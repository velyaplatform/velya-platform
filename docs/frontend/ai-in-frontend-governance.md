# Governança de IA no Frontend — Velya Platform

**Status:** Ativo
**Última atualização:** 2026-04-09

---

## 1. Visão Geral

A plataforma Velya integra agentes de IA que produzem recomendações, insights e sugestões para equipes hospitalares. A governança no frontend define como essas sugestões são apresentadas ao operador humano, garantindo que a IA nunca substitua o julgamento clínico e que toda ação final seja explicitamente humana.

### 1.1 Princípios Fundamentais

1. **IA recomenda, humano decide**: Nenhuma ação de IA é executada sem confirmação explícita
2. **Evidência visível**: O raciocínio da IA é transparente e inspecionável
3. **Confiança mostrada**: O nível de confiança da recomendação é sempre exibido
4. **Nunca UX "mágica"**: O usuário entende que é uma sugestão, não um fato
5. **Preservar revisão humana**: Atalhos que bypassam revisão são proibidos
6. **Auditabilidade**: Toda interação com IA é registrada

---

## 2. Marcação Visual de Conteúdo IA

### 2.1 Badge de IA

Todo conteúdo gerado ou sugerido por IA deve ter marcação visual clara:

```tsx
// components/domain/ai-badge.tsx
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIBadgeProps {
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

export function AIBadge({ size = 'sm', label = 'Sugestão IA', className }: AIBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
        'border border-violet-200 dark:border-violet-800',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        className,
      )}
    >
      <Sparkles className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {label}
    </span>
  );
}
```

### 2.2 Regras de Marcação

| Cenário                     | Marcação                                  |
| --------------------------- | ----------------------------------------- |
| Card com sugestão de IA     | AIBadge no header + borda violeta         |
| Texto gerado por IA         | AIBadge inline + background violeta sutil |
| Campo pré-preenchido por IA | AIBadge ao lado do label + tooltip        |
| Gráfico com insight de IA   | AIBadge na legenda + callout explicativo  |
| Alerta gerado por IA        | AIBadge + seção "Por que este alerta?"    |
| Sugestão em timeline        | Ícone Sparkles + cor violeta no item      |

### 2.3 Estilo Visual Consistente

```
┌──────────────────────────────────────────────────────┐
│  ✨ Sugestão IA                           Confiança: 87% │
│ ──────────────────────────────────────────────────────│
│  Recomendação: Ajustar horário da Dipirona para      │
│  coincidir com o pico de dor registrado às 14h.      │
│                                                       │
│  Evidência: Paciente registrou dor nível 7 em 3 dos  │
│  últimos 5 dias entre 13h-15h. Medicação atual está  │
│  agendada para 10h.                                   │
│                                                       │
│  [Ver detalhes]  [Aceitar] [Modificar] [Rejeitar]    │
└──────────────────────────────────────────────────────┘
```

Cores:

- Background: `bg-violet-50 dark:bg-violet-950/30`
- Borda: `border-violet-200 dark:border-violet-800`
- Texto do badge: `text-violet-700 dark:text-violet-300`
- Ícone: Sparkles (Lucide) em violeta

---

## 3. Apresentação de Evidência

### 3.1 Componente de Evidência

