#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PUBLISH_SCRIPT="${REPO_ROOT}/scripts/publish-opensquad-snapshot.mjs"

STATE_ROOT="${VELYA_AUTOPILOT_STATE_DIR:-${HOME}/.local/state/velya/autopilot}"
SERVICE_DIR="${STATE_ROOT}/services"
LOG_FILE="${SERVICE_DIR}/opensquad-snapshot-publisher.log"
PID_FILE="${SERVICE_DIR}/opensquad-snapshot-publisher.pid"
HEALTH_FILE="${SERVICE_DIR}/opensquad-snapshot-publisher.last.json"
STALE_AFTER_SECONDS="${VELYA_OPENSQUAD_PUBLISHER_STALE_AFTER_SECONDS:-180}"
SOURCE_URL="${VELYA_OPENSQUAD_SNAPSHOT_SOURCE_URL:-http://127.0.0.1:${VELYA_DASHBOARD_PORT:-5173}/api/snapshot}"

info() {
  printf '[opensquad-snapshot-publisher] %s\n' "$*"
}

fail() {
  printf '[opensquad-snapshot-publisher] %s\n' "$*" >&2
  exit 1
}

health_is_fresh() {
  [[ -f "${HEALTH_FILE}" ]] || return 1
  local published_at epoch now age
  published_at="$(jq -r '.publishedAt // empty' "${HEALTH_FILE}" 2>/dev/null || true)"
  [[ -n "${published_at}" ]] || return 1
  epoch="$(date -u -d "${published_at}" +%s 2>/dev/null || true)"
  [[ -n "${epoch}" ]] || return 1
  now="$(date -u +%s)"
  age="$((now - epoch))"
  [[ "${age}" -le "${STALE_AFTER_SECONDS}" ]]
}

mkdir -p "${SERVICE_DIR}"

command -v node >/dev/null 2>&1 || fail "node nao encontrado"
command -v jq >/dev/null 2>&1 || fail "jq nao encontrado"
command -v curl >/dev/null 2>&1 || fail "curl nao encontrado"
command -v setsid >/dev/null 2>&1 || fail "setsid nao encontrado"
[[ -f "${PUBLISH_SCRIPT}" ]] || fail "publisher nao encontrado em ${PUBLISH_SCRIPT}"

if ! curl -fsS "${SOURCE_URL}" >/dev/null 2>&1; then
  fail "source-url indisponivel em ${SOURCE_URL}; inicie o dashboard antes do publisher"
fi

if [[ -f "${PID_FILE}" ]]; then
  pid="$(cat "${PID_FILE}")"
  if kill -0 "${pid}" >/dev/null 2>&1 && health_is_fresh; then
    info "publisher ja ativo e saudavel (pid ${pid})"
    info "log: ${LOG_FILE}"
    exit 0
  fi
  if kill -0 "${pid}" >/dev/null 2>&1; then
    info "reiniciando publisher sem health fresco (pid ${pid})"
    kill "${pid}" >/dev/null 2>&1 || true
    sleep 1
  fi
  rm -f "${PID_FILE}"
fi

cd "${REPO_ROOT}"
setsid sh -c "exec node '${PUBLISH_SCRIPT}' --interval 60 --source-url '${SOURCE_URL}' --health-file '${HEALTH_FILE}' >'${LOG_FILE}' 2>&1" < /dev/null &
pid=$!
echo "${pid}" > "${PID_FILE}"

for _ in $(seq 1 20); do
  if health_is_fresh; then
    info "publisher ativo"
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
fail "publisher nao ficou saudavel; verifique o log em ${LOG_FILE}"
