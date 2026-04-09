# Modelo de Risco Cognitivo do Frontend — Velya Platform

> **Versão**: 1.0 | **Atualizado em**: 2026-04-08 | **Dono**: Produto e UX Clínico  
> **Propósito**: Análise de riscos cognitivos e de fatores humanos na interface da plataforma Velya. Em ambiente hospitalar, erros de UX têm consequências clínicas diretas. Este documento trata a interface como um sistema de segurança crítica, não apenas como produto digital.

---

## Contexto Operacional Hospitalar

Antes de analisar riscos específicos de componentes, é essencial entender o contexto em que a UI será usada:

### Perfil do Usuário Clínico

| Característica | Implicação para UX |
|---|---|
| Turnos de 12 horas | Fadiga cognitiva no final do turno. Erros aumentam nas últimas horas. |
| Múltiplas interrupções por hora | Perda de contexto frequente. A UI deve reorientar rapidamente. |
| Alta carga emocional | Estresse aumenta propensão a erros de clique e leitura rápida sem verificação. |
| Uso em movimento (enfermaria) | Leitura rápida, dispositivos variados, postura não-ideal. |
| Pressão de tempo | Atalhos cognitivos e "satisficing" (primeira opção aceitável, não a melhor). |
| Expertise variada | Residentes vs. médicos sêniors têm modelos mentais diferentes do fluxo. |
| Uso em ambiente ruidoso e iluminação variável | Leitura prejudicada. Cores e contraste críticos. |

### Modos de Falha Cognitiva em Ambiente Hospitalar

1. **Viés de confirmação**: O clínico vê o que espera ver — não o que está na tela.
2. **Fadiga de decisão**: Depois de muitas decisões, qualidade de julgamento diminui.
3. **Anchoring**: A primeira informação vista ancora todas as avaliações subsequentes.
4. **Alert fatigue**: Tantos alertas que todos são ignorados, incluindo os críticos.
5. **Automation bias**: Confiança excessiva na recomendação da AI sem verificação crítica.
6. **Mudança cega**: Não perceber mudanças em tela devido a sobrecarga de atenção.

---

## Riscos por Componente da Interface

### Componente: Command Center (Dashboard Principal)

**Descrição da interface atual**: 6 cards de métricas simultâneos (ocupação, altas pendentes, bloqueadores, intake, etc.) com badge de notificação.

---

#### CR-001 — Sobrecarga de Atenção por 6 Métricas Simultâneas

**Risco cognitivo**:  
A cognição humana tem capacidade limitada de atenção simultânea (George Miller: 7±2 chunks). 6 cards de métricas com múltiplos números cada um pode exceder este limite, especialmente em fim de turno ou em situação de pico.

**Impacto clínico potencial**: Clínico não percebe métrica crítica (ex: 3 altas urgentes bloqueadas) porque está processando as outras 5 simultaneamente. Atraso em alta medicalmente necessária.

**Controle de design**:
- Priorização hierárquica: mostrar 3 métricas críticas em destaque, 3 secundárias colapsadas
- Modo de "foco" para situação de crise — UI simplificada com apenas 2-3 métricas prioritárias
- Codificação visual de urgência que vai além de número: cor + tamanho + ícone
- Teste de atenção: eye-tracking study para verificar onde o olhar vai primeiro

**Validação**: Teste de usabilidade com clínicos em condição de fadiga simulada (final de dia). Medir tempo até detectar alerta crítico.

---

#### CR-002 — Alert Badge Com Número Mas Sem Contexto de Urgência

**Risco cognitivo**:  
Badge "7 alertas" não informa se são 7 alertas críticos ou 7 avisos de rotina. O clínico não sabe se deve interromper o que está fazendo para verificar ou pode continuar.

**Impacto clínico potencial**: Clínico ignora badge de "7 alertas" assumindo que são rotineiros. Dois deles são alertas críticos que precisavam de ação imediata.

**Controle de design**:
- Separar contagem por severidade: `🔴 2 críticos | 🟡 5 informativos`
- Preview do alerta mais crítico ao hover/tap no badge
- Som diferenciado para alertas críticos (com controle de volume/silêncio)
- Alertas críticos não removíveis por simples dismiss — exigem ação ou "aceitar e registrar motivo"

