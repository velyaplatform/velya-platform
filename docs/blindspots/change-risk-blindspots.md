# Pontos Cegos de Gestão de Mudança — Velya Platform

> **Versão**: 1.0 | **Atualizado em**: 2026-04-08 | **Dono**: Engenharia e DevOps  
> **Propósito**: Catalogar os riscos de mudança específicos da plataforma Velya — como mudanças pequenas podem ter efeitos sistêmicos, e que controles são necessários para detectar e conter esses efeitos.

---

## Incidentes Históricos de Mudança

Os seguintes incidentes reais do projeto Velya servem como base para o catálogo de riscos:

| Incidente | Data | Causa | Impacto | Descoberta |
|---|---|---|---|---|
| Prettier corrompeu templates Helm | 2025-Q4 | `.prettierignore` não incluía `charts/**/*.yaml` | Todos os Helm charts com `{{ }}` corrompidos para `{ { }` | Próximo `helm template` falhou |
| Remoção de `isolatedModules` quebrou 20 arquivos | 2025-Q4 | Mudança de configuração TypeScript afetou todos os arquivos com exports de type | 20+ erros de compilação em serviços diferentes | CI falhou em cascade |
| OpenTofu taint com `NoSchedule` em vez de `NO_SCHEDULE` | 2025-Q4 | Case-sensitivity de enum Kubernetes não validada | Taint não aplicado, nó continuou recebendo pods | Diagnóstico tardio de comportamento incorreto |
| Push rejeitado após commit de CI/CD | 2025 | Remote estava à frente do local após CI fazer commit automático | Push manual rejeitado com non-fast-forward | `git pull --rebase` necessário |

---

## Catálogo de Riscos de Mudança

### CHANGE-001 — Mudança Pequena com Efeito Sistêmico

**Descrição**: Uma mudança aparentemente localizada (uma linha de configuração, um flag de compilador) tem efeito em cascata em múltiplos componentes.

**Exemplo histórico**: Remoção de `isolatedModules: true` do `tsconfig.json` quebrou 20 arquivos de uma vez porque eliminando este modo, o TypeScript passou a rejeitar exports de type que antes eram aceitos.

**Por que é cego**: O desenvolvedor que fez a mudança testou o componente onde foi feita. Não testou os outros 19 componentes afetados.

**Gate de prevenção**:
```bash
# CI: verificar impacto de mudanças em tsconfig.json
if git diff --name-only | grep -q "tsconfig.json"; then
  echo "Mudança em tsconfig detectada — executando verificação completa de tipos"
  npx tsc --noEmit --project tsconfig.json
  # Executar typecheck em TODOS os pacotes, não apenas o modificado
fi
```

**Quem valida**: Review obrigatório pelo tech lead para mudanças em arquivos de configuração de compilador.

**Observabilidade**: CI deve mostrar quais arquivos foram afetados pelo typecheck — não apenas pass/fail.

---

### CHANGE-002 — Mudança "Só de Config" Sem Revisão Adequada

**Descrição**: Mudanças em arquivos de configuração (Helm values, ConfigMaps, tsconfig, .env.example) são frequentemente revisadas com menos rigor que mudanças de código, mas têm impacto igualmente crítico.

**Risco específico Velya**:
- `values-prod.yaml`: mudança de resource limits pode causar OOMKill ou thrash de KEDA
- `alertmanager-config.yaml`: mudar receiver pode silenciar todos os alertas
- `.claude/rules/*.md`: mudança em regra de agent pode alterar comportamento de todos os agents

**Gate de prevenção**: Marcar arquivos de configuração críticos como CODEOWNERS com reviewers mandatórios.

```
# .github/CODEOWNERS
infra/helm/charts/**/values-prod.yaml @velya/platform-leads
infra/argocd/** @velya/platform-leads
.claude/rules/** @velya/governance-leads
platform/**/*.yaml @velya/platform-leads
```

**Quem valida**: Pelo menos 2 approvals para mudanças em arquivos marcados como críticos.

---

### CHANGE-003 — Drift Entre Documentação e Realidade do Cluster

