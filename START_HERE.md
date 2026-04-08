# 🚀 START HERE - Velya Platform Setup

## The One Command You Need

```bash
bash scripts/velya-init.sh
```

**Aquele é o único comando que você precisa executar.**

---

## What You Need Before Running

✅ **Obrigatório:**

- Docker Desktop ou Docker daemon rodando
- 6GB RAM (4GB mínimo)
- 5GB disco livre
- Internet

✅ **Opcional:**

- Git (script instala se faltar)
- kind, kubectl, helm (script instala automaticamente)

---

## Step-by-Step Guide

### 1️⃣ Clone o repositório (se ainda não tiver)

```bash
git clone https://github.com/velyaplatform/velya-platform.git
cd velya-platform
```

### 2️⃣ Certifique-se que Docker está rodando

```bash
# macOS/Windows: Abra Docker Desktop
# Linux: sudo service docker start

# Verifique:
docker ps
```

### 3️⃣ Execute o script maestro

```bash
bash scripts/velya-init.sh
```

**Isto vai:**

- ✅ Detectar seu SO
- ✅ Verificar quais ferramentas você tem
- ✅ Instalar o que falta (Docker, kind, kubectl, helm)
- ✅ Criar cluster Kubernetes (kind) com 5 nodes
- ✅ Aplicar tier isolation (4 tiers: frontend, backend, platform, ai)
- ✅ Instalar observability stack (Prometheus, Grafana, ArgoCD)
- ✅ Iniciar AWS simulation (ministack)
- ✅ Validar que tudo funciona
- ✅ Mostrar URLs de acesso

**Tempo:** 3-10 minutos (primeira vez é mais lenta)

### 4️⃣ Após o setup, você terá acesso a:

```bash
# Kubernetes local
kubectl get nodes -L velya.io/tier

# Prometheus (métricas)
kubectl port-forward -n velya-dev-observability \
  svc/prometheus-kube-prometheus-prometheus 9090:9090
# Abrir: http://localhost:9090

# Grafana (dashboards)
kubectl port-forward -n velya-dev-observability svc/grafana 3000:80
# Abrir: http://localhost:3000 (admin/admin)

# ArgoCD (GitOps)
kubectl port-forward -n argocd svc/argocd-server 8080:443
# Abrir: https://localhost:8080

# AWS Simulation
export AWS_ENDPOINT_URL=http://localhost:4566
aws ec2 describe-instances
aws eks describe-clusters
```

---

## O Que Será Criado

### Kubernetes Cluster (kind)

```
5 nodes (1 control-plane + 4 workers)
├── Frontend node (t3.medium)
├── Backend node (t3.large)
├── Platform node (t3.small) [TAINTED - isolado]
└── AI/Agents node (t3.large) [TAINTED - isolado]

Recursos:
✓ Network policies (isolamento de tiers)
✓ Resource quotas (limites por tier)
✓ Pod disruption budgets (alta disponibilidade)
✓ Observability stack (Prometheus, Grafana, ArgoCD)
```

### AWS Simulation (ministack)

```
LocalStack Services:
✓ VPC com subnets públicas/privadas
✓ EKS cluster (simulado)
✓ RDS PostgreSQL
✓ ECR registry
✓ CloudWatch logs
✓ MinIO (S3 simulation)
✓ Redis (cache)
✓ NATS (event streaming)
```

---

## Troubleshooting

### ❌ Erro: "Docker daemon not running"

```bash
# macOS/Windows: Abra Docker Desktop
# Linux: sudo service docker start
```

### ❌ Erro: "Permission denied: docker.sock" (Linux)

```bash
sudo usermod -aG docker $USER
# Depois faça logout e login
```

### ❌ Erro: "kubectl: command not found"

Script tenta instalar automaticamente. Se falhar:

```bash
# macOS
brew install kubectl

# Linux
sudo apt-get install -y kubectl
```

### ❌ Erro: "kind create cluster failed"

```bash
# Limpe e tente novamente
kind delete cluster --name velya-local
bash scripts/velya-init.sh
```

### ❌ Erro: "Not enough resources"

```bash
# Verifique RAM e disco
docker system prune -a  # Limpa Docker
```

---

## Próximos Passos Após Setup

### 1. Validar Cluster

```bash
# Ver nodes
kubectl get nodes -L velya.io/tier

# Ver namespaces
kubectl get ns

# Ver pods
kubectl get pods -A
```

### 2. Deploy um Serviço de Teste

```bash
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: frontend-test
  namespace: velya-dev-core
spec:
  nodeSelector:
    velya.io/tier: frontend
  containers:
  - name: nginx
    image: nginx:alpine
    ports:
    - containerPort: 80
    resources:
      requests:
        cpu: 50m
        memory: 64Mi
      limits:
        memory: 256Mi
EOF

# Verificar se foi para o node certo
kubectl get pod frontend-test -n velya-dev-core -o wide
```

