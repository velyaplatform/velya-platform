# Velya Init - One-Command Setup

**One script to rule them all.** 🧙

Execute um único comando e todo o setup é feito automaticamente.

## The One Command

```bash
bash scripts/velya-init.sh
```

That's it. Aquele é o único comando que você precisa executar.

## O Que Este Script Faz

### ✅ Detecção Automática
- 🖥️ Detecta seu sistema operacional (macOS, Linux, Windows/WSL)
- 📦 Verifica quais ferramentas você já tem instaladas
- 💾 Valida recursos (RAM, disco)
- 🔌 Verifica se Docker está rodando

### ✅ Instalação Automática
Se algo estiver faltando, instala:
- **Docker** (obrigatório) - via Homebrew ou instalador
- **kind** (Kubernetes local) - via GitHub releases
- **kubectl** (CLI Kubernetes) - versão estável
- **Helm** (gerenciador de pacotes K8s) - opcional
- **Git** (controle de versão) - se necessário

### ✅ Configuração Automática
- Configura permissões de Docker (Linux)
- Cria cluster kind com 5 nodes (1 control + 4 workers)
- Aplica tier isolation (labels, taints, network policies)
- Inicia ministack (simulação AWS)
- Verifica tudo

### ✅ Relatório Final
Mostra:
- Ferramentas instaladas vs já existentes
- URLs de acesso (Prometheus, Grafana, ArgoCD)
- Próximos passos
- Links para documentação

## Exemplo de Execução

```bash
$ bash scripts/velya-init.sh

╔════════════════════════════════════════════════════════════════════╗
║   VELYA PLATFORM - INTELLIGENT INITIALIZATION                    ║
╚════════════════════════════════════════════════════════════════════╝

[ℹ] Detected OS: macos

╔════════════════════════════════════════════════════════════════════╗
║ STEP 1: Checking Prerequisites                                   ║
╚════════════════════════════════════════════════════════════════════╝

[ℹ] Required tools:
[✓] Docker: Docker version 29.3.1, build c2be9cc

[ℹ] Optional tools (will auto-install if missing):
[✓] kind: kind version 0.31.0 go1.25.5 linux/amd64
[!] kubectl: NOT FOUND
[!] Helm: NOT FOUND
[✓] Git: git version 2.43.0

╔════════════════════════════════════════════════════════════════════╗
║ STEP 2: Installing Missing Tools                                 ║
╚════════════════════════════════════════════════════════════════════╝

[⬇] Installing kubectl
[ℹ] Installing via Homebrew...
[✓] kubectl installed

[⬇] Installing Helm
[ℹ] Installing via Homebrew...
[✓] Helm installed

╔════════════════════════════════════════════════════════════════════╗
║ STEP 3: Verifying Docker                                         ║
╚════════════════════════════════════════════════════════════════════╝

[ℹ] Checking if Docker is running...
[✓] Docker daemon is running

╔════════════════════════════════════════════════════════════════════╗
║ STEP 4: Checking System Resources                                ║
╚════════════════════════════════════════════════════════════════════╝

[ℹ] Checking system resources...
[✓] RAM: 32GB available
[✓] Disk: 500GB available

╔════════════════════════════════════════════════════════════════════╗
║ STEP 5: Setting Up Velya Platform                                ║
╚════════════════════════════════════════════════════════════════════╝

[ℹ] Running kind setup...
[✓] kind cluster created
[✓] Network policies applied
[✓] Resource quotas applied

[ℹ] Running ministack setup...
[✓] ministack services started

╔════════════════════════════════════════════════════════════════════╗
║ ✨ VELYA PLATFORM READY! ✨                                       ║
╚════════════════════════════════════════════════════════════════════╝

INSTALLATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tools already installed: 3
Tools newly installed:   2
Failed to install:       0

NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Check cluster status:
   kubectl get nodes -L velya.io/tier

2. Deploy a test service:
   kubectl apply -f - <<'EOF'
   ...

3. Access Kubernetes services:
   kubectl port-forward -n velya-dev-observability svc/prometheus-kube-prometheus-prometheus 9090:9090

4. Access AWS simulation (ministack):
   export AWS_ENDPOINT_URL=http://localhost:4566
   aws ec2 describe-instances
```

## Pré-Requisitos Mínimos

| Item | Obrigatório? | Como Instalar |
|------|---|---|
| **Docker** | ✅ SIM | https://www.docker.com/products/docker-desktop |
| **Git** | ✅ SIM | `brew install git` ou `apt-get install git` |
| kind | ❌ NÃO | Script instala automaticamente |
| kubectl | ❌ NÃO | Script instala automaticamente |
| Helm | ❌ NÃO | Script instala automaticamente (opcional) |

## Pré-Requisitos de Sistema

- **RAM**: 4GB mínimo, 6GB recomendado
- **Disco**: 5GB livre mínimo
- **CPU**: 2+ cores
- **Internet**: Necessária para downloads
- **Docker rodando**: ✅ Obrigatório

## Sistemas Operacionais Suportados

