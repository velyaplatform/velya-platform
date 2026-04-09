# Política de Priorização AWS + Kubernetes + OSS/Free

**Versão:** 1.0  
**Domínio:** Decisões Tecnológicas  
**Classificação:** Documento de Governança Técnica  
**Data:** 2026-04-08

---

## Mandato

> **A Velya escolhe tecnologia na seguinte ordem: confiável → simples → OSS/free → integra com AWS+K8s → pago apenas com justificativa explícita e aprovação de arquitetura.**

Esta política existe para:

1. Controlar custo operacional em fase de crescimento
2. Preservar autonomia técnica (sem vendor lock-in crítico)
3. Manter a stack legível para novos engenheiros
4. Maximizar aproveitamento do investimento já feito em AWS + Kubernetes

---

## Hierarquia de Decisão Tecnológica

```
┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 1: CONFIABILIDADE                                    │
│  A tecnologia resolve o problema de forma comprovada?       │
│  Tem produção similar em healthcare/fintech?                │
└─────────────────────────────────┬───────────────────────────┘
                                  │ SIM
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 2: SIMPLICIDADE                                      │
│  É a opção mais simples que resolve o problema?             │
│  Adiciona <2 conceitos novos ao time?                       │
└─────────────────────────────────┬───────────────────────────┘
                                  │ SIM
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 3: OSS/FREE                                          │
│  Existe versão OSS/free que atende os requisitos?           │
│  Operação self-hosted é viável com time atual?              │
└─────────────────────────────────┬───────────────────────────┘
                                  │ SIM
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 4: INTEGRAÇÃO AWS + K8s                              │
│  Integra nativamente com EKS, IAM, S3, CloudWatch?         │
│  Helm chart mantido? Operator disponível?                   │
└─────────────────────────────────┬───────────────────────────┘
                                  │ SIM
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 5: SERVIÇO PAGO (ÚLTIMO RECURSO)                     │
│  Justificativa formal necessária:                           │
│  - Custo de operação OSS > custo do serviço?                │
│  - Compliance exige managed service?                        │
│  - Time não tem capacidade de operar OSS?                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Tabela Completa de Decisões Tecnológicas Velya

### Observabilidade

| Domínio    | Opção Escolhida   | Alternativa Avaliada                   | Decisão            | Custo Est.         | Complexidade Op. | Justificativa                                                                           |
| ---------- | ----------------- | -------------------------------------- | ------------------ | ------------------ | ---------------- | --------------------------------------------------------------------------------------- |
| Métricas   | Prometheus OSS    | Datadog, New Relic, CloudWatch Metrics | OSS                | $0 (infra própria) | Média            | Self-hosted, integração nativa K8s, KEDA usa Prometheus, sem vendor lock                |
| Dashboards | Grafana OSS       | Grafana Cloud, Datadog                 | OSS                | $0                 | Baixa            | Helm chart estável, plugins livres, embedding no velya-web                              |
| Logs       | Loki              | CloudWatch Logs, Datadog Logs, Elastic | OSS                | $0 + S3 storage    | Média            | Integra com Grafana, modelo de labels igual ao Prometheus, custo de storage baixo em S3 |
| Tracing    | Tempo             | Jaeger OSS, AWS X-Ray, Datadog APM     | OSS                | $0 + S3 storage    | Média            | Backend compatível com OTLP, armazena traces em S3/GCS, integra Grafana                 |
| Alerting   | Alertmanager      | PagerDuty (routing), OpsGenie          | OSS + PD free tier | $0–$20/mês         | Baixa            | Alertmanager gerencia routing; PagerDuty free para <5 usuários                          |
| Uptime     | Blackbox Exporter | Pingdom, StatusPage                    | OSS                | $0                 | Baixa            | Probe HTTP/TCP/DNS, integra Prometheus                                                  |

**Decisão rejeitada — Grafana Cloud:**

- Custo: ~$200/mês para volume Velya (estimado)
- Lock-in: dados de métricas em infra Grafana
- Justificativa rejeição: Grafana OSS roda em 2 pods, 1 PVC, sem custo adicional

**Decisão rejeitada — CloudWatch Logs:**

- Custo: ~$0.50/GB ingestão + $0.03/GB storage (estimado: $150-300/mês em prod)
- Integração: não integra com Grafana sem plugin pago
- Justificativa rejeição: Loki com S3 backend = ~$5-15/mês storage

**Decisão rejeitada — AWS X-Ray:**

- Custo: $5/million traces + $0.50/million spans
- Lock-in: SDK proprietário, difícil migrar
- Justificativa rejeição: Tempo com OTLP é vendor-neutral, armazena em S3

---

### Orquestração de Workflows

| Domínio           | Opção Escolhida    | Alternativa Avaliada               | Decisão    | Custo Est.      | Complexidade Op. | Justificativa                                                                                                        |
| ----------------- | ------------------ | ---------------------------------- | ---------- | --------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| Workflow Durável  | Temporal OSS       | AWS Step Functions, Argo Workflows | OSS        | $0 + infra pods | Alta             | Durabilidade real, SDK TypeScript/Python/Go, replay, compensation. Step Functions: $25/1000 transitions, lock-in AWS |
| Batch DAG         | CronJob K8s + Argo | AWS Batch, Airflow                 | OSS        | $0              | Baixa-Média      | CronJob para simples; Argo para DAGs; nenhum custo adicional no cluster                                              |
| Scheduler Simples | CronJob K8s        | EventBridge Scheduler, Celery Beat | K8s nativo | $0              | Muito Baixa      | Nativo K8s, sem dependência adicional                                                                                |

**Decisão rejeitada — AWS Step Functions:**

- Custo: $0.025/1000 state transitions (workflows Velya fazem 50-200 transitions cada)
- Em 10k workflows/dia: ~$12-50/dia = $360-1500/mês
- Lock-in: JSON DSL proprietário, difícil testar localmente
- Justificativa rejeição: Temporal OSS tem custo zero de transações, SDK rico

---

### Autoscaling

| Domínio              | Opção Escolhida  | Alternativa Avaliada                        | Decisão             | Custo Est.      | Complexidade Op. | Justificativa                                                            |
| -------------------- | ---------------- | ------------------------------------------- | ------------------- | --------------- | ---------------- | ------------------------------------------------------------------------ |
| Event-driven scaling | KEDA             | Fargate Auto Scaling, HPA custom metrics    | OSS                 | $0              | Média            | 50+ scalers prontos, integra NATS/Prometheus/HTTP/Redis, sem vendor lock |
| Node provisioning    | Karpenter        | Cluster Autoscaler, EKS Managed Node Groups | OSS (AWS patrocina) | $0 + instâncias | Média            | Consolidação automática, NodePool declarativo, Spot nativo               |
| Pod resources        | VPA (Goldilocks) | Manual, Datadog Autopilot                   | OSS                 | $0              | Baixa            | Recomendações sem custo adicional                                        |
| HTTP scaling         | HPA (CPU/custom) | Fargate, KEDA HTTP                          | K8s nativo          | $0              | Muito Baixa      | Nativo K8s, simples, confiável                                           |

**Decisão rejeitada — Fargate Auto Scaling:**

- Custo: Fargate cobra por vCPU/hora e GB/hora — ~30% mais caro que EC2 equivalente
- Sem scheduling fine-grained (sem taints/affinities complexos)
- Justificativa rejeição: Karpenter com EC2 Spot = custo ~60-70% menor que Fargate

---

### Mensageria e Eventos

| Domínio        | Opção Escolhida    | Alternativa Avaliada         | Decisão     | Custo Est.      | Complexidade Op. | Justificativa                                                                       |
| -------------- | ------------------ | ---------------------------- | ----------- | --------------- | ---------------- | ----------------------------------------------------------------------------------- |
| Message broker | NATS JetStream     | AWS SQS/SNS, Kafka, RabbitMQ | OSS         | $0 + infra pods | Baixa-Média      | Baixa latência, JetStream para persistência, cluster nativo K8s, sem overhead Kafka |
| DLQ            | NATS JetStream DLQ | SQS DLQ                      | NATS nativo | $0              | Muito Baixa      | Parte do JetStream, sem custo adicional                                             |
| Pub/Sub        | NATS Core          | AWS EventBridge, SNS         | OSS         | $0              | Muito Baixa      | Sub-ms latência, sem custo por mensagem                                             |

**Decisão rejeitada — AWS SQS/SNS:**

- Custo: $0.40/million requests SQS, $0.50/million SNS — pequeno mas acumula
- Operational: acoplamento à AWS, sem replay nativo (SQS não replay)
- Justificativa rejeição: NATS JetStream tem replay, durabilidade, sem custo por mensagem

**Decisão rejeitada — Apache Kafka:**

- Operação: 3+ brokers, ZooKeeper/KRaft, tuning complexo
- Custo de infra: mínimo 3 nós dedicados
- Justificativa rejeição: Volume atual não justifica Kafka; NATS JetStream suficiente até 1M msgs/dia

---

### AI e LLM

| Domínio      | Opção Escolhida                 | Alternativa Avaliada              | Decisão                | Custo Est.              | Complexidade Op. | Justificativa                                                                                  |
| ------------ | ------------------------------- | --------------------------------- | ---------------------- | ----------------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| LLM Router   | ai-gateway (custom)             | LiteLLM, AWS Bedrock gateway      | Custom + OSS libs      | $0 operação             | Baixa            | Controle total de budget, routing, fallback, audit log                                         |
| LLM Provider | Anthropic Claude (pago)         | OpenAI, AWS Bedrock, Mistral      | Pago com justificativa | ~$0.003-0.015/1k tokens | N/A — API        | Qualidade superior para clinical reasoning; justificativa: qualidade clínica impacta segurança |
| Embeddings   | text-embedding-3-small (OpenAI) | Sentence Transformers OSS, Cohere | Pago com justificativa | $0.0001/1k tokens       | N/A — API        | Custo baixíssimo; OSS alternativo se volume escalar                                            |
| Vector DB    | pgvector (PostgreSQL)           | Pinecone, Weaviate, Qdrant        | OSS embutido           | $0 (reusa PostgreSQL)   | Muito Baixa      | Sem infra adicional; suficiente para < 10M vetores                                             |

**Decisão — LLM Pago:**
Exceção à regra OSS/free. Justificativa formal:

1. Qualidade clínica do Claude é demonstravelmente superior para português e raciocínio médico
2. Custo de operar modelos OSS (GPU nodes) > custo API Anthropic em volume atual
3. Segurança: DPA assinado com Anthropic, dados não usados para treino

---

### Banco de Dados

| Domínio          | Opção Escolhida                 | Alternativa Avaliada          | Decisão     | Custo Est.     | Complexidade Op. | Justificativa                                                    |
| ---------------- | ------------------------------- | ----------------------------- | ----------- | -------------- | ---------------- | ---------------------------------------------------------------- |
| OLTP Principal   | PostgreSQL 16 (self-hosted K8s) | AWS RDS PostgreSQL, Aurora    | OSS         | $0 + storage   | Média            | Cnpg operator (CloudNativePG), backup S3, HA automático          |
| Cache / Session  | Redis 7 (self-hosted)           | AWS ElastiCache, Dragonfly    | OSS         | $0 + infra     | Baixa            | Helm chart Bitnami, simples, sem custo adicional                 |
| OLAP / Analytics | DuckDB (in-process)             | Redshift, BigQuery, Snowflake | OSS         | $0             | Muito Baixa      | Query analytics em arquivos Parquet S3 sem servidor adicional    |
| Object Storage   | S3 (AWS)                        | MinIO, GCS                    | AWS managed | ~$0.023/GB/mês | Muito Baixa      | S3 é commodity; MinIO em K8s adiciona complexidade sem benefício |

**Decisão — RDS vs Self-hosted:**

- RDS PostgreSQL db.t3.medium: ~$60/mês
- CloudNativePG em EKS (m6i.large node compartilhado): ~$20-30/mês equivalente
- Razão self-hosted: operação simplificada pelo operator, backup automático para S3, sem custo de licença RDS
- **Revisitar quando:** volume > 500 GB, time < 2 engenheiros de infra, compliance exige managed

---

### Service Mesh e Networking

| Domínio             | Opção Escolhida          | Alternativa Avaliada              | Decisão    | Custo Est.         | Complexidade Op. | Justificativa                                                                          |
| ------------------- | ------------------------ | --------------------------------- | ---------- | ------------------ | ---------------- | -------------------------------------------------------------------------------------- |
| Ingress             | Nginx Ingress Controller | ALB Ingress (AWS), Traefik, Istio | OSS        | $0 + ALB ($16/mês) | Baixa            | Simples, amplamente suportado, annotations ricas                                       |
| mTLS / Service Mesh | Nenhum (fase atual)      | Istio, Linkerd, AWS App Mesh      | N/A        | N/A                | Alta             | Sem necessidade atual; adicionar quando: multi-tenant estrito ou compliance exige mTLS |
| DNS Interno         | CoreDNS (K8s nativo)     | Route53 interno, Consul           | K8s nativo | $0                 | Muito Baixa      | Nativo, sem dependência adicional                                                      |
| Cert Manager        | cert-manager (OSS)       | ACM, Vault                        | OSS        | $0                 | Baixa            | Let's Encrypt + cert-manager = TLS sem custo                                           |

---

### CI/CD e GitOps

| Domínio            | Opção Escolhida           | Alternativa Avaliada                | Decisão           | Custo Est.                  | Complexidade Op. | Justificativa                                                |
| ------------------ | ------------------------- | ----------------------------------- | ----------------- | --------------------------- | ---------------- | ------------------------------------------------------------ |
| CI/CD              | GitHub Actions            | Jenkins, CircleCI, AWS CodePipeline | SaaS (free tier)  | $0 (OSS repos) / $4/usuário | Muito Baixa      | Integrado ao GitHub, OIDC com AWS, sem infra a gerenciar     |
| GitOps             | ArgoCD                    | Flux, AWS CodeDeploy                | OSS               | $0                          | Média            | UI rich, RBAC, sync automático, rollback visual              |
| Container Registry | ECR (AWS)                 | DockerHub, GHCR                     | AWS managed       | $0.10/GB/mês                | Muito Baixa      | Integração nativa IAM, sem rate limit como DockerHub         |
| Secret Management  | AWS Secrets Manager + ESO | Vault, Sealed Secrets               | AWS managed + OSS | ~$0.40/secret/mês           | Baixa            | ESO (External Secrets Operator) sincroniza ASM → K8s Secrets |

---

### Segurança e Compliance

| Domínio            | Opção Escolhida           | Alternativa Avaliada                 | Decisão          | Custo Est.   | Complexidade Op. | Justificativa                                                           |
| ------------------ | ------------------------- | ------------------------------------ | ---------------- | ------------ | ---------------- | ----------------------------------------------------------------------- |
| RBAC               | K8s RBAC nativo           | OPA Gatekeeper, Kyverno              | K8s nativo       | $0           | Muito Baixa      | Suficiente para fase atual                                              |
| Policy Engine      | Kyverno                   | OPA Gatekeeper, AWS Config           | OSS              | $0           | Média            | Sintaxe YAML, mutation + validation + generation, menos verboso que OPA |
| Vulnerability Scan | Trivy (CI) + ECR scanning | Snyk, Aqua Security                  | OSS + AWS nativo | $0           | Baixa            | Trivy no CI + ECR enhanced scanning (AWS Inspector)                     |
| Audit Logs         | K8s Audit Log → Loki      | AWS CloudTrail, Datadog              | OSS + K8s nativo | $0 + storage | Baixa            | Pipeline Fluentbit → Loki → Grafana                                     |
| Secrets em K8s     | External Secrets Operator | Vault Agent Injector, Sealed Secrets | OSS              | $0           | Baixa            | Sincroniza AWS Secrets Manager para K8s Secrets automaticamente         |

---

## Processo de Exceção — Tecnologia Paga

Quando uma tecnologia paga é considerada, o seguinte processo é obrigatório:

### Template de Justificativa

```markdown
## Justificativa para Adoção de Tecnologia Paga: [NOME]