### 3. Testar Tier Isolation

```bash
# Tente deploy em platform tier SEM toleration (deve FALHAR)
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: bad-platform-pod
  namespace: velya-dev-platform
spec:
  nodeSelector:
    velya.io/tier: platform
  containers:
  - name: test
    image: busybox:latest
    command: ["sleep", "3600"]
EOF

# Ver status (deve ser Pending)
kubectl get pod bad-platform-pod -n velya-dev-platform

# Agora COM toleration (deve FUNCIONAR)
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: good-platform-pod
  namespace: velya-dev-platform
spec:
  nodeSelector:
    velya.io/tier: platform
  tolerations:
  - key: velya.io/platform
    operator: Equal
    value: "true"
    effect: NoSchedule
  containers:
  - name: test
    image: busybox:latest
    command: ["sleep", "3600"]
EOF

# Ver status (deve ser Running)
kubectl get pod good-platform-pod -n velya-dev-platform
```

### 4. Testar Network Policies

```bash
# Ver policies
kubectl get networkpolicies -A

# Descrever uma policy
kubectl describe networkpolicy backend-tier-policy -n velya-dev-core
```

### 5. Deploy Real Services

Depois de validado localmente, faça deploy de serviços reais:

```bash
kubectl apply -f deploy/frontend.yaml
kubectl apply -f deploy/backend.yaml
kubectl apply -f deploy/agents.yaml
```

---

## Documentação Disponível

| Documento                          | Para Quem               | Tempo  |
| ---------------------------------- | ----------------------- | ------ |
| **START_HERE.md** (você está aqui) | Começar rápido          | 5 min  |
| **VELYA_INIT.md**                  | Entender o script       | 10 min |
| **QUICKSTART_LOCAL.md**            | Setup rápido com opções | 5 min  |
| **docs/LOCAL_SETUP.md**            | Guia completo           | 30 min |
| **docs/ARCHITECTURE_LOCAL.md**     | Entender arquitetura    | 20 min |
| **scripts/kind-local-testing.md**  | Teste tier isolation    | 45 min |

---

## Commands Rápidos

```bash
# Setup completo
bash scripts/velya-init.sh

# Verificar status
./scripts/multistack-setup.sh verify

# Rodar testes
kubectl get nodes -L velya.io/tier

# Acessar Prometheus
kubectl port-forward -n velya-dev-observability \
  svc/prometheus-kube-prometheus-prometheus 9090:9090

# Acessar Grafana
kubectl port-forward -n velya-dev-observability svc/grafana 3000:80

# Acessar ArgoCD
kubectl port-forward -n argocd svc/argocd-server 8080:443

# AWS Simulation
export AWS_ENDPOINT_URL=http://localhost:4566
aws ec2 describe-instances

# Limpar tudo
./scripts/multistack-setup.sh teardown
kind delete cluster --name velya-local
```

---

## FAQ Rápido

**P: Preciso fazer algo antes de rodar o script?**  
R: Apenas abra Docker Desktop (macOS/Windows) ou inicie Docker daemon (Linux).

**P: O script vai deletar algo?**  
R: Não. Se houver cluster existente, ele avisa e pula.

**P: Posso rodar o script múltiplas vezes?**  
R: Sim, é seguro. Script é idempotente.

**P: Quanto tempo leva?**  
R: 3-10 minutos. Primeira vez é mais lenta.

**P: Funciona sem internet?**  
R: Não. Precisa baixar imagens Docker.

**P: E se meu Docker não tiver espaço?**  
R: Limpe com `docker system prune -a` (cuidado com `-a`!).

**P: Preciso de acesso root/sudo?**  
R: Sim, em alguns pontos. Script pede quando necessário.

---

## OS Suportados

| OS             | Versão        | Status                |
| -------------- | ------------- | --------------------- |
| **macOS**      | 12+           | ✅ Completo           |
| **Linux**      | Ubuntu 20.04+ | ✅ Completo           |
| **Windows 11** | WSL2          | ✅ Completo           |
| **Windows 10** | WSL2          | ⚠️ Pode ter problemas |

---

## Próximo Passo

```bash
bash scripts/velya-init.sh
```

Depois de 3-5 minutos, você tem:

- ✅ Kubernetes cluster (5 nodes)
- ✅ Tier isolation (4 tiers)
- ✅ Observability (Prometheus, Grafana)
- ✅ GitOps (ArgoCD)
- ✅ AWS simulation (ministack)

**Feliz codificação! 🚀**

---

**Dúvidas?** Veja os documentos listados acima ou rode:

```bash
bash scripts/velya-init.sh --help  # Em breve
```
