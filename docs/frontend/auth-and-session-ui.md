# Autenticação e Sessão — UI/UX — Velya Platform

**Status:** Ativo
**Última atualização:** 2026-04-09
**Biblioteca:** Auth.js v5 (next-auth beta)

---

## 1. Visão Geral

A autenticação na plataforma Velya é crítica: equipes hospitalares precisam de acesso rápido e seguro, com sessões resilientes a interrupções de rede, troca de turnos, e múltiplos dispositivos. Este documento define a integração com Auth.js e os padrões de UX de sessão.

### 1.1 Princípios

1. **Acesso rápido**: Login em menos de 10 segundos
2. **Segurança contextual**: Nível de autenticação proporcional à ação
3. **Sessão resiliente**: Não perde sessão por instabilidade de rede
4. **Transparência**: Usuário sempre sabe quem está logado e com quais permissões
5. **Logoff seguro**: Sessão encerrada corretamente, sem dados residuais
6. **Multi-dispositivo**: Mesmo usuário em diferentes devices sem conflito

---

## 2. Configuração Auth.js

### 2.1 Setup Base

```tsx
// lib/auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Credentials({
      name: 'Velya',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        const validated = loginSchema.safeParse(credentials)
        if (!validated.success) return null

        const response = await fetch(`${process.env.AUTH_API_URL}/authenticate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validated.data),
        })

        if (!response.ok) return null

        const user = await response.json()
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          unit: user.unit,
          avatar: user.avatar,
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 12 * 60 * 60, // 12 horas (turno hospitalar)
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.permissions = user.permissions
        token.unit = user.unit
      }
      return token
    },

    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      session.user.permissions = token.permissions as string[]
      session.user.unit = token.unit as string
      return session
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
})
```

### 2.2 Tipagem da Sessão

```tsx
// types/next-auth.d.ts
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      permissions: string[]
      unit: string
    } & DefaultSession['user']
  }

  interface User {
    role: string
    permissions: string[]
    unit: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    permissions: string[]
    unit: string
  }
}
```

---

## 3. Guardas por Rota

### 3.1 Middleware (Edge)

```tsx
// middleware.ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Mapa de rotas protegidas por permissão
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/admin': ['admin.access'],
  '/admin/users': ['admin.users.manage'],
  '/admin/roles': ['admin.roles.manage'],
  '/admin/audit': ['admin.audit.view'],
  '/medication': ['medication.view'],
  '/medication/prescriptions': ['medication.prescribe'],
  '/command-center': ['command-center.access'],
  '/workforce': ['workforce.view'],
  '/agents': ['agents.view'],
  '/observability': ['observability.access'],
}

export default auth((req) => {
  const { nextUrl } = req
  const session = req.auth

  // Verificar permissão de rota
  for (const [route, permissions] of Object.entries(ROUTE_PERMISSIONS)) {
    if (nextUrl.pathname.startsWith(route)) {
      const hasPermission = permissions.some((p) =>
        session?.user.permissions.includes(p)
      )
      if (!hasPermission) {
        return NextResponse.redirect(new URL('/access-denied', nextUrl))
      }
    }
  }

  return NextResponse.next()
})
```

### 3.2 Guarda por Componente

```tsx
// components/auth/permission-guard.tsx
'use client'

import { useSession } from 'next-auth/react'

interface PermissionGuardProps {
  permission: string | string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGuard({
  permission,
  children,
  fallback = null,
}: PermissionGuardProps) {
  const { data: session } = useSession()

  if (!session) return null

  const permissions = Array.isArray(permission) ? permission : [permission]
  const hasPermission = permissions.some((p) =>
    session.user.permissions.includes(p)
  )

  if (!hasPermission) return <>{fallback}</>

  return <>{children}</>
}

// Uso
<PermissionGuard permission="medication.administer">
  <Button onClick={handleAdminister}>Administrar medicação</Button>
</PermissionGuard>
```

### 3.3 Guarda por Ação (Hook)

```tsx
// hooks/use-permission.ts
'use client'

import { useSession } from 'next-auth/react'

export function usePermission(permission: string | string[]): boolean {
  const { data: session } = useSession()

  if (!session) return false

  const permissions = Array.isArray(permission) ? permission : [permission]
  return permissions.some((p) => session.user.permissions.includes(p))
}

export function useRole(role: string | string[]): boolean {
  const { data: session } = useSession()

  if (!session) return false

  const roles = Array.isArray(role) ? role : [role]
  return roles.includes(session.user.role)
}

// Uso
function MedicationActions() {
  const canAdminister = usePermission('medication.administer')
  const canPrescribe = usePermission('medication.prescribe')

  return (
    <div>
      {canAdminister && <Button>Administrar</Button>}
      {canPrescribe && <Button>Prescrever</Button>}
    </div>
  )
}
```

---

## 4. Session Awareness

### 4.1 Indicador de Sessão no Topbar

```tsx
function SessionIndicator() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <Skeleton className="h-8 w-32" />
  }

  if (!session) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={session.user.image || undefined} />
            <AvatarFallback>{getInitials(session.user.name)}</AvatarFallback>
          </Avatar>
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium leading-none">{session.user.name}</p>
            <p className="text-xs text-muted-foreground">{getRoleLabel(session.user.role)}</p>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="font-medium">{session.user.name}</p>
          <p className="text-xs text-muted-foreground">{session.user.email}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Unidade: {session.user.unit}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### 4.2 Expiração de Sessão

