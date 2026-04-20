#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DASHBOARD_DIR="${REPO_ROOT}/dashboard"

STATE_ROOT="${VELYA_AUTOPILOT_STATE_DIR:-${HOME}/.local/state/velya/autopilot}"
SERVICE_DIR="${STATE_ROOT}/services"
LOG_FILE="${SERVICE_DIR}/orchestration-dashboard.log"
PID_FILE="${SERVICE_DIR}/orchestration-dashboard.pid"

HOST="${VELYA_DASHBOARD_HOST:-0.0.0.0}"
PORT="${VELYA_DASHBOARD_PORT:-5173}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/snapshot"

info() {
  printf '[dashboard] %s\n' "$*"
}

fail() {
  printf '[dashboard] %s\n' "$*" >&2
  exit 1
}

mkdir -p "${SERVICE_DIR}"

command -v npm >/dev/null 2>&1 || fail "npm nao encontrado"
command -v curl >/dev/null 2>&1 || fail "curl nao encontrado"
command -v setsid >/dev/null 2>&1 || fail "setsid nao encontrado"
[[ -d "${DASHBOARD_DIR}" ]] || fail "dashboard/ nao encontrado em ${DASHBOARD_DIR}"
[[ -d "${DASHBOARD_DIR}/node_modules" ]] || fail "dashboard/node_modules ausente; rode npm install em ${DASHBOARD_DIR}"

LINCESOC_AWS_SYNC_STARTER="${REPO_ROOT}/scripts/start-lincesoc-aws-migration-sync.sh"
LINCESOC_PLATFORM_SYNC_STARTER="${REPO_ROOT}/scripts/start-lincesoc-platform-ops-sync.sh"
COORDINATION_SYNC_STARTER="${REPO_ROOT}/scripts/start-agent-coordination-sync.sh"
OPENSQUAD_PUBLISHER_STARTER="${REPO_ROOT}/scripts/start-opensquad-snapshot-publisher.sh"

start_supporting_services() {
  if [[ -x "${COORDINATION_SYNC_STARTER}" ]]; then
    "${COORDINATION_SYNC_STARTER}" >/dev/null 2>&1 || info "sync de coordination nao iniciou automaticamente"
  fi
  if [[ -x "${LINCESOC_AWS_SYNC_STARTER}" ]]; then
    "${LINCESOC_AWS_SYNC_STARTER}" >/dev/null 2>&1 || info "sync Lincesoc AWS nao iniciou automaticamente"
  fi
  if [[ -x "${LINCESOC_PLATFORM_SYNC_STARTER}" ]]; then
    "${LINCESOC_PLATFORM_SYNC_STARTER}" >/dev/null 2>&1 || info "sync Lincesoc Platform Ops nao iniciou automaticamente"
  fi
  if [[ "${VELYA_OPENSQUAD_PUBLISHER_DISABLED:-0}" != "1" && -x "${OPENSQUAD_PUBLISHER_STARTER}" ]]; then
    "${OPENSQUAD_PUBLISHER_STARTER}" >/dev/null 2>&1 || info "publisher do snapshot opensquad nao iniciou automaticamente"
  fi
}

if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
  start_supporting_services
  if [[ -f "${PID_FILE}" ]]; then
    pid="$(cat "${PID_FILE}")"
    info "dashboard ja acessivel em http://localhost:${PORT}/ (pid ${pid})"
  else
    info "dashboard ja acessivel em http://localhost:${PORT}/"
  fi
  info "log: ${LOG_FILE}"
  exit 0
fi

if [[ -f "${PID_FILE}" ]]; then
  stale_pid="$(cat "${PID_FILE}")"
  if kill -0 "${stale_pid}" >/dev/null 2>&1; then
    info "encerrando processo anterior ${stale_pid}"
    kill "${stale_pid}" >/dev/null 2>&1 || true
    sleep 1
  fi
  rm -f "${PID_FILE}"
fi

cd "${DASHBOARD_DIR}"
setsid sh -c "exec npm run dev -- --host '${HOST}' --port '${PORT}'" >"${LOG_FILE}" 2>&1 < /dev/null &
pid=$!
echo "${pid}" > "${PID_FILE}"

for _ in $(seq 1 30); do
  if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
    start_supporting_services
    info "dashboard disponivel em http://localhost:${PORT}/"
    info "pid: ${pid}"
    info "log: ${LOG_FILE}"
    exit 0
  fi
  if ! kill -0 "${pid}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

tail -n 40 "${LOG_FILE}" >&2 || true
fail "dashboard nao ficou saudavel; verifique o log em ${LOG_FILE}"
