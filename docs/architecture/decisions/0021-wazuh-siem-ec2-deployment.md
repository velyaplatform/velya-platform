# ADR-0021: Wazuh SIEM Server on EC2

## Status

Accepted

## Date

2026-04-17

## Context

A plataforma Velya opera dois clusters EKS (App e AI/Agents) mas não possui um SIEM centralizado para:

- Detecção de intrusão (IDS/IPS) nos endpoints e rede
- File Integrity Monitoring (FIM)
- Vulnerability scanning de agentes nos nós
- Correlação de eventos de segurança cross-cluster
- Compliance com LGPD, ANS e HIPAA (audit trail, detecção de acesso indevido a PHI)

O Wazuh é open-source, HIPAA-ready, e cobre todos esses casos.

## Decision

Deployar o Wazuh como instância EC2 standalone (all-in-one: Manager + Indexer + Dashboard) gerenciada via OpenTofu + Terragrunt, fora do EKS.

### Justificativa para EC2 vs. Kubernetes

1. **Wazuh Indexer (OpenSearch)** requer discos persistentes, tuning de kernel (`vm.max_map_count`), e é stateful — não se beneficia de scheduling dinâmico do K8s
2. **Simplicidade operacional** — single-node all-in-one é suficiente para a escala atual (< 100 agents)
3. **Independência** — o SIEM deve sobreviver a falhas do cluster que monitora
4. **Custo** — uma t3.xlarge dedicada é mais previsível que pods com PVCs em EKS

### Observabilidade integrada

- `node_exporter` na porta 9100 para métricas de sistema
- Exporter custom na porta 9101 para métricas do Wazuh (agents, alerts, indexer health, disk)
- Prometheus scrape config e alert rules versionados no repo
- Dashboard Grafana provisionado como código
- CloudWatch Agent para logs do Wazuh → CloudWatch Logs

### Gerenciamento via Agent

O `soc-wazuh-management-agent` é responsável pelo ciclo de vida:
- Saúde, atualizações, backup, expansão de disco, rotação de certificados
- Opera via SSM (sem SSH)
- Stage inicial: `draft`, seguindo o lifecycle padrão

## Consequences

### Positivas

- Visibilidade completa de segurança: IDS, FIM, vulnerability scanning, compliance
- Integrado com a stack de observabilidade existente (Prometheus + Grafana)
- Gerenciado por agent, reduzindo operação manual
- Wazuh agents nos nós EKS completam o security posture

### Negativas

- EC2 standalone requer gestão de patching de OS separada do EKS
- Single-node não é HA (aceitável para dev; prod exigirá cluster multi-nó)
- Custo fixo da instância EC2 (~$120/mês para t3.xlarge)

### Riscos

- Se a EC2 cair, o SIEM fica offline até recovery (mitigado por SSM + auto-restart + alerting)
- Volume de dados pode crescer rápido com muitos agents (mitigado por ILM e expansão automática de EBS)

## References

- Módulo OpenTofu: `infra/opentofu/modules/wazuh-server/`
- Terragrunt dev: `infra/terragrunt/dev/wazuh-server/`
- Dashboard Grafana: `infra/observability/grafana/dashboards/wazuh-server-overview.json`
- Alert rules: `infra/observability/prometheus/rules/wazuh-alerts.yaml`
- Agent: `.claude/agents/soc-wazuh-management-agent.md`
