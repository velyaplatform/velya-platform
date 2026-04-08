#!/usr/bin/env bash
# validate-naming.sh
# Hook to validate file and directory naming conventions against the Velya naming taxonomy.
#
# Usage:
#   .claude/hooks/validate-naming.sh              # Check staged files
#   .claude/hooks/validate-naming.sh --all        # Check all tracked files
#   .claude/hooks/validate-naming.sh --path DIR   # Check a specific directory
#
# Exit codes:
#   0 - All names are valid
#   1 - Naming violations detected

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m'

VIOLATIONS=0
VIOLATION_DETAILS=""

# Files and directories that are allowed to break kebab-case rules
EXCEPTIONS=(
    'Dockerfile'
    'Makefile'
    'LICENSE'
    'SECURITY.md'
    'CLAUDE.md'
    'README.md'
    'CHANGELOG.md'
    'CODEOWNERS'
    'Procfile'
    'Taskfile.yml'
    'DEPLOYMENT.md'
    'QUICKSTART_LOCAL.md'
    'START_HERE.md'
    'VELYA_INIT.md'
    'ARCHITECTURE_LOCAL.md'
    'LOCAL_SETUP.md'
    'SESSION_SUMMARY.md'
    'QUICKSTART.md'
    '_helpers.tpl'
    'tsconfig.json'
    'tsconfig.*.json'
    '.gitignore'
    '.gitattributes'
    '.npmrc'
    '.nvmrc'
    '.prettierrc'
    '.prettierrc.js'
    '.prettierrc.json'
    '.eslintrc.js'
    '.eslintrc.json'
    '.eslintrc.cjs'
    'jest.config.ts'
    'jest.config.js'
    'vitest.config.ts'
    'vitest.config.js'
    'playwright.config.ts'
    'next.config.js'
    'next.config.mjs'
    'tailwind.config.js'
    'tailwind.config.ts'
    'postcss.config.js'
    'Chart.yaml'
    'Chart.lock'
    '.helmignore'
    '.terraform.lock.hcl'
    '.env.example'
    'package.json'
    'package-lock.json'
    'turbo.json'
    'nx.json'
    'pnpm-workspace.yaml'
)

# Directories to skip entirely
SKIP_DIRS=(
    'node_modules'
    '.git'
    'dist'
    'build'
    '.next'
    '.turbo'
    'coverage'
    '.terraform'
    '.tofu'
)

is_exception() {
    local basename="$1"
    for exception in "${EXCEPTIONS[@]}"; do
        if [[ "$basename" == "$exception" ]]; then
            return 0
        fi
    done
    # Hidden config files (dotfiles) are generally exceptions
    if [[ "$basename" == .* ]]; then
        return 0
    fi
    return 1
}

is_skip_dir() {
    local path="$1"
    for skip in "${SKIP_DIRS[@]}"; do
        if echo "$path" | grep -qE "(^|/)${skip}(/|$)"; then
            return 0
        fi
    done
    return 1
}

add_violation() {
    local file="$1"
    local rule="$2"
    local suggestion="$3"
    VIOLATIONS=$((VIOLATIONS + 1))
    VIOLATION_DETAILS="${VIOLATION_DETAILS}\n  ${RED}[VIOLATION]${NC} $file"
    VIOLATION_DETAILS="${VIOLATION_DETAILS}\n    Rule: $rule"
    VIOLATION_DETAILS="${VIOLATION_DETAILS}\n    Suggestion: $suggestion\n"
}

# Convert a name to kebab-case for suggestion
to_kebab_case() {
    echo "$1" | sed -E 's/([a-z])([A-Z])/\1-\2/g; s/_/-/g' | tr '[:upper:]' '[:lower:]'
}

