#!/usr/bin/env bash
# pre-commit-secrets.sh
# Hook to check staged files for accidentally committed secrets.
# Runs before every commit to prevent secrets from entering the repository.
#
# Usage:
#   .claude/hooks/pre-commit-secrets.sh           # Check staged files (git pre-commit)
#   .claude/hooks/pre-commit-secrets.sh --all     # Check all tracked files (full scan)
#
# Exit codes:
#   0 - No secrets found
#   1 - Potential secrets detected (commit blocked)

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

FINDINGS=0
FINDING_DETAILS=""

# Determine which files to check
if [[ "${1:-}" == "--all" ]]; then
    FILES=$(git ls-files)
else
    FILES=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)
fi

if [[ -z "$FILES" ]]; then
    echo -e "${GREEN}No files to check.${NC}"
    exit 0
fi

# Files to skip (documentation, examples, test fixtures with fake data)
SKIP_PATTERNS=(
    '\.md$'
    '\.env\.example$'
    'package-lock\.json$'
    'node_modules/'
    '\.git/'
    'dist/'
    'build/'
    '\.claude/hooks/pre-commit-secrets\.sh$'
    '\.claude/skills/run-security-audit\.md$'
)

should_skip() {
    local file="$1"
    for pattern in "${SKIP_PATTERNS[@]}"; do
        if echo "$file" | grep -qE "$pattern"; then
            return 0
        fi
    done
    return 1
}

check_pattern() {
    local pattern="$1"
    local description="$2"
    local severity="$3"
    local file="$4"

    local matches
    matches=$(grep -nE "$pattern" "$file" 2>/dev/null || true)

    if [[ -n "$matches" ]]; then
        FINDINGS=$((FINDINGS + 1))
        FINDING_DETAILS="${FINDING_DETAILS}\n${RED}[$severity]${NC} $description"
        FINDING_DETAILS="${FINDING_DETAILS}\n  File: $file"
        while IFS= read -r match; do
            local line_num
            line_num=$(echo "$match" | cut -d: -f1)
            # Redact the actual value to avoid displaying secrets in output
            local redacted
            redacted=$(echo "$match" | sed -E "s/(key|token|password|secret|credential)(['\"]?\s*[:=]\s*['\"]?)[^'\"[:space:]]*/\1\2****REDACTED****/gi")
            FINDING_DETAILS="${FINDING_DETAILS}\n  Line $line_num: $redacted"
        done <<< "$matches"
        FINDING_DETAILS="${FINDING_DETAILS}\n"
    fi
}

echo "Scanning for secrets in staged files..."
echo ""

while IFS= read -r file; do
    # Skip if file does not exist (deleted files)
    [[ ! -f "$file" ]] && continue

    # Skip binary files
    if file "$file" | grep -q "binary"; then
        continue
    fi

    # Skip excluded patterns
    if should_skip "$file"; then
        continue
    fi

    # AWS Access Key IDs
    check_pattern 'AKIA[0-9A-Z]{16}' \
        "AWS Access Key ID detected" \
        "CRITICAL" \
        "$file"

    # AWS Secret Access Key assignments
    check_pattern "aws_secret_access_key\s*=\s*['\"][A-Za-z0-9/+=]{40}" \
        "AWS Secret Access Key assignment detected" \
        "CRITICAL" \
        "$file"

    # Generic API key assignments
    check_pattern "(api[_-]?key|apikey)\s*[:=]\s*['\"][a-zA-Z0-9_\-]{20,}['\"]" \
        "Potential API key assignment detected" \
        "HIGH" \
        "$file"

    # Auth token assignments
    check_pattern "(auth[_-]?token|access[_-]?token)\s*[:=]\s*['\"][a-zA-Z0-9_\-\.]{20,}['\"]" \
        "Potential auth token assignment detected" \
        "HIGH" \
        "$file"

    # Private keys
    check_pattern '-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----' \
        "Private key detected" \
        "CRITICAL" \
        "$file"

    # Password assignments (not in comments or type definitions)
    check_pattern "password\s*[:=]\s*['\"][^'\"]{8,}['\"]" \
        "Potential hardcoded password detected" \
        "HIGH" \
        "$file"

    # Database connection strings with embedded credentials
    check_pattern '(postgres|mysql|mongodb|redis)://[^:]+:[^@]+@' \
        "Database connection string with credentials detected" \
        "CRITICAL" \
        "$file"

    # Anthropic API keys
    check_pattern 'sk-ant-[a-zA-Z0-9\-]{20,}' \
        "Anthropic API key detected" \
        "CRITICAL" \
        "$file"

    # OpenAI API keys
    check_pattern 'sk-[a-zA-Z0-9]{20,}' \
        "Potential OpenAI API key detected" \
        "CRITICAL" \
        "$file"

    # JWT secrets
    check_pattern "jwt[_-]?secret\s*[:=]\s*['\"][^'\"]{16,}['\"]" \
        "JWT secret detected" \
        "HIGH" \
        "$file"

    # Bearer tokens
    check_pattern '[Bb]earer\s+[a-zA-Z0-9\-._~+/]{32,}' \
        "Bearer token detected" \
        "HIGH" \
        "$file"

    # GitHub tokens
    check_pattern 'gh[pousr]_[A-Za-z0-9_]{36,}' \
        "GitHub token detected" \
        "CRITICAL" \
        "$file"

    # Generic secret key assignments
    check_pattern "(secret[_-]?key)\s*[:=]\s*['\"][a-zA-Z0-9_\-]{20,}['\"]" \
        "Potential secret key assignment detected" \
        "HIGH" \
        "$file"

done <<< "$FILES"

echo ""

if [[ $FINDINGS -gt 0 ]]; then
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  SECRETS DETECTED - COMMIT BLOCKED${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo -e "${FINDINGS} potential secret(s) found:"
    echo ""
    echo -e "$FINDING_DETAILS"
    echo -e "${YELLOW}What to do:${NC}"
    echo "  1. Remove the secret from your code"
    echo "  2. Use External Secrets Operator to inject secrets at runtime"
    echo "  3. Store secrets in AWS Secrets Manager (see docs/security/secrets-model.md)"
    echo "  4. If this is a false positive, add the pattern to SKIP_PATTERNS in this script"
    echo ""
    echo -e "${YELLOW}If this secret was previously committed:${NC}"
    echo "  1. Rotate the secret immediately"
    echo "  2. Use 'git filter-branch' or BFG Repo-Cleaner to remove from history"
    echo "  3. Report to security@velya.health"
    echo ""
    exit 1
else
    echo -e "${GREEN}No secrets detected. All clear.${NC}"
    exit 0
fi
