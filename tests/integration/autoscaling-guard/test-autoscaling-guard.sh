#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Integration tests for the Autoscaling Ownership Guard
#
# Simulates cluster state via mock kubectl responses and
# validates that presync-validate.sh produces correct
# pass/fail decisions for each scenario.
#
# Usage:
#   ./tests/integration/autoscaling-guard/test-autoscaling-guard.sh
#
# Requires: bash 4+
# Does NOT require a real cluster — kubectl is shimmed.
# ─────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
GUARD_SCRIPT="$REPO_ROOT/infra/kubernetes/bootstrap/autoscaling-guard.yaml"

TESTS_PASSED=0
TESTS_FAILED=0
TMPDIR_BASE=$(mktemp -d)
trap 'rm -rf "$TMPDIR_BASE"' EXIT

# ── Extract presync-validate.sh from the ConfigMap ───────

extract_script() {
  # Extract the presync-validate.sh content from the multi-doc YAML
  awk '/presync-validate\.sh: \|/{found=1; next} found && /^  [a-z]/{found=0} found{print substr($0,5)}' \
    "$GUARD_SCRIPT" > "$TMPDIR_BASE/presync-validate.sh"
  chmod +x "$TMPDIR_BASE/presync-validate.sh"
}

# ── Mock kubectl ─────────────────────────────────────────

setup_mock_kubectl() {
  local test_dir="$1"
  mkdir -p "$test_dir/bin"

  cat > "$test_dir/bin/kubectl" << 'MOCK_EOF'
#!/usr/bin/env bash
# Mock kubectl that returns predefined responses based on args
MOCK_DATA_DIR="${MOCK_DATA_DIR:-/tmp/mock-data}"

args="$*"

# Route based on command pattern
if [[ "$args" == *"get hpa"*"--no-headers"*"custom-columns"* ]]; then
  ns=$(echo "$args" | grep -oP '(?<=-n )\S+')
  cat "$MOCK_DATA_DIR/hpa-list-$ns.txt" 2>/dev/null || true
  exit 0
fi

if [[ "$args" == *"get scaledobjects"*"--no-headers"*"custom-columns"* ]]; then
  ns=$(echo "$args" | grep -oP '(?<=-n )\S+')
  cat "$MOCK_DATA_DIR/so-list-$ns.txt" 2>/dev/null || true
  exit 0
fi

if [[ "$args" == *"get hpa"*"-o jsonpath"*"managed-by"* ]]; then
  hpa_name=$(echo "$args" | grep -oP 'get hpa \K\S+')
  ns=$(echo "$args" | grep -oP '(?<=-n )\S+')
  cat "$MOCK_DATA_DIR/hpa-managed-by-$ns-$hpa_name.txt" 2>/dev/null || true
  exit 0
fi

if [[ "$args" == *"get hpa"*"-o jsonpath"*"ownerReferences"* ]]; then
  hpa_name=$(echo "$args" | grep -oP 'get hpa \K\S+')
  ns=$(echo "$args" | grep -oP '(?<=-n )\S+')
  cat "$MOCK_DATA_DIR/hpa-owner-$ns-$hpa_name.txt" 2>/dev/null || true
  exit 0
fi

if [[ "$args" == *"get hpa"* && "$args" != *"--no-headers"* ]]; then
  # Simple existence check
  hpa_name=$(echo "$args" | grep -oP 'get hpa \K\S+')
  ns=$(echo "$args" | grep -oP '(?<=-n )\S+')
  if [[ -f "$MOCK_DATA_DIR/hpa-exists-$ns-$hpa_name" ]]; then
    exit 0
  else
    echo "Error from server (NotFound): horizontalpodautoscalers.autoscaling \"$hpa_name\" not found" >&2
    exit 1
  fi
fi

if [[ "$args" == *"get scaledobject "*"-o jsonpath"*"transfer-hpa-ownership"* ]]; then
  so_name=$(echo "$args" | grep -oP 'get scaledobject \K\S+')
  ns=$(echo "$args" | grep -oP '(?<=-n )\S+')
  cat "$MOCK_DATA_DIR/so-transfer-$ns-$so_name.txt" 2>/dev/null || true
  exit 0
fi

if [[ "$args" == *"get scaledobject "*"-o jsonpath"*"horizontalPodAutoscalerConfig"* ]]; then
  so_name=$(echo "$args" | grep -oP 'get scaledobject \K\S+')
  ns=$(echo "$args" | grep -oP '(?<=-n )\S+')
  cat "$MOCK_DATA_DIR/so-hpa-config-$ns-$so_name.txt" 2>/dev/null || true
  exit 0
fi

if [[ "$args" == *"get scaledobject "* && "$args" != *"--no-headers"* ]]; then
  so_name=$(echo "$args" | grep -oP 'get scaledobject \K\S+')
  ns=$(echo "$args" | grep -oP '(?<=-n )\S+')
  if [[ -f "$MOCK_DATA_DIR/so-exists-$ns-$so_name" ]]; then
    exit 0
  else
    echo "Error from server (NotFound): scaledobjects.keda.sh \"$so_name\" not found" >&2
    exit 1
  fi
fi

# Default: empty output
exit 0
MOCK_EOF
  chmod +x "$test_dir/bin/kubectl"
}

