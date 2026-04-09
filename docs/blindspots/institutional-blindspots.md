# Pontos Cegos Institucionais — Velya Platform

> **Versão**: 1.0 | **Atualizado em**: 2026-04-08 | **Dono**: Governança e Liderança  
> **Propósito**: Catalogar os pontos cegos da organização como empresa digital-native de agents — onde a estrutura, os processos e a governança parecem existir mas não geram valor real, ou onde lacunas institucionais criam riscos sistêmicos invisíveis.

---

## Parte 1 — Governança Sem Substância

### INST-001 — 18 Agents Definidos, Apenas 1 Com Nome Correto

**Situação**: A plataforma tem 18 agents definidos em `.claude/agents/`. A convenção de nomenclatura `{office}-{role}-agent` (definida em `.claude/rules/naming.md` e `agent-governance.md`) é seguida por apenas 1 agent.

**Indicador de que está acontecendo**: A convenção existe como regra escrita mas não é enforçada. Não há linter de nome de agent no CI.

**Impacto na operação real**:

- Identificação de agents por ID é impossível sem conhecer a convenção não aplicada
- Rastreabilidade de ações por agent fica comprometida
- Logging e métricas de agent não podem ser agregadas por office ou role
- Novos membros da equipe não conseguem inferir o propósito de um agent pelo nome

**Controle institucional necessário**:

1. Linter de nome de agent no CI:

```bash
# scripts/lint-agent-names.sh
for agent in .claude/agents/**/*.md; do
  name=$(basename $agent .md)
  if ! echo "$name" | grep -qE '^[a-z]+-[a-z]+-agent$'; then
    echo "ERRO: Nome de agent inválido: $name (esperado: {office}-{role}-agent)"
    exit 1
  fi
done
```

2. Gate de CI que bloqueia PR com agent mal-nomeado
3. Migração de todos os 17 agents com nomenclatura incorreta

---

### INST-002 — Shadow Mode Nunca Executado

**Situação**: A governança define que todo agent deve passar por shadow mode (mínimo 2 semanas para não-clínicos, 4 semanas para clínicos/financeiros) antes de ser ativado. Nenhum agent passou por shadow mode com documentação de execução e resultado.

**Indicador de que está acontecendo**: Não há logs de execução de shadow mode. Não há relatório de comparação de decisões de agent vs. humano. Não há registro de accuracy threshold atingido.

**Impacto na operação real**:

- Agents que forem ativados não terão baseline de qualidade estabelecida
- Primeiro uso em produção é o primeiro teste real — em ambiente clínico
- Sem shadow mode, não há como detectar se um agent está "errado sistematicamente" antes que cause dano

**Controle institucional necessário**:

1. Criar framework técnico de shadow mode:
   - Agent executa em modo "read + suggest" — sem ações
   - Outputs registrados para comparação com decisões reais
   - Relatório automático de accuracy após período mínimo
2. Gate de lifecycle: PR para mudar agent de `draft` para `active` requer relatório de shadow mode aprovado

---

### INST-003 — Offices Definidos Sem Charter Executável

**Situação**: Os offices estão definidos conceitualmente, mas nenhum tem um charter com:

- SLA de throughput (quantas tarefas por dia)
- Capacidade declarada (quantos agents disponíveis)
- Processo de escalação quando incapaz de atender
- Métricas de saúde e thresholds de alerta
- Definição de "office falhando"

**Indicador de que está acontecendo**: Não há `office-health-check` em nenhum dashboard. O backlog de um office pode crescer por dias sem detecção.

**Impacto na operação real**:

- Um office sobrecarregado acumula trabalho silenciosamente
- A percepção é de que "os agents estão trabalhando" quando na verdade o trabalho está na fila sem processamento
- Sem SLA, não há base para medir se o office está performando adequadamente

**Controle institucional necessário**:

