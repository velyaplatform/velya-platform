# Design System Foundation — Velya Platform

**Status:** Ativo
**Última atualização:** 2026-04-09
**Base:** shadcn/ui + Tailwind CSS + Radix UI Primitives

---

## 1. Visão Geral

O design system da Velya é construído sobre shadcn/ui como base de componentes, com tokens semânticos customizados para o domínio hospitalar. O sistema prioriza acessibilidade, legibilidade em ambientes com iluminação variada (UTI, enfermaria, postos), e operação touch-first.

### 1.1 Princípios do Design System

1. **Clareza clínica**: Informação crítica nunca ambígua
2. **Acessibilidade WCAG 2.1 AA**: Contraste, tamanho de toque, navegação por teclado
3. **Consistência**: Mesmos padrões em todas as telas e domínios
4. **Dark theme hospitalar**: Modo escuro otimizado para UTI e turnos noturnos
5. **Feedback explícito**: Todo estado do sistema é visível e compreensível
6. **Densidade adaptável**: Compacto em desktop, espaçado em mobile

---

## 2. Tokens de Design

### 2.1 Cores Semânticas

O sistema utiliza variáveis CSS semânticas que se adaptam ao tema:

```css
/* styles/globals.css */
@layer base {
  :root {
    /* Superfícies */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;

    /* Primária — Azul hospitalar */
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;

    /* Secundária */
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;

    /* Tons neutros */
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;

    /* Semânticas de status */
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --success: 142 76% 36%;
    --success-foreground: 210 40% 98%;
    --warning: 38 92% 50%;
    --warning-foreground: 0 0% 9%;
    --info: 199 89% 48%;
    --info-foreground: 210 40% 98%;

    /* Hospitalares específicas */
    --critical: 0 84% 50%;
    --critical-foreground: 0 0% 100%;
    --urgent: 25 95% 53%;
    --urgent-foreground: 0 0% 100%;
    --stable: 142 76% 36%;
    --stable-foreground: 0 0% 100%;
    --observation: 199 89% 48%;
    --observation-foreground: 0 0% 100%;

    /* Dor (escala) */
    --pain-none: 142 76% 36%;
    --pain-mild: 82 68% 45%;
    --pain-moderate: 38 92% 50%;
    --pain-severe: 25 95% 53%;
    --pain-worst: 0 84% 50%;

    /* Bordas e input */
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;

    /* Radius */
    --radius: 0.5rem;
  }

  .dark {
    /* Dark theme — hospitalar noturno */
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 6.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 6.9%;
    --popover-foreground: 210 40% 98%;

    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;

    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;

    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;

    --destructive: 0 62.8% 50.6%;
    --destructive-foreground: 210 40% 98%;
    --success: 142 71% 45%;
    --success-foreground: 0 0% 9%;
    --warning: 38 92% 60%;
    --warning-foreground: 0 0% 9%;
    --info: 199 89% 58%;
    --info-foreground: 0 0% 9%;

    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}
```

### 2.2 Cores Hospitalares — Contexto de Uso

| Token | Uso | Exemplo |
|---|---|---|
| `--critical` | Paciente crítico, alerta vermelho | Badge "Crítico", borda de card urgente |
| `--urgent` | Ação urgente, chamada ativa | Timer de chamada, medicação atrasada |
| `--stable` | Status estável, sucesso | Badge "Estável", confirmação de ação |
| `--observation` | Em observação, informacional | Badge "Observação", nota informativa |
| `--pain-*` | Escala de dor (0-10) | Indicador visual de nível de dor |
| `--destructive` | Ação destrutiva | Botão de cancelar, excluir |
| `--warning` | Atenção necessária | Medicação próxima do horário |

### 2.3 Tipografia

