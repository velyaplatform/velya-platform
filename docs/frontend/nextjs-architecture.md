# Arquitetura Next.js — Velya Platform

**Status:** Ativo
**Última atualização:** 2026-04-09
**Aplica-se a:** `apps/web`

---

## 1. Visão Geral

A aplicação web Velya utiliza Next.js 15+ com App Router como framework principal. Esta documentação define a arquitetura de roteamento, composição de componentes, middleware, tratamento de erros e padrões de carregamento.

### 1.1 Princípios Arquiteturais

1. **Server-first**: Server Components por padrão, Client Components apenas quando necessário
2. **Streaming progressivo**: Suspense boundaries para carregamento incremental
3. **Domínios isolados**: Cada domínio hospitalar tem sua árvore de rotas
4. **Segurança no edge**: Middleware verifica autenticação antes do rendering
5. **Layouts compartilhados**: Navegação e contexto persistem entre rotas do mesmo domínio

---

## 2. App Router — Estrutura de Rotas por Domínio

### 2.1 Árvore de Rotas Principal

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   ├── forgot-password/
│   │   └── page.tsx
│   ├── reset-password/
│   │   └── page.tsx
│   └── layout.tsx                  # Layout sem sidebar/nav
│
├── (platform)/
│   ├── layout.tsx                  # Layout com sidebar, topbar, session
│   ├── dashboard/
│   │   ├── page.tsx                # Dashboard principal
│   │   ├── loading.tsx
│   │   └── error.tsx
│   │
│   ├── patients/
│   │   ├── page.tsx                # Lista de pacientes
│   │   ├── [patientId]/
│   │   │   ├── page.tsx            # Visão geral do paciente
│   │   │   ├── journey/
│   │   │   │   └── page.tsx        # Jornada do paciente
│   │   │   ├── medications/
│   │   │   │   └── page.tsx        # Medicações do paciente
│   │   │   ├── pain/
│   │   │   │   └── page.tsx        # Registro de dor
│   │   │   ├── calls/
│   │   │   │   └── page.tsx        # Chamadas do paciente
│   │   │   └── layout.tsx          # Tabs do paciente
│   │   ├── loading.tsx
│   │   └── error.tsx
│   │
│   ├── medication/
│   │   ├── page.tsx                # Painel de medicação
│   │   ├── prescriptions/
│   │   │   └── page.tsx
│   │   ├── administration/
│   │   │   └── page.tsx
│   │   └── loading.tsx
│   │
│   ├── calls/
│   │   ├── page.tsx                # Painel de chamadas
│   │   ├── active/
│   │   │   └── page.tsx
│   │   ├── history/
│   │   │   └── page.tsx
│   │   └── loading.tsx
│   │
│   ├── handoff/
│   │   ├── page.tsx                # Passagem de plantão
│   │   ├── new/
│   │   │   └── page.tsx
│   │   ├── [handoffId]/
│   │   │   └── page.tsx
│   │   └── loading.tsx
│   │
│   ├── workforce/
│   │   ├── page.tsx                # Gestão de equipe
│   │   ├── schedule/
│   │   │   └── page.tsx
│   │   ├── teams/
│   │   │   └── page.tsx
│   │   └── loading.tsx
│   │
│   ├── command-center/
│   │   ├── page.tsx                # Centro de comando
│   │   ├── overview/
│   │   │   └── page.tsx
│   │   ├── alerts/
│   │   │   └── page.tsx
│   │   └── loading.tsx
│   │
│   ├── agents/
│   │   ├── page.tsx                # Agentes IA
│   │   ├── [agentId]/
│   │   │   └── page.tsx
│   │   └── loading.tsx
│   │
│   ├── admin/
│   │   ├── page.tsx
│   │   ├── users/
│   │   │   └── page.tsx
│   │   ├── roles/
│   │   │   └── page.tsx
│   │   ├── audit/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   │
│   └── observability/
│       ├── page.tsx
│       ├── metrics/
│       │   └── page.tsx
│       ├── logs/
│       │   └── page.tsx
│       └── traces/
│           └── page.tsx
│
├── api/
│   ├── auth/
│   │   └── [...nextauth]/
│   │       └── route.ts            # Auth.js handler
│   ├── health/
│   │   └── route.ts                # Health check
│   └── bff/
│       ├── patients/
│       │   └── route.ts
│       ├── medications/
│       │   └── route.ts
│       └── dashboard/
│           └── route.ts
│
├── layout.tsx                       # Root layout
├── not-found.tsx                    # 404 global
├── error.tsx                        # Error boundary global
├── global-error.tsx                 # Root error boundary
└── loading.tsx                      # Loading global
```

### 2.2 Route Groups

Route groups `(auth)` e `(platform)` não afetam a URL mas permitem layouts diferentes:

- **`(auth)`**: Layout limpo, sem navegação lateral, centrado
- **`(platform)`**: Layout completo com sidebar, topbar, breadcrumbs, session provider

---

## 3. Server Components vs Client Components

### 3.1 Regra de Decisão

```
                    ┌─────────────────────┐
                    │  O componente       │
                    │  precisa de:        │
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         useState?      onClick?      browser API?
         useEffect?     onChange?     localStorage?
         useContext?    onSubmit?     window/document?
              │              │              │
              ▼              ▼              ▼
         ┌────────┐    ┌────────┐    ┌────────┐
         │  SIM   │    │  SIM   │    │  SIM   │
         └───┬────┘    └───┬────┘    └───┬────┘
             │             │             │
             └──────┬──────┘─────────────┘
                    │
            ┌───────▼───────┐
            │ 'use client'  │
            └───────────────┘
