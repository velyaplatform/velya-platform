# Política de Priorização OSS/Free — Velya Platform

**Versão:** 1.0  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Última revisão:** 2026-04-08  

---

## 1. Filosofia de Priorização

A Velya opera em um mercado de saúde digital onde o custo operacional de infraestrutura é um diferencial competitivo direto. Cada real gasto em serviços managed que poderiam ser substituídos por alternativas OSS equivalentes é um real que deixa de ir para desenvolvimento de produto clínico.

A política de priorização OSS/free da Velya não é uma preferência ideológica: é uma decisão de negócio baseada em análise de custo-benefício. OSS gratuito não é sempre a melhor escolha — mas quando é equivalente a soluções pagas, é sempre a escolha correta.

---

## 2. Ordem de Decisão Tecnológica

Ao escolher qualquer tecnologia ou serviço para a Velya, a avaliação segue esta ordem obrigatória:

```
PASSO 1: EXISTE SOLUÇÃO CONFIÁVEL JÁ EM USO?
  └── Se sim e resolve o problema: USAR O QUE JÁ TEMOS
  └── Se não: ir para passo 2

PASSO 2: SOLUÇÃO SIMPLES E DETERMINÍSTICA RESOLVE?
  └── Se sim: IMPLEMENTAR COMO CÓDIGO/CONFIGURAÇÃO
  └── (ex: um script, uma regra, uma configuração)
  └── Se não: ir para passo 3

PASSO 3: EXISTE OSS MADURO QUE RESOLVE?
  └── Critérios de maturidade:
      - CNCF Graduated OU > 2 anos em produção ampla
      - Comunidade ativa (commits nos últimos 3 meses)
      - Sem vulnerability crítica não-corrigida
  └── Se sim: USAR OSS
  └── Se não: ir para passo 4

PASSO 4: INTEGRA BEM COM AWS + KUBERNETES?
  └── Helm chart disponível e mantido?
  └── Operador Kubernetes disponível?
  └── Prometheus metrics expostos?
  └── Se não integra bem: reconsiderar passo 3

PASSO 5: MANAGED SERVICE É JUSTIFICÁVEL?
  └── APENAS se:
      - OSS equivalente não existe ou é muito imaturo
      - Custo de operação do OSS > custo do managed (com evidência)
      - Compliance/regulação exige (ex: LGPD + auditoria)
      - Equipe não tem expertise para operar o OSS com segurança
  └── REQUER: Justificativa formal escrita + aprovação de 2 arquitetos
```

---

## 3. Tabela de Tecnologias Velya: OSS vs Managed

### 3.1 Decisões Atuais (Status: Adotado)

| Componente | Escolha Atual | Alternativa Managed Rejeitada | Motivo da Rejeição |
|---|---|---|---|
| Orquestração de containers | Kubernetes (kind local / EKS) | ECS, Cloud Run | EKS é OSS + AWS, equivalente |
| Messaging | NATS JetStream (OSS) | AWS SQS/SNS | $0 vs $0.40/million msgs. Funcionalidade superior. |
| Workflows | Temporal (OSS) | AWS Step Functions | $0 vs $0.025/state transition. Muito mais poderoso. |
| Observabilidade | Prometheus + Grafana + Loki + Tempo | Datadog, Splunk | Datadog: $15-23/host/mês. Stack OSS: $0 |
| GitOps | ArgoCD (OSS) | AWS CodePipeline + Flux | ArgoCD mais maduro, UI melhor |
| Secrets | External Secrets Operator (OSS) | HashiCorp Vault Enterprise | ESO + AWS Secrets Manager: $0.40/secret/mês vs $0+ |
| IaC | OpenTofu (OSS fork) | Terraform Cloud | OpenTofu gratuito, Terraform Cloud: $20+/user/mês |
| Autoscaling | KEDA (OSS, CNCF) | Custom solution | KEDA maduro, 80+ triggers, suporte NATS nativo |
| Node provisioning | Karpenter (OSS, EKS) | Managed Node Groups | Karpenter mais eficiente, spot instances melhor |
| Service mesh | Cilium (OSS) | AWS App Mesh, Istio | Cilium mais leve, eBPF-based |

### 3.2 Serviços Managed Justificados (com Justificativa)

| Serviço | Provider | Custo Estimado | Justificativa Formal |
|---|---|---|---|
| Banco de dados principal | AWS RDS PostgreSQL | ~$50-100/mês (dev) | Backup automático, multi-AZ para prod, replicação. Custo de operação manual seria maior. |
| Container Registry | AWS ECR | ~$10/mês | Integração nativa com EKS IAM, scan de vulnerabilidades incluso |
| DNS | AWS Route53 | ~$1/mês | Dominância de mercado, 100% SLA, custo mínimo |
| Load Balancer | AWS ALB (via ingress) | ~$20/mês | Gerenciado pelo AWS Load Balancer Controller, sem alternativa OSS equivalente em EKS |
| Certificate Manager | AWS ACM | $0 (grátis) | Gratuito para ALB, sem razão para usar alternativa |
| AI Inference | Anthropic/OpenAI APIs | Variável por uso | Não existe OSS equivalente para LLMs de qualidade necessária. Custo por token é mais eficiente que hospedar modelo. |

