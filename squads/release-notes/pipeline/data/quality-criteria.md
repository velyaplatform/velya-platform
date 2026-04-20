# Quality Criteria — Release Notes

## Critérios por severidade

### CRÍTICO (bloqueio automático)
- Presença de PHI, PII ou dados clínicos reais.
- Presença de credencial (API key, token, senha, cert).
- Factualidade errada: changelog afirma mudança que o commit não fez.
- Breaking change sem instrução de migração.

### ALTO (bloqueio até correção)
- Commit do brief não aparece no changelog nem em "Cobertura".
- Commit `clinical` publicado em anúncio externo sem aprovação registrada.
- Quebra do padrão Conventional Commits não sinalizada (commit fora de padrão ignorado silenciosamente).
- Uso de vocabulário proibido ("incrível", "revolucionário", "estamos animados", "significativo" sem quantificador).

### MÉDIO (publicar após correção)
- Data em formato fora do padrão YYYY-MM-DD.
- Anúncio stakeholder com detalhe de implementação (hash de commit, nome de arquivo, SQL).
- Ausência de seção "Cobertura" no changelog.

### BAIXO (pode publicar, registrar como sugestão)
- Prosa poderia ser mais concisa.
- Ordem de seções diverge levemente do padrão.
- Capitalização inconsistente.

## Checklist da revisão

- [ ] Cada entrada do changelog rastreia para commit real do brief.
- [ ] Nenhum PHI ou segredo detectado.
- [ ] Breaking changes têm instrução de migração.
- [ ] Commits `clinical` têm disclaimer.
- [ ] Vocabulário proibido não aparece.
- [ ] Formato de data é YYYY-MM-DD.
- [ ] Seção "Cobertura" lista commits cobertos e ignorados.
- [ ] Anúncio stakeholder (se gerado) fala de impacto, não de implementação.
- [ ] Nomes próprios de tech stack (Temporal, Medplum, ArgoCD, NATS) preservados em inglês.
- [ ] Português (Brasil) consistente.