### 1. Problema que resolve

[Descrição clara do problema]

### 2. Alternativa OSS avaliada

[Nome + razão da rejeição]

### 3. Custo estimado

- Tier inicial: $X/mês
- Escala com volume: $Y por [unidade]
- Projeção 12 meses: $Z

### 4. Custo da alternativa OSS

- Infra para rodar: $A/mês
- Horas de engenharia para operar: B horas/semana × $C/hora = $D/mês
- Total alternativa OSS: $E/mês

### 5. Decisão

OSS custa $E/mês vs Pago $X/mês.
Diferença: $F/mês.
Justificativa para pagar: [compliance / qualidade / capacidade / velocidade]

### 6. Exit strategy

Como sair desta tecnologia paga se necessário: [plano]

### 7. Aprovação necessária

- [ ] Arquiteto responsável
- [ ] CTO
```

---

## Regras de Reavaliação

Decisões tecnológicas são reavaliadas quando:

| Trigger                                                   | Ação                                  |
| --------------------------------------------------------- | ------------------------------------- |
| Custo da opção OSS > custo pago equivalente               | Avaliar migração para managed         |
| Falha de segurança crítica no OSS escolhido               | Avaliação emergencial de alternativa  |
| Time cai abaixo de 2 engenheiros de infra                 | Aumentar uso de managed services      |
| Volume 10x do previsto                                    | Re-avaliar capacidade operacional OSS |
| Nova oferta AWS resolve problema com custo < 20% overhead | Avaliar migração                      |

---

## Mapa de Tecnologias por Ambiente

### kind-velya-local (Desenvolvimento)

```yaml
# Fidelidade máxima com prod, custo zero
observability:
  metrics: prometheus-community/kube-prometheus-stack
  logs: grafana/loki-stack
  traces: grafana/tempo
  dashboards: grafana/grafana