# ── Test runner ──────────────────────────────────────────

run_test() {
  local test_name="$1"
  local expected_exit="$2" # 0=pass, 1=fail
  local test_dir="$TMPDIR_BASE/$test_name"
  local mock_dir="$test_dir/mock-data"
  local policy_dir="$test_dir/policy"

  mkdir -p "$mock_dir" "$policy_dir"
  setup_mock_kubectl "$test_dir"

  # Caller should have written:
  #   $policy_dir/policy.conf
  #   $mock_dir/<mock-files>

  local actual_exit=0
  MOCK_DATA_DIR="$mock_dir" \
  PATH="$test_dir/bin:$PATH" \
  POLICY_FILE="$policy_dir/policy.conf" \
    bash "$TMPDIR_BASE/presync-validate.sh" > "$test_dir/output.log" 2>&1 || actual_exit=$?

  if [[ "$actual_exit" -eq "$expected_exit" ]]; then
    echo "  ✓ $test_name (exit=$actual_exit)"
    ((TESTS_PASSED++)) || true
  else
    echo "  ✗ $test_name (expected exit=$expected_exit, got exit=$actual_exit)"
    echo "    Output:"
    sed 's/^/    | /' "$test_dir/output.log"
    ((TESTS_FAILED++)) || true
  fi
}

# ── Tests ────────────────────────────────────────────────

echo "╔══════════════════════════════════════════════════╗"
echo "║  Autoscaling Guard — Integration Tests          ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

extract_script

# ─── Test 1: Valid HPA only ───────────────────────────
test_name="valid-hpa-only"
test_dir="$TMPDIR_BASE/$test_name"
mock_dir="$test_dir/mock-data"
policy_dir="$test_dir/policy"
mkdir -p "$mock_dir" "$policy_dir"

cat > "$policy_dir/policy.conf" << 'EOF'
my-service|velya-dev-core|hpa|my-service-hpa|
EOF

# No ScaledObjects exist
echo -n "" > "$mock_dir/so-list-velya-dev-core.txt"

run_test "$test_name" 0

# ─── Test 2: Valid KEDA only (no legacy HPA) ─────────
test_name="valid-keda-only"
test_dir="$TMPDIR_BASE/$test_name"
mock_dir="$test_dir/mock-data"
policy_dir="$test_dir/policy"
mkdir -p "$mock_dir" "$policy_dir"

cat > "$policy_dir/policy.conf" << 'EOF'
patient-flow|velya-dev-core|keda||patient-flow-scaler
EOF

# No HPAs exist
echo -n "" > "$mock_dir/hpa-list-velya-dev-core.txt"

run_test "$test_name" 0

# ─── Test 3: Valid KEDA with KEDA-managed HPA ────────
test_name="valid-keda-with-keda-managed-hpa"
test_dir="$TMPDIR_BASE/$test_name"
mock_dir="$test_dir/mock-data"
policy_dir="$test_dir/policy"
mkdir -p "$mock_dir" "$policy_dir"

cat > "$policy_dir/policy.conf" << 'EOF'
patient-flow|velya-dev-core|keda||patient-flow-scaler
EOF

# HPA exists but is KEDA-managed
echo "keda-hpa-patient-flow   patient-flow" > "$mock_dir/hpa-list-velya-dev-core.txt"
echo -n "keda-operator" > "$mock_dir/hpa-managed-by-velya-dev-core-keda-hpa-patient-flow.txt"

run_test "$test_name" 0

# ─── Test 4: INVALID — KEDA mode + legacy HPA ───────
test_name="invalid-keda-with-legacy-hpa"
test_dir="$TMPDIR_BASE/$test_name"
mock_dir="$test_dir/mock-data"
policy_dir="$test_dir/policy"
mkdir -p "$mock_dir" "$policy_dir"

cat > "$policy_dir/policy.conf" << 'EOF'
task-inbox|velya-dev-core|keda||task-inbox-scaler
EOF

# Legacy HPA exists (not KEDA-managed)
echo "task-inbox-hpa   task-inbox" > "$mock_dir/hpa-list-velya-dev-core.txt"
echo -n "" > "$mock_dir/hpa-managed-by-velya-dev-core-task-inbox-hpa.txt"
echo -n "" > "$mock_dir/hpa-owner-velya-dev-core-task-inbox-hpa.txt"

run_test "$test_name" 1

# ─── Test 5: INVALID — HPA mode + ScaledObject exists
test_name="invalid-hpa-with-scaledobject"
test_dir="$TMPDIR_BASE/$test_name"
mock_dir="$test_dir/mock-data"
policy_dir="$test_dir/policy"
mkdir -p "$mock_dir" "$policy_dir"

cat > "$policy_dir/policy.conf" << 'EOF'
my-service|velya-dev-core|hpa|my-service-hpa|
EOF