### 3.3 Componentes em Avaliação

| Componente | Candidato OSS | Alternativa Managed | Prazo de Decisão | Status |
|---|---|---|---|---|
| Service Discovery | Kubernetes native | AWS Cloud Map | Q2 2026 | K8s native suficiente |
| Object Storage | MinIO (OSS) vs S3 | AWS S3 | Q2 2026 | S3 preferível por simplicidade |
| Message Schema Registry | Confluent Schema Registry (OSS) | AWS Glue Schema Registry | Q3 2026 | Ainda não necessário |

---

## 4. Avaliação de Custo Operacional

### 4.1 Framework de Avaliação

Para decidir entre OSS e Managed, calcular o Total Cost of Operation (TCO) de 12 meses:

```
TCO OSS = Custo de compute (EC2/pods) + Custo de storage (EBS/S3) +
          Custo de engineer-hours para manutenção +
          Custo de incidentes esperados

TCO Managed = Preço do serviço/mês * 12 +
              Custo de vendor lock-in (migração futura) +
              Custo de funcionalidades ausentes (workarounds)

DECISÃO = MIN(TCO OSS, TCO Managed) com 20% de buffer para incerteza
```

### 4.2 Exemplo Real: NATS JetStream vs AWS SQS+SNS

```
NATS JetStream (OSS):
  Compute: 1 StatefulSet pod = 100m CPU + 256Mi RAM = ~$5/mês em kind local
  Storage: 20Gi PVC = ~$2/mês (EBS gp3)
  Manutenção: ~2h/mês para monitoring e updates = ~$100/mês (eng time)
  TCO Mensal: ~$107/mês

AWS SQS + SNS:
  Volume estimado: 2 milhões de mensagens/mês
  SQS: $0.40/million = $0.80/mês
  SNS: $0.50/million notifications = $1/mês
  Custo de API: ~$1-2/mês
  TOTAL: ~$3-4/mês
  
  MAS:
  - SQS não suporta pull consumers com ack granular como NATS
  - SQS não tem DLQ tão configurável
  - SQS não tem replay de mensagens por timestamp
  - Funcionalidades faltantes = workarounds = ~$500/mês em eng time
  
  TCO real (funcionalidade equivalente): ~$503/mês

DECISÃO: NATS JetStream
ECONOMIA: ~$396/mês vs funcionalidade equivalente no SQS
```

### 4.3 Exemplo Real: Temporal vs AWS Step Functions

```
Temporal (OSS):
  Compute: 3 pods (server + 2 workers) = ~$15/mês em kind local
  Storage: PostgreSQL no RDS = ~$50/mês
  Manutenção: ~3h/mês = ~$150/mês (eng time)
  TCO Mensal: ~$215/mês

AWS Step Functions:
  Volume: ~100k workflow execuções/mês
  Custo: $0.025 per 1000 state transitions
  Estado médio por workflow: 15 states
  100k * 15 = 1.5M state transitions = $37.50/mês
  
  MAS:
  - Step Functions Express: max 5 minutos por workflow
  - Discharge workflow pode durar até 4 horas → Standard required
  - Standard: $0.025 per 1000 transitions (mais caro por exec longa)
  - Sem suporte nativo a signals/queries (necessário para humanl-in-loop)
  - Vendor lock-in: migrar de Step Functions custaria 3-6 meses de eng
  
  TCO real (funcionalidade equivalente): ~$200-800/mês + eng time de migração futura

DECISÃO: Temporal OSS
OBSERVAÇÃO: Custo similar mas Temporal tem muito mais funcionalidade e zero vendor lock-in
```

---

## 5. Justificativa Formal para Soluções Pagas

### 5.1 Template de Justificativa

Qualquer adoção de serviço managed ou solução paga que não seja trivial (> $20/mês) deve ter justificativa formal aprovada:

```yaml
# justificativa-managed-service.yaml
service_name: "AWS RDS PostgreSQL"
monthly_cost_estimate_usd: 75
annual_cost_estimate_usd: 900

oss_alternative_evaluated: "PostgreSQL self-managed no EKS (StatefulSet)"
oss_alternative_rejected_reasons:
  - reason: "Backup automatizado"
    detail: "RDS tem backups automáticos e point-in-time recovery. Self-managed requer pgbackrest ou similar + S3, adiciona ~4h/mês de manutenção."
  
  - reason: "Multi-AZ para production"
    detail: "RDS Multi-AZ é flip de botão. Self-managed multi-AZ requer setup complexo de Patroni ou similar."
  
  - reason: "Patch automatizado de segurança"
    detail: "RDS aplica patches de segurança automaticamente. Self-managed requer processo manual e janela de manutenção."

total_oss_operation_cost_estimate:
  compute: "$15/mês"
  storage: "$5/mês"
  maintenance_engineer_hours: "6h/mês"
  maintenance_cost_at_100_usd_per_hour: "$600/mês"
  total: "$620/mês"

managed_cost: "$75/mês"

cost_difference: "RDS é $545/mês mais barato quando custo de eng é considerado"

compliance_requirement: "LGPD: backup e recovery documentados obrigatórios"

approved_by:
  - name: "Arquiteto Principal"
    date: "2026-04-08"
  - name: "FinOps Lead"
    date: "2026-04-08"

review_deadline: "2027-04-08"  # Revisar em 1 ano
```