messaging:
  broker: nats-io/nats (JetStream enabled)

workflow:
  durable: temporalio/temporal (single node dev)
  batch: kubernetes CronJob + Argo Workflows

database:
  oltp: cloudnative-pg/cloudnative-pg
  cache: bitnami/redis

autoscaling:
  event: kedacore/keda
  hpa: kubernetes native
  nodes: kindest/node (manual, sem Karpenter)
```

### EKS Staging / Prod (AWS)

```yaml
# Additions vs local
nodes:
  provisioner: karpenter (AWS-native)

storage:
  objects: s3 (logs, traces, backups)
  pvc: gp3 ebs

secrets:
  source: aws-secrets-manager
  sync: external-secrets-operator

registry:
  images: ecr

ingress:
  controller: nginx-ingress
  tls: cert-manager + acm

# Same as local
observability: prometheus + loki + tempo + grafana
messaging: nats jetstream
workflow: temporal
database: cloudnative-pg + redis
autoscaling: keda + hpa + karpenter
```

---

## Custo Total de Infraestrutura Estimado

### kind-velya-local (Dev)

| Componente           | Custo                |
| -------------------- | -------------------- |
| Cluster kind (local) | $0                   |
| Todos os pods        | $0 (recursos locais) |
| **Total**            | **$0/mês**           |

### EKS Staging (Estimado)

| Componente                          | Custo/mês     |
| ----------------------------------- | ------------- |
| EKS cluster fee                     | $72           |
| EC2 nodes (3x m6i.xlarge On-Demand) | ~$435         |
| EBS volumes (500 GB gp3)            | ~$40          |
| S3 storage (100 GB)                 | ~$2.30        |
| ECR (10 GB)                         | ~$1           |
| Secrets Manager (10 secrets)        | ~$4           |
| **Total Staging**                   | **~$554/mês** |

### EKS Produção (Estimado — volume inicial)

| Componente                              | Custo/mês           |
| --------------------------------------- | ------------------- |
| EKS cluster fee                         | $72                 |
| EC2 nodes (5x m6i.2xlarge, mix Spot/OD) | ~$600-900           |
| Karpenter Spot savings estimado         | -30%                |
| EBS volumes (1 TB gp3)                  | ~$80                |
| S3 storage (1 TB)                       | ~$23                |
| ECR                                     | ~$5                 |
| Secrets Manager (30 secrets)            | ~$12                |
| CloudWatch (K8s control plane logs)     | ~$30                |
| LLM API (Anthropic)                     | ~$500-2000          |
| **Total Produção**                      | **~$1400-2200/mês** |

---

## Decisões Pendentes e Roadmap

### Em Avaliação (Q2 2026)

| Tecnologia              | Caso                                     | Status             | Prazo Decisão |
| ----------------------- | ---------------------------------------- | ------------------ | ------------- |
| Istio service mesh      | mTLS entre serviços, observabilidade L7  | Em avaliação       | Q2 2026       |
| Vault HashiCorp         | Secret management multi-cloud            | Em avaliação       | Q3 2026       |
| Qdrant                  | Vector DB se pgvector atingir limitações | Pendente volume    | Q3 2026       |
| Confluent/Kafka         | Se NATS atingir limitações de volume     | Pendente volume    | Q4 2026       |
| Grafana Cloud (parcial) | Oncall + IRM se PagerDuty custo escalar  | Pendente headcount | Q3 2026       |

### Decisões Fechadas (Não Reavaliar sem Trigger Explícito)

| Tecnologia         | Status    | Razão                                  |
| ------------------ | --------- | -------------------------------------- |
| AWS Step Functions | Rejeitado | Custo por transição, Temporal superior |
| Datadog            | Rejeitado | Custo > $1000/mês em volume Velya      |
| RDS Aurora         | Rejeitado | CloudNativePG suficiente, custo menor  |
| Fargate            | Rejeitado | Karpenter + EC2 Spot 60% mais barato   |
| CloudWatch Logs    | Rejeitado | Loki + S3 equivalente a 10% do custo   |

---

_Esta política é revisada a cada trimestre ou quando um novo componente de infraestrutura é avaliado. Toda exceção requer aprovação de arquitetura formal._