# ScaledObject exists targeting same workload
echo "my-service-scaler   my-service" > "$mock_dir/so-list-velya-dev-core.txt"

run_test "$test_name" 1

# ─── Test 6: Valid migrate-hpa-to-keda ───────────────
test_name="valid-migrate-hpa-to-keda"
test_dir="$TMPDIR_BASE/$test_name"
mock_dir="$test_dir/mock-data"
policy_dir="$test_dir/policy"
mkdir -p "$mock_dir" "$policy_dir"

cat > "$policy_dir/policy.conf" << 'EOF'
ai-gateway|velya-dev-platform|migrate-hpa-to-keda|ai-gateway-hpa|ai-gateway-scaler
EOF

# HPA exists
touch "$mock_dir/hpa-exists-velya-dev-platform-ai-gateway-hpa"
# ScaledObject exists with correct config
touch "$mock_dir/so-exists-velya-dev-platform-ai-gateway-scaler"
echo -n "true" > "$mock_dir/so-transfer-velya-dev-platform-ai-gateway-scaler.txt"
echo -n "ai-gateway-hpa" > "$mock_dir/so-hpa-config-velya-dev-platform-ai-gateway-scaler.txt"

run_test "$test_name" 0

# ─── Test 7: INVALID migrate — missing transfer annotation
test_name="invalid-migrate-no-transfer-annotation"
test_dir="$TMPDIR_BASE/$test_name"
mock_dir="$test_dir/mock-data"
policy_dir="$test_dir/policy"
mkdir -p "$mock_dir" "$policy_dir"

cat > "$policy_dir/policy.conf" << 'EOF'
ai-gateway|velya-dev-platform|migrate-hpa-to-keda|ai-gateway-hpa|ai-gateway-scaler
EOF

touch "$mock_dir/hpa-exists-velya-dev-platform-ai-gateway-hpa"
touch "$mock_dir/so-exists-velya-dev-platform-ai-gateway-scaler"
echo -n "" > "$mock_dir/so-transfer-velya-dev-platform-ai-gateway-scaler.txt"
echo -n "ai-gateway-hpa" > "$mock_dir/so-hpa-config-velya-dev-platform-ai-gateway-scaler.txt"

run_test "$test_name" 1

# ─── Test 8: INVALID migrate — wrong HPA name ───────
test_name="invalid-migrate-wrong-hpa-name"
test_dir="$TMPDIR_BASE/$test_name"
mock_dir="$test_dir/mock-data"
policy_dir="$test_dir/policy"
mkdir -p "$mock_dir" "$policy_dir"

cat > "$policy_dir/policy.conf" << 'EOF'
ai-gateway|velya-dev-platform|migrate-hpa-to-keda|ai-gateway-hpa|ai-gateway-scaler
EOF

touch "$mock_dir/hpa-exists-velya-dev-platform-ai-gateway-hpa"
touch "$mock_dir/so-exists-velya-dev-platform-ai-gateway-scaler"
echo -n "true" > "$mock_dir/so-transfer-velya-dev-platform-ai-gateway-scaler.txt"
echo -n "wrong-hpa-name" > "$mock_dir/so-hpa-config-velya-dev-platform-ai-gateway-scaler.txt"

run_test "$test_name" 1

# ─── Test 9: Multiple workloads, one conflict ────────
test_name="multi-workload-one-conflict"
test_dir="$TMPDIR_BASE/$test_name"
mock_dir="$test_dir/mock-data"
policy_dir="$test_dir/policy"
mkdir -p "$mock_dir" "$policy_dir"

cat > "$policy_dir/policy.conf" << 'EOF'
patient-flow|velya-dev-core|keda||patient-flow-scaler
task-inbox|velya-dev-core|keda||task-inbox-scaler
EOF

# patient-flow: clean (no HPA)
# task-inbox: conflict (legacy HPA)
echo "task-inbox-hpa   task-inbox" > "$mock_dir/hpa-list-velya-dev-core.txt"
echo -n "" > "$mock_dir/hpa-managed-by-velya-dev-core-task-inbox-hpa.txt"
echo -n "" > "$mock_dir/hpa-owner-velya-dev-core-task-inbox-hpa.txt"

run_test "$test_name" 1

# ─── Test 10: Unknown mode ───────────────────────────
test_name="unknown-mode"
test_dir="$TMPDIR_BASE/$test_name"
mock_dir="$test_dir/mock-data"
policy_dir="$test_dir/policy"
mkdir -p "$mock_dir" "$policy_dir"

cat > "$policy_dir/policy.conf" << 'EOF'
my-service|velya-dev-core|vpa||
EOF

run_test "$test_name" 1

# ── Summary ──────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════"
echo "  Tests passed: $TESTS_PASSED"
echo "  Tests failed: $TESTS_FAILED"
echo "  Total:        $((TESTS_PASSED + TESTS_FAILED))"
echo "════════════════════════════════════════════════════"

if [[ "$TESTS_FAILED" -gt 0 ]]; then
  echo ""
  echo "SOME TESTS FAILED"
  exit 1
fi

echo ""
echo "ALL TESTS PASSED"
exit 0
