# Padrões de Gráficos e Dashboards — Velya Platform

**Status:** Ativo
**Última atualização:** 2026-04-09
**Biblioteca:** Recharts 2.x

---

## 1. Visão Geral

Dashboards e gráficos na plataforma Velya comunicam informações operacionais críticas: tendências de dor, throughput de medicação, backlog de chamadas, e indicadores de performance da equipe. A visualização deve ser clara, acessível e responsiva.

### 1.1 Princípios

1. **Informação, não decoração**: Gráficos devem responder perguntas, não enfeitar a tela
2. **Acessibilidade**: Dados acessíveis via texto, não apenas visualização
3. **Mobile-first**: Todo gráfico funciona em tela pequena ou tem fallback
4. **Anomalias destacadas**: Valores fora do esperado devem ser evidentes
5. **Contexto temporal**: Período sempre visível, comparação com baseline quando possível
6. **Performance**: Gráficos não devem travar a interface

---

## 2. Quando Usar Chart vs Tabela

### 2.1 Matriz de Decisão

| Pergunta | Chart | Tabela |
|---|---|---|
| Preciso ver tendência ao longo do tempo? | Line/Area chart | Não |
| Preciso comparar categorias? | Bar chart | Se poucas categorias |
| Preciso ver distribuição/proporção? | Pie/Donut chart | Não |
| Preciso ver valores exatos? | Não | Tabela |
| Preciso buscar/filtrar dados? | Não | Tabela |
| Preciso exportar dados? | Tabela complementar | Tabela |
| Dados têm mais de 7 categorias? | Bar horizontal | Tabela |
| Usuário precisa agir nos dados? | Tabela | Tabela |
| Leitor de tela precisa acessar? | Com tabela fallback | Tabela |

### 2.2 Regra Geral

> Se o insight é visual (tendência, comparação, proporção), use chart.
> Se a necessidade é operacional (buscar, agir, exportar), use tabela.
> Na dúvida, ofereça ambos.

---

## 3. Tipos de Gráfico por Caso de Uso

### 3.1 Catálogo de Visualizações

| Tipo | Recharts Component | Caso de Uso Hospitalar |
|---|---|---|
| Line Chart | `<LineChart>` | Tendência de dor, temperatura, sinais vitais |
| Area Chart | `<AreaChart>` | Volume de chamadas ao longo do dia |
| Bar Chart | `<BarChart>` | Medicações por turno, chamadas por setor |
| Stacked Bar | `<BarChart>` com stacking | Tipos de chamada por período |
| Horizontal Bar | `<BarChart layout="vertical">` | Ranking de motivos de chamada |
| Pie/Donut | `<PieChart>` | Distribuição de status de pacientes |
| Radar | `<RadarChart>` | Score multidimensional de qualidade |
| Composed | `<ComposedChart>` | Medicações + taxa de atraso sobrepostos |

### 3.2 Visões por Domínio

#### Dashboard Principal

```
┌─────────────────────────────────────────────────────┐
│  Metric Cards (4x)                                  │
│  [Pacientes] [Chamadas] [Medicações] [Handoffs]     │
├─────────────────────┬───────────────────────────────┤
│  Area Chart          │  Bar Chart                    │
│  Chamadas/hora       │  Medicações por status        │
│  (últimas 24h)       │  (pendente/admin/atrasada)    │
├─────────────────────┼───────────────────────────────┤
│  Line Chart          │  Donut Chart                  │
│  Tendência de dor    │  Pacientes por status         │
│  (média por turno)   │  (crítico/urgente/estável)    │
└─────────────────────┴───────────────────────────────┘
```

#### Painel de Dor

- **Line chart**: Evolução da dor do paciente ao longo dos dias
- **Area chart**: Distribuição de níveis de dor por turno
- **Bar chart**: Pacientes por faixa de dor (0-3, 4-6, 7-10)

#### Painel de Chamadas

- **Area chart**: Volume de chamadas por hora (padrão diário)
- **Stacked bar**: Chamadas atendidas vs perdidas por turno
- **Horizontal bar**: Top motivos de chamada
- **Line chart**: Tempo médio de resposta (tendência)

#### Painel de Medicação

- **Bar chart**: Medicações por status (pendente, administrada, atrasada)
- **Line chart**: Taxa de medicação no prazo (tendência semanal)
- **Stacked bar**: Medicações por via de administração

#### Workforce

- **Radar chart**: Carga de trabalho por enfermeiro
- **Bar chart**: Horas trabalhadas por turno
- **Line chart**: Razão enfermeiro/paciente ao longo do tempo