**Descrição**: A documentação de arquitetura e os runbooks descrevem o estado desejado ou o estado anterior — não o estado atual do cluster. Mudanças no cluster não refletem na documentação.

**Exemplo específico**: A documentação diz "KEDA escala patient-flow-service baseado em consumer lag NATS". Na realidade, o ServiceMonitor ainda não existe, portanto o KEDA está usando um trigger de CPU por fallback. Alguém seguindo a documentação não entende por que o scaling se comporta diferente do esperado.

**Gate de prevenção**:
- Mudanças no cluster (via kubectl apply manual ou ArgoCD) devem ser acompanhadas de atualização de documentação no mesmo PR
- Template de PR inclui: "Documentação atualizada? ☐ Sim ☐ N/A (mudança não afeta docs)"
- Revisão trimestral de documentação vs. realidade

**Quem valida**: Reviewer do PR verifica se mudança de infra tem documentação correspondente.

---

### CHANGE-004 — Rollout Sem Abort Automático

**Descrição**: Nenhum deployment da plataforma Velya tem rollback automático configurado. Se um deploy causa aumento de error rate ou latência, a reversão requer intervenção manual.

**Risco**: Em ambiente clínico operando 24x7, um deploy defeituoso às 3h da manhã pode afetar a operação hospitalar por horas até que alguém perceba e faça rollback manual.

**Gate de prevenção**:
```yaml
# ArgoCD Rollout para discharge-orchestrator
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: discharge-orchestrator
spec:
  strategy:
    canary:
      steps:
        - setWeight: 10   # 10% do tráfego na nova versão
        - pause: {duration: 5m}
        - setWeight: 50
        - pause: {duration: 5m}
        - setWeight: 100
      analysis:
        templates:
          - templateName: discharge-orchestrator-analysis
        args:
          - name: service-name
            value: discharge-orchestrator
```

**Quem valida**: A análise automática (error rate, latência p95) determina se o canary avança ou faz rollback.

---

### CHANGE-005 — Rollback Que Não Reverte Dependências de Schema

**Descrição**: Um rollback de código reverte a aplicação para a versão anterior, mas não reverte a migration de banco de dados que foi executada junto com o deploy. O código antigo encontra um schema novo e pode falhar de formas inesperadas.

**Exemplo**: Nova versão adiciona coluna `discharge_reason` NOT NULL ao banco. Rollback para versão anterior — o código antigo não envia `discharge_reason` em INSERTs. Todos os INSERTs falham com constraint violation.

**Gate de prevenção**:
- Migrations devem ser backward-compatible: nunca adicionar NOT NULL sem default
- Separar deploy de schema de deploy de código: migration roda primeiro, código depois, como etapas independentes
- Runbook de rollback inclui instrução sobre como tratar schema (reverter migration? aplicar migration de compensação?)

**Quem valida**: DBA ou senior engineer deve revisar todas as migrations para confirmar backward-compatibility.

---

### CHANGE-006 — Feature Flag Sem Dono e Sem Data de Remoção

**Descrição**: Feature flags criadas sem documentação de dono e data de expiração tornam-se "zumbis" — existem indefinidamente, adicionando complexidade ao código sem valor claro.

**Risco específico Velya**: Flags que controlam comportamento de AI (ex: `velya.ai.discharge-recommendation.enabled`) são especialmente perigosas se reativadas inadvertidamente após longa inatividade.

**Gate de prevenção**:
```typescript
// Toda feature flag deve ter metadata obrigatória
interface FeatureFlag {
  name: string;
  owner: string;           // Email do responsável
  description: string;
  expiryDate: Date;        // Quando deve ser removida
  cleanupPR?: string;      // PR de remoção planejada
}
```

**Observabilidade**: Alerta para flags sem atualização há mais de 30 dias ou com data de expiração passada.

---

### CHANGE-007 — PR Aprovado Sem Entendimento Real do Impacto

**Descrição**: Pull Requests com mudanças críticas (em sistema de AI, dados clínicos, infraestrutura) são aprovados por reviewers que não têm domínio suficiente para avaliar o impacto real.

