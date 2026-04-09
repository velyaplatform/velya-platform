# PWA e Modo Degradado — Velya Platform

**Status:** Ativo
**Última atualização:** 2026-04-09

---

## 1. Visão Geral

A plataforma Velya opera como Progressive Web App (PWA) para oferecer experiência app-like em dispositivos móveis hospitalares. O modo degradado garante que falhas de rede sejam comunicadas explicitamente, nunca silenciosas.

### 1.1 Princípios

1. **Instalável**: Profissionais podem instalar a PWA na home screen
2. **Standalone**: Executa sem barra do browser, como app nativo
3. **Degradação explícita**: Nunca falha silenciosa — o operador sabe que algo está errado
4. **Cache estratégico**: Apenas recursos estáticos e dados não-sensíveis
5. **Online-first**: Não tenta ser offline-first — dados hospitalares exigem fonte de verdade
6. **Retorno resiliente**: Ao voltar do background, verifica estado e re-sincroniza

---

## 2. PWA Manifest

### 2.1 Configuração

```json
// public/manifest.json
{
  "name": "Velya Platform",
  "short_name": "Velya",
  "description": "Plataforma hospitalar de jornada do paciente",
  "start_url": "/dashboard",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0a0f1a",
  "theme_color": "#3b82f6",
  "scope": "/",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-apple-touch.png",
      "sizes": "180x180",
      "type": "image/png"
    }
  ],
  "categories": ["medical", "health", "productivity"],
  "screenshots": [
    {
      "src": "/screenshots/dashboard.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Dashboard principal"
    },
    {
      "src": "/screenshots/mobile-patients.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Lista de pacientes"
    }
  ]
}
```

### 2.2 Meta Tags

```tsx
// app/layout.tsx
export const metadata = {
  title: 'Velya Platform',
  description: 'Plataforma hospitalar de jornada do paciente',
  manifest: '/manifest.json',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0f1a' },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Velya',
    startupImage: [
      {
        url: '/splash/splash-2048x2732.png',
        media: '(device-width: 1024px) and (device-height: 1366px)',
      },
      {
        url: '/splash/splash-1170x2532.png',
        media: '(device-width: 390px) and (device-height: 844px)',
      },
    ],
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
}
```

---

## 3. Standalone Mode

### 3.1 Detecção de Modo

```tsx
function useStandaloneMode(): boolean {
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true

    setIsStandalone(standalone)
  }, [])

  return isStandalone
}
```

### 3.2 Adaptações para Standalone

| Aspecto | Browser Tab | Standalone (PWA) |
|---|---|---|
| Navegação | Browser back/forward | Custom back button |
| URL bar | Visível | Oculta |
| Status bar | Não controlável | theme-color + status-bar-style |
| Safe areas | Não relevante | Respeitar env(safe-area-*) |
| Pull-to-refresh | Browser nativo | Custom ou desabilitado |
| Splash screen | Nenhum | Splash configurado |

### 3.3 Custom Back Navigation

```tsx
function StandaloneBackButton() {
  const isStandalone = useStandaloneMode()
  const router = useRouter()

  if (!isStandalone) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => router.back()}
      className="md:hidden"
    >
      <ChevronLeft className="h-5 w-5" />
    </Button>
  )
}
```

---

## 4. Estratégia de Cache

### 4.1 O que Cachear vs Não Cachear

| Recurso | Cachear? | Estratégia | Motivo |
|---|---|---|---|
| HTML de rotas | Sim | Network-first | Atualizar sempre, fallback se offline |
| JS bundles | Sim | Cache-first | Versionados, imutáveis |
| CSS | Sim | Cache-first | Versionados, imutáveis |
| Fontes | Sim | Cache-first | Raramente mudam |
| Imagens estáticas | Sim | Cache-first | Logo, ícones |
| Dados de paciente | **Não** | Network-only | Dados sensíveis, sempre frescos |
| Dados de medicação | **Não** | Network-only | Críticos, tempo-sensíveis |
| Dados de chamada | **Não** | Network-only | Real-time |
| Dados de dashboard | Parcial | Network-first, stale ok | Métricas podem ter delay |
| Configuração do usuário | Sim | Network-first | Atualizar quando possível |

### 4.2 Service Worker (Mínimo)

```tsx
// Registrar service worker para PWA
// NOTA: Service worker limitado — não para offline completo

// next.config.ts
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      // JS e CSS estáticos
      urlPattern: /^https:\/\/.*\/_next\/static\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      // Fontes
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    {
      // API routes — nunca cachear
      urlPattern: /^https:\/\/.*\/api\/.*/,
      handler: 'NetworkOnly',
    },
    {
      // Páginas — network first
      urlPattern: /^https:\/\/.*\/(?!api\/).*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
        networkTimeoutSeconds: 5,
      },
    },
  ],
})
```

