# Run Blind Spot Discovery

Use this skill to systematically discover unknown unknowns, fragile assumptions, and invisible risks in the Velya platform.

## When to use

- Quarterly as a full platform sweep
- After any major architectural change
- When something fails unexpectedly (to find related blind spots)
- Before any production readiness certification
- When a new office or agent cluster is designed

## Blind Spot Categories

Investigate each category in turn:

### 1. Assumption Blind Spots
What are we treating as true that we haven't actually verified?
- Check `docs/risk/assumption-log.md` for all current assumptions
- For each: was it actually validated or just assumed?
- Challenge every "it should work" statement

### 2. Coverage Blind Spots
What are we not monitoring, testing, or auditing?
- Which components have no tests?
- Which processes have no automated monitoring?
- Which agents have no watchdog?
- Which failure modes have no alert?

### 3. Dependency Blind Spots
What external things are we relying on that we haven't stress-tested?
- Check `docs/risk/vendor-dependency-risk.md`
- Single points of failure in the dependency chain?
- What happens if dependency X is unavailable for 1 hour? 1 day? 1 week?

### 4. Governance Blind Spots
Where does accountability go missing?
- Tasks without owners
- Handoffs without contracts
- Validation that's nominal rather than real
- Offices that generate reports no one reads

### 5. Human Factor Blind Spots
Where do we assume perfect human behavior?
- Assume clinicians are under stress, sleep-deprived, interrupted
- Assume engineers are handling 3 incidents simultaneously
- Assume on-call engineer has never seen this system before

### 6. Economic Blind Spots
Where could costs spiral without warning?
- Unbounded loops in AI inference
- Autoscaling with no maximum
- Storage without expiration

### 7. Silent Failure Blind Spots
What could fail without any alarm?
- Process that completes but produces wrong output
- Alert that's defined but not delivered
- Validation that runs but doesn't actually check

### 8. Clinical Safety Blind Spots
What could harm a patient that we haven't thought of?
- Degraded mode that looks normal to clinical staff
- AI recommendation based on stale data, presented as current
- Missed follow-up due to event processing failure

## Discovery Methods

For each category:
1. **Assumption inversion**: Take the assumption. Assume it's wrong. What breaks?
2. **Failure injection**: What if this component fails right now? What happens downstream?
3. **Observer test**: Could a new team member understand what's happening from the dashboards alone?
4. **Adversary test**: If I wanted to exploit this, what would I do?
5. **Expert scan**: What would a CISO / clinical safety officer / chaos engineer find?

## Output

Document all findings in:
- `docs/validation/unknown-unknown-discovery-log.md`
- `docs/risk/master-gap-register.md` (for actionable gaps)
- `docs/risk/assumption-log.md` (for new assumptions discovered)
- `docs/risk/silent-failure-matrix.md` (for silent failure modes)

## Report Format

```markdown
## Blind Spot Discovery Report
**Date**: YYYY-MM-DD
**Scope**: [component | office | platform]
**Discoverer**: [agent name]

### New Unknown-Unknowns Found
[Items not in any previous register]

### Previously Known Gaps Now Confirmed Unresolved
[Items that were supposed to be fixed but aren't]

### Assumption Invalidations
[Assumptions that were wrong]

### Silent Failure Modes Discovered
[Failures that have no detection]

### Priority Remediation List
[Top 5 items by risk score]
```