---

## 4. Componentes Padronizados

### 4.1 Wrapper Base

```tsx
'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

interface ChartContainerProps {
  children: React.ReactNode
  height?: number
  minHeight?: number
  className?: string
}

function ChartContainer({
  children,
  height = 300,
  minHeight = 200,
  className,
}: ChartContainerProps) {
  return (
    <div className={cn('w-full', className)} style={{ minHeight }}>
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}
```

### 4.2 Line Chart Padronizado

```tsx
interface VelyaLineChartProps {
  data: Record<string, any>[]
  lines: {
    dataKey: string
    label: string
    color: string
    strokeDasharray?: string
  }[]
  xAxisKey: string
  xAxisFormatter?: (value: any) => string
  yAxisFormatter?: (value: any) => string
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  showTooltip?: boolean
  thresholds?: { value: number; color: string; label: string }[]
  animate?: boolean
}

function VelyaLineChart({
  data,
  lines,
  xAxisKey,
  xAxisFormatter,
  yAxisFormatter,
  height = 300,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  thresholds = [],
  animate = true,
}: VelyaLineChartProps) {
  return (
    <ChartContainer height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-border"
            vertical={false}
          />
        )}

        <XAxis
          dataKey={xAxisKey}
          tickFormatter={xAxisFormatter}
          className="text-xs fill-muted-foreground"
          axisLine={false}
          tickLine={false}
        />

        <YAxis
          tickFormatter={yAxisFormatter}
          className="text-xs fill-muted-foreground"
          axisLine={false}
          tickLine={false}
          width={40}
        />

        {showTooltip && (
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'hsl(var(--border))' }}
          />
        )}

        {showLegend && (
          <Legend
            content={<CustomLegend />}
            verticalAlign="top"
            height={36}
          />
        )}

        {/* Threshold lines */}
        {thresholds.map((threshold) => (
          <ReferenceLine
            key={threshold.label}
            y={threshold.value}
            stroke={threshold.color}
            strokeDasharray="4 4"
            label={{
              value: threshold.label,
              fill: threshold.color,
              fontSize: 11,
            }}
          />
        ))}

        {/* Data lines */}
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.label}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
            isAnimationActive={animate}
            strokeDasharray={line.strokeDasharray}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}
```

### 4.3 Tooltip Customizado