**Risco específico Velya**: Um PR que muda a lógica de construção de contexto de AI para o discharge-orchestrator pode ter impacto clínico direto. Se o reviewer foca apenas na sintaxe do TypeScript e não na semântica do prompt, o impacto passa despercebido.

**Gate de prevenção**:
- CODEOWNERS por domínio: mudanças em AI prompt logic requerem reviewer com conhecimento de AI safety
- Template de PR inclui seção obrigatória: "Qual é o impacto clínico potencial desta mudança?"
- Para mudanças em `.claude/` e `packages/ai-gateway/`: revisão obrigatória de um membro do AI Safety team

---

### CHANGE-008 — Prettier Corrompendo Templates Helm

**Descrição**: Prettier configurado para formatar todos os arquivos YAML converte `{{` para `{ {` em templates Helm, corrompendo completamente a sintaxe de template.

**Exemplo histórico confirmado**: Este incidente já ocorreu no projeto Velya.

**Gate de prevenção**:
```bash
# .prettierignore — deve incluir:
charts/**
infra/helm/**
**/*.helm.yaml
```

```bash
# CI: verificar se templates Helm são válidos após qualquer mudança em charts/
helm lint charts/velya-patient-flow/
helm template charts/velya-patient-flow/ --values charts/velya-patient-flow/values-dev.yaml > /dev/null
```

**Quem valida**: CI automaticamente. Lint Helm em qualquer PR que toque `charts/`.

**Status**: Mitigado parcialmente — `.prettierignore` existe mas pode não cobrir todos os casos.

---

### CHANGE-009 — Version Bump Automático Sem Verificação de Breaking Changes

**Descrição**: O workflow `version-bump.yml` faz bump automático de versões de dependências. Uma nova versão de uma biblioteca pode introduzir breaking changes que passam despercebidos pela ausência de testes adequados.

**Exemplo**: `@nestjs/common` v11 → v12: mudança de API em decorators. Com cobertura de testes próxima de zero, os erros de runtime só aparecem em produção.

**Gate de prevenção**:
```yaml
# .github/workflows/version-bump.yml: adicionar verificação
- name: Verify no breaking changes
  run: |
    # Verificar se há notas de breaking change no CHANGELOG da dependência
    npx depcheck --skip-missing
    # Executar todos os testes (não apenas smoke test)
    npm run test:integration
    # Verificar typecheck
    npx tsc --noEmit
```

**Quem valida**: Version bumps de major ou minor version requerem review manual e não são auto-merged.

---

### CHANGE-010 — OpenTofu Taint com Case Error em Enum Kubernetes

**Descrição**: Enums Kubernetes têm case-sensitivity específica. `NoSchedule` é válido, `NO_SCHEDULE` não é. OpenTofu aceita o valor sem erro, mas o taint não é aplicado corretamente.

**Exemplo histórico confirmado**: Taint de nó com `effect: NO_SCHEDULE` em vez de `effect: NoSchedule` — OpenTofu aplicou sem erro, nó continuou recebendo pods que deveriam ser evitados.

**Gate de prevenção**:
```hcl
# Validação explícita em módulo OpenTofu
variable "taint_effect" {
  type = string
  validation {
    condition     = contains(["NoSchedule", "PreferNoSchedule", "NoExecute"], var.taint_effect)
    error_message = "taint_effect deve ser: NoSchedule, PreferNoSchedule, ou NoExecute (case-sensitive)"
  }
}
```

**Quem valida**: Validação automática via `tofu validate` no CI.

---

### CHANGE-011 — Push Rejeitado por Remote Ahead Após Commit de CI/CD

**Descrição**: O pipeline CI/CD faz commit automático (ex: version bump, geração de arquivo) no branch. O desenvolvedor que disparou a CI tenta fazer push de mudanças locais e recebe "non-fast-forward — remote ahead" error.

**Exemplo histórico confirmado**: Após CI fazer commit de version bump, push local rejeitado. Solução: `git pull --rebase` + push.

