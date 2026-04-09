#!/usr/bin/env bash
# tunnel.sh — Inicia Cloudflare Tunnel para acesso externo à Velya
# A URL pública muda a cada reinício (quick tunnel grátis)
# Uso: bash scripts/tunnel.sh

set -euo pipefail

INGRESS_IP="172.19.0.100"

# Kill existing tunnel
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1

echo "Iniciando Cloudflare Tunnel..."
echo "Aguarde a URL pública..."
echo ""

cloudflared tunnel --url http://${INGRESS_IP}:80 2>&1 | tee /tmp/velya-tunnel.log &
TUNNEL_PID=$!

# Wait for URL to appear
for i in $(seq 1 15); do
  URL=$(grep -o 'https://[a-z-]*\.trycloudflare\.com' /tmp/velya-tunnel.log 2>/dev/null | head -1)
  if [ -n "$URL" ]; then
    echo ""
    echo "════════════════════════════════════════════════"
    echo "  VELYA PLATFORM — Acesso Externo"
    echo "  URL: $URL"
    echo "  PID: $TUNNEL_PID"
    echo "════════════════════════════════════════════════"
    echo ""
    echo "Páginas disponíveis:"
    echo "  $URL                → Centro de Comando"
    echo "  $URL/patients       → Pacientes"
    echo "  $URL/tasks          → Tarefas"
    echo "  $URL/discharge      → Altas"
    echo "  $URL/system         → Status do Sistema"
    echo "  $URL/activity       → Log de Atividade"
    echo "  $URL/audit          → Auditoria"
    echo "  $URL/suggestions    → Sugestões"
    echo "  $URL/api/health     → Health Check"
    echo ""
    echo "Para parar: kill $TUNNEL_PID"

    # Save URL to file for reference
    echo "$URL" > /tmp/velya-tunnel-url.txt

    wait $TUNNEL_PID
    exit 0
  fi
  sleep 1
done

echo "Erro: tunnel não iniciou em 15s"
exit 1