```markdown
# Template de Charter de Office (obrigatório para cada office)

## Office: {nome}

## SLA de throughput: N tarefas/dia

## Capacidade máxima: X tarefas simultâneas

## Alerta de sobrecarga: backlog > Y tarefas por > Z horas

## Escalação: [humano responsável] quando backlog crítico

## Métricas de saúde: [lista de métricas e thresholds]

## Critério de "office falhando": [definição explícita]
```

---

### INST-004 — Scorecards Definidos Sem Coleta Real de Métricas

**Situação**: Os scorecards de agents estão definidos com thresholds (verde/amarelo/vermelho para validation pass rate, accuracy, latência, etc.), mas nenhuma das métricas está sendo coletada automaticamente.

**Indicador de que está acontecendo**: Não há ServiceMonitor para agents. Não há dashboard de scorecard de agent. Os thresholds existem apenas no documento de governança.

**Impacto na operação real**:

- Governança de agents é theater — parece existir mas não tem dados reais
- Um agent com 40% de validation pass rate (threshold: >90% = verde) continua sendo usado sem qualquer sinal de problema
- Decisões de promoção/rebaixamento de agents são subjetivas, não baseadas em dados

**Controle institucional necessário**:

1. Implementar coleta automática de métricas de scorecard
2. Dashboard de saúde de office com scorecards em tempo real
3. Alertas automáticos para agents abaixo de thresholds

---

### INST-005 — Nenhum Agent em Runtime Real

**Situação**: Todos os agents são definições em `.claude/agents/` — arquivos markdown com instruções. Nenhum agent está executando workflows reais de forma autônoma e persistente.

**Indicador de que está acontecendo**: Não há pods de agentes em execução no cluster. Não há workflows Temporal de orquestração de agents ativos. A governança é completamente teórica.

**Impacto na operação real**:

- A capacidade de AI da plataforma depende de interação manual com Claude CLI — não é autônoma
- Os benefícios prometidos de automação não são realizados
- A governança elaborada não tem nada para governar atualmente

**Controle institucional necessário**:

1. Definir critérios claros para ativação de agents (o que precisa estar pronto antes)
2. Executar piloto controlado com 1-2 agents em shadow mode antes de expandir
3. Não ativar agents em produção clínica sem infraestrutura de observabilidade funcionando

---

## Parte 2 — Accountability Gaps

### INST-006 — Tasks Criadas Sem Dono Humano Validando

**Situação**: Tasks geradas por agents (real ou hipotético) não têm um `human_owner` obrigatório que valide e seja responsável pela conclusão.

**Indicador de que está acontecendo**: Se tasks de agents fossem geradas hoje, elas existiriam no backlog sem dono humano. O agent que criou a task pode não existir mais amanhã (se o contexto de conversação acabar).

**Impacto na operação real**:

- Trabalho importante pode ficar pendente indefinidamente sem dono humano
- Accountability é apenas do agent — não há humano responsável pelos resultados
- Em caso de task incorreta ou prejudicial, não há dono para escalar

**Controle institucional necessário**:

```typescript
interface AgentTask {
  id: string;
  createdBy: { agentId: string; agentName: string };
  humanOwner: {
    userId: string; // Obrigatório — não pode ser nulo
    email: string;
    acceptedAt?: Date;
  };
  // ... outros campos
}
// Rejeitar task sem humanOwner no serviço de tasks
```

---

### INST-007 — Decisões de Arquitetura Sem ADR

**Situação**: Apenas 13 ADRs documentados, mas a plataforma tem centenas de decisões de arquitetura implícitas (escolha de NestJS v11, estrutura de namespaces, formato de NATS subjects, política de retry, etc.).

**Indicador de que está acontecendo**: Perguntas sobre "por que X?" frequentemente têm como resposta "não sei, foi antes" ou "está no histórico de conversa de Claude".

**Impacto na operação real**:

- Conhecimento de contexto de decisão perdido quando pessoas saem ou contextos de conversa terminam
- Decisões são revertidas ou contraditas por falta de entendimento do raciocínio original
- Novos membros tomam decisões conflitantes por não saber que uma decisão já foi tomada