### 4.3 Limpeza de Cache

```tsx
// Limpar cache ao fazer logout
async function clearAppCache() {
  if ('caches' in window) {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames.map((name) => caches.delete(name))
    )
  }

  // Limpar localStorage de dados sensíveis
  const keysToKeep = ['theme', 'locale']
  Object.keys(localStorage).forEach((key) => {
    if (!keysToKeep.includes(key)) {
      localStorage.removeItem(key)
    }
  })
}
```

---

## 5. Modo Degradado Explícito

### 5.1 Conceito

O modo degradado NÃO é modo offline. É o estado em que a aplicação detecta problemas de conectividade ou disponibilidade de serviços e comunica isso explicitamente ao operador.

### 5.2 Níveis de Degradação

| Nível | Condição | Comportamento |
|---|---|---|
| **Normal** | Rede estável, APIs respondendo | Operação completa |
| **Lento** | Latência > 3s | Banner amarelo, dados podem estar desatualizados |
| **Parcial** | Algumas APIs falhando | Banner laranja, features afetadas listadas |
| **Offline** | Sem conexão | Banner vermelho, somente dados cacheados, ações bloqueadas |
| **Recuperando** | Voltando do offline | Banner azul, sincronizando dados |

### 5.3 Detecção de Estado de Rede

```tsx
// providers/degraded-provider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type NetworkStatus = 'online' | 'slow' | 'partial' | 'offline' | 'recovering'

interface DegradedContextValue {
  status: NetworkStatus
  lastSync: Date | null
  affectedServices: string[]
  isActionAllowed: (action: string) => boolean
}

const DegradedContext = createContext<DegradedContextValue>({
  status: 'online',
  lastSync: null,
  affectedServices: [],
  isActionAllowed: () => true,
})

export function DegradedProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<NetworkStatus>('online')
  const [lastSync, setLastSync] = useState<Date | null>(new Date())
  const [affectedServices, setAffectedServices] = useState<string[]>([])

  useEffect(() => {
    // Detectar online/offline
    function handleOnline() {
      setStatus('recovering')
      // Verificar APIs
      checkServices().then((result) => {
        setStatus(result.allHealthy ? 'online' : 'partial')
        setAffectedServices(result.unhealthy)
        setLastSync(new Date())
      })
    }

    function handleOffline() {
      setStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Health check periódico
    const interval = setInterval(async () => {
      if (!navigator.onLine) {
        setStatus('offline')
        return
      }

      try {
        const start = performance.now()
        const result = await checkServices()
        const latency = performance.now() - start

        if (!result.allHealthy) {
          setStatus('partial')
          setAffectedServices(result.unhealthy)
        } else if (latency > 3000) {
          setStatus('slow')
        } else {
          setStatus('online')
          setAffectedServices([])
        }
        setLastSync(new Date())
      } catch {
        setStatus('offline')
      }
    }, 30000) // A cada 30s

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  function isActionAllowed(action: string): boolean {
    if (status === 'offline') return false
    if (status === 'partial') {
      // Verificar se o serviço necessário está disponível
      const serviceMap: Record<string, string> = {
        'medication.administer': 'medication-service',
        'patient.admit': 'patient-service',
        'call.respond': 'call-service',
      }
      return !affectedServices.includes(serviceMap[action] || '')
    }
    return true
  }

  return (
    <DegradedContext.Provider value={{ status, lastSync, affectedServices, isActionAllowed }}>
      {children}
    </DegradedContext.Provider>
  )
}

export function useDegraded() {
  return useContext(DegradedContext)
}
```

### 5.4 Banner de Status de Rede

```tsx
function NetworkStatusBanner() {
  const { status, lastSync, affectedServices } = useDegraded()

  if (status === 'online') return null

  const config = {
    slow: {
      bg: 'bg-warning/10 border-warning',
      icon: WifiLow,
      iconColor: 'text-warning',
      message: 'Conexão lenta. Dados podem estar desatualizados.',
    },
    partial: {
      bg: 'bg-orange-500/10 border-orange-500',
      icon: WifiOff,
      iconColor: 'text-orange-500',
      message: `Serviços indisponíveis: ${affectedServices.join(', ')}`,
    },
    offline: {
      bg: 'bg-destructive/10 border-destructive',
      icon: WifiOff,
      iconColor: 'text-destructive',
      message: 'Sem conexão. Ações bloqueadas até reconexão.',
    },
    recovering: {
      bg: 'bg-info/10 border-info',
      icon: RefreshCw,
      iconColor: 'text-info animate-spin',
      message: 'Reconectando e sincronizando dados...',
    },
  }

  const { bg, icon: Icon, iconColor, message } = config[status]

  return (
    <div className={cn('border-b px-4 py-2 flex items-center gap-3', bg)}>
      <Icon className={cn('h-4 w-4 flex-shrink-0', iconColor)} />
      <span className="text-sm flex-1">{message}</span>
      {lastSync && (
        <span className="text-xs text-muted-foreground">
          Última sincronização: {formatRelativeTime(lastSync)}
        </span>
      )}
    </div>
  )
}
```

