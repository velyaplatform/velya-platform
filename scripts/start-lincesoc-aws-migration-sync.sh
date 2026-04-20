#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SYNC_SCRIPT="${REPO_ROOT}/scripts/sync-lincesoc-aws-migration.mjs"

STATE_ROOT="${VELYA_AUTOPILOT_STATE_DIR:-${HOME}/.local/state/velya/autopilot}"
SERVICE_DIR="${STATE_ROOT}/services"
LOG_FILE="${SERVICE_DIR}/lincesoc-aws-migration-sync.log"
PID_FILE="${SERVICE_DIR}/lincesoc-aws-migration-sync.pid"
HEALTH_FILE="${SERVICE_DIR}/lincesoc-aws-migration-sync.last.json"
STATUS_FILE="${REPO_ROOT}/docs/orchestration/lincesoc-aws-migration-status-current.md"
STALE_AFTER_SECONDS="${VELYA_LINCESOC_SYNC_STALE_AFTER_SECONDS:-180}"

info() {
  printf '[lincesoc-sync] %s\n' "$*"
}

fail() {
  printf '[lincesoc-sync] %s\n' "$*" >&2
  exit 1
}

health_is_fresh() {
  [[ -f "${HEALTH_FILE}" ]] || return 1
  local generated_at epoch now age
  generated_at="$(jq -r '.generatedAt // empty' "${HEALTH_FILE}" 2>/dev/null || true)"
  [[ -n "${generated_at}" ]] || return 1
  epoch="$(date -u -d "${generated_at}" +%s 2>/dev/null || true)"
  [[ -n "${epoch}" ]] || return 1
  now="$(date -u +%s)"
  age="$((now - epoch))"
  [[ "${age}" -le "${STALE_AFTER_SECONDS}" ]]
}

mkdir -p "${SERVICE_DIR}"

command -v node >/dev/null 2>&1 || fail "node nao encontrado"
command -v jq >/dev/null 2>&1 || fail "jq nao encontrado"
command -v setsid >/dev/null 2>&1 || fail "setsid nao encontrado"
[[ -f "${SYNC_SCRIPT}" ]] || fail "sync script nao encontrado em ${SYNC_SCRIPT}"

if [[ -f "${PID_FILE}" ]]; then
  pid="$(cat "${PID_FILE}")"
  if kill -0 "${pid}" >/dev/null 2>&1 && health_is_fresh; then
    info "sync ja ativo e saudavel (pid ${pid})"
    info "log: ${LOG_FILE}"
    exit 0
  fi
  if kill -0 "${pid}" >/dev/null 2>&1; then
    info "reiniciando sync sem health fresco (pid ${pid})"
    kill "${pid}" >/dev/null 2>&1 || true
    sleep 1
  fi
  rm -f "${PID_FILE}"
fi

cd "${REPO_ROOT}"
setsid sh -c "exec node '${SYNC_SCRIPT}' --interval 60 --health-file '${HEALTH_FILE}' >'${LOG_FILE}' 2>&1" < /dev/null &
pid=$!
echo "${pid}" > "${PID_FILE}"

for _ in $(seq 1 20); do
  if [[ -f "${STATUS_FILE}" ]] && health_is_fresh; then
    info "sync ativo"
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
fail "sync nao ficou saudavel; verifique o log em ${LOG_FILE}"