```tsx
function CustomTooltip({ active, payload, label }: TooltipProps<any, any>) {
  if (!active || !payload) return null

  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="text-sm font-medium mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-muted-foreground">{entry.name}</span>
            </div>
            <span className="text-sm font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 4.4 Legenda Customizada

```tsx
function CustomLegend({ payload }: LegendProps) {
  if (!payload) return null

  return (
    <div className="flex flex-wrap justify-center gap-4 mb-2">
      {payload.map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <div
            className="h-2 w-4 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}
```

---

## 5. Metric Cards

### 5.1 Componente

```tsx
interface MetricCardProps {
  title: string
  value: number | string
  change?: {
    value: number
    direction: 'up' | 'down' | 'neutral'
    period: string
  }
  icon?: LucideIcon
  variant?: 'default' | 'success' | 'warning' | 'critical'
  isLoading?: boolean
}

function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  variant = 'default',
  isLoading,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-3 w-24" />
        </CardContent>
      </Card>
    )
  }

  const changeColor = {
    up: 'text-destructive',
    down: 'text-success',
    neutral: 'text-muted-foreground',
  }

  const changeIcon = {
    up: TrendingUp,
    down: TrendingDown,
    neutral: Minus,
  }

  const ChangeIcon = change ? changeIcon[change.direction] : null

  return (
    <Card className={cn(
      variant === 'critical' && 'border-critical/50 bg-critical/5',
      variant === 'warning' && 'border-warning/50 bg-warning/5',
      variant === 'success' && 'border-success/50 bg-success/5',
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{title}</p>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <p className="text-3xl font-bold mt-2 tabular-nums">{value}</p>
        {change && (
          <div className={cn('flex items-center gap-1 mt-1', changeColor[change.direction])}>
            {ChangeIcon && <ChangeIcon className="h-3 w-3" />}
            <span className="text-xs font-medium">
              {change.value > 0 ? '+' : ''}{change.value}%
            </span>
            <span className="text-xs text-muted-foreground">{change.period}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## 6. Acessibilidade de Gráficos

### 6.1 Princípios

1. **Nunca usar apenas cor** para comunicar informação — usar formas, padrões, labels
2. **Tabela alternativa** disponível para cada gráfico
3. **Descrição textual** (`aria-label`) no container do gráfico
4. **Contraste** de cores adequado entre séries
5. **Animações** desabilitáveis via `prefers-reduced-motion`

### 6.2 Tabela Alternativa

```tsx
function ChartWithTable<T>({
  chart,
  data,
  columns,
  showTable = false,
}: ChartWithTableProps<T>) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>(
    showTable ? 'table' : 'chart'
  )

  return (
    <div>
      <div className="flex justify-end mb-2">
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as any)}>
          <ToggleGroupItem value="chart" aria-label="Ver gráfico">
            <BarChart3 className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Ver tabela">
            <TableIcon className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {viewMode === 'chart' ? (
        <div role="img" aria-label="Gráfico de dados — use o botão de tabela para versão acessível">
          {chart}
        </div>
      ) : (
        <DataTable data={data} columns={columns} />
      )}
    </div>
  )
}
```

### 6.3 Paleta de Cores Acessível

```tsx
// Paleta que funciona para daltonismo (deuteranopia, protanopia)
const CHART_COLORS = {
  primary: 'hsl(221, 83%, 53%)',      // Azul
  secondary: 'hsl(142, 76%, 36%)',    // Verde
  tertiary: 'hsl(38, 92%, 50%)',      // Amarelo
  quaternary: 'hsl(280, 67%, 50%)',   // Roxo
  quinary: 'hsl(16, 85%, 55%)',       // Laranja
  senary: 'hsl(340, 75%, 55%)',       // Rosa
}

// Com padrões para distinção adicional
const LINE_PATTERNS = {
  solid: undefined,
  dashed: '8 4',
  dotted: '2 4',
  dashDot: '8 4 2 4',
}
```

---

## 7. Anomalias e Thresholds

### 7.1 Linhas de Threshold

```tsx
// Threshold de dor
<ReferenceLine
  y={7}
  stroke="hsl(var(--destructive))"
  strokeDasharray="4 4"
  label={{ value: 'Dor severa', fill: 'hsl(var(--destructive))', fontSize: 11 }}
/>

// Threshold de SLA de chamada
<ReferenceLine
  y={300} // 5 minutos em segundos
  stroke="hsl(var(--warning))"
  strokeDasharray="4 4"
  label={{ value: 'SLA 5min', fill: 'hsl(var(--warning))', fontSize: 11 }}
/>
```

### 7.2 Pontos de Anomalia

```tsx
function AnomalyDot(props: any) {
  const { cx, cy, value, threshold } = props

  if (value > threshold) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill="hsl(var(--destructive))"
        stroke="white"
        strokeWidth={2}
      />
    )
  }

  return null // Dot normal (ou sem dot)
}

// Uso
<Line
  dataKey="painLevel"
  dot={<AnomalyDot threshold={7} />}
  activeDot={{ r: 4 }}
/>
```

### 7.3 Áreas de Alerta

```tsx
// Faixa de valores normais
<ReferenceArea
  y1={0}
  y2={3}
  fill="hsl(var(--success))"
  fillOpacity={0.05}
  label="Normal"
/>
<ReferenceArea
  y1={7}
  y2={10}
  fill="hsl(var(--destructive))"
  fillOpacity={0.05}
  label="Severo"
/>
```

---

## 8. Responsividade Mobile

### 8.1 Estratégia por Breakpoint

| Breakpoint | Comportamento |
|---|---|
| Desktop (lg+) | Gráficos em grid 2-3 colunas, altura padrão |
| Tablet (md) | Grid 1-2 colunas, altura reduzida |
| Mobile (sm) | Uma coluna, gráfico simplificado ou tabela |

### 8.2 Simplificação para Mobile

```tsx
function ResponsiveChart({ data, fullConfig, mobileConfig }: ResponsiveChartProps) {
  const isMobile = useMediaQuery('(max-width: 768px)')

  if (isMobile) {
    return (
      <ChartContainer height={200}>
        <LineChart data={data}>
          {/* Menos labels, sem legenda, sem grid */}
          <XAxis dataKey="time" tick={false} axisLine={false} />
          <YAxis hide />
          <Line
            dataKey={mobileConfig.mainMetric}
            stroke={mobileConfig.color}
            strokeWidth={2}
            dot={false}
          />
          <Tooltip content={<SimpleTooltip />} />
        </LineChart>
      </ChartContainer>
    )
  }

  return <FullChart data={data} config={fullConfig} />
}
```

### 8.3 Tap Targets em Mobile

- Tooltips ativados por toque (não hover)
- Dots maiores (r=6) para facilitar toque
- Legendas clicáveis para mostrar/esconder séries
- Área de toque mínima 44x44px em controles

### 8.4 Fallback para Tabela em Mobile

Quando o gráfico fica ilegível em tela pequena:

```tsx
function ChartOrTable({ data, chart, columns }: ChartOrTableProps) {
  const isMobile = useMediaQuery('(max-width: 640px)')

  if (isMobile) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Visualização em tabela (gire o dispositivo para ver o gráfico)
        </p>
        <SimpleTable data={data} columns={columns} />
      </div>
    )
  }

  return chart
}
```

---

## 9. Padrões de Dashboard Layout

### 9.1 Grid Responsivo

```tsx
function DashboardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  )
}

// Metric cards: 4 colunas em desktop, 2 em tablet, 1 em mobile
// Charts: 2 colunas em desktop, 1 em mobile
// Tabelas: sempre full-width
```

### 9.2 Seletor de Período

```tsx
function PeriodSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const periods = [
    { value: '24h', label: 'Últimas 24h' },
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: '90d', label: 'Últimos 90 dias' },
    { value: 'custom', label: 'Personalizado' },
  ]

  return (
    <ToggleGroup type="single" value={value} onValueChange={onChange}>
      {periods.map((period) => (
        <ToggleGroupItem key={period.value} value={period.value} size="sm">
          {period.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
```

### 9.3 Auto-Refresh

```tsx
function DashboardAutoRefresh() {
  const [interval, setInterval] = useState<number | null>(60000) // 1 min

  return (
    <div className="flex items-center gap-2">
      <Select
        value={interval?.toString() || 'off'}
        onValueChange={(v) => setInterval(v === 'off' ? null : Number(v))}
      >
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="off">Auto-refresh: off</SelectItem>
          <SelectItem value="30000">A cada 30s</SelectItem>
          <SelectItem value="60000">A cada 1min</SelectItem>
          <SelectItem value="300000">A cada 5min</SelectItem>
        </SelectContent>
      </Select>
      {interval && (
        <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin" style={{
          animationDuration: `${interval}ms`,
        }} />
      )}
    </div>
  )
}
```

---

## 10. Performance de Gráficos

### 10.1 Regras

1. **Limitar pontos de dados**: Máximo 500 pontos por série no cliente
2. **Agregar no servidor**: Dados horários para visualização diária, diários para semanal
3. **Desabilitar animação**: Em mobile ou `prefers-reduced-motion`
4. **Lazy load**: Gráficos abaixo do fold carregam sob demanda
5. **Memoize data**: `useMemo` para transformações de dados
6. **Debounce resize**: Não recalcular a cada pixel de resize

### 10.2 Lazy Loading de Charts

```tsx
import dynamic from 'next/dynamic'

const PainTrendChart = dynamic(
  () => import('@/features/calls-and-pain/components/pain-trend-chart'),
  {
    loading: () => <Skeleton className="h-[300px] w-full rounded-lg" />,
    ssr: false,
  }
)
```

### 10.3 Métricas de Performance

| Métrica | Target |
|---|---|
| Render de chart (300 pontos) | < 100ms |
| Resize recalculation | < 50ms |
| Tooltip response time | < 16ms (60fps) |
| Bundle size (Recharts) | < 50kb gzipped |
| Memory por chart instance | < 5MB |

---

## 11. Testes de Gráficos

### 11.1 O que Testar

- [ ] Renderiza sem crash com dados válidos
- [ ] Renderiza estado vazio quando sem dados
- [ ] Renderiza estado de erro quando dados falham
- [ ] Tooltip aparece ao hover/toque
- [ ] Legenda mostra/esconde séries
- [ ] Responsividade: ajusta ao container
- [ ] Acessibilidade: fallback tabela disponível
- [ ] Performance: não excede budgets

### 11.2 Não Testar

- Layout exato de SVG (frágil, mudanças de versão)
- Valores pixel-exact de posição
- Animações

---

## 12. Referências

- [Recharts Documentation](https://recharts.org)
- [Data Visualization Best Practices](https://www.storytellingwithdata.com)
- [WCAG Guideline 1.4.1 — Use of Color](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html)
- [Chart Accessibility — W3C](https://www.w3.org/WAI/tutorials/images/complex/)
