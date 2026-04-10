# Scorecards de UI Quality

Este documento define os scorecards usados para medir a saúde da esteira de
UI Quality da Velya. Scorecards são revisados semanalmente pelo UI Quality
Office e pelo Red Team Office.

## Princípio

"O que não é medido é assumido." A esteira de UI Quality só é confiável se
conseguirmos responder objetivamente: **o quanto estamos protegendo a UI?**

## Scorecards Oficiais

### 1. Visual Regression Pass Rate

Mede o percentual de testes visuais que passam sem retry em `main`.

| Métrica                  | Verde  | Amarelo | Vermelho | Crítico |
| ------------------------ | ------ | ------- | -------- | ------- |
| Pass rate (sem retry)    | >98%   | 95-98%  | 90-95%   | <90%    |
| Pass rate (com retry)    | >99.5% | 99-99.5%| 97-99%   | <97%    |

Sinal de alerta: queda de 1% semana a semana.

### 2. Accessibility Pass Rate

Percentual de runs sem violações `critical` ou `serious` do axe-core.

| Métrica                  | Verde  | Amarelo | Vermelho | Crítico |
| ------------------------ | ------ | ------- | -------- | ------- |
| Run sem critical/serious | >99%   | 95-99%  | 90-95%   | <90%    |
| Violações `moderate`/run | <3     | 3-5     | 5-10     | >10     |

### 3. Contrast Pass Rate

Subset específico de violações de contraste. Calculado separadamente pela
alta confiabilidade do axe nesse ponto.

| Métrica                  | Verde  | Amarelo | Vermelho | Crítico |
| ------------------------ | ------ | ------- | -------- | ------- |
| Rotas sem violação       | 100%   | 95-100% | 90-95%   | <90%    |

Contraste é a primeira coisa que deve estar no verde — é o mais fácil de
detectar e corrigir.

### 4. Responsive Pass Rate

Percentual da matriz de viewports que passa todos os checks.

| Métrica                    | Verde  | Amarelo | Vermelho | Crítico |
| -------------------------- | ------ | ------- | -------- | ------- |
| Viewports verdes por rota  | 100%   | 85-100% | 70-85%   | <70%    |

### 5. Geometry Pass Rate

Testes de geometria (overlap, offscreen, touch-target, etc.).

| Métrica                 | Verde  | Amarelo | Vermelho | Crítico |
| ----------------------- | ------ | ------- | -------- | ------- |
| Runs sem issue blocante | >99%   | 95-99%  | 90-95%   | <90%    |
| Runs sem issue moderado | >95%   | 85-95%  | 75-85%   | <75%    |

### 6. Mobile Pass Rate

Subset focado em viewports mobile (iPhone, Android).

| Métrica              | Verde | Amarelo | Vermelho | Crítico |
| -------------------- | ----- | ------- | -------- | ------- |
| Mobile VR pass rate  | >98%  | 95-98%  | 90-95%   | <90%    |
| Touch-target issues  | 0     | 1-3     | 4-10     | >10     |

Mobile tem gate específico porque tende a ser menos testado em revisão
humana.

### 7. Design System Integrity

Mede quão consistente o app está com os tokens do design system.

| Métrica                     | Verde  | Amarelo | Vermelho | Crítico |
| --------------------------- | ------ | ------- | -------- | ------- |
| Cores fora do token         | 0      | 1-5     | 6-15     | >15     |
| Espaçamentos ad-hoc         | 0      | 1-10    | 11-30    | >30     |
| Componentes duplicados      | 0      | 1-3     | 4-8      | >8      |

Detectado via ESLint custom rules + análise estática do Tailwind.

### 8. Flaky Rate

Percentual de testes que precisaram de retry para passar.

| Métrica            | Verde | Amarelo | Vermelho | Crítico |
| ------------------ | ----- | ------- | -------- | ------- |
| Retry rate semanal | <0.5% | 0.5-1%  | 1-3%     | >3%     |
| Testes taguados @flaky | 0  | 1-3     | 4-8      | >8      |

Meta agressiva porque flakiness corrói confiança na esteira.

### 9. MTTR — Mean Time to Repair

Tempo entre detecção e correção de regressão visual.

| Severidade | Verde   | Amarelo  | Vermelho | Crítico |
| ---------- | ------- | -------- | -------- | ------- |
| critical   | <4h     | 4-24h    | 24-48h   | >48h    |
| serious    | <24h    | 24-48h   | 48h-7d   | >7d     |
| moderate   | <3d     | 3-7d     | 7-14d    | >14d    |

### 10. Performance Budget Compliance

Percentual de runs Lighthouse que passam todos os budgets.

| Métrica          | Verde | Amarelo | Vermelho | Crítico |
| ---------------- | ----- | ------- | -------- | ------- |
| Budgets verdes   | 100%  | 95-100% | 85-95%   | <85%    |
| LCP p95 desktop  | <2.2s | 2.2-2.5s| 2.5-3.0s | >3.0s   |
| LCP p95 mobile   | <2.8s | 2.8-3.2s| 3.2-4.0s | >4.0s   |

## Cadência de Revisão

| Atividade                            | Frequência |
| ------------------------------------ | ---------- |
| Scorecard snapshot                   | Diário     |
| Revisão semanal do UI Quality Office | Semanal    |
| Revisão do Red Team                  | Mensal     |
| Retrospectiva de qualidade           | Trimestral |

## Publicação

Scorecards são publicados em:

1. `docs/ui-quality/scorecards-current.md` (atualizado diariamente).
2. Dashboard Grafana `velya-ui-quality`.
3. Comentário automático em PR quando métricas de PR degradam.

## Ações Automáticas por Status

| Status   | Ação                                                              |
| -------- | ----------------------------------------------------------------- |
| Verde    | Nenhuma.                                                          |
| Amarelo  | Alerta no Slack do UI Quality Office.                             |
| Vermelho | Incident aberto; revisão obrigatória na próxima semana.           |
| Crítico  | Imediato: pausa novas features de UI até volta ao amarelo.        |

## Não Fazer

- Não ajustar thresholds de scorecard "para ficar verde".
- Não desabilitar métrica sem ADR.
- Não esconder falhas recorrentes — deduplicação ≠ esconder.
- Não medir apenas em PR — main e noturno contam também.
