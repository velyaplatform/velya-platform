#!/usr/bin/env bash
# memory-guardian/run.sh — validate repo invariants declared in claims.yaml
#
# Reusable from:
#   - .github/workflows/memory-guardian.yaml (CI gate)
#   - infra/kubernetes/memory-guardian/cronjob.yaml (in-cluster CronJob)
#   - local dev: bash ops/memory-guardian/run.sh
#
# Exit codes:
#   0 — all critical claims passed
#   1 — at least one critical claim violated
#   2 — fatal (claims file missing, etc.)

set -u
set -o pipefail

# Resolve repo root (parent of ops/)
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
CLAIMS="${MEMORY_GUARDIAN_CLAIMS:-$HERE/claims.yaml}"

if [[ ! -f "$CLAIMS" ]]; then
  echo "fatal: claims file not found at $CLAIMS" >&2
  exit 2
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "fatal: python3 required" >&2
  exit 2
fi

REPORT="${MEMORY_GUARDIAN_REPORT:-$REPO_ROOT/memory-guardian-report.json}"

python3 - "$CLAIMS" "$REPO_ROOT" "$REPORT" <<'PY'
import json
import os
import sys
import glob as globlib
import re

claims_path, repo_root, report_path = sys.argv[1], sys.argv[2], sys.argv[3]

try:
    import yaml  # type: ignore
    with open(claims_path) as f:
        doc = yaml.safe_load(f)
except ImportError:
    # Minimal yaml fallback: this validator only needs top-level `claims` list
    # with shallow fields. The CI runner will install pyyaml; in-cluster image
    # ships python:3.12-slim + pyyaml.
    print("fatal: pyyaml not installed", file=sys.stderr)
    sys.exit(2)

claims = doc.get("claims", []) or []

results = []
fail_critical = 0
fail_warning = 0

def apply_name_transform(name: str, rule: str) -> str:
    if not rule:
        return name
    if rule.startswith("strip_prefix:"):
        prefix = rule.split(":", 1)[1]
        return name[len(prefix):] if name.startswith(prefix) else name
    if rule.startswith("strip_suffix:"):
        suffix = rule.split(":", 1)[1]
        return name[: -len(suffix)] if name.endswith(suffix) else name
    return name

def check_file_exists(c):
    p = os.path.join(repo_root, c["path"])
    return (os.path.isfile(p), f"file {'present' if os.path.isfile(p) else 'MISSING'}: {c['path']}")

def check_dir_exists(c):
    p = os.path.join(repo_root, c["path"])
    return (os.path.isdir(p), f"dir {'present' if os.path.isdir(p) else 'MISSING'}: {c['path']}")

def check_file_contains(c):
    p = os.path.join(repo_root, c["path"])
    if not os.path.isfile(p):
        return (False, f"file MISSING: {c['path']}")
    pattern = c.get("pattern", "")
    with open(p, "r", errors="replace") as f:
        body = f.read()
    ok = re.search(pattern, body) is not None
    return (ok, f"{'contains' if ok else 'MISSING pattern'} /{pattern}/ in {c['path']}")

def check_all_match_pair(c):
    globp = os.path.join(repo_root, c["glob"])
    # Accept a primary template plus any number of fallback templates. A
    # file passes the check if ANY rendered template resolves to an
    # existing file.
    templates = [c["pair_template"]]
    fb = c.get("pair_fallback_templates") or c.get("pair_fallback_template")
    if isinstance(fb, list):
        templates.extend(fb)
    elif isinstance(fb, str):
        templates.append(fb)
    xform = c.get("name_transform", "")
    missing = []
    count = 0
    for src in globlib.glob(globp):
        count += 1
        base = os.path.splitext(os.path.basename(src))[0]
        name = apply_name_transform(base, xform)
        candidates = [t.replace("${name}", name) for t in templates]
        if not any(os.path.isfile(os.path.join(repo_root, cand)) for cand in candidates):
            missing.append(" | ".join(candidates))
    ok = not missing
    msg = f"pair check over {count} files: " + (
        "all present" if ok else f"missing {len(missing)} — {', '.join(missing)}"
    )
    return (ok, msg)

def check_file_contains_each(c):
    target = os.path.join(repo_root, c["path"])
    if not os.path.isfile(target):
        return (False, f"target MISSING: {c['path']}")
    with open(target, "r", errors="replace") as f:
        body = f.read()
    each_glob = os.path.join(repo_root, c["each_glob"])
    xform = c.get("name_transform", "")
    missing = []
    count = 0
    for src in globlib.glob(each_glob):
        count += 1
        base = os.path.basename(src)
        name = apply_name_transform(base, xform)
        if name not in body:
            missing.append(name)
    ok = not missing
    msg = f"{count} sources checked, {len(missing)} missing entries in {c['path']}" + (
        "" if ok else f" — {', '.join(missing)}"
    )
    return (ok, msg)

DISPATCH = {
    "file_exists": check_file_exists,
    "dir_exists": check_dir_exists,
    "file_contains": check_file_contains,
    "all_match_pair": check_all_match_pair,
    "file_contains_each": check_file_contains_each,
}

for c in claims:
    cid = c.get("id", "<unnamed>")
    kind = c.get("kind", "?")
    severity = c.get("severity", "critical")
    memory = c.get("memory", "")
    fn = DISPATCH.get(kind)
    if fn is None:
        ok, msg = (False, f"unknown claim kind: {kind}")
    else:
        try:
            ok, msg = fn(c)
        except Exception as e:
            ok, msg = (False, f"exception: {e}")
    if not ok:
        if severity == "critical":
            fail_critical += 1
        else:
            fail_warning += 1
    results.append({
        "id": cid, "kind": kind, "severity": severity, "memory": memory,
        "ok": ok, "message": msg,
    })
    status = "OK " if ok else ("FAIL" if severity == "critical" else "WARN")
    print(f"[{status}] {severity:8} {cid:42} — {msg}")

summary = {
    "total": len(claims),
    "passed": sum(1 for r in results if r["ok"]),
    "failed_critical": fail_critical,
    "failed_warning": fail_warning,
    "results": results,
}
with open(report_path, "w") as f:
    json.dump(summary, f, indent=2)

print()
print(f"memory-guardian: total={summary['total']} "
      f"passed={summary['passed']} "
      f"fail_critical={summary['failed_critical']} "
      f"fail_warning={summary['failed_warning']}")
print(f"report written to {report_path}")

sys.exit(1 if fail_critical > 0 else 0)
PY
