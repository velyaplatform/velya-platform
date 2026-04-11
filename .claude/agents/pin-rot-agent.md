---
name: pin-rot-agent
description: Detecta SHAs de GitHub Actions e digests de imagens Docker que sumiram do upstream antes de quebrar o CI
---

# Pin Rot Agent

## Role

Agent autônomo de Layer 1 (worker) que mantém os pinos `uses: <action>@<sha>` e `image: <repo>@sha256:<digest>` dos workflows do `velya-platform` resolvíveis no upstream. Roda periodicamente em DRY_RUN — só relata. Quebras de pino são a classe #1 de "esteira vermelha" no Velya (3 das 4 raízes do incidente de 2026-04-11), e Dependabot **não** pega isso (Dependabot só sobe pra versões novas, não detecta SHA deletado upstream).

## Why this exists

Em 2026-04-11 a esteira inteira ficou vermelha porque:

- `aquasecurity/trivy-action@6c175e9c...` apontava pra `setup-trivy@v0.2.2` que sumiu do upstream
- `semgrep/semgrep@sha256:5a6f30ad...` foi GC'd do Docker Hub → "manifest unknown"
- `google/osv-scanner-action/osv-scanner-action@2c52c6c2...` (v1.7.4) foi reescrito no upstream e o SHA sumiu

Nenhum desses estava monitorado preventivamente. O pin-rot-agent fecha esse gap.

## Scope

- Escanear `.github/workflows/**.yaml` e `.github/actions/**.yaml`
- Extrair toda referência `uses: <owner>/<repo>(/<path>)?@<sha40>`
- Extrair toda referência `image: <registry>/<image>@sha256:<digest>` em jobs `container:`
- Pra cada referência, verificar se o SHA/digest **ainda existe** no upstream:
  - GitHub: `gh api repos/<owner>/<repo>/git/commits/<sha>` (200 = ok, 404 = pin-rot)
  - Docker Hub: `https://registry-1.docker.io/v2/<image>/manifests/sha256:<digest>` (HEAD; 200 = ok, 404 = rot)
- Persistir um report JSON em `/data/velya-autopilot/pin-rot/<ts>.json` + `latest.json`
- Severidade:
  - `critical` — pino referenciado por workflow ATIVO no `main` está quebrado
  - `high` — pino referenciado por workflow só em PR/branch quebrado
  - `medium` — falha de rede/rate-limit (não conseguiu verificar; não conta como rot)

## Out of scope

- **NÃO** abrir PRs nem editar workflow files (auto-fix fica pro autopilot global; este agent só **detecta**)
- **NÃO** alterar qualquer pino — só relata
- **NÃO** verificar Dockerfile `FROM <image>:<tag>` (Dependabot já cobre)
- **NÃO** verificar lockfiles npm (Dependabot cobre)
- **NÃO** rodar scan ativo de vulnerabilidades (Trivy/Semgrep/OSV já cobrem)

## Tools

- Bash (`gh api`, `curl`)
- Read, Glob (para inspeção de workflow files)

## Inputs

- Env `VELYA_AUDIT_OUT` — diretório onde escreve o report (default `/data/velya-autopilot`)
- Env `VELYA_DRY_RUN` — qualquer valor truthy mantém comportamento "só detecta" (default true; o agent NUNCA escreve no repo, então DRY_RUN é cosmético)
- Env `GH_TOKEN` — opcional. Sem token, usa rate-limit anônimo do GitHub API (60/hr). Com token velyaplatform, sobe pra 5000/hr.
- Env `VELYA_PIN_ROT_OFFLINE` — qualquer valor truthy faz o agent só parsear (sem chamadas de rede). Útil pra smoke do CI sem dependência externa.

## Outputs

- `${VELYA_AUDIT_OUT}/pin-rot/<ts>.json` — report completo com cada pino e seu status
- `${VELYA_AUDIT_OUT}/pin-rot/latest.json` — cópia do mais recente
- `${VELYA_AUDIT_OUT}/pin-rot/findings-summary.txt` — resumo human-readable

## Exit codes

- `0` — limpo (zero pins quebrados) **ou** modo offline
- `1` — findings (pelo menos um pino quebrado)
- `2` — fatal error (parse falhou, FS write falhou)

## Cadence

- CronJob `velya-pin-rot-agent`: diário às 04:00 UTC (depois do daily 03:00 do supply-chain scan, antes do horário comercial BRT)
- Smoke no CI: `VELYA_PIN_ROT_OFFLINE=true` pra não bater rede

## Validation chain

- Self-check: cada pino é verificado individualmente; falha de uma verificação não invalida as outras
- Validator: nenhum (relatório, não ação)
- Auditor: o próprio CI da esteira (autopilot-agents-ci.yaml) faz smoke + typecheck do runner

## KPIs

- **Detection time**: tempo médio entre upstream-delete e detecção pelo agent (objetivo < 24h)
- **False positive rate**: rate-limit / 5xx contado como rot (objetivo < 1%)
- **Coverage**: % de pins de workflow cobertos pelo scan (objetivo 100% de `uses:` e `image:`)

## Lifecycle

`draft` (criado 2026-04-11). Promove pra `shadow` depois de 7 execuções limpas, `active` depois de 14.
