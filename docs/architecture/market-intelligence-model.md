# Market Intelligence Model

## Overview

The Market Intelligence Office is one of the 22 offices in the Velya digital enterprise. Its mission is to continuously discover improvements, innovations, and optimizations for the platform by researching the external landscape: competitor products, industry benchmarks, emerging technologies, regulatory changes, and best practices. It operates a structured pipeline from discovery through evidence gathering to actionable improvement proposals.

## Office Structure

```
+-----------------------------------------------+
|          Market Intelligence Office            |
+-----------------------------------------------+
|                                                |
|  market-intel-supervisor                       |
|    |                                           |
|    +-- web-research-agent                      |
|    +-- benchmark-analyst-agent                 |
|    +-- technology-scout-agent                  |
|    +-- regulatory-monitor-agent                |
|    +-- proposal-writer-agent                   |
|                                                |
+-----------------------------------------------+
```

### Agent Roles

| Agent | Responsibility |
|-------|---------------|
| **market-intel-supervisor** | Coordinates research priorities, reviews proposals, manages the improvement pipeline |
| **web-research-agent** | Searches the web for relevant information: competitor features, industry news, clinical informatics publications |
| **benchmark-analyst-agent** | Compares Velya's capabilities against industry benchmarks and competitor feature matrices |
| **technology-scout-agent** | Monitors emerging technologies (new AI models, infrastructure tools, clinical data standards) for applicability |
| **regulatory-monitor-agent** | Tracks regulatory changes (CMS rules, HIPAA updates, state regulations) that affect platform requirements |
| **proposal-writer-agent** | Synthesizes research findings into structured improvement proposals with evidence, impact analysis, and implementation estimates |

## Web Research Process

The web-research-agent performs structured web research on a continuous schedule and in response to ad-hoc requests from other offices.

### Research Triggers

| Trigger | Source | Example |
|---------|--------|---------|
| **Scheduled scan** | Cron schedule (daily, weekly) | Weekly scan of top 20 health IT news sources |
| **Office request** | Another office supervisor | Engineering requests research on new FHIR R5 features |
| **Gap detection** | Internal metrics | Quality office reports declining coding accuracy; research current coding tools |
| **Technology release** | Technology scout alert | New Claude model released; research capabilities and clinical applicability |

### Research Methodology

1. **Define research question**: Clear, specific question with scope boundaries. Example: "What ambient documentation solutions exist for outpatient encounters, and how do they compare on accuracy, latency, and EHR integration?"
2. **Source identification**: Select credible sources (peer-reviewed publications, vendor documentation, regulatory guidance, industry analyst reports).
3. **Data collection**: Web search agent queries multiple sources, extracts relevant information, and records source URLs, dates, and credibility assessments.
4. **Cross-referencing**: Information from multiple sources is cross-referenced. Claims supported by a single source are flagged as low-confidence.
5. **Summary generation**: Findings are synthesized into a structured research report with citations.

### Source Credibility Framework

| Tier | Source Type | Credibility Weight | Examples |
|------|-----------|-------------------|----------|
| 1 | Peer-reviewed publication, regulatory guidance | Highest | JAMIA, CMS final rules, ONC regulations |
| 2 | Major industry analyst, vendor documentation | High | KLAS, Gartner, official product docs |
| 3 | Industry media, conference proceedings | Medium | Healthcare IT News, HIMSS proceedings |
| 4 | Blog posts, social media, forums | Low | Individual blogs, Reddit, Twitter threads |

Information sourced exclusively from Tier 4 sources is not used in proposals without corroboration from higher-tier sources.

## Benchmark Analysis

The benchmark-analyst-agent maintains a continuous comparison of Velya's capabilities against industry standards and competitors.

### Benchmark Dimensions

| Dimension | Metrics | Comparison Targets |
|-----------|---------|-------------------|
| **Clinical functionality** | FHIR resource coverage, CDS capabilities, clinical workflow support | Epic, Cerner, athenahealth |
| **AI capabilities** | Documentation accuracy, coding accuracy, ambient listening quality | Nuance DAX, Abridge, Suki |
| **Technical architecture** | Uptime, latency, scalability, deployment frequency | Industry SLA benchmarks |
| **Compliance** | HIPAA compliance features, audit capabilities, consent management | Regulatory requirements |
| **Integration** | Supported standards (FHIR, HL7v2, CDA), API completeness | Interoperability benchmarks |
| **Cost efficiency** | Cost per encounter, cost per AI inference, infrastructure cost per bed | Industry cost benchmarks |

### Benchmark Cadence

- **Monthly**: Technical performance benchmarks (latency, uptime, deployment frequency)
- **Quarterly**: Feature comparison against top 5 competitors
- **Annually**: Comprehensive industry positioning analysis

### Gap Identification

When benchmarking reveals a gap (Velya lacks a capability that competitors offer or that industry standards require), the benchmark-analyst-agent creates a gap report:

```
Gap Report:
  - Gap ID: GAP-2026-042
  - Dimension: AI capabilities
  - Finding: Competitor X offers real-time ambient documentation with 94% accuracy; Velya ambient documentation accuracy is 87%
  - Impact: Medium (affects clinical documentation efficiency)
  - Evidence: [links to benchmark data]
  - Recommended action: Research accuracy improvement strategies
  - Priority: P2
```

## Proposal Pipeline

Improvement proposals follow a structured pipeline from discovery to implementation decision.