```tsx
interface AIEvidenceProps {
  summary: string;
  dataPoints: {
    label: string;
    value: string;
    source: string;
    timestamp: string;
  }[];
  reasoning: string;
  limitations?: string[];
  expandable?: boolean;
}

function AIEvidence({
  summary,
  dataPoints,
  reasoning,
  limitations,
  expandable = true,
}: AIEvidenceProps) {
  const [expanded, setExpanded] = useState(!expandable);

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20 p-4">
      <div className="flex items-start gap-2">
        <FileSearch className="h-4 w-4 text-violet-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Evidência</p>
          <p className="text-sm text-muted-foreground mt-1">{summary}</p>

          {expandable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="mt-2 -ml-2 text-violet-600"
            >
              {expanded ? 'Menos detalhes' : 'Mais detalhes'}
              <ChevronDown
                className={cn('ml-1 h-4 w-4 transition-transform', expanded && 'rotate-180')}
              />
            </Button>
          )}

          {expanded && (
            <div className="mt-3 space-y-3">
              {/* Data points */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Dados utilizados:</p>
                <ul className="space-y-1">
                  {dataPoints.map((dp, i) => (
                    <li key={i} className="text-sm flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                      <span>
                        {dp.label}: <strong>{dp.value}</strong>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({dp.source}, {dp.timestamp})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Reasoning */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Raciocínio:</p>
                <p className="text-sm">{reasoning}</p>
              </div>

              {/* Limitations */}
              {limitations && limitations.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Limitações:</p>
                  <ul className="space-y-1">
                    {limitations.map((l, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-warning flex-shrink-0" />
                        {l}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 3.2 Regras de Evidência

1. **Sempre mostrar**: Toda sugestão de IA deve ter evidência acessível
2. **Dados rastreáveis**: Cada data point referencia sua fonte e timestamp
3. **Raciocínio explicado**: O "por quê" da recomendação, não apenas o "o quê"
4. **Limitações declaradas**: O que a IA não considerou ou não tem certeza
5. **Linguagem simples**: Enfermeiros devem entender sem formação técnica em IA
6. **Sem jargão de ML**: Nunca usar "score", "feature importance", "embeddings" na UI

---

## 4. Indicador de Confiança

### 4.1 Componente

```tsx
interface ConfidenceIndicatorProps {
  value: number; // 0-100
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

function ConfidenceIndicator({ value, size = 'sm', showLabel = true }: ConfidenceIndicatorProps) {
  const level = value >= 80 ? 'high' : value >= 50 ? 'medium' : 'low';

  const colors = {
    high: 'text-success',
    medium: 'text-warning',
    low: 'text-destructive',
  };

  const labels = {
    high: 'Alta confiança',
    medium: 'Confiança moderada',
    low: 'Baixa confiança',
  };

  const bgColors = {
    high: 'bg-success',
    medium: 'bg-warning',
    low: 'bg-destructive',
  };

  return (
    <div className="flex items-center gap-2">
      {/* Barra visual */}
      <div className="flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              'rounded-full',
              size === 'sm' ? 'h-1.5 w-3' : 'h-2 w-4',
              i < Math.ceil(value / 20) ? bgColors[level] : 'bg-muted',
            )}
          />
        ))}
      </div>

      {showLabel && (
        <span className={cn('font-medium', colors[level], size === 'sm' ? 'text-xs' : 'text-sm')}>
          {value}% — {labels[level]}
        </span>
      )}
    </div>
  );
}
```

### 4.2 Regras de Exibição de Confiança

| Confiança         | Apresentação               | Ação Default                                    |
| ----------------- | -------------------------- | ----------------------------------------------- |
| 80-100% (Alta)    | Verde, indicador cheio     | "Aceitar" como primeiro botão                   |
| 50-79% (Moderada) | Amarelo, indicador parcial | "Revisar" como primeiro botão                   |
| 0-49% (Baixa)     | Vermelho, indicador mínimo | "Revisar detalhes" obrigatório antes de aceitar |

### 4.3 Tratamento de Baixa Confiança

Sugestões com confiança < 50% requerem passos adicionais:

```tsx
function LowConfidenceSuggestion({ suggestion }: { suggestion: AISuggestion }) {
  const [reviewed, setReviewed] = useState(false);

  return (
    <div className="border-l-4 border-warning bg-warning/5 p-4 rounded-r-lg">
      <div className="flex items-center gap-2 mb-2">
        <AIBadge />
        <ConfidenceIndicator value={suggestion.confidence} />
      </div>

      <Alert variant="warning" className="mb-3">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Esta sugestão tem confiança baixa. Revise a evidência antes de aceitar.
        </AlertDescription>
      </Alert>

      <p className="text-sm">{suggestion.text}</p>

      <AIEvidence {...suggestion.evidence} expandable={false} />

      <div className="flex gap-2 mt-4">
        {!reviewed ? (
          <Button variant="outline" onClick={() => setReviewed(true)}>
            Revisei a evidência
          </Button>
        ) : (
          <>
            <Button onClick={() => handleAccept(suggestion)}>Aceitar</Button>
            <Button variant="outline" onClick={() => handleModify(suggestion)}>
              Modificar
            </Button>
            <Button variant="ghost" onClick={() => handleReject(suggestion)}>
              Rejeitar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
```

---

## 5. Ação Humana Explícita

### 5.1 Padrões de Interação

Toda sugestão de IA deve ter três ações possíveis:

| Ação          | Significado                      | Registra em Auditoria              |
| ------------- | -------------------------------- | ---------------------------------- |
| **Aceitar**   | Operador concorda e aplica       | Sim — quem aceitou, quando         |
| **Modificar** | Operador ajusta antes de aplicar | Sim — versão original e modificada |
| **Rejeitar**  | Operador descarta a sugestão     | Sim — motivo opcional              |

### 5.2 Componente de Ação

```tsx
interface AISuggestionActionsProps {
  suggestion: AISuggestion;
  onAccept: () => void;
  onModify: () => void;
  onReject: (reason?: string) => void;
  requireReview?: boolean;
}

function AISuggestionActions({
  suggestion,
  onAccept,
  onModify,
  onReject,
  requireReview = suggestion.confidence < 50,
}: AISuggestionActionsProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  return (
    <div className="flex items-center gap-2 mt-4">
      <Button onClick={onAccept} disabled={requireReview} size="sm">
        <Check className="mr-2 h-4 w-4" />
        Aceitar sugestão
      </Button>

      <Button variant="outline" size="sm" onClick={onModify}>
        <Pencil className="mr-2 h-4 w-4" />
        Modificar
      </Button>

      <Button variant="ghost" size="sm" onClick={() => setShowRejectDialog(true)}>
        <X className="mr-2 h-4 w-4" />
        Rejeitar
      </Button>

      {/* Dialog de rejeição com motivo */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar sugestão</DialogTitle>
            <DialogDescription>
              Opcional: informe o motivo para melhorar futuras sugestões.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motivo da rejeição (opcional)"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                onReject(rejectReason || undefined);
                setShowRejectDialog(false);
              }}
            >
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

### 5.3 Nunca Auto-Accept

Regras invioláveis:

1. **Nunca** aceitar sugestão automaticamente, mesmo com alta confiança
2. **Nunca** aplicar ação sem clique explícito do operador
3. **Nunca** pré-selecionar "Aceitar" — botões sempre em estado neutro
4. **Nunca** usar countdown para auto-aceitar ("aceitando em 5s...")
5. **Nunca** esconder opção de rejeitar
6. **Nunca** penalizar o operador por rejeitar (sem popups de "tem certeza?")

---

## 6. Proibição de UX "Mágica"

### 6.1 O que é UX Mágica (e por que é proibida)

UX "mágica" é quando o sistema age de forma autônoma sem que o operador entenda o que aconteceu, por que, e o que foi alterado.

**Proibido:**

| Anti-pattern                  | Exemplo                                   | Por que é perigoso                          |
| ----------------------------- | ----------------------------------------- | ------------------------------------------- |
| Auto-preenchimento silencioso | Campos aparecem preenchidos sem indicação | Operador pode não perceber dados incorretos |
| Reordenação automática        | Lista muda de ordem sem aviso             | Operador pode medicar paciente errado       |
| Alerta que desaparece         | Alerta de IA some após 3 segundos         | Informação crítica perdida                  |
| Ação por inferência           | "Parece que você quer..." e executa       | Ação não intencional                        |
| Filtragem implícita           | IA filtra resultados sem mostrar          | Operador não vê dados relevantes            |
| Decisão delegada              | "IA decidiu ajustar o horário"            | Responsabilidade clínica é do humano        |

### 6.2 O que Fazer em Vez Disso

| Proibido                      | Alternativa Correta                                      |
| ----------------------------- | -------------------------------------------------------- |
| Auto-preenchimento silencioso | Campo com AIBadge + "Sugerido pela IA" + valor editável  |
| Reordenação automática        | "IA sugere: ordenar por prioridade" + botão para aceitar |
| Alerta que desaparece         | Alerta persistente até o operador dismiss manualmente    |
| Ação por inferência           | Sugestão com botão explícito de aceitação                |
| Filtragem implícita           | "IA recomenda filtro: Críticos" + link para ver todos    |
| Decisão delegada              | "IA sugere: ajustar horário para 14h" + Aceitar/Rejeitar |

---

## 7. Preservação da Revisão Humana

### 7.1 Workflow de Revisão

```
IA gera sugestão
  └── Frontend exibe com evidência + confiança
       └── Operador revisa
            ├── Aceita → Ação executada → Auditoria
            ├── Modifica → Operador edita → Ação executada → Auditoria
            └── Rejeita → Motivo (opcional) → Auditoria
```

### 7.2 Componente de Review Gate

```tsx
function AIReviewGate({
  suggestion,
  children,
  criticalAction = false,
}: {
  suggestion: AISuggestion;
  children: (onProceed: () => void) => React.ReactNode;
  criticalAction?: boolean;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  if (!reviewed) {
    return (
      <Card className="border-violet-200 dark:border-violet-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AIBadge />
            <ConfidenceIndicator value={suggestion.confidence} />
          </div>
          <CardTitle className="text-base">{suggestion.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4">{suggestion.description}</p>
          <AIEvidence {...suggestion.evidence} />

          {criticalAction && (
            <div className="flex items-center gap-2 mt-4">
              <Checkbox
                id="ack-ai"
                checked={acknowledged}
                onCheckedChange={(v) => setAcknowledged(!!v)}
              />
              <Label htmlFor="ack-ai" className="text-sm">
                Revisei a evidência e entendo que esta é uma sugestão de IA, não uma recomendação
                clínica validada.
              </Label>
            </div>
          )}

          <Button
            className="mt-4"
            onClick={() => setReviewed(true)}
            disabled={criticalAction && !acknowledged}
          >
            Prosseguir com revisão concluída
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {children(() => {
        /* proceed */
      })}
    </>
  );
}
```

### 7.3 Cenários por Domínio

| Domínio   | Sugestão IA                | Review Gate                       |
| --------- | -------------------------- | --------------------------------- |
| Medicação | Ajuste de horário          | Sim — critical action             |
| Medicação | Alerta de interação        | Sim — evidence review obrigatório |
| Dor       | Tendência detectada        | Não — informacional               |
| Handoff   | Priorização de pacientes   | Sim — review gate simples         |
| Workforce | Sugestão de escala         | Sim — review gate simples         |
| Dashboard | Anomalia detectada         | Não — informacional com detalhe   |
| Chamada   | Priorização de atendimento | Sim — review gate simples         |

---

## 8. Feedback Loop do Operador

### 8.1 Coleta de Feedback

Após interagir com sugestão de IA, o operador pode fornecer feedback:

```tsx
function AIFeedbackPrompt({ suggestionId, action }: AIFeedbackProps) {
  const [feedback, setFeedback] = useState<'helpful' | 'not-helpful' | null>(null);
  const [comment, setComment] = useState('');

  if (action === 'rejected') {
    // Já coletou motivo na rejeição
    return null;
  }

  return (
    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
      <span>Esta sugestão foi útil?</span>
      <Button
        variant="ghost"
        size="sm"
        className={cn(feedback === 'helpful' && 'text-success')}
        onClick={() => {
          setFeedback('helpful');
          submitFeedback(suggestionId, 'helpful');
        }}
      >
        <ThumbsUp className="h-3 w-3 mr-1" />
        Sim
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(feedback === 'not-helpful' && 'text-destructive')}
        onClick={() => {
          setFeedback('not-helpful');
          submitFeedback(suggestionId, 'not-helpful', comment);
        }}
      >
        <ThumbsDown className="h-3 w-3 mr-1" />
        Não
      </Button>
    </div>
  );
}
```

---

## 9. Auditoria de Interações com IA

### 9.1 Eventos Registrados

| Evento                   | Dados Capturados                                            |
| ------------------------ | ----------------------------------------------------------- |
| `ai.suggestion.shown`    | ID, agente, tipo, confiança, contexto, timestamp            |
| `ai.suggestion.accepted` | ID, operador, timestamp, versão aceita                      |
| `ai.suggestion.modified` | ID, operador, versão original, versão modificada, timestamp |
| `ai.suggestion.rejected` | ID, operador, motivo (se fornecido), timestamp              |
| `ai.evidence.viewed`     | ID da sugestão, operador, tempo de visualização             |
| `ai.feedback.submitted`  | ID, operador, helpful/not-helpful, comentário               |

### 9.2 Trilha de Auditoria Visível

```tsx
function AIAuditTrail({ suggestionId }: { suggestionId: string }) {
  const { data: trail } = useQuery({
    queryKey: ['ai-audit', suggestionId],
    queryFn: () => getAIAuditTrail(suggestionId),
  });

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Histórico desta sugestão</h4>
      <Timeline>
        {trail?.events.map((event) => (
          <TimelineItem
            key={event.id}
            icon={getEventIcon(event.type)}
            title={getEventTitle(event.type)}
            description={`${event.operatorName} — ${formatDateTime(event.timestamp)}`}
          />
        ))}
      </Timeline>
    </div>
  );
}
```

---

## 10. Disclaimers e Avisos Legais

### 10.1 Disclaimer Global

Na primeira vez que o operador interage com uma sugestão de IA em uma sessão:

```tsx
function AIDisclaimerDialog() {
  const [acknowledged, setAcknowledged] = useState(false);
  const hasSeenDisclaimer = useLocalStorage('ai-disclaimer-seen', false);

  if (hasSeenDisclaimer) return null;

  return (
    <Dialog open={!hasSeenDisclaimer}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Sugestões de Inteligência Artificial
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>
            A plataforma Velya utiliza agentes de IA para fornecer sugestões e insights. Estas
            sugestões:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Não substituem o julgamento clínico profissional</li>
            <li>Podem conter erros ou informações incompletas</li>
            <li>Devem ser revisadas antes de qualquer ação</li>
            <li>São registradas em auditoria para rastreabilidade</li>
          </ul>
          <p className="font-medium">
            A responsabilidade por qualquer ação clínica é do profissional de saúde que a executa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="ack" checked={acknowledged} onCheckedChange={(v) => setAcknowledged(!!v)} />
          <Label htmlFor="ack">Entendo que sugestões de IA requerem revisão humana</Label>
        </div>
        <DialogFooter>
          <Button
            disabled={!acknowledged}
            onClick={() => {
              localStorage.setItem('ai-disclaimer-seen', 'true');
            }}
          >
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 10.2 Disclaimer Inline

```tsx
function AIInlineDisclaimer() {
  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
      <Info className="h-3 w-3" />
      Sugestão gerada por IA. Revise antes de aplicar. Não substitui avaliação clínica.
    </p>
  );
}
```

---

## 11. Configuração por Operador

### 11.1 Preferências de IA

```tsx
function AIPreferences() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferências de IA</CardTitle>
        <CardDescription>Configure como sugestões de IA são exibidas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Mostrar sugestões de IA</Label>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <Label>Nível mínimo de confiança para exibir</Label>
          <Select defaultValue="30">
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Todas</SelectItem>
              <SelectItem value="30">30%+</SelectItem>
              <SelectItem value="50">50%+</SelectItem>
              <SelectItem value="80">80%+</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <Label>Mostrar evidência expandida por padrão</Label>
          <Switch />
        </div>
        <div className="flex items-center justify-between">
          <Label>Solicitar feedback após cada interação</Label>
          <Switch defaultChecked />
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 12. Métricas de Governança

| Métrica                  | Definição                        | Alerta                          |
| ------------------------ | -------------------------------- | ------------------------------- |
| Acceptance rate          | Sugestões aceitas / mostradas    | Se > 95% (auto-accept suspeito) |
| Review time              | Tempo entre mostrar e ação       | Se < 2s (não revisou)           |
| Modification rate        | Sugestões modificadas / aceitas  | Track (indica qualidade)        |
| Rejection rate           | Sugestões rejeitadas / mostradas | Se > 70% (IA não útil)          |
| Evidence view rate       | Evidência expandida / sugestões  | Se < 20% (operadores ignorando) |
| Feedback submission rate | Feedbacks / interações           | Track                           |
| Auto-accept attempts     | Tentativas de bypass de revisão  | Qualquer > 0 (bug ou UX issue)  |

---

## 13. Referências

- [EU AI Act — High Risk Systems](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52021PC0206)
- [FDA Guidance on Clinical Decision Support](https://www.fda.gov/regulatory-information/search-fda-guidance-documents)
- [Google PAIR — Human-AI Interaction](https://pair.withgoogle.com)
- [Microsoft HAX Toolkit](https://www.microsoft.com/en-us/haxtoolkit)
- [Apple Human Interface Guidelines — Machine Learning](https://developer.apple.com/design/human-interface-guidelines/machine-learning)