**Validação**: Teste A/B com badge simples vs. badge com contexto de severidade. Medir taxa de resposta a alertas críticos.

---

#### CR-003 — Mistura de Informações Operacionais e Clínicas

**Risco cognitivo**:  
O Command Center mistura métricas operacionais (ocupação de leitos, tempo médio de permanência) com métricas clínicas urgentes (altas bloqueadas por critério clínico). O clínico tem que filtrar mentalmente o que é operacional vs. clínico.

**Impacto clínico potencial**: Em situação de pressão, o clínico foca nas métricas operacionais (mais numéricas e objetivas) e não percebe bloqueadores clínicos que exigem julgamento.

**Controle de design**:
- Separação visual clara entre seção clínica e operacional
- Seção clínica sempre no topo, seção operacional subordinada
- Usuários com perfil clínico veem dashboard clínico-first; gestores veem operacional-first

**Validação**: Observação etnográfica de uso. Perguntar após tarefa: "o que você notou primeiro na tela?"

---

### Componente: Página de Pacientes

**Descrição**: Lista de até 20+ pacientes com filtros, status tags, e blocker indicators.

---

#### CR-004 — 20 Pacientes Simultâneos com 4 Filtros — Triagem Cognitiva Elevada

**Risco cognitivo**:  
Uma lista de 20 pacientes com múltiplos atributos visuais (status, bloqueadores, tempo de permanência, risco de alta) exige varredura visual extensa. O clínico precisa aplicar mentalmente múltiplos critérios para decidir qual paciente priorizar.

**Impacto clínico potencial**: Paciente crítico na posição 15 da lista não é notado por clínico que para de ler após as primeiras 5-7 entradas (efeito primacy).

**Controle de design**:
- Ordenação inteligente padrão: pacientes com maior urgência de ação aparecem no topo
- Filtro rápido de "ação necessária agora" como primeiro view, não como filtro adicional
- Paginação com no máximo 10 pacientes por tela — scroll não é amigável em tablet clínico
- Indicador de paciente que passou de threshold de permanência: destaque automático sem filtro

**Validação**: Teste com lista de 20 pacientes. Medir: qual paciente o clínico identifica como mais urgente? Está correto?

---

#### CR-005 — Blocker Tags Inline Perdidas em Operação sob Pressão

**Risco cognitivo**:  
Bloqueadores de alta são tags pequenas inline na linha do paciente. Sob pressão ou fadiga, leitura rápida pode perder tags que não se destacam suficientemente.

**Impacto clínico potencial**: Clínico assume que paciente está pronto para alta porque não percebeu o blocker tag "aguardando laudo de imagem". Alta iniciada prematuramente.

**Controle de design**:
- Blocker tags devem ter peso visual equivalente ao status — não subordinado
- Blocker icon com tooltip de descrição no hover
- Linha de paciente com bloqueador tem visual distinto (borda, background) — não apenas tag
- Na página de detalhe, bloqueadores são a primeira informação visível, não a última

**Validação**: Eye-tracking test. Medir se olhar do clínico detecta blocker tags em varredura rápida de 3 segundos por linha.

---

#### CR-006 — Ausência de Classificação Visual de Criticidade Além de Cor de Status

**Risco cognitivo**:  
A codificação de criticidade somente por cor (verde/amarelo/vermelho) tem dois problemas: daltonismo (8% homens) e polissemia (vermelho pode ser "pronto para alta urgente" ou "situação crítica" — qual?).

**Impacto clínico potencial**: Médico com deuteranopia não distingue paciente amarelo de paciente verde. Clínico sem daltonismo interpreta "vermelho" como diferente do intencionado pelo designer.

**Controle de design**:
- Todo código de cor acompanhado de ícone semântico AND label de texto
- Exemplo: `🔴 Bloqueado` vs. `🟢 Pronto` vs. `🟡 Em Andamento`
- Nunca confiar apenas na cor para informação crítica (WCAG 2.1 §1.4.1)
- Palette testada para as 3 formas mais comuns de daltonismo

**Validação**: Simular a UI com filtro de deuteranopia (Sim Daltonism ou similar). Verificar se todas as informações são distinguíveis.

---

### Componente: Página de Tarefas (Task Inbox)

---

#### CR-007 — Vista Plana Sem Indicador Visual de SLA Vencido Destacado