- ✅ **macOS** 12+ (Intel ou Apple Silicon)
- ✅ **Linux** (Ubuntu 20.04+, Debian, Fedora, etc.)
- ✅ **Windows 11** com WSL2
- ⚠️ **Windows 10** com WSL2 (pode ter problemas de Docker)

## O Que Fazer Se Algo Falhar

### Erro: "Docker daemon not running"
```bash
# macOS: Abra Docker Desktop
# Linux: sudo service docker start
# Windows: Abra Docker Desktop
```

### Erro: "Permission denied: docker.sock" (Linux)
```bash
sudo usermod -aG docker $USER
# Depois faça logout e login
```

### Erro: "Failed to install kind/kubectl"
```bash
# Tente manualmente:
brew install kind kubectl  # macOS
sudo apt-get install kind kubectl  # Linux
```

### Erro: "helm installation failed"
Helm é opcional. O cluster funcionará sem ele (observability stack pode não instalar).

### Erro: "kind create cluster failed"
```bash
# Limpe e tente novamente:
kind delete cluster --name velya-local
bash scripts/velya-init.sh
```

## Após o Setup

Você terá acesso a:

```bash
# Kubernetes local
kubectl get nodes -L velya.io/tier
kubectl get pods -A

# Prometheus (métricas)
kubectl port-forward -n velya-dev-observability svc/prometheus-kube-prometheus-prometheus 9090:9090
# http://localhost:9090

# Grafana (dashboards)
kubectl port-forward -n velya-dev-observability svc/grafana 3000:80
# http://localhost:3000 (admin/admin)

# ArgoCD (GitOps)
kubectl port-forward -n argocd svc/argocd-server 8080:443
# https://localhost:8080

# AWS Simulation (ministack)
export AWS_ENDPOINT_URL=http://localhost:4566
aws ec2 describe-instances
aws eks describe-clusters
aws rds describe-db-instances
```

## Dicas Pro

### 1. Rodar em background
```bash
nohup bash scripts/velya-init.sh > velya-setup.log 2>&1 &
tail -f velya-setup.log
```

### 2. Ver logs detalhados
```bash
bash scripts/velya-init.sh 2>&1 | tee velya-setup.log
```

### 3. Limpar tudo depois
```bash
./scripts/multistack-setup.sh teardown
kind delete cluster --name velya-local
```

### 4. Reiniciar do zero
```bash
./scripts/multistack-setup.sh teardown
bash scripts/velya-init.sh
```

## Arquitetura Criada

Após executar este script, você terá:

```
┌─────────────────────────────────────────────────────────────┐
│  KUBERNETES CLUSTER (kind)         AWS SIM (ministack)      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✓ 5 nodes (1 control + 4 workers)  ✓ LocalStack          │
│  ✓ 4 tiers (frontend,backend,      ✓ VPC + subnets        │
│     platform, ai)                   ✓ RDS PostgreSQL       │
│  ✓ Network policies                 ✓ ECR registry         │
│  ✓ Resource quotas                  ✓ CloudWatch logs      │
│  ✓ Pod disruption budgets           ✓ MinIO (S3)          │
│  ✓ Observability stack              ✓ Redis               │
│    (Prometheus, Grafana, ArgoCD)    ✓ NATS               │
│                                      ✓ Prometheus         │
│                                      ✓ Grafana            │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting

```bash
# Ver status do cluster
kubectl get nodes
kubectl get ns
kubectl get all -A

# Ver logs do setup
cat velya-setup.log  # se salvou em arquivo

# Debugar Docker
docker ps
docker logs <container-id>

# Debugar ministack
cd .ministack/repo
docker-compose ps
docker-compose logs

# Limpar e reiniciar
./scripts/multistack-setup.sh teardown
bash scripts/velya-init.sh
```

## FAQ

**P: Preciso de Homebrew?**  
R: No macOS ajuda, mas o script tenta múltiplas formas de instalação. Linux não precisa.

**P: E se eu já tenho Docker, kind, kubectl instalados?**  
R: O script detecta tudo e não reinstala. Usa o que você já tem.

**P: Quanto tempo leva?**  
R: 3-10 minutos dependendo de internet e CPU. Primeira vez é mais lenta.

**P: Posso rodar múltiplas vezes?**  
R: Sim! Script é idempotente. Rodar novamente só atualiza o que precisa.

**P: O que fazer se o Docker não tiver espaço?**  
R: Limpe imagens: `docker system prune -a` (cuidado: remove tudo!)

**P: Preciso de acesso root?**  
R: Em alguns pontos sim (instalação de pacotes, Docker no Linux). Script usa `sudo` quando necessário.

---

**Uma linha, tudo feito.** ✨

```bash
bash scripts/velya-init.sh
```

Depois de 3-5 minutos, você tem Velya rodando localmente com:
- ✅ Kubernetes cluster (kind) com tier isolation
- ✅ AWS simulation (ministack)
- ✅ Observability stack (Prometheus, Grafana)
- ✅ GitOps (ArgoCD)

**Go build! 🚀**