### 5.5 Bloqueio de Ações em Modo Degradado

```tsx
function DegradedActionGuard({
  action,
  children,
  fallback,
}: {
  action: string
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { isActionAllowed, status } = useDegraded()

  if (!isActionAllowed(action)) {
    return fallback || (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">
            <Button disabled variant="outline">
              <WifiOff className="mr-2 h-4 w-4" />
              Indisponível
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Ação indisponível — {status === 'offline' ? 'sem conexão' : 'serviço temporariamente indisponível'}
        </TooltipContent>
      </Tooltip>
    )
  }

  return <>{children}</>
}

// Uso
<DegradedActionGuard action="medication.administer">
  <Button onClick={handleAdminister}>Administrar medicação</Button>
</DegradedActionGuard>
```

---

## 6. Rede Móvel

### 6.1 Detecção de Tipo de Conexão

```tsx
function useConnectionType() {
  const [connection, setConnection] = useState<{
    type: string
    effectiveType: string
    downlink: number
    rtt: number
  } | null>(null)

  useEffect(() => {
    const nav = navigator as any
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection

    if (conn) {
      function updateConnection() {
        setConnection({
          type: conn.type,
          effectiveType: conn.effectiveType,
          downlink: conn.downlink,
          rtt: conn.rtt,
        })
      }

      updateConnection()
      conn.addEventListener('change', updateConnection)
      return () => conn.removeEventListener('change', updateConnection)
    }
  }, [])

  return connection
}
```

### 6.2 Adaptação por Qualidade de Rede

```tsx
function useAdaptiveLoading() {
  const connection = useConnectionType()

  return {
    // Desabilitar animações em conexão lenta
    enableAnimations: connection?.effectiveType !== '2g',

    // Reduzir tamanho de página em conexão lenta
    pageSize: connection?.effectiveType === '2g' ? 10 :
              connection?.effectiveType === '3g' ? 20 : 50,

    // Desabilitar prefetch em conexão lenta
    enablePrefetch: connection?.effectiveType === '4g',

    // Reduzir qualidade de imagens
    imageQuality: connection?.effectiveType === '2g' ? 30 :
                  connection?.effectiveType === '3g' ? 60 : 85,

    // Intervalo de refresh do dashboard
    refreshInterval: connection?.effectiveType === '2g' ? 120000 :
                     connection?.effectiveType === '3g' ? 60000 : 30000,
  }
}
```

---

## 7. Retorno do Background

### 7.1 Verificação ao Retornar

```tsx
function BackgroundResumeManager() {
  const queryClient = useQueryClient()
  const { status } = useDegraded()

  useEffect(() => {
    let lastActive = Date.now()

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastActive

        // Se ficou mais de 1 minuto em background
        if (elapsed > 60000) {
          // 1. Verificar sessão
          fetch('/api/auth/session').then((res) => {
            if (!res.ok) {
              signOut({ callbackUrl: '/login?reason=expired' })
              return
            }
          }).catch(() => {
            // Offline — handled by degraded provider
          })

          // 2. Invalidar queries para buscar dados frescos
          queryClient.invalidateQueries()

          // 3. Verificar atualizações do PWA
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
              registration.update()
            })
          }
        }

        lastActive = Date.now()
      } else {
        lastActive = Date.now()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [queryClient])

  return null
}
```

### 7.2 Notificação de Dados Atualizados

```tsx
function StaleDataIndicator({ queryKey }: { queryKey: string[] }) {
  const { dataUpdatedAt, isStale, isRefetching } = useQuery({
    queryKey,
    enabled: false, // Apenas observa
  })

  if (isRefetching) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Atualizando...
      </div>
    )
  }

  if (isStale && dataUpdatedAt) {
    return (
      <div className="flex items-center gap-1 text-xs text-warning">
        <Clock className="h-3 w-3" />
        Dados de {formatRelativeTime(new Date(dataUpdatedAt))}
      </div>
    )
  }

  return null
}
```

---

## 8. Comportamento Offline Limitado

### 8.1 O que Funciona Offline

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Visualizar telas cacheadas | Parcial | Layout sem dados frescos |
| Navegar entre rotas cacheadas | Sim | Service worker serve cache |
| Preencher formulários | Sim | Dados locais, mas não envia |
| Consultar dados de paciente | **Não** | Dados sensíveis, não cacheados |
| Administrar medicação | **Não** | Requer confirmação servidor |
| Responder chamada | **Não** | Requer comunicação real-time |
| Ver dashboard | Parcial | Dados da última sincronização |
| Alterar configurações | **Não** | Requer persistência servidor |