```css
:root {
  /* Font family */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Font sizes — escala modular */
  --text-xs: 0.75rem;      /* 12px — labels secundários */
  --text-sm: 0.875rem;     /* 14px — corpo secundário, tabelas */
  --text-base: 1rem;       /* 16px — corpo principal */
  --text-lg: 1.125rem;     /* 18px — subtítulos */
  --text-xl: 1.25rem;      /* 20px — títulos de seção */
  --text-2xl: 1.5rem;      /* 24px — títulos de página */
  --text-3xl: 1.875rem;    /* 30px — títulos de dashboard */
  --text-4xl: 2.25rem;     /* 36px — métricas grandes */

  /* Line heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  /* Font weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

**Regras de tipografia hospitalar:**

- Corpo de texto nunca menor que 14px em desktop, 16px em mobile
- Labels de formulário em 14px medium
- Nomes de pacientes sempre em semibold
- Métricas numéricas (vitais, scores) em tabular-nums para alinhamento
- Timestamps em texto muted e tamanho sm

### 2.4 Spacing

```css
:root {
  /* Spacing scale (Tailwind default) */
  --space-0: 0;
  --space-0.5: 0.125rem;   /* 2px */
  --space-1: 0.25rem;      /* 4px */
  --space-1.5: 0.375rem;   /* 6px */
  --space-2: 0.5rem;       /* 8px */
  --space-3: 0.75rem;      /* 12px */
  --space-4: 1rem;         /* 16px */
  --space-5: 1.25rem;      /* 20px */
  --space-6: 1.5rem;       /* 24px */
  --space-8: 2rem;         /* 32px */
  --space-10: 2.5rem;      /* 40px */
  --space-12: 3rem;        /* 48px */
  --space-16: 4rem;        /* 64px */
}
```

**Regras de spacing:**

- Padding interno de cards: `p-4` (desktop), `p-3` (mobile)
- Gap entre cards em grid: `gap-4` (desktop), `gap-3` (mobile)
- Margin entre seções: `space-y-6` (desktop), `space-y-4` (mobile)
- Padding de página: `p-6` (desktop), `p-4` (mobile)

### 2.5 Border Radius

```css
:root {
  --radius-none: 0;
  --radius-sm: 0.25rem;    /* 4px — badges, chips */
  --radius-md: 0.375rem;   /* 6px — inputs, buttons */
  --radius-lg: 0.5rem;     /* 8px — cards */
  --radius-xl: 0.75rem;    /* 12px — modals, popovers */
  --radius-2xl: 1rem;      /* 16px — containers grandes */
  --radius-full: 9999px;   /* avatares, pills */
}
```

### 2.6 Shadows

```css
:root {
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
  /* Dark theme usa shadows mais sutis */
}
```

---

## 3. Estados de Interface

### 3.1 Estado de Carregamento (Loading)

Cada componente que busca dados deve ter um estado de carregamento explícito:

```tsx
// Skeleton para card de paciente
function PatientCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  )
}
```

**Regras de loading:**

- Skeletons replicam a forma do conteúdo final
- Animação de pulse suave (não distrai)
- Tempo mínimo de exibição: 300ms (evita flash)
- Para ações: spinner inline no botão, botão desabilitado

### 3.2 Estado Vazio (Empty)

```tsx
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
```

**Regras de empty state:**

- Sempre comunicar por que está vazio
- Se possível, oferecer ação para popular
- Ícone contextual (não genérico)
- Nunca mostrar tabela/grid vazia sem mensagem

### 3.3 Estado de Erro (Error)

```tsx
function ErrorState({
  title = 'Erro ao carregar dados',
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        {description || 'Ocorreu um erro inesperado. Tente novamente.'}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="mt-4">
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
```

**Regras de error state:**

- Mensagem em linguagem humana (não códigos técnicos)
- Sempre oferecer botão de retry quando aplicável
- Para erros de permissão: explicar o que falta e como solicitar
- Log técnico separado para observabilidade

### 3.4 Estado de Feedback (Success/Warning/Info)

```tsx
// Toast notifications
function showToast(type: 'success' | 'warning' | 'error' | 'info', message: string) {
  toast({
    variant: type,
    title: TOAST_TITLES[type],
    description: message,
    duration: type === 'error' ? 8000 : 4000,
  })
}

// Inline alerts
function InlineAlert({ variant, title, children }: InlineAlertProps) {
  return (
    <Alert variant={variant}>
      <AlertIcon variant={variant} />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
```

### 3.5 Estado Degradado (Degraded)

Quando o sistema funciona parcialmente (rede instável, serviço indisponível):

```tsx
function DegradedBanner({ service, lastSync }: DegradedBannerProps) {
  return (
    <div className="bg-warning/10 border-b border-warning px-4 py-2 flex items-center gap-2">
      <WifiOff className="h-4 w-4 text-warning" />
      <span className="text-sm text-warning-foreground">
        Modo degradado — {service} indisponível.
        Última sincronização: {formatRelativeTime(lastSync)}
      </span>
      <Button variant="ghost" size="sm" className="ml-auto">
        Tentar reconectar
      </Button>
    </div>
  )
}
```

**Regras de estado degradado:**

- Banner fixo no topo quando modo degradado ativo
- Indicar qual funcionalidade está limitada
- Mostrar timestamp da última sincronização
- Oferecer ação manual de reconexão
- Nunca esconder — o operador deve saber

### 3.6 Estado de Auditoria (Audit)

Ações sensíveis requerem feedback especial:

```tsx
function AuditConfirmation({
  action,
  details,
  operatorName,
  timestamp,
}: AuditConfirmationProps) {
  return (
    <div className="border-l-4 border-primary bg-primary/5 p-4 rounded-r-lg">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Ação registrada em auditoria</span>
      </div>
      <dl className="text-sm space-y-1">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Ação:</dt>
          <dd>{action}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Operador:</dt>
          <dd>{operatorName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Horário:</dt>
          <dd>{formatDateTime(timestamp)}</dd>
        </div>
      </dl>
    </div>
  )
}
```

---

## 4. Status Chips

### 4.1 Componente StatusChip

```tsx
const STATUS_VARIANTS = {
  // Paciente
  critical: { bg: 'bg-critical/10', text: 'text-critical', dot: 'bg-critical' },
  urgent: { bg: 'bg-urgent/10', text: 'text-urgent', dot: 'bg-urgent' },
  stable: { bg: 'bg-stable/10', text: 'text-stable', dot: 'bg-stable' },
  observation: { bg: 'bg-observation/10', text: 'text-observation', dot: 'bg-observation' },
  discharged: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },

  // Chamada
  ringing: { bg: 'bg-urgent/10', text: 'text-urgent', dot: 'bg-urgent animate-pulse' },
  active: { bg: 'bg-primary/10', text: 'text-primary', dot: 'bg-primary' },
  resolved: { bg: 'bg-stable/10', text: 'text-stable', dot: 'bg-stable' },
  missed: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },

  // Medicação
  pending: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  administered: { bg: 'bg-stable/10', text: 'text-stable', dot: 'bg-stable' },
  overdue: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive animate-pulse' },
  skipped: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },

  // Handoff
  draft: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  inProgress: { bg: 'bg-primary/10', text: 'text-primary', dot: 'bg-primary' },
  completed: { bg: 'bg-stable/10', text: 'text-stable', dot: 'bg-stable' },

  // Agente IA
  aiSuggestion: { bg: 'bg-violet-100 dark:bg-violet-950', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  aiConfirmed: { bg: 'bg-stable/10', text: 'text-stable', dot: 'bg-stable' },
  aiRejected: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },
} as const

type StatusVariant = keyof typeof STATUS_VARIANTS

interface StatusChipProps {
  variant: StatusVariant
  label: string
  showDot?: boolean
  size?: 'sm' | 'md'
}

function StatusChip({ variant, label, showDot = true, size = 'sm' }: StatusChipProps) {
  const styles = STATUS_VARIANTS[variant]
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full font-medium',
      styles.bg, styles.text,
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
    )}>
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} />}
      {label}
    </span>
  )
}
```

### 4.2 Uso por Domínio

| Domínio | Status | Chip |
|---|---|---|
| Paciente | Crítico, Urgente, Estável, Observação, Alta | `critical`, `urgent`, `stable`, `observation`, `discharged` |
| Chamada | Tocando, Ativa, Resolvida, Perdida | `ringing`, `active`, `resolved`, `missed` |
| Medicação | Pendente, Administrada, Atrasada, Pulada | `pending`, `administered`, `overdue`, `skipped` |
| Handoff | Rascunho, Em progresso, Concluído | `draft`, `inProgress`, `completed` |
| Agente IA | Sugestão, Confirmado, Rejeitado | `aiSuggestion`, `aiConfirmed`, `aiRejected` |

---

## 5. Timeline Primitives

### 5.1 Componente Timeline

```tsx
interface TimelineEvent {
  id: string
  timestamp: Date
  type: 'medication' | 'call' | 'pain' | 'handoff' | 'note' | 'vital' | 'procedure'
  title: string
  description?: string
  operator: string
  status?: StatusVariant
  aiGenerated?: boolean
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="relative">
      {/* Linha vertical */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-4">
        {events.map((event) => (
          <TimelineItem key={event.id} event={event} />
        ))}
      </div>
    </div>
  )
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  const Icon = TIMELINE_ICONS[event.type]