**Risco cognitivo**:  
Em uma lista de tarefas sem destaque visual para itens com SLA vencido, o clínico tende a processar em ordem de exibição (primacy effect) — não em ordem de urgência real.

**Impacto clínico potencial**: Tarefa de confirmação de alta venceu SLA há 2 horas. O clínico não percebe porque está no meio da lista sem destaque. Alta atrasada, leito bloqueado.

**Controle de design**:
- Tarefas com SLA vencido sobem automaticamente para o topo da lista com badge de "VENCIDO há X horas"
- Background vermelho/alaranjado para tarefas com SLA crítico
- Contador regressivo visível para tarefas prestes a vencer (< 30 minutos)
- Notificação push para SLA vencido (não apenas mudança visual passiva)

**Validação**: Criar lista de 15 tarefas com 3 SLAs vencidos. Medir se clínico identifica SLAs vencidos antes de começar pela primeira tarefa da lista.

---

#### CR-008 — Ação de Um Clique Sem Confirmação em Operação Irreversível

**Risco cognitivo**:  
Concluir uma tarefa de alta com um único clique é conveniente, mas elimina a barreira de reflexão. Em situação de fadiga ou distração, clique acidental pode concluir tarefa de alta indevidamente.

**Impacto clínico potencial**: Clínico clica "concluir" na tarefa de alta do leito 12 quando pretendia clicar no leito 13 (proximidade de targets, Fitts's Law). Alta registrada para paciente errado.

**Controle de design**:
- Para ações de alta: confirmar com toast "Concluindo alta do Paciente X. Cancelar (5s)"
- Janela de desfazer de 5-10 segundos com countdown visível
- Targets de clique com espaçamento mínimo de 44px (Apple HIG para touch)
- Para tablet: swipe action ao invés de tap — reduz clique acidental

**Validação**: Teste Fitts's Law — medir taxa de erro de alvo em dispositivos touch sob pressão temporal.

---

### Componente: Página de Alta (Discharge)

---

#### CR-009 — Semáforo Visual Sem Suporte Para Daltonismo

**Risco cognitivo**:  
O semáforo de prontidão para alta (vermelho/amarelo/verde) é o elemento visual principal da página de alta. Para usuários com daltonismo (especialmente deuteranopia, a forma mais comum), vermelho e verde são indistinguíveis.

**Impacto clínico potencial**: Médico com daltonismo não percebe que paciente está em estado "bloqueado" (vermelho) e inicia processo de alta para paciente que não está pronto.

**Controle de design**:
- Semáforo com ícone: `✗` para vermelho (bloqueado), `⚠` para amarelo (pendente), `✓` para verde (pronto)
- Label de texto obrigatório além da cor: "Bloqueado", "Aguardando", "Pronto para Alta"
- Teste com simulação de 3 tipos de daltonismo antes do lançamento

**Validação**: Verificar conformidade com WCAG 2.1 §1.4.1 (Color) e §1.4.3 (Contrast).

---

#### CR-010 — Ações em Massa Sem Revisão Individual

**Risco cognitivo**:  
A funcionalidade de "alta em massa" permite selecionar múltiplos pacientes e iniciar o processo de alta simultaneamente. A conveniência operacional cria risco de alta em massa equivocada.

**Impacto clínico potencial**: Clínico seleciona 5 pacientes prontos para alta. Por erro de seleção (checkbox próximos, touch impreciso), inclui inadvertidamente um 6º paciente que não está pronto. Processo de alta iniciado para paciente sem critérios.

**Controle de design**:
- Ação em massa exibe lista de revisão: "Você vai iniciar alta para: [nome 1], [nome 2], [nome 3]. Confirmar?"
- Checklist de revisão individual para cada paciente incluído
- Contagem e validação: "5 de 5 pacientes com critérios de alta verificados. Prosseguir?"
- Ação não completada instantaneamente — inicia workflow que pode ser cancelado por 30 segundos

**Validação**: Teste de seleção acidental. Medir taxa de erro de seleção em tablet com touch vs. desktop com mouse.

---

#### CR-011 — Recommendation de AI Sem Clareza Sobre Limitações

**Risco cognitivo**:  
A recomendação de AI de prontidão para alta é exibida com um indicador de confiança, mas sem explicação de quais dados foram usados, quais foram ignorados, e em que situações a AI erra mais.

**Impacto clínico potencial**:  
Viés de automação: clínico vê "AI recomenda alta — 92% confiança" e inicia alta sem verificar clinicamente. A AI pode ter alta confiança mas estar errada (especialmente para casos fora da distribuição de treino).

**Controle de design**:
- Card de recomendação sempre inclui:
  - Dados usados para a recomendação (lista de evidências)
  - Dados ausentes ou não considerados (campos faltantes)
  - Histórico de precisão para tipo similar de caso
  - Aviso explícito: "Esta é uma recomendação de suporte. A decisão clínica é responsabilidade do profissional de saúde."
- Registrar se recomendação foi seguida ou overridden (com motivo)
- Override rate baixo (< 5%) dispara revisão — pode indicar automation bias

**Validação**: Monitorar override rate. Conduzir entrevistas com clínicos sobre como interpretam recomendações de AI.

---

## Matriz de Risco Cognitivo Consolidada

| ID | Componente | Risco | Impacto Clínico | Severidade | Controle | Status |
|---|---|---|---|---|---|---|
| CR-001 | Command Center | 6 métricas simultâneas — sobrecarga de atenção | Alerta crítico não percebido | Alta | Hierarquia visual + modo foco | Ausente |
| CR-002 | Command Center | Alert badge sem contexto de urgência | Alerta crítico ignorado | Crítica | Badge com severidade + preview | Ausente |
| CR-003 | Command Center | Mistura operacional/clínico | Prioridade clínica perdida | Alta | Separação visual por domínio | Ausente |
| CR-004 | Pacientes | 20+ pacientes simultâneos | Paciente urgente não percebido | Alta | Ordenação por urgência + max 10 | Ausente |
| CR-005 | Pacientes | Blocker tags inline pequenas | Alta prematura por blocker não visto | Crítica | Peso visual equivalente ao status | Ausente |
| CR-006 | Pacientes | Somente cor para criticidade | Daltonismo — erro de interpretação | Alta | Ícone + label + cor | Ausente |
| CR-007 | Task Inbox | SLA vencido sem destaque | Tarefa urgente não atendida | Alta | Destaque automático SLA vencido | Ausente |
| CR-008 | Task Inbox | Ação de 1 clique sem confirmação | Clique acidental — ação irreversível | Crítica | Confirmação + undo window | Ausente |
| CR-009 | Discharge | Semáforo sem suporte daltonismo | Alta de paciente não pronto | Crítica | Ícone + label + cor | Ausente |
| CR-010 | Discharge | Alta em massa sem revisão | Alta de paciente errado incluído | Crítica | Checklist de revisão individual | Ausente |
| CR-011 | Discharge | AI rec sem clareza de limitações | Automation bias — decisão sem verificação | Catastrófica | Evidências + disclaimer + override tracking | Ausente |

---

## Plano de Validação de UX Clínico

### Antes do Go-Live (Pré-requisitos de UX)

1. **Teste de daltonismo**: Passar toda a UI por simulação de deuteranopia, protanopia e tritanopia
2. **Teste de acessibilidade**: WCAG 2.1 AA compliance (cor, contraste, navegação por teclado)
3. **Teste de dispositivos**: UI funcionando em iPad, Android tablet e desktop de enfermagem
4. **Teste de Fitts's Law**: Medir taxa de clique errôneo em ações críticas em touch screen

### Em Piloto (Primeiras 2 semanas com usuários reais)

5. **Sessões de observação**: Observar 3-5 clínicos usando a ferramenta no turno
6. **Think-aloud protocol**: Pedir para clínico verbalizar o que está vendo e decidindo
7. **Métricas de uso**: Time-on-task, error rate, override rate de AI
8. **Entrevistas de debriefing**: O que foi confuso? O que você quase fez errado?

### Operação Contínua

9. **Override rate monitoring**: Se override de AI < 5% → investigar automation bias
10. **Error report tracking**: Canal fácil para reportar quase-acidentes de UX
11. **Review trimestral de UX**: Revisitar riscos com dados reais de uso

---

> **Nota crítica sobre responsabilidade**: A interface de um sistema de suporte clínico é um dispositivo de segurança. Cada risco cognitivo não mitigado é uma possível fonte de dano ao paciente. O standard de qualidade de UX para esta plataforma é o de software de segurança crítica, não o de produto digital comercial.