# Determine which files to check
if [[ "${1:-}" == "--all" ]]; then
    FILES=$(git ls-files 2>/dev/null || find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*')
elif [[ "${1:-}" == "--path" ]]; then
    TARGET="${2:-.}"
    FILES=$(find "$TARGET" -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*')
else
    FILES=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)
fi

if [[ -z "$FILES" ]]; then
    echo -e "${GREEN}No files to check.${NC}"
    exit 0
fi

echo "Validating naming conventions..."
echo ""

# Track directories we have already checked
declare -A CHECKED_DIRS

while IFS= read -r file; do
    # Skip files in excluded directories
    if is_skip_dir "$file"; then
        continue
    fi

    # Check the filename (basename)
    basename=$(basename "$file")
    
    # Skip exceptions
    if is_exception "$basename"; then
        continue
    fi

    # Strip extension for checking
    name_without_ext="${basename%.*}"
    
    # Check for kebab-case: only lowercase letters, numbers, and hyphens
    # Allow dots in filenames (e.g., vitest.config.ts, test.spec.ts)
    if echo "$name_without_ext" | grep -qE '[A-Z_]'; then
        # Allow test files like *.test.ts, *.spec.ts
        base_for_check=$(echo "$name_without_ext" | sed -E 's/\.(test|spec|stories|mock|fixture|e2e|integration)$//')
        if echo "$base_for_check" | grep -qE '[A-Z_]'; then
            suggested=$(to_kebab_case "$base_for_check")
            add_violation "$file" \
                "File names must use kebab-case" \
                "Rename to: ${suggested}${name_without_ext/$base_for_check/}"
        fi
    fi

    # Check directory components
    dir=$(dirname "$file")
    IFS='/' read -ra PARTS <<< "$dir"
    for part in "${PARTS[@]}"; do
        # Skip current dir, empty, and already checked
        [[ -z "$part" || "$part" == "." ]] && continue
        [[ -n "${CHECKED_DIRS[$part]+x}" ]] && continue
        CHECKED_DIRS["$part"]=1

        # Skip exception directories
        if is_exception "$part" || is_skip_dir "$part"; then
            continue
        fi

        # Hidden directories are ok
        [[ "$part" == .* ]] && continue

        # Check for kebab-case
        if echo "$part" | grep -qE '[A-Z_]'; then
            suggested=$(to_kebab_case "$part")
            add_violation "$dir/$part/" \
                "Directory names must use kebab-case" \
                "Rename to: $suggested"
        fi
    done

    # Check service directory naming (under services/)
    if echo "$file" | grep -qE '^services/[^/]+/'; then
        service_dir=$(echo "$file" | cut -d'/' -f2)
        if [[ -z "${CHECKED_DIRS[svc_$service_dir]+x}" ]]; then
            CHECKED_DIRS["svc_$service_dir"]=1
            # Accept both velya-{domain}-{responsibility} and short {domain}-{responsibility} patterns
            if ! echo "$service_dir" | grep -qE '^(velya-)?[a-z]+-[a-z]+(-[a-z]+)*$'; then
                add_violation "services/$service_dir/" \
                    "Service directories must use kebab-case (e.g., patient-flow or velya-patient-flow)" \
                    "Rename to kebab-case"
            fi
        fi
    fi

    # Check agent directory naming (under agents/)
    if echo "$file" | grep -qE '^agents/[^/]+/[^/]+/'; then
        agent_dir=$(echo "$file" | cut -d'/' -f3)
        if [[ -z "${CHECKED_DIRS[agent_$agent_dir]+x}" ]]; then
            CHECKED_DIRS["agent_$agent_dir"]=1
            if ! echo "$agent_dir" | grep -qE '^[a-z]+-[a-z]+-agent$'; then
                add_violation "agents/*/$agent_dir/" \
                    "Agent directories must follow {office}-{role}-agent pattern" \
                    "Rename to: {office}-{role}-agent (e.g., security-office-reviewer-agent)"
            fi
        fi
    fi

    # Check package naming (package.json under packages/)
    if echo "$file" | grep -qE '^packages/[^/]+/package\.json$'; then
        pkg_dir=$(echo "$file" | cut -d'/' -f2)
        if [[ -z "${CHECKED_DIRS[pkg_$pkg_dir]+x}" ]]; then
            CHECKED_DIRS["pkg_$pkg_dir"]=1
            if [[ -f "$file" ]]; then
                pkg_name=$(grep -oP '"name"\s*:\s*"\K[^"]+' "$file" 2>/dev/null || true)
                if [[ -n "$pkg_name" ]] && ! echo "$pkg_name" | grep -qE '^@velya/'; then
                    add_violation "$file" \
                        "Package name must follow @velya/{package-name} pattern" \
                        "Update name in package.json to: @velya/$pkg_dir"
                fi
            fi
        fi
    fi

done <<< "$FILES"

echo ""

if [[ $VIOLATIONS -gt 0 ]]; then
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  NAMING VIOLATIONS DETECTED${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo -e "${VIOLATIONS} naming violation(s) found:"
    echo -e "$VIOLATION_DETAILS"
    echo -e "${YELLOW}Reference: docs/product/naming-taxonomy.md${NC}"
    echo ""
    exit 1
else
    echo -e "${GREEN}All naming conventions are valid.${NC}"
    exit 0
fi