**Controle institucional necessário**:

- ADR obrigatório para toda decisão que afeta mais de um serviço ou que é irreversível
- Gate no processo de PR: mudanças de arquitetura devem referenciar ADR existente ou criar novo

---

### INST-008 — Runbooks Existentes Mas Nunca Testados

**Situação**: Runbooks existem para incidentes comuns (pod crashloop, consumer lag, etc.), mas nenhum foi executado em drill controlado. A efetividade real é desconhecida.

**Indicador de que está acontecendo**: Não há registro de "game day" ou drill de incidente executado. Não há revisão de runbook pós-incidente.

**Impacto na operação real**:

- Em incidente real, o respondedor segue o runbook e descobre que está desatualizado ou incompleto
- Tempo de resolução de incidente aumenta drasticamente
- A confiança do time no runbook deteriora — passam a não usar

**Controle institucional necessário**:

- Game day mensal: executar 2-3 cenários de incidente com runbook
- Após cada game day: atualizar runbooks com gaps encontrados
- Rotação de responsável pelo game day entre membros da equipe

---

## Parte 3 — Riscos de Escalabilidade Institucional

### INST-009 — Gargalo Invisível do Coordinator Agent

**Situação**: O modelo de governança pressupõe que o coordinator agent distribui trabalho entre agents de office. Se o coordinator ficar sobrecarregado, todo o trabalho da empresa de agents acumula em um ponto único.

**Indicador de que está acontecendo**:

- Backlog crescendo em múltiplos offices simultaneamente
- Tempo médio de handoff aumentando
- Tasks novas não sendo distribuídas apesar de agents disponíveis

**Impacto na operação real**: A empresa digital de agents para de funcionar porque o ponto central de coordenação está saturado — mas ninguém sabe que o problema é o coordinator, não os agents.

**Controle institucional necessário**:

- Monitorar throughput do coordinator separadamente dos offices
- Alerta se tasks pendentes no coordinator > threshold por > N minutos
- Escalonamento horizontal do coordinator (múltiplas instâncias com particionamento por office)

---

### INST-010 — Validator Sempre Aprovando — Governança Vira Carimbo

**Situação**: Sem monitoramento de taxa de aprovação de validators, um validator que aprova tudo (por pressão de throughput, por preguiça, ou por bug) opera sem detecção.

**Indicador de que está acontecendo**:

- Taxa de aprovação de validator X: 99% por 2 semanas
- Nenhuma rejection documentada com evidência
- Tempo médio de review: 30 segundos (impossível para review real)

**Impacto na operação real**: A camada de qualidade e governança não existe efetivamente. Erros de agents passam para produção. Código incorreto é mergeado. Dados errados são processados.

**Controle institucional necessário**:

```yaml
# Alerta de validator com taxa suspeita
- alert: ValidatorApprovalRateTooHigh
  expr: |
    rate(agent_validations_approved_total[1h]) / 
    rate(agent_validations_total[1h]) > 0.95
  for: 2h
  annotations:
    summary: 'Validator {{ $labels.validator_id }} aprovando > 95% por 2h'
    description: 'Possível rubber-stamping — auditoria manual necessária'
```

---

### INST-011 — Learning Loop Propagando Padrão Errado

**Situação**: O learning loop pode aprender de incidentes isolados ou decisões excepcionais e propagar como "boa prática" para toda a instituição de agents.

**Exemplo concreto**: Uma semana de alta sazonal faz o agent aprender "padrão de hospital é ter 95% de ocupação". Esse aprendizado contamina a baseline de todos os agents que usam esse contexto.

**Indicador de que está acontecendo**:

- Agents começam a tomar decisões ligeiramente diferentes do baseline anterior
- Mudança de comportamento sem nenhuma mudança de código
- Comportamento difere entre agents que usam a memória e agents sem acesso

**Controle institucional necessário**:

1. Revisão humana obrigatória de todo novo padrão antes de propagar
2. Quarentena de 7 dias para novos padrões
3. Versionamento de aprendizado: capaz de reverter para versão anterior
4. Alerta quando drift de comportamento detectado em agents comparado a baseline