```

### 3.2 Quando Usar Server Components

- Layouts e shells de página
- Busca inicial de dados (fetch direto no servidor)
- Componentes de exibição pura (cards, badges, texto)
- Metadados e SEO
- Acesso direto a banco/API interno (via BFF)
- Componentes que não precisam de interatividade

### 3.3 Quando Usar Client Components

- Formulários interativos (React Hook Form)
- Tabelas com sorting/filtering (TanStack Table)
- Gráficos interativos (Recharts)
- Componentes com estado local (modals, dropdowns, tabs)
- Real-time updates (WebSocket listeners)
- Componentes que usam hooks do browser

### 3.4 Padrão de Composição

```tsx
// app/(platform)/patients/page.tsx — Server Component
import { getPatients } from '@/services/patients'
import { PatientTable } from '@/features/patients/components/patient-table'

export default async function PatientsPage() {
  const patients = await getPatients()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pacientes</h1>
      {/* Client Component recebe dados do Server Component */}
      <PatientTable initialData={patients} />
    </div>
  )
}
```

```tsx
// features/patients/components/patient-table.tsx — Client Component
'use client'

import { useQuery } from '@tanstack/react-query'
import { DataTable } from '@/components/ui/data-table'
import { columns } from './columns'

interface Props {
  initialData: Patient[]
}

export function PatientTable({ initialData }: Props) {
  const { data } = useQuery({
    queryKey: ['patients'],
    queryFn: fetchPatients,
    initialData,
  })

  return <DataTable columns={columns} data={data} />
}
```

---

## 4. Layouts

### 4.1 Root Layout

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/providers/theme-provider'
import { QueryProvider } from '@/providers/query-provider'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Velya Platform',
  description: 'Plataforma hospitalar de jornada do paciente',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <QueryProvider>
            {children}
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### 4.2 Platform Layout

```tsx
// app/(platform)/layout.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { SessionProvider } from '@/providers/session-provider'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <SessionProvider session={session}>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  )
}
```

### 4.3 Layout de Paciente (Tabs)

```tsx
// app/(platform)/patients/[patientId]/layout.tsx
import { getPatient } from '@/services/patients'
import { PatientHeader } from '@/features/patients/components/patient-header'
import { PatientTabs } from '@/features/patients/components/patient-tabs'