```tsx
function SessionExpiryWatcher() {
  const { data: session, update } = useSession()
  const [showWarning, setShowWarning] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!session) return

    const expiresAt = new Date(session.expires).getTime()
    const warningThreshold = 5 * 60 * 1000 // 5 minutos antes

    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = expiresAt - now

      if (remaining <= 0) {
        // Sessão expirada — redirecionar
        signOut({ callbackUrl: '/login?reason=expired' })
        return
      }

      if (remaining <= warningThreshold) {
        setShowWarning(true)
        setTimeLeft(Math.ceil(remaining / 1000))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [session])

  if (!showWarning) return null

  return (
    <Dialog open={showWarning}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sessão expirando</DialogTitle>
          <DialogDescription>
            Sua sessão expira em {formatSeconds(timeLeft!)}. Deseja continuar conectado?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => signOut({ callbackUrl: '/login' })}>
            Sair
          </Button>
          <Button onClick={async () => {
            await update() // Renova a sessão
            setShowWarning(false)
          }}>
            Continuar conectado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 5. Fluxos de Reautenticação

### 5.1 Quando Reautenticar

| Cenário | Motivo |
|---|---|
| Administrar medicação controlada | Ação de alto risco, confirmar identidade |
| Alterar permissões de outro usuário | Ação administrativa sensível |
| Acessar dados de paciente VIP | Acesso restrito, auditado |
| Break-glass (acesso emergencial) | Override de permissão, requer justificativa |
| Inatividade > 30 minutos | Tela pode estar desatendida |
| Exportar dados sensíveis | Prevenção de vazamento |

### 5.2 Dialog de Reautenticação

```tsx
function ReauthDialog({
  open,
  onAuthenticated,
  reason,
}: ReauthDialogProps) {
  const { data: session } = useSession()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleReauth() {
    setIsLoading(true)
    setError(null)

    try {
      const result = await fetch('/api/auth/reauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session?.user.email,
          password,
        }),
      })

      if (result.ok) {
        onAuthenticated()
        setPassword('')
      } else {
        setError('Senha incorreta')
      }
    } catch {
      setError('Erro ao verificar credenciais')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Confirmação de identidade
          </DialogTitle>
          <DialogDescription>
            {reason || 'Esta ação requer confirmação de identidade.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
            <Avatar>
              <AvatarFallback>{getInitials(session?.user.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{session?.user.name}</p>
              <p className="text-xs text-muted-foreground">{session?.user.email}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reauth-password">Senha</Label>
            <Input
              id="reauth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleReauth()}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onAuthenticated()}>
            Cancelar
          </Button>
          <Button onClick={handleReauth} disabled={isLoading || !password}>
            {isLoading ? 'Verificando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### 5.3 Hook de Reautenticação

```tsx
function useReauth() {
  const [showReauth, setShowReauth] = useState(false)
  const resolveRef = useRef<(() => void) | null>(null)

  async function requireReauth(reason?: string): Promise<boolean> {
    return new Promise((resolve) => {
      resolveRef.current = () => resolve(true)
      setShowReauth(true)
    })
  }

  function onAuthenticated() {
    resolveRef.current?.()
    setShowReauth(false)
  }

  return { showReauth, requireReauth, onAuthenticated }
}

// Uso
function MedicationAdminButton({ medication }: Props) {
  const { showReauth, requireReauth, onAuthenticated } = useReauth()

  async function handleAdmin() {
    const confirmed = await requireReauth('Administração de medicação requer confirmação')
    if (confirmed) {
      await administerMedication(medication.id)
    }
  }

  return (
    <>
      <Button onClick={handleAdmin}>Administrar</Button>
      <ReauthDialog
        open={showReauth}
        onAuthenticated={onAuthenticated}
        reason="Administração de medicação requer confirmação de identidade"
      />
    </>
  )
}
```

---

## 6. Break-Glass UX

### 6.1 Conceito

Break-glass é um mecanismo de acesso emergencial que permite overriding temporário de permissões quando necessário para atendimento ao paciente. O uso é auditado e requer justificativa.

### 6.2 Componente Break-Glass

```tsx
function BreakGlassDialog({
  open,
  onOpenChange,
  resource,
  onActivate,
}: BreakGlassProps) {
  const [reason, setReason] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    if (open && countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [open, countdown])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-destructive">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Acesso Emergencial (Break-Glass)
          </DialogTitle>
          <DialogDescription>
            Você está solicitando acesso emergencial a recurso protegido.
            Este acesso será registrado em auditoria e revisado.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção</AlertTitle>
          <AlertDescription>
            Recurso: <strong>{resource}</strong>
            <br />
            Este acesso viola a política de permissões normal e será
            reportado ao gestor de segurança.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Justificativa clínica *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva a emergência que justifica este acesso"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="acknowledge"
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(!!v)}
            />
            <Label htmlFor="acknowledge" className="text-sm">
              Confirmo que este acesso é necessário para atendimento
              emergencial ao paciente e que será auditado.
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => onActivate(reason)}
            disabled={!acknowledged || !reason.trim() || countdown > 0}
          >
            {countdown > 0
              ? `Aguarde ${countdown}s`
              : 'Ativar acesso emergencial'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 7. Troca de Usuário

### 7.1 Cenário

Em postos de enfermagem compartilhados, vários profissionais usam o mesmo dispositivo. A troca de usuário deve ser rápida e segura.

### 7.2 Fluxo de Troca

```
Usuário A logado
  └── Clica "Trocar usuário"
       └── Lock screen aparece (dados de A não visíveis)
            └── Usuário B faz login
                 └── Sessão de A é encerrada
                      └── Sessão de B inicia
```

### 7.3 Componente de Troca

```tsx
function SwitchUserButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await signOut({ redirect: false })
        window.location.href = '/login?mode=switch'
      }}
    >
      <UserSwitch className="mr-2 h-4 w-4" />
      Trocar usuário
    </Button>
  )
}
```

---

## 8. Logoff Automático

### 8.1 Regras de Inatividade

| Contexto | Timeout | Ação |
|---|---|---|
| Desktop (posto de enfermagem) | 30 minutos | Lock screen |
| Mobile (pessoal) | 15 minutos | Lock screen |
| Tela de medicação aberta | 10 minutos | Lock screen + alerta |
| Após break-glass | 5 minutos | Logoff completo |

### 8.2 Detector de Inatividade

```tsx
function InactivityDetector({
  timeout = 30 * 60 * 1000, // 30 min default
  onInactive,
}: InactivityProps) {
  useEffect(() => {
    let timer: NodeJS.Timeout

    function resetTimer() {
      clearTimeout(timer)
      timer = setTimeout(onInactive, timeout)
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach((event) => document.addEventListener(event, resetTimer))
    resetTimer()

    return () => {
      clearTimeout(timer)
      events.forEach((event) => document.removeEventListener(event, resetTimer))
    }
  }, [timeout, onInactive])

  return null
}
```

---

## 9. Lock Screen

### 9.1 Componente Lock Screen

```tsx
function LockScreen({ userName, onUnlock }: LockScreenProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleUnlock() {
    try {
      const result = await fetch('/api/auth/reauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (result.ok) {
        onUnlock()
      } else {
        setError('Senha incorreta')
        setPassword('')
      }
    } catch {
      setError('Erro ao verificar credenciais')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 text-center">
        <Lock className="mx-auto h-12 w-12 text-muted-foreground" />
        <div>
          <h2 className="text-xl font-semibold">Tela bloqueada</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sessão de {userName} — insira sua senha para continuar
          </p>
        </div>

        <div className="space-y-2">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            placeholder="Senha"
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={handleUnlock} disabled={!password}>
            Desbloquear
          </Button>
          <Button
            variant="link"
            className="text-sm"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            Entrar com outro usuário
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {new Date().toLocaleString('pt-BR')}
        </p>
      </div>
    </div>
  )
}
```

---

## 10. Mobile Session Handling

### 10.1 Desafios Mobile

1. **Background/foreground**: App pode ser suspensa pelo OS e voltar
2. **Rede instável**: Token refresh pode falhar
3. **Múltiplas tabs**: Sessão deve sincronizar entre tabs do PWA
4. **Storage limitado**: Cookies preferidos sobre localStorage

### 10.2 Retorno do Background

```tsx
function BackgroundResumeHandler() {
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        // Verifica se sessão ainda é válida ao voltar
        fetch('/api/auth/session')
          .then((res) => {
            if (res.status === 401) {
              signOut({ callbackUrl: '/login?reason=expired' })
            }
          })
          .catch(() => {
            // Offline — não faz nada, mostra banner degradado
          })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return null
}
```

### 10.3 Token Refresh Resiliente

```tsx
// No callback JWT do Auth.js
async jwt({ token }) {
  const now = Date.now()
  const expiresAt = (token.expiresAt as number) || 0

  // Token ainda válido
  if (now < expiresAt - 5 * 60 * 1000) {
    return token
  }

  // Tentar refresh
  try {
    const response = await fetch(`${process.env.AUTH_API_URL}/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.refreshToken}` },
    })

    if (response.ok) {
      const refreshed = await response.json()
      return {
        ...token,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.expiresAt,
      }
    }
  } catch {
    // Refresh falhou — token expirado forçará re-login
  }

  return { ...token, error: 'RefreshTokenExpired' }
}
```

### 10.4 Sincronização Cross-Tab

```tsx
function CrossTabSessionSync() {
  useEffect(() => {
    const channel = new BroadcastChannel('velya-session')

    channel.addEventListener('message', (event) => {
      if (event.data.type === 'LOGOUT') {
        signOut({ callbackUrl: '/login' })
      }
      if (event.data.type === 'LOGIN') {
        window.location.reload()
      }
    })

    return () => channel.close()
  }, [])

  return null
}
```

---

## 11. Páginas de Autenticação

### 11.1 Login Page

```tsx
export default function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string; reason?: string }
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <img src="/logo.svg" alt="Velya" className="mx-auto h-12 mb-4" />
          <CardTitle>Entrar na plataforma</CardTitle>
          {searchParams.reason === 'expired' && (
            <Alert variant="warning" className="mt-2">
              <Clock className="h-4 w-4" />
              <AlertDescription>Sua sessão expirou. Faça login novamente.</AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent>
          <LoginForm callbackUrl={searchParams.callbackUrl} />
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="link" asChild>
            <Link href="/forgot-password">Esqueci minha senha</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
```

### 11.2 Access Denied Page

```tsx
export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <ShieldOff className="h-16 w-16 text-destructive/50 mb-4" />
      <h1 className="text-2xl font-bold">Acesso negado</h1>
      <p className="text-muted-foreground mt-2 max-w-md">
        Você não tem permissão para acessar este recurso.
        Contate seu administrador se acredita que isto é um erro.
      </p>
      <div className="flex gap-2 mt-6">
        <Button variant="outline" asChild>
          <Link href="/dashboard">Voltar ao dashboard</Link>
        </Button>
        <Button variant="outline" onClick={() => window.history.back()}>
          Voltar
        </Button>
      </div>
    </div>
  )
}
```

---

## 12. Hierarquia de Roles

### 12.1 Roles Hospitalares

| Role | Descrição | Permissões Chave |
|---|---|---|
| `admin` | Administrador do sistema | Tudo |
| `medical-director` | Diretor médico | Todas clínicas + gestão |
| `physician` | Médico | Prescrever, diagnosticar, alta |
| `nurse-lead` | Enfermeiro líder | Gestão de equipe, handoff |
| `nurse` | Enfermeiro | Administrar medicação, registrar |
| `nursing-tech` | Técnico de enfermagem | Registrar vitais, dor, chamadas |
| `pharmacist` | Farmacêutico | Validar prescrições |
| `receptionist` | Recepcionista | Admissão, agenda |
| `observer` | Observador (auditor) | Somente leitura |

### 12.2 Verificação de Hierarquia

```tsx
const ROLE_HIERARCHY: Record<string, number> = {
  'admin': 100,
  'medical-director': 90,
  'physician': 80,
  'nurse-lead': 70,
  'nurse': 60,
  'nursing-tech': 50,
  'pharmacist': 60,
  'receptionist': 30,
  'observer': 10,
}

function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0)
}
```

---

## 13. Métricas de Autenticação

| Métrica | Monitorar |
|---|---|
| Login success rate | > 99% |
| Login latency (P95) | < 2s |
| Session expiry rate | Baseline tracking |
| Break-glass activations | Alert if > 0 |
| Failed login attempts | Alert if > 5 per user/hour |
| Concurrent sessions per user | Track |
| Reauth requests | Track by action type |

---

## 14. Referências

- [Auth.js Documentation](https://authjs.dev)
- [Next.js Authentication](https://nextjs.org/docs/app/building-your-application/authentication)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