  return (
    <div className="relative flex gap-4 pl-10">
      {/* Dot/Icon no eixo */}
      <div className="absolute left-2 flex h-5 w-5 items-center justify-center rounded-full border bg-background">
        <Icon className="h-3 w-3 text-muted-foreground" />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{event.title}</span>
          {event.status && <StatusChip variant={event.status} label={event.status} size="sm" />}
          {event.aiGenerated && (
            <span className="text-xs text-violet-500 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> IA
            </span>
          )}
        </div>
        {event.description && (
          <p className="text-sm text-muted-foreground mt-0.5">{event.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{formatRelativeTime(event.timestamp)}</span>
          <span>por {event.operator}</span>
        </div>
      </div>
    </div>
  )
}
```

### 5.2 Ícones por Tipo de Evento

| Tipo | Ícone | Cor |
|---|---|---|
| `medication` | Pill | primary |
| `call` | Phone | urgent |
| `pain` | Activity | warning |
| `handoff` | ArrowRightLeft | info |
| `note` | FileText | muted |
| `vital` | Heart | critical |
| `procedure` | Stethoscope | stable |

---

## 6. Card System

### 6.1 Card Variants

```tsx
// Card base (shadcn/ui)
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descrição</CardDescription>
  </CardHeader>
  <CardContent>Conteúdo</CardContent>
  <CardFooter>Ações</CardFooter>
</Card>

// Card com status border
<Card className="border-l-4 border-l-critical">
  <CardContent>Paciente crítico</CardContent>
</Card>

// Card métrica
<MetricCard
  title="Chamadas ativas"
  value={12}
  change={{ value: 3, direction: 'up' }}
  icon={Phone}
/>

// Card de paciente
<PatientCard
  patient={patient}
  status="critical"
  lastAction="Medicação administrada há 5min"
/>
```

### 6.2 Padrões de Card

- **Border-left colorida**: Indica severidade/status do conteúdo
- **Header com ações**: Botões de ação no canto superior direito
- **Footer com metadata**: Timestamps, operador, links
- **Hover sutil**: `hover:shadow-md transition-shadow` para cards clicáveis
- **Skeleton matching**: Skeleton replica exatamente a estrutura do card

---

## 7. Form System

### 7.1 Componentes de Formulário

```tsx
// Form field padronizado
<FormField
  control={form.control}
  name="patientName"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Nome do paciente</FormLabel>
      <FormControl>
        <Input placeholder="Nome completo" {...field} />
      </FormControl>
      <FormDescription>Nome conforme documento</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 7.2 Regras de Formulário

- Labels sempre visíveis (não apenas placeholder)
- Mensagens de erro em vermelho abaixo do campo
- Campos obrigatórios marcados com asterisco
- Agrupamento lógico com fieldsets visuais
- Botão de submit desabilitado enquanto inválido ou enviando
- Touch targets mínimo 44px em mobile

---

## 8. Table System

### 8.1 Estrutura Base

```tsx
<div className="rounded-lg border">
  <Table>
    <TableHeader>
      <TableRow className="bg-muted/50">
        <TableHead className="sticky top-0">Nome</TableHead>
        <TableHead className="sticky top-0">Status</TableHead>
        <TableHead className="sticky top-0 text-right">Ações</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {rows.map((row) => (
        <TableRow key={row.id} className="hover:bg-muted/50">
          <TableCell className="font-medium">{row.name}</TableCell>
          <TableCell><StatusChip variant={row.status} /></TableCell>
          <TableCell className="text-right">
            <RowActions row={row} />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

### 8.2 Regras de Tabela

- Header sticky sempre
- Hover na row para indicar interatividade
- Colunas de ação à direita
- Colunas numéricas alinhadas à direita
- Zebra striping opcional para tabelas longas
- Empty state quando sem dados
- Loading skeleton com linhas animadas

---

## 9. Dark Theme Hospitalar

### 9.1 Motivação

UTIs e postos de enfermagem noturnos exigem iluminação reduzida. O dark theme hospitalar difere de dark themes tradicionais:

- **Contraste calibrado**: Suficiente para leitura rápida, sem ofuscar em ambiente escuro
- **Cores de status preservadas**: Crítico vermelho, urgente laranja permanecem distintos
- **Superfícies mais quentes**: Evita azul frio puro que causa fadiga ocular
- **Brilho reduzido em brancos**: Texto em cinza claro, nunca branco puro

### 9.2 Regras do Dark Theme

1. Background principal: `hsl(222.2 84% 4.9%)` — quase preto com tom azulado
2. Cards elevados: Um step mais claro que background
3. Texto primário: `hsl(210 40% 98%)` — off-white
4. Texto secundário: `hsl(215 20.2% 65.1%)` — cinza médio
5. Bordas: Sutis, `hsl(217.2 32.6% 17.5%)`
6. Status colors: Ligeiramente mais saturadas para compensar fundo escuro
7. Nunca usar preto puro (`#000`) ou branco puro (`#fff`)

### 9.3 Toggle de Tema

```tsx
function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Alternar tema</span>
    </Button>
  )
}
```

---

## 10. Iconografia

### 10.1 Biblioteca: Lucide React

Lucide é a biblioteca padrão de ícones (incluída com shadcn/ui):

- **Estilo consistente**: Stroke-based, 24x24 grid
- **Tree-shakeable**: Apenas ícones usados no bundle
- **Customizável**: Size, color, strokeWidth via props

### 10.2 Ícones por Domínio

| Domínio | Ícones Principais |
|---|---|
| Pacientes | User, Users, UserPlus, UserCheck |
| Medicação | Pill, Syringe, Clock, AlertCircle |
| Chamadas | Phone, PhoneIncoming, PhoneOff, Bell |
| Dor | Activity, Gauge, TrendingUp |
| Handoff | ArrowRightLeft, ClipboardList, CheckCircle |
| Workforce | Calendar, Users, Shield |
| Dashboard | LayoutDashboard, BarChart, PieChart |
| Auditoria | Shield, Eye, FileSearch, Lock |
| Agentes IA | Sparkles, Bot, Brain, Zap |
| Settings | Settings, Cog, Sliders |

---

## 11. Motion e Animação

### 11.1 Princípios

1. **Funcional, não decorativa**: Animação comunica mudança de estado
2. **Rápida**: Duração máxima 300ms para transições, 500ms para entrada/saída
3. **Reduzível**: Respeitar `prefers-reduced-motion`
4. **Sutil**: Nunca distrair do conteúdo clínico

### 11.2 Padrões

```css
/* Transição padrão */
.transition-base {
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Entrada */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 12. Responsividade

### 12.1 Breakpoints

| Breakpoint | Pixels | Contexto Hospitalar |
|---|---|---|
| `sm` | 640px | Smartphone portrait |
| `md` | 768px | Tablet portrait, smartphone landscape |
| `lg` | 1024px | Tablet landscape, desktop pequeno |
| `xl` | 1280px | Desktop padrão |
| `2xl` | 1536px | Monitor grande, posto de enfermagem |

### 12.2 Estratégia por Breakpoint

- **sm**: Uma coluna, cards empilhados, tabelas viram cards, sidebar hidden
- **md**: Duas colunas, sidebar overlay, tabelas com colunas prioritárias
- **lg**: Grid completo, sidebar visível, tabelas completas
- **xl+**: Densidade máxima, painéis laterais, múltiplas seções visíveis

---

## 13. Acessibilidade

### 13.1 Checklist

- [ ] Contraste mínimo 4.5:1 para texto normal, 3:1 para texto grande
- [ ] Focus ring visível em todos os elementos interativos
- [ ] ARIA labels em ícones sem texto
- [ ] Role e aria-* em componentes custom (tabs, dialogs, alerts)
- [ ] Navegação por teclado funcional em toda a aplicação
- [ ] Screen reader anuncia mudanças dinâmicas (live regions)
- [ ] Imagens com alt text descritivo
- [ ] Touch targets mínimo 44x44px em mobile
- [ ] `prefers-reduced-motion` respeitado
- [ ] `prefers-color-scheme` detectado para tema inicial

---

## 14. Referências

- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Radix UI Primitives](https://www.radix-ui.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Lucide Icons](https://lucide.dev)
- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)