export default async function PatientLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { patientId: string }
}) {
  const patient = await getPatient(params.patientId)

  return (
    <div className="space-y-6">
      <PatientHeader patient={patient} />
      <PatientTabs patientId={params.patientId} />
      {children}
    </div>
  )
}
```

---

## 5. Loading States

### 5.1 Convenção de Loading

Cada rota pode ter seu `loading.tsx` que exibe um skeleton enquanto o Server Component carrega:

```tsx
// app/(platform)/patients/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function PatientsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
```

### 5.2 Streaming com Suspense

Para carregamento granular dentro de uma página:

```tsx
// app/(platform)/dashboard/page.tsx
import { Suspense } from 'react'
import { DashboardMetrics } from '@/features/dashboard/components/metrics'
import { RecentCalls } from '@/features/dashboard/components/recent-calls'
import { PatientAlerts } from '@/features/dashboard/components/patient-alerts'
import { MetricsSkeleton, CallsSkeleton, AlertsSkeleton } from './skeletons'

export default function DashboardPage() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Suspense fallback={<MetricsSkeleton />}>
        <DashboardMetrics />
      </Suspense>
      <Suspense fallback={<CallsSkeleton />}>
        <RecentCalls />
      </Suspense>
      <Suspense fallback={<AlertsSkeleton />}>
        <PatientAlerts />
      </Suspense>
    </div>
  )
}
```

---

## 6. Error Boundaries

### 6.1 Error Boundary por Rota

```tsx
// app/(platform)/patients/error.tsx
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function PatientsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log para observabilidade
    console.error('Patients page error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold">Erro ao carregar pacientes</h2>
      <p className="text-muted-foreground">
        Ocorreu um erro inesperado. Tente novamente.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  )
}
```

### 6.2 Global Error Boundary

```tsx
// app/global-error.tsx
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="pt-BR">
      <body className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Erro crítico</h2>
          <p>A plataforma encontrou um erro inesperado.</p>
          <button onClick={reset} className="px-4 py-2 bg-primary text-white rounded">
            Recarregar
          </button>
        </div>
      </body>
    </html>
  )
}
```

### 6.3 Hierarquia de Error Boundaries

```
global-error.tsx          (root — fallback final)
  └── (platform)/error.tsx    (layout level)
       ├── patients/error.tsx     (feature level)
       ├── medication/error.tsx
       ├── calls/error.tsx
       └── dashboard/error.tsx
```

Cada nível captura erros do seu escopo. Erros não capturados propagam para o nível superior.

---

## 7. Middleware

### 7.1 Middleware de Autenticação e Segurança

```tsx
// src/middleware.ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password']
const API_AUTH_PREFIX = '/api/auth'

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  // API auth routes — sempre permitidas
  if (nextUrl.pathname.startsWith(API_AUTH_PREFIX)) {
    return NextResponse.next()
  }

  // Rotas públicas
  if (PUBLIC_ROUTES.includes(nextUrl.pathname)) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl))
    }
    return NextResponse.next()
  }

  // Rotas protegidas
  if (!isLoggedIn) {
    const callbackUrl = encodeURIComponent(nextUrl.pathname + nextUrl.search)
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl))
  }

  // Headers de segurança
  const response = NextResponse.next()
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
```

### 7.2 Responsabilidades do Middleware

| Responsabilidade | Implementação |
|---|---|
| Autenticação | Verifica sessão Auth.js |
| Redirecionamento | Login se não autenticado, dashboard se já autenticado |
| Headers de segurança | X-Frame-Options, CSP, etc. |
| Locale detection | Detecta idioma do browser (futuro) |
| Rate limiting headers | Passa informações para API routes |
| Request ID | Gera ID único para tracing |

---

## 8. API Routes (BFF)

### 8.1 Padrão BFF (Backend for Frontend)

API routes servem como camada de agregação entre o frontend e os microserviços do backend:

```tsx
// app/api/bff/dashboard/route.ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Agrega dados de múltiplos serviços
  const [metrics, alerts, recentCalls] = await Promise.all([
    fetch(`${process.env.API_URL}/metrics`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    }).then(r => r.json()),
    fetch(`${process.env.API_URL}/alerts/active`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    }).then(r => r.json()),
    fetch(`${process.env.API_URL}/calls/recent`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    }).then(r => r.json()),
  ])

  return NextResponse.json({ metrics, alerts, recentCalls })
}
```

### 8.2 Quando Usar API Routes vs Server Components

| Cenário | Usar |
|---|---|
| Dados para renderização inicial | Server Component com fetch direto |
| Dados para Client Component com cache | TanStack Query → API Route (BFF) |
| Mutations (POST/PUT/DELETE) | API Route ou Server Action |
| Agregação de múltiplos serviços | API Route (BFF) |
| WebSocket/SSE proxy | API Route |
| Health check | API Route |

---

## 9. Server Actions

### 9.1 Padrão para Ações Seguras

```tsx
// features/patients/actions/update-patient.ts
'use server'

