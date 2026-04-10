# Arquitetura de Validação de UI (10 Camadas)

Este documento descreve a arquitetura em 10 camadas que a Velya usa para validar
qualidade de UI em todo o ciclo de vida: do commit ao deploy em produção.

O objetivo é deixar explícito o que cada camada detecta, o que NÃO detecta, e
como as camadas se encaixam para formar uma esteira de defesa em profundidade.

## Princípios

1. Nenhuma camada é suficiente sozinha. Cada uma cobre uma classe de falha
   distinta.
2. Falhas automáticas só substituem falhas humanas parcialmente. Revisão visual
   por humano continua sendo obrigatória em PRs que alteram baselines.
3. Cada falha precisa ser classificada (severidade, tipo, dono) para que a
   triagem seja rápida.
4. Testes determinísticos são inegociáveis. Flaky tests viram débito operacional.
5. Cobertura responsiva é obrigatória — desktop, tablet e mobile.

## As 10 Camadas

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  1. STATIC GUARDRAILS    tsc --noEmit, ESLint strict, prettier check     │
 ├──────────────────────────────────────────────────────────────────────────┤
 │  2. STATE COVERAGE       Storybook stories (default, loading, empty,     │
 │                          error, disabled, long content, mobile, dark)   │
 ├──────────────────────────────────────────────────────────────────────────┤
 │  3. COMPONENT VR         Playwright screenshots por componente isolado   │
 ├──────────────────────────────────────────────────────────────────────────┤
 │  4. PAGE VR              Playwright full-page em rotas reais             │
 ├──────────────────────────────────────────────────────────────────────────┤
 │  5. FLOW VR              Screenshots durante jornadas multi-step         │
 ├──────────────────────────────────────────────────────────────────────────┤
 │  6. A11Y / CONTRAST      @axe-core/playwright + WCAG 2.2 AA baseline     │
 ├──────────────────────────────────────────────────────────────────────────┤
 │  7. GEOMETRY ASSERTIONS  overlap, clipping, offscreen, touch-target <44  │
 ├──────────────────────────────────────────────────────────────────────────┤
 │  8. RESPONSIVE MATRIX    1440x900, 1280x720, iPad, iPhone, Android       │
 ├──────────────────────────────────────────────────────────────────────────┤
 │  9. PERFORMANCE BUDGETS  Lighthouse CI — LCP, CLS, FID, a11y score       │
 ├──────────────────────────────────────────────────────────────────────────┤
 │ 10. EVIDENCE / TRIAGE    Artefatos, fingerprint, dono, scorecard, MTTR   │
 └──────────────────────────────────────────────────────────────────────────┘