### Pipeline Stages

```
Discovery --> Research --> Evidence --> Draft Proposal --> Review --> Decision
    |            |           |              |               |          |
    v            v           v              v               v          v
 Raw signal   Structured  Validated     Proposal with    Supervisor  Accept/
 from scan    research    evidence      cost/benefit     + target    Reject/
 or request   report      chain         analysis         office      Defer
                                                         review
```

### Stage 1: Discovery

Raw signals are collected from web research scans, office requests, technology alerts, and regulatory changes. Each signal is logged with:

- Source and date
- Brief description
- Relevance score (0-1, assigned by the discovering agent)
- Category (feature gap, technology opportunity, regulatory requirement, optimization)

Signals with relevance score below 0.3 are archived without further processing. Signals above 0.3 proceed to Research.

### Stage 2: Research

The web-research-agent conducts focused research on the signal. The output is a structured research report containing:

- Background and context
- Current state in Velya
- External landscape (what competitors/industry are doing)
- Source list with credibility assessments
- Preliminary feasibility assessment

### Stage 3: Evidence Chain

The proposal-writer-agent builds an evidence chain that links the proposal to verifiable data:

```
Claim: "Implementing X will improve Y by Z%"
  Evidence 1: [Peer-reviewed study] showed Z% improvement in similar context
  Evidence 2: [Competitor case study] reported Z% improvement after implementation
  Evidence 3: [Internal data] shows current Y metric at baseline value
  Confidence: High (multiple corroborating sources)
```

Every claim in a proposal must have at least one supporting piece of evidence. Claims without evidence are flagged and either substantiated or removed.

### Stage 4: Draft Proposal

The proposal-writer-agent produces a structured improvement proposal:

```yaml
proposal:
  id: PROP-2026-042
  title: "Improve ambient documentation accuracy from 87% to 93%"
  category: ai-capability-improvement
  priority: P2
  source-gaps: [GAP-2026-042]
  
  problem-statement: |
    Current ambient documentation accuracy (87%) is below the industry
    benchmark (93%) and competitor average (91%). This gap results in
    increased clinician editing time and reduced satisfaction.
  
  proposed-solution: |
    Implement a multi-pass documentation pipeline: initial transcription,
    clinical entity extraction, structured note generation, and
    self-evaluation loop with clinician feedback integration.
  
  evidence-chain:
    - claim: "Multi-pass pipeline improves accuracy by 5-8%"
      sources: [STUDY-2025-NLP-AMBIENT, COMPETITOR-X-WHITEPAPER]
      confidence: medium
  
  impact-analysis:
    clinical-impact: medium
    engineering-effort: large (estimated 6-8 weeks)
    infrastructure-impact: low (uses existing GPU capacity)
    cost-impact: moderate (increased token usage per encounter)
  
  target-offices: [engineering, ai-ml, clinical-ops]
  
  risks:
    - risk: "Multi-pass pipeline increases latency"
      mitigation: "Implement streaming output for first-pass results"
```

### Stage 5: Review

The proposal is reviewed by:

1. **market-intel-supervisor**: Validates evidence quality and proposal coherence
2. **Target office supervisors**: Assess feasibility and alignment with current roadmap
3. **agent-governance-reviewer**: Reviews any governance implications

### Stage 6: Decision

Proposals are decided by the relevant division lead (human) with one of three outcomes:

- **Accept**: Proposal moves to implementation planning. Engineering creates work items.
- **Defer**: Proposal is valid but not prioritized now. Revisit date is set.
- **Reject**: Proposal is not pursued. Rejection reason is recorded for future reference.

## Evidence Chain Requirements

Every proposal must maintain a complete evidence chain from claim to source:

### Evidence Quality Criteria

| Criterion | Requirement |
|-----------|-------------|
| **Recency** | Evidence must be less than 18 months old for technology claims, less than 3 years for clinical outcomes |
| **Relevance** | Evidence must be from a comparable context (similar patient population, similar technology stack, similar scale) |
| **Credibility** | At least one Tier 1 or Tier 2 source per major claim |
| **Reproducibility** | Methodology must be described well enough to validate or reproduce findings |
| **Conflict of interest** | Vendor-sponsored research is flagged and requires corroboration from independent sources |

### Evidence Staleness

The market-intel-supervisor periodically reviews active proposals and their evidence chains. Evidence that has become stale (exceeded recency requirements) triggers a re-research cycle. Proposals whose evidence is no longer valid are downgraded or withdrawn.

## Integration with Other Offices

| Interface | Direction | Content |
|-----------|-----------|---------|
| Engineering | Outbound | Improvement proposals with technical specifications |
| Quality | Bidirectional | Quality gaps trigger research; research informs quality targets |
| Compliance | Inbound | Regulatory changes that require platform updates |
| Finance | Outbound | Cost-benefit analysis for proposed improvements |
| AI/ML | Bidirectional | AI capability gaps trigger research; new model releases trigger technology scouting |
| Clinical Operations | Outbound | Clinical workflow improvement proposals |

## Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Proposals generated per month | Number of complete proposals produced | 4-8 |
| Proposal acceptance rate | Percentage of proposals accepted for implementation | >= 40% |
| Research-to-proposal time | Time from initial signal to complete proposal | <= 10 business days |
| Evidence quality score | Average evidence chain quality across proposals | >= 0.75 |
| Gap detection coverage | Percentage of competitor features tracked | >= 80% of top 5 competitors |