import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { patientUpdateSchema } from '@/schemas/patient'
import { auditLog } from '@/lib/audit'

export async function updatePatient(formData: FormData) {
  const session = await auth()
  if (!session) throw new Error('Não autenticado')

  const raw = Object.fromEntries(formData)
  const validated = patientUpdateSchema.safeParse(raw)

  if (!validated.success) {
    return { error: validated.error.flatten() }
  }

  try {
    const result = await fetch(`${process.env.API_URL}/patients/${validated.data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(validated.data),
    })

    if (!result.ok) {
      return { error: 'Falha ao atualizar paciente' }
    }

    await auditLog({
      action: 'patient.update',
      userId: session.user.id,
      resourceId: validated.data.id,
      details: validated.data,
    })

    revalidatePath(`/patients/${validated.data.id}`)
    return { success: true }
  } catch (error) {
    return { error: 'Erro de comunicação com o servidor' }
  }
}
```

---

## 10. Configuração Next.js

### 10.1 next.config.ts

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Output standalone para Docker
  output: 'standalone',

  // Domínios de imagem permitidos
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.velya.health' },
    ],
  },

  // Headers de segurança
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ],
    },
  ],

  // Redirects
  redirects: async () => [
    { source: '/', destination: '/dashboard', permanent: false },
  ],

  // Experimental features
  experimental: {
    typedRoutes: true,
    serverActions: { bodySizeLimit: '2mb' },
  },
}

export default nextConfig
```

---

## 11. Padrões de Performance

### 11.1 Parallel Routes (Futuro)

Para dashboards com seções independentes:

```
app/(platform)/dashboard/
├── @metrics/
│   └── page.tsx
├── @alerts/
│   └── page.tsx
├── @activity/
│   └── page.tsx
├── layout.tsx
└── page.tsx
```

### 11.2 Intercepting Routes

Para modals que preservam o contexto da lista:

```
app/(platform)/patients/
├── page.tsx                    # Lista de pacientes
├── [patientId]/
│   └── page.tsx               # Página completa do paciente
└── (.)patient-quick-view/
    └── [patientId]/
        └── page.tsx           # Modal de visualização rápida
```

### 11.3 Prefetching

Next.js prefetches links visíveis automaticamente. Para controle adicional:

```tsx
import Link from 'next/link'

// Prefetch automático (default)
<Link href="/patients">Pacientes</Link>

// Sem prefetch (links menos frequentes)
<Link href="/admin/audit" prefetch={false}>Auditoria</Link>
```

---

## 12. Convenções de Arquivo

| Arquivo | Propósito |
|---|---|
| `page.tsx` | Componente da rota (UI) |
| `layout.tsx` | Layout compartilhado (persiste entre navegações) |
| `loading.tsx` | Skeleton/spinner enquanto carrega |
| `error.tsx` | Error boundary da rota |
| `not-found.tsx` | 404 da rota |
| `template.tsx` | Layout que re-renderiza (raro) |
| `default.tsx` | Fallback para parallel routes |
| `route.ts` | API route handler |
| `opengraph-image.tsx` | OG image generation |

---

## 13. Referências

- [Next.js App Router — Documentação Oficial](https://nextjs.org/docs/app)
- [React Server Components RFC](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md)
- [Patterns for App Router](https://nextjs.org/docs/app/building-your-application)
