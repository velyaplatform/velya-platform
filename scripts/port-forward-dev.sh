#!/usr/bin/env bash
# Port-forward all velya dev services for local access
# Usage: ./scripts/port-forward-dev.sh [start|stop]

set -euo pipefail

PF_PID_FILE="/tmp/velya-pf.pids"
ACTION="${1:-start}"

start_forwards() {
  echo "Starting port-forwards for Velya dev services..."
  pids=()

  # Observability
  kubectl port-forward svc/prometheus-grafana 3000:80 -n velya-dev-observability &>/tmp/pf-grafana.log &
  pids+=($!)
  kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n velya-dev-observability &>/tmp/pf-prometheus.log &
  pids+=($!)
  kubectl port-forward svc/prometheus-kube-prometheus-alertmanager 9093:9093 -n velya-dev-observability &>/tmp/pf-alertmanager.log &
  pids+=($!)

  # Core services
  kubectl port-forward svc/patient-flow 3001:3001 -n velya-dev-core &>/tmp/pf-patient-flow.log &
  pids+=($!)
  kubectl port-forward svc/discharge-orchestrator 3002:3002 -n velya-dev-core &>/tmp/pf-discharge.log &
  pids+=($!)
  kubectl port-forward svc/task-inbox 3003:3003 -n velya-dev-core &>/tmp/pf-task-inbox.log &
  pids+=($!)
  kubectl port-forward svc/audit-service 3004:3004 -n velya-dev-core &>/tmp/pf-audit.log &
  pids+=($!)

  # Platform services
  kubectl port-forward svc/ai-gateway 3010:3010 -n velya-dev-platform &>/tmp/pf-ai-gateway.log &
  pids+=($!)
  kubectl port-forward svc/nats 4222:4222 -n velya-dev-platform &>/tmp/pf-nats.log &
  pids+=($!)
  kubectl port-forward svc/postgresql 5432:5432 -n velya-dev-platform &>/tmp/pf-postgres.log &
  pids+=($!)

  # Agents
  kubectl port-forward svc/agent-orchestrator 3020:3020 -n velya-dev-agents &>/tmp/pf-agent-orch.log &
  pids+=($!)

  # ArgoCD
  kubectl port-forward svc/argocd-server 8080:443 -n argocd &>/tmp/pf-argocd.log &
  pids+=($!)

  printf '%s\n' "${pids[@]}" > "$PF_PID_FILE"

  sleep 2
  echo ""
  echo "=== Velya Dev URLs ==="
  echo "  Grafana:               http://localhost:3000  (admin / prom-operator)"
  echo "  Prometheus:            http://localhost:9090"
  echo "  ArgoCD:                https://localhost:8080"
  echo "  Patient Flow API:      http://localhost:3001/api/v1/health"
  echo "  Discharge Orch API:    http://localhost:3002/api/v1/health"
  echo "  Task Inbox API:        http://localhost:3003/api/v1/health"
  echo "  Audit Service API:     http://localhost:3004/api/v1/health"
  echo "  AI Gateway API:        http://localhost:3010/api/v1/health"
  echo "  Agent Orchestrator:    http://localhost:3020/api/v1/health"
  echo "  NATS:                  nats://localhost:4222"
  echo "  PostgreSQL:            postgresql://velya:velya-dev-password@localhost:5432/velya_dev"
  echo "  LocalStack:            http://localhost:4566 (running in Docker)"
  echo ""
  echo "PIDs saved to $PF_PID_FILE"
}

stop_forwards() {
  if [[ -f "$PF_PID_FILE" ]]; then
    echo "Stopping port-forwards..."
    while IFS= read -r pid; do
      kill "$pid" 2>/dev/null && echo "Killed PID $pid" || true
    done < "$PF_PID_FILE"
    rm -f "$PF_PID_FILE"
    echo "Done."
  else
    echo "No PID file found at $PF_PID_FILE"
  fi
}

case "$ACTION" in
  start) start_forwards ;;
  stop)  stop_forwards ;;
  *) echo "Usage: $0 [start|stop]"; exit 1 ;;
esac
