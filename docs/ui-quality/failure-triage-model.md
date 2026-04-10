# Modelo de Triagem de Falhas de UI

Quando um teste da esteira de UI Quality falha, a falha precisa ser
classificada rapidamente para que o dono correto seja acionado, a severidade
seja conhecida e duplicatas sejam agrupadas.

Este documento define o modelo de triagem da Velya.

## Taxonomia de Falhas

Cada falha é classificada em exatamente um dos tipos abaixo:

| Tipo               | Descrição                                                          |
| ------------------ | ------------------------------------------------------------------ |
| `overlap`          | Dois elementos interativos se sobrepondo                           |
| `contrast`         | Contraste de cor abaixo do mínimo WCAG                             |
| `clipping`         | Conteúdo cortado por `overflow: hidden`                            |
| `offscreen`        | Elemento renderizado fora da viewport                              |
| `overflow`         | Página com scroll horizontal inesperado                            |
| `a11y`             | Violação axe-core distinta de contraste                            |
| `responsive`       | Quebra específica de breakpoint                                    |
| `touch-target`     | Alvo de toque menor que 44x44px                                    |
| `sticky-overlay`   | Header/sticky cobrindo conteúdo                                    |
| `modal-drawer`     | Modal ou drawer fora da viewport                                   |
| `token-drift`      | Uso de cor/token não documentado                                   |
| `performance`      | Budget Lighthouse violado                                          |
| `visual-regression`| Diff de pixel sem causa geométrica identificada                    |
| `unknown`          | Fallback — exige triagem humana                                    |

## Registro de Falha

Toda falha é serializada em JSON com a seguinte estrutura:

```ts
interface UiFailure {
  // identidade
  id: string;                       // UUID
  fingerprint: string;              // hash estável da falha
  type: FailureType;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';

  // contexto
  route: string;
  viewport: { width: number; height: number };
  device: string;
  browser: string;

  // origem
  testFile: string;
  testName: string;
  runId: string;
  prNumber?: number;
  commitSha: string;

  // detalhes
  description: string;
  selector?: string;
  evidence: {
    screenshot?: string;
    diff?: string;
    axeJson?: string;
    geometryJson?: string;
  };

  // ownership
  owner?: string;
  office?: string;

  // tempo
  firstSeen: string;                // ISO
  lastSeen: string;                 // ISO
  occurrences: number;
}
```

## Fingerprint

O fingerprint é usado para agrupar ocorrências da mesma falha em execuções
diferentes:

```ts
function computeFingerprint(f: UiFailure): string {
  const key = [
    f.type,
    f.route,
    f.viewport.width,
    f.device,
    f.selector ?? '',
    f.description.slice(0, 80),
  ].join('|');
  return sha256(key).slice(0, 16);
}
```

Fingerprint igual → mesma falha. Ocorrências incrementam `occurrences` e
atualizam `lastSeen`.

## Severidade

Derivada do tipo + contexto:

| Tipo               | Severidade default   | Override condicional                   |
| ------------------ | -------------------- | -------------------------------------- |
| `overlap`          | critical             | —                                      |
| `contrast`         | serious              | critical se falha em rota clínica      |
| `clipping`         | serious              | —                                      |
| `offscreen`        | critical             | —                                      |
| `overflow`         | critical             | —                                      |
| `a11y`             | depende do axe impact | —                                     |
| `responsive`       | serious              | —                                      |
| `touch-target`     | serious              | critical se em rota clínica            |
| `sticky-overlay`   | serious              | critical se cobre CTA de ação crítica  |
| `modal-drawer`     | serious              | —                                      |
| `token-drift`      | moderate             | —                                      |
| `performance`      | serious              | critical se LCP > 3.5s                 |
| `visual-regression`| moderate             | serious se > 5% diff                   |
| `unknown`          | moderate             | exige triagem humana                   |

## Atribuição de Dono

Regras em ordem de precedência:

1. Se o teste tem annotation `owner` → usa ela.
2. Se o arquivo fonte do componente tem `CODEOWNERS` match → usa ele.
3. Se a rota está em mapa `route → office` → usa o office responsável.
4. Fallback: `ui-quality-office`.

Mapa de rota para office:

| Rota prefix       | Office responsável                  |
| ----------------- | ----------------------------------- |
| `/login`, `/register`, `/verify` | Identity Office       |
| `/patients`       | Clinical Experience Office          |
| `/icu`            | ICU Office                          |
| `/ems`            | EMS Office                          |
| `/pharmacy`       | Pharmacy Office                     |
| `/prescribe`      | Medication Office                   |
| `/admit`, `/discharge` | Patient Flow Office            |
| `/`, `/dashboard` | Product Office                      |

## Ciclo de Vida da Falha

```
detected → triaged → assigned → in-progress → fixed → verified → closed
                                                                    │
                                                         regressão  ▼
                                                              reopened
```

- **detected:** estado inicial automático.
- **triaged:** tipo + severidade + fingerprint atribuídos (automático).
- **assigned:** dono atribuído (automático com fallback humano).
- **in-progress:** dono pegou a falha.
- **fixed:** PR de correção mergeado.
- **verified:** próximo run verde confirma fix.
- **closed:** fechada; permanece no histórico.
- **reopened:** fingerprint reaparece após `verified`.

## SLAs de Correção

| Severidade | PR em aberto | Main verde |
| ---------- | ------------ | ---------- |
| critical   | bloqueia merge | 24h      |
| serious    | bloqueia merge | 48h      |
| moderate   | não bloqueia | 7 dias    |
| minor      | não bloqueia | 14 dias   |

## Deduplicação

Se duas falhas têm o mesmo fingerprint, o sistema:

1. Usa a mais antiga como canônica.
2. Incrementa `occurrences`.
3. Atualiza `lastSeen`.
4. Cola evidência da ocorrência mais recente.

Falhas com mesmo tipo + rota mas selector diferente são consideradas
distintas — podem ter causa diferente.

## Triagem Automática

O script `scripts/triage-ui-failures.ts` roda após cada execução da esteira
e:

1. Lê artefatos (`axe-*.json`, `geometry-*.json`, diffs de screenshot).
2. Classifica cada falha por tipo.
3. Calcula severidade e fingerprint.
4. Atribui dono.
5. Publica comentário no PR com tabela resumida.
6. Alimenta o scorecard (`ui-quality-scorecards.md`).

## Comentário Automático no PR

Exemplo:

```markdown
## UI Quality — 3 falhas detectadas

| Severidade | Tipo          | Rota       | Viewport  | Dono               |
| ---------- | ------------- | ---------- | --------- | ------------------ |
| critical   | overlap       | /patients  | 390x844   | Clinical Exp Office|
| serious    | contrast      | /login     | 1440x900  | Identity Office    |
| moderate   | token-drift   | /dashboard | 1280x720  | Product Office     |

[Ver artefatos no Action](link)
[Política de triagem](docs/ui-quality/failure-triage-model.md)
```

## Não Fazer

- Não fechar falha "verified" sem run verde confirmando.
- Não atribuir severidade manualmente sem justificativa.
- Não deduplicar falhas de tipos diferentes mesmo com fingerprint parecido.
- Não ignorar `unknown` — investigar sempre.