```

## Camada 1 — Static Guardrails

**O que detecta:** erros de tipo, imports quebrados, lint violations, código
morto, classes Tailwind inválidas, uso de APIs depreciadas.

**Ferramentas:** `tsc --noEmit`, ESLint (`--max-warnings 0`), Prettier check.

**Tempo alvo:** < 90 segundos no CI.

**Gate:** bloqueante. PR não entra em revisão se falhar.

## Camada 2 — State Coverage (Storybook)

**O que detecta:** estados faltantes, regressões em estados não-default,
componentes que quebram com conteúdo longo ou vazio.

**Obrigatório por componente:**

- `default`
- `loading`
- `empty`
- `error`
- `disabled`
- `long-content` (texto longo sobrepondo layout)
- `with-icon` / `without-icon`
- `validation-error` (inputs)
- `permission-denied`
- `mobile-compact`
- `dark` / `light`

Detalhes em `storybook-state-coverage.md`.

## Camada 3 — Component Visual Regression

**O que detecta:** mudança visual inesperada em um componente isolado.
Screenshots determinísticos contra baselines versionadas.

**Preferência:** componente isolado > página inteira. Diffs menores, menos
flaky, triagem mais rápida.

Detalhes em `playwright-visual-testing.md`.

## Camada 4 — Page Visual Regression

**O que detecta:** regressões compostas — quando componentes individuais estão
OK mas a página inteira quebra (ex: sticky header cobrindo CTA, grid que
colapsa).

**Rotas cobertas:** `/`, `/login`, `/register`, `/verify`, `/patients`,
`/patients/[id]`, `/icu`, `/ems`, `/pharmacy`, `/dashboard`.

## Camada 5 — Flow Visual Regression

**O que detecta:** regressões específicas de estado durante uma jornada real
(ex: modal de confirmação quebrado após submit, toast de erro cortado).

**Exemplos:** login completo, cadastro com verificação, prescrição de
medicação, admissão de paciente, discharge.

## Camada 6 — A11y / Contraste

**O que detecta automaticamente:** ~57% dos issues de acessibilidade (estudo
Deque) — contraste insuficiente, falta de label, ARIA incorreto, landmarks
ausentes, headings fora de ordem, alt text ausente.

**O que NÃO detecta:** UX de leitor de tela, ordem de leitura real, usabilidade
de navegação por teclado, clareza cognitiva.

**Ferramentas:** `@axe-core/playwright`, baseline WCAG 2.2 nível AA.

Detalhes em `axe-and-accessibility-pipeline.md`.

## Camada 7 — Geometry Assertions

**O que detecta:** overlap entre elementos interativos, clipping, elementos
offscreen, scroll horizontal, touch targets menores que 44x44px, header
cobrindo CTA, modal saindo da viewport.

Detalhes em `geometry-and-layout-assertions.md`.

## Camada 8 — Responsive Matrix

**O que detecta:** quebras específicas em breakpoints. Executa camadas 3-7 em
cada viewport da matriz.

**Viewports:** 1440x900, 1280x720, iPad portrait/landscape, iPhone 14, Android
medium, Android large.

Detalhes em `responsive-viewport-matrix.md`.

## Camada 9 — Performance Budgets

**O que detecta:** regressões de performance, bundle size explodindo, LCP
subindo, CLS aparecendo.

**Ferramentas:** Lighthouse CI com budgets por rota.

**Targets mínimos:**

- Performance: 85+
- Accessibility: 95+
- Best Practices: 90+
- SEO: 85+
- LCP < 2.5s, FID < 100ms, CLS < 0.1

Detalhes em `lighthouse-ci-budgets.md`.

## Camada 10 — Evidence / Triagem

**O que faz:** coleta artefatos (screenshots, diffs, relatórios axe, JSON do
Lighthouse), classifica cada falha, calcula fingerprint para deduplicação,
atribui dono, mantém scorecard e MTTR.

Detalhes em `failure-triage-model.md` e `ui-quality-scorecards.md`.

## Gates no Pipeline

| Camada | Gate em PR | Gate em main | Frequência extra   |
| ------ | ---------- | ------------ | ------------------ |
| 1      | bloqueante | bloqueante   | —                  |
| 2      | bloqueante | bloqueante   | —                  |
| 3      | bloqueante | bloqueante   | —                  |
| 4      | bloqueante | bloqueante   | noturno            |
| 5      | alerta     | bloqueante   | noturno            |
| 6      | bloqueante | bloqueante   | noturno            |
| 7      | bloqueante | bloqueante   | noturno            |
| 8      | alerta     | bloqueante   | noturno            |
| 9      | alerta     | bloqueante   | noturno            |
| 10     | informa    | informa      | contínuo           |

## Relação com Outras Áreas

- **Red Team Office:** revisa blind spots da esteira mensalmente. Camada 10
  alimenta scorecards monitorados pelo Red Team.
- **Design System:** baselines de componentes isolados (camada 3) servem como
  regression tests do próprio design system.
- **Clinical Safety:** fluxos clínicos críticos (admissão, prescrição,
  discharge) têm cobertura obrigatória em camadas 5, 6 e 7.

## Referências

- `visual-regression-strategy.md`
- `playwright-visual-testing.md`
- `axe-and-accessibility-pipeline.md`
- `geometry-and-layout-assertions.md`
- `lighthouse-ci-budgets.md`
- `failure-triage-model.md`
- `github-actions-ui-quality-pipeline.md`