---

## 6. Regras de Compliance da Política

### 6.1 O que Requer Aprovação Formal

| Situação | Aprovadores necessários |
|---|---|
| Adotar qualquer managed service > $50/mês | 2 arquitetos sênior |
| Adotar qualquer managed service > $200/mês | 2 arquitetos + CTO |
| Rejeitar OSS em favor de managed sem justificativa escrita | Proibido |
| Renovar contrato de serviço pago > $500/mês sem revisão | Proibido |
| Introduzir vendor lock-in sem análise de exit strategy | Proibido |

### 6.2 Auditoria Mensal

O FinOps Office realiza auditoria mensal:
- Lista todos os serviços pagos ativos com custo atual
- Verifica se justificativa está documentada e ainda válida
- Identifica serviços pagos onde OSS passou a ser viável (novas versões, maturidade aumentada)
- Gera relatório de oportunidades de redução de custo

### 6.3 Revisão Anual Obrigatória

Toda justificativa de serviço managed é revisada anualmente. Critérios de revisão:
- O custo aumentou significativamente?
- Surgiu alternativa OSS mais madura?
- O uso real justifica o custo (utilização > 50%)?
- A equipe tem expertise agora para operar a alternativa OSS?

---

## 7. Checklist de Avaliação de Nova Tecnologia

```
[ ] 1. NECESSIDADE REAL
    Qual problema específico isso resolve?
    Esse problema não pode ser resolvido com o que já temos?

[ ] 2. AVALIAÇÃO OSS PRIMEIRO
    Existe alternativa OSS madura?
    (CNCF Graduated ou > 2 anos em prod ampla?)
    Se não: documentar por quê não existe

[ ] 3. ANÁLISE DE INTEGRAÇÃO
    Tem Helm chart ou operator para K8s?
    Expõe métricas Prometheus?
    Integra com AWS IAM/IRSA?
    Se algum "não": avaliar custo de integração manual

[ ] 4. ANÁLISE DE TCO
    Custo OSS (compute + storage + manutenção): $____/mês
    Custo Managed: $____/mês
    OSS é mais caro mesmo considerando eng time? Documentar.

[ ] 5. ANÁLISE DE VENDOR LOCK-IN
    Qual é o custo de migrar para fora em 2 anos?
    Existe exit strategy documentada?

[ ] 6. ANÁLISE DE COMPLIANCE
    LGPD, padrões hospitalares exigem auditoria de onde os dados ficam?
    Dados de pacientes podem ir para esse serviço?

[ ] 7. APROVAÇÃO
    Se Managed > $20/mês: justificativa formal escrita
    Se Managed > $50/mês: 2 arquitetos aprovam
    Se Managed > $200/mês: CTO aprova
```

---

## 8. Exceções Documentadas

### 8.1 LLM Inference APIs (Anthropic, OpenAI)

**Status:** Exceção aprovada  
**Justificativa:** Não existe alternativa OSS equivalente para modelos de linguagem de qualidade suficiente para uso clínico. Hospedar modelos localmente requer GPU ($2000+/mês por instância p3.2xlarge) vs custo por token (~$0.002-0.015/1000 tokens). Para o volume atual da Velya, APIs são significativamente mais econômicas.

**Condições da exceção:**
- Custo monitorado por agent e por office
- Budget hard limit implementado (circuit breaker automático)
- Reavaliado semestralmente (modelos OSS estão melhorando rapidamente)

### 8.2 AWS ECR

**Status:** Exceção aprovada  
**Justificativa:** Harbor (OSS) é a alternativa, mas requer operação de StatefulSet adicional, S3 backend para storage, e certificados TLS próprios. Custo de ECR ($0.10/GB/mês) é mínimo e a integração nativa com EKS elimina toda a complexidade de autenticação.

### 8.3 AWS Secrets Manager via External Secrets Operator

**Status:** Parcial — custo minimizado  
**Justificativa:** O próprio AWS Secrets Manager é pago ($0.40/secret/mês), mas o External Secrets Operator (OSS) permite que a Velya use o AWS Secrets Manager sem vendor lock-in na camada de aplicação. A aplicação acessa secrets como ConfigMaps K8s nativos. A migração para alternativa (ex: Vault) seria transparente.