### 8.2 Fila de Ações Pendentes

```tsx
// NOTA: Apenas para ações não-críticas (anotações, preferências)
// Ações críticas (medicação, chamadas) NUNCA são enfileiradas

function usePendingActions() {
  const [pending, setPending] = useState<PendingAction[]>([])
  const { status } = useDegraded()

  function queueAction(action: PendingAction) {
    if (action.critical) {
      throw new Error('Ações críticas não podem ser enfileiradas')
    }
    setPending((prev) => [...prev, { ...action, queuedAt: new Date() }])
    localStorage.setItem('pending-actions', JSON.stringify([...pending, action]))
  }

  // Processar fila quando reconectar
  useEffect(() => {
    if (status === 'online' && pending.length > 0) {
      processPendingActions(pending).then((results) => {
        const failed = results.filter((r) => !r.success)
        setPending(failed.map((r) => r.action))
        if (failed.length > 0) {
          toast.warning(`${failed.length} ações pendentes não puderam ser processadas`)
        } else {
          toast.success('Ações pendentes processadas com sucesso')
          localStorage.removeItem('pending-actions')
        }
      })
    }
  }, [status])

  return { pending, queueAction }
}
```

### 8.3 Tela Offline

```tsx
function OfflineScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
      <WifiOff className="h-16 w-16 text-muted-foreground/50 mb-4" />
      <h2 className="text-xl font-semibold">Sem conexão</h2>
      <p className="text-muted-foreground mt-2 max-w-sm">
        A plataforma Velya requer conexão com a internet para operar.
        Verifique sua conexão Wi-Fi ou dados móveis.
      </p>
      <div className="mt-6 space-y-2">
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar reconectar
        </Button>
        <p className="text-xs text-muted-foreground">
          Em caso de emergência, utilize o sistema de backup ou contate a central.
        </p>
      </div>
    </div>
  )
}
```

---

## 9. Install Prompt

### 9.1 Custom Install Banner

```tsx
function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const isStandalone = useStandaloneMode()

  useEffect(() => {
    if (isStandalone) return

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e)

      // Mostrar prompt customizado após 30s de uso
      setTimeout(() => setShowPrompt(true), 30000)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [isStandalone])

  if (!showPrompt || !deferredPrompt) return null

  async function handleInstall() {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50">
      <Card>
        <CardContent className="p-4 flex items-start gap-3">
          <img src="/icons/icon-48.png" alt="" className="h-10 w-10 rounded-lg" />
          <div className="flex-1">
            <p className="text-sm font-medium">Instalar Velya</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Acesse mais rápido pela tela inicial do seu dispositivo
            </p>
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={handleInstall}>Instalar</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowPrompt(false)}>
                Agora não
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## 10. Atualização do PWA

### 10.1 Detecção de Nova Versão

```tsx
function PWAUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setShowUpdate(true)
          }
        })
      })
    })
  }, [])

  if (!showUpdate) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50">
      <Card className="border-primary">
        <CardContent className="p-4">
          <p className="text-sm font-medium">Atualização disponível</p>
          <p className="text-xs text-muted-foreground mt-1">
            Uma nova versão da plataforma está disponível.
          </p>
          <Button
            size="sm"
            className="mt-2 w-full"
            onClick={() => window.location.reload()}
          >
            Atualizar agora
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## 11. Métricas de PWA

| Métrica | Target | Monitorar |
|---|---|---|
| Install rate | Track | Quantos instalam a PWA |
| Standalone usage | Track | % de uso em modo standalone |
| Offline events | Track | Frequência de desconexões |
| Degraded mode duration | Minimize | Tempo em modo degradado |
| Background resume latency | < 2s | Tempo para re-sincronizar |
| Cache hit rate | > 80% para assets | Eficiência do cache |
| Service worker update adoption | > 90% em 24h | Velocidade de atualização |

---

## 12. Segurança

### 12.1 Dados Sensíveis

- **Nunca cachear** dados de paciente, medicação, ou credenciais no service worker
- **Limpar cache** ao fazer logout
- **HTTPS obrigatório** — PWA requer HTTPS
- **CSP headers** — Content Security Policy em todas as respostas
- **Não usar localStorage** para tokens — usar httpOnly cookies

### 12.2 Isolamento

- Service worker com scope limitado a `/`
- Não interceptar chamadas para domínios externos
- Não cachear respostas com headers `no-store`

---

## 13. Referências

- [Web App Manifest — MDN](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Service Workers — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [next-pwa](https://github.com/shadowwalker/next-pwa)
- [PWA Builder](https://www.pwabuilder.com)
- [Workbox Strategies](https://developer.chrome.com/docs/workbox/modules/workbox-strategies)