---

### INST-012 — Ausência de Definição de "Pronto" Para Agents

**Situação**: Não há Definition of Done específica para tasks executadas por agents. Um agent pode marcar uma task como "concluída" sem ter cumprido critérios mínimos de qualidade.

**Indicador de que está acontecendo**:

- Tasks marcadas como concluídas sem evidência de resultado
- Outputs de tasks incompletos ou parciais aceitos pelo sistema
- Auditoria de tasks concluídas revela que muitas são "concluídas" apenas formalmente

**Impacto na operação real**: O trabalho está sendo "feito" mas não está gerando valor real. O backlog parece diminuir, mas a qualidade do trabalho entregue é insuficiente.

**Controle institucional necessário**:

```markdown
# Definition of Done por tipo de task (exemplo)

## Task: Análise de prontidão de alta

- [ ] Checklist de critérios clínicos verificado
- [ ] Evidência documentada para cada critério
- [ ] Confiança >= 0.80 registrada
- [ ] Bloqueadores identificados (ou ausência de bloqueadores documentada)
- [ ] Recomendação com rationale e dados utilizados
- [ ] ID de decision_log criado para auditoria
```

---

## Tabela Consolidada de Pontos Cegos Institucionais

| ID       | Ponto Cego                       | Impacto                                  | Indicador Atual                   | Controle Necessário                   | Prioridade |
| -------- | -------------------------------- | ---------------------------------------- | --------------------------------- | ------------------------------------- | ---------- |
| INST-001 | Naming de agents sem enforcement | Rastreabilidade comprometida             | 17 de 18 agents mal-nomeados      | Linter no CI                          | Alta       |
| INST-002 | Shadow mode nunca executado      | Qualidade de agents desconhecida         | Zero relatórios de shadow         | Framework técnico de shadow           | Crítica    |
| INST-003 | Offices sem charter executável   | Office sobrecarregado invisível          | Nenhum charter tem SLA            | Template de charter obrigatório       | Alta       |
| INST-004 | Scorecards sem dados reais       | Governança baseada em dados inexistentes | Nenhuma métrica coletada          | Implementar coleta e dashboards       | Crítica    |
| INST-005 | Nenhum agent em runtime real     | Automação prometida não entregue         | Zero agents ativos                | Piloto controlado com critérios       | Alta       |
| INST-006 | Tasks sem dono humano            | Trabalho sem accountability              | Estrutura não enforça humanOwner  | Campo obrigatório + alerta            | Alta       |
| INST-007 | Decisões sem ADR                 | Conhecimento perdido com pessoas         | 13 ADRs para centenas de decisões | ADR obrigatório em PRs de arquitetura | Alta       |
| INST-008 | Runbooks não testados            | Incidente leva mais tempo                | Zero game days registrados        | Game day mensal                       | Alta       |
| INST-009 | Coordinator como SPOF            | Empresa de agents para de funcionar      | Sem monitoramento de coordinator  | Alerta de throughput + escalonamento  | Média      |
| INST-010 | Validator como carimbo           | Governança inoperante                    | Sem taxa de aprovação monitorada  | Alerta de taxa suspeita + auditoria   | Crítica    |
| INST-011 | Learning loop sem curadoria      | Comportamento sistêmico incorreto        | Sem versionamento de aprendizado  | Revisão humana obrigatória            | Alta       |
| INST-012 | Sem Definition of Done           | Trabalho "feito" sem qualidade           | Sem critérios por tipo de task    | DoD por tipo de task                  | Alta       |

> **Avaliação institucional**: A plataforma Velya tem uma governança sofisticada e bem documentada no papel, mas com zero enforcement técnico e zero evidência de execução real. O risco mais sério não é técnico — é que a aparência de governança cria uma sensação de segurança que não corresponde à realidade operacional. Isso é mais perigoso que não ter governança, porque reduz a vigilância.