**Gate de prevenção**:
- CI que faz commits automáticos usa branch separado + cria PR (não faz push direto para main)
- Documentar no CONTRIBUTING.md: "Se push for rejeitado, fazer `git pull --rebase origin main`"
- Configurar CI para usar branch próprio para commits automáticos

---

### CHANGE-012 — Release Sem Observação Pós-Implantação Estruturada

**Descrição**: Após um deploy, não há protocolo formal de observação da saúde do sistema por N minutos antes de o time considerar o deploy "concluído".

**Risco**: Um problema que manifesta após 5-10 minutos (ex: memory leak gradual, latência crescente) não é detectado na janela informal de "parece estar funcionando".

**Gate de prevenção**:
```markdown
# Release Checklist (obrigatório após cada deploy para produção)
- [ ] Verificar error rate do serviço nos primeiros 10 minutos
- [ ] Verificar latência p95 nos primeiros 10 minutos (deve estar dentro de baseline)
- [ ] Verificar pod restarts (deve ser 0 após deploy)
- [ ] Verificar consumer lag NATS (não deve estar crescendo)
- [ ] Verificar memória dos pods novos (não deve estar crescendo)
- [ ] Confirmar no canal de operações: "Deploy de [serviço] [versão] observado por 10 minutos — saudável"
```

---

### CHANGE-013 — Mudança Crítica Sem Chaos Test Prévio

**Descrição**: Mudanças de infraestrutura crítica (mudança de CNI, upgrade de NATS, migração de banco) são aplicadas sem validação prévia do comportamento sob falha.

**Risco**: A mudança pode interagir com modos de falha existentes de formas não previstas. Sem chaos test, o primeiro "teste de falha" é um incidente real.

**Gate de prevenção**:
- Para mudanças de nível de plataforma: chaos test obrigatório no ambiente de staging antes de produção
- Definir critério de chaos test por tipo de mudança: "upgrade de NATS requer: teste de failover, teste de consumer reconnect, teste de publisher durante restart"
- Resultado de chaos test documentado na descrição do PR

---

## Tabela de Riscos Consolidada

| ID | Risco | Exemplo Histórico | Gate de Prevenção | Status |
|---|---|---|---|---|
| CHANGE-001 | Mudança small com efeito sistêmico | `isolatedModules` quebrou 20 arquivos | CI completo em mudanças de config de compilador | Ausente |
| CHANGE-002 | Config sem revisão adequada | — | CODEOWNERS para configs críticas | Ausente |
| CHANGE-003 | Drift doc vs. cluster | — | Template de PR com checklist de doc | Ausente |
| CHANGE-004 | Rollout sem abort automático | — | ArgoCD Rollouts com análise automática | Ausente |
| CHANGE-005 | Rollback sem reverter schema | — | Migrations backward-compatible | Ausente |
| CHANGE-006 | Feature flag zumbi | — | Registro com owner + expiry | Ausente |
| CHANGE-007 | PR aprovado sem entendimento | — | CODEOWNERS por domínio de AI/clínico | Ausente |
| CHANGE-008 | Prettier corrompendo Helm | Confirmado — ocorreu no Velya | `.prettierignore` + `helm lint` no CI | Parcial |
| CHANGE-009 | Version bump sem check de breaking | — | Verificação de CHANGELOG + testes completos | Ausente |
| CHANGE-010 | OpenTofu taint case error | Confirmado — `NO_SCHEDULE` vs. `NoSchedule` | Validação de enum no módulo Tofu | Ausente |
| CHANGE-011 | Push rejeitado por CI ahead | Confirmado — non-fast-forward | Documentado; CI usa branch separado | Parcial |
| CHANGE-012 | Deploy sem observação estruturada | — | Release checklist obrigatório | Ausente |
| CHANGE-013 | Mudança crítica sem chaos test | — | Chaos test obrigatório para plataforma | Ausente |

> **Ponto de atenção**: 3 destes riscos têm exemplos históricos confirmados no projeto Velya. Isso indica padrão sistêmico — não são eventos isolados. Os gates de prevenção precisam ser incorporados ao processo de desenvolvimento antes do próximo ciclo de mudanças críticas.
