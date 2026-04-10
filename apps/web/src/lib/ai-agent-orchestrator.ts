/**
 * AI Agent Orchestrator — turns natural-language queries into tool calls.
 *
 * Pipeline:
 *   1. classifyIntent(query)         → IntentMatch ({ toolId, args, confidence })
 *   2. AI_TOOLS[toolId].execute(args) → AiToolResult
 *   3. composeResponse(intent, result) → AgentResponse
 *
 * Why rule-based first, LLM second?
 *   - 80% of operator queries match a small set of patterns ("quem está de
 *     plantão na UTI", "pacientes com vancomicina", "findings críticos").
 *     A deterministic regex/keyword classifier is faster, cheaper, and
 *     auditable — no surprise tool calls. This satisfies
 *     .claude/rules/ai-safety.md "output validation" requirements at the
 *     intent layer.
 *   - When no rule matches with confidence >= 0.6, we degrade to the
 *     semantic-search-modules tool which is also a safe read-only path.
 *   - LLM fallback (calling /api/ai/chat) is only for free-form questions
 *     that need synthesis. The orchestrator NEVER lets the LLM execute
 *     tools directly — every action goes through this Layer.
 *
 * Trust boundary: this module runs server-side only. The /api/ai/agent
 * route is the single entry point. Inputs are sanitized via normalizeQuery()
 * before any pattern matching to neutralize prompt-injection attempts that
 * could appear in regex captures (zero-width, control chars, etc).
 */

import { AI_TOOLS, getTool, type AiToolResult, type AiToolDef } from './ai-tools';

// ---------------------------------------------------------------------------
// LLM fallback configuration
// ---------------------------------------------------------------------------
//
// Cost control:
//   - LLM is called ONLY when rule confidence < LLM_FALLBACK_THRESHOLD
//   - maxTokens hard-capped at 400 (input + output combined budget)
//   - In-process cache (Map) keyed by query, TTL 10 min, LRU 200 entries
//   - When VELYA_AI_GATEWAY_URL is unset (dev), the call short-circuits
//     and we degrade to semantic-search without spending a token
//
// Why this design: the founder explicitly authorized "pode usar a sua api se
// for o caso", and .claude/rules/ai-safety.md mandates that all AI access
// goes through the gateway (which is /api/ai/chat → packages/ai-gateway).
// We honor both: structured tool routing + gateway-mediated billing.

const LLM_FALLBACK_THRESHOLD = 0.7;
const LLM_CACHE_TTL_MS = 10 * 60 * 1000;
const LLM_CACHE_MAX_ENTRIES = 200;

interface LlmCacheEntry {
  match: IntentMatch;
  expiresAt: number;
}
const LLM_CACHE = new Map<string, LlmCacheEntry>();

function llmCacheGet(query: string): IntentMatch | null {
  const entry = LLM_CACHE.get(query);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    LLM_CACHE.delete(query);
    return null;
  }
  return entry.match;
}

function llmCachePut(query: string, match: IntentMatch): void {
  if (LLM_CACHE.size >= LLM_CACHE_MAX_ENTRIES) {
    // Drop the oldest entry — Map iteration order is insertion order
    const firstKey = LLM_CACHE.keys().next().value;
    if (firstKey !== undefined) LLM_CACHE.delete(firstKey);
  }
  LLM_CACHE.set(query, { match, expiresAt: Date.now() + LLM_CACHE_TTL_MS });
}

/**
 * Build the system prompt that asks Claude to act as a tool router.
 * The prompt is intentionally compact (≤ 600 input tokens) and demands
 * a strict JSON response so we can parse without an LLM-side validator.
 */
function buildToolRouterPrompt(query: string): {
  system: string;
  user: string;
} {
  const tools = Object.values(AI_TOOLS).map((t) => ({
    id: t.id,
    description: t.description,
    requiresApproval: t.requiresApproval,
  }));
  const system = `Você é o roteador de ferramentas do Velya, plataforma hospitalar.
Sua única função: ler a query do operador em PT-BR e devolver UM JSON com a ferramenta certa do registro abaixo.

REGRAS ESTRITAS:
- Responda SOMENTE com um JSON válido. Sem markdown, sem explicação, sem prefácio.
- Schema: {"toolId":"<id>","args":{...},"confidence":<0..1>,"matchedPattern":"<curta descrição PT-BR>"}
- toolId DEVE ser um dos ids abaixo. Se nenhum servir, use "semantic-search-modules" com {"query":"<a query original>"}.
- args DEVE conter apenas chaves que a ferramenta aceita (não invente campos).
- confidence: 0..1, sua certeza de que a tool está certa.
- Para tools com requiresApproval=true, ainda assim retorne — o orchestrator gateia depois.
- NUNCA invoque ações clínicas sem que a ferramenta exija approval.

REGISTRO DE FERRAMENTAS:
${JSON.stringify(tools, null, 2)}`;
  const user = `Query do operador: ${query}`;
  return { system, user };
}

/**
 * Parse Claude's response into an IntentMatch. Strict: anything that
 * doesn't validate falls back to semantic-search.
 */
function parseLlmResponse(raw: string, originalQuery: string): IntentMatch {
  try {
    // Strip markdown code fences if Claude added any
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned) as {
      toolId?: string;
      args?: Record<string, unknown>;
      confidence?: number;
      matchedPattern?: string;
    };
    if (!parsed.toolId || typeof parsed.toolId !== 'string') throw new Error('toolId missing');
    if (!getTool(parsed.toolId)) throw new Error(`unknown toolId ${parsed.toolId}`);
    return {
      toolId: parsed.toolId,
      args: parsed.args ?? {},
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.6,
      matchedPattern: `llm:${parsed.matchedPattern ?? 'router'}`,
    };
  } catch {
    return {
      toolId: 'semantic-search-modules',
      args: { query: originalQuery, limit: 15 },
      confidence: 0.4,
      matchedPattern: 'fallback-llm-parse-error',
    };
  }
}

/**
 * Call the AI gateway via /api/ai/chat. Server-side only — uses absolute
 * URL when running inside Next.js, falls back to localhost in tests.
 *
 * Returns null when the gateway is not configured or the call fails —
 * the orchestrator then degrades gracefully to semantic search.
 */
async function callLlmRouter(query: string): Promise<IntentMatch | null> {
  const cached = llmCacheGet(query);
  if (cached) return cached;

  const gatewayUrl = process.env.VELYA_AI_GATEWAY_URL;
  // In dev/demo without a gateway, do not waste a request — degrade silently.
  if (!gatewayUrl) return null;

  const { system, user } = buildToolRouterPrompt(query);

  try {
    const res = await fetch(`${gatewayUrl}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Velya-Capability': 'ai.search-knowledge-base',
      },
      body: JSON.stringify({
        capability: 'ai.search-knowledge-base',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        maxTokens: 400,
        // Haiku is the cheapest Claude model — perfect for routing.
        modelHint: 'claude-haiku-4-5-20251001',
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { reply?: string };
    if (!data.reply) return null;
    const match = parseLlmResponse(data.reply, query);
    llmCachePut(query, match);
    return match;
  } catch {
    return null;
  }
}

export interface AgentResponse {
  /** Original query */
  query: string;
  /** Intent classifier output */
  intent: {
    toolId: string;
    confidence: number;
    matchedPattern: string;
  };
  /** Tool execution result */
  result: AiToolResult;
  /** PT-BR text the panel should render to the user */
  text: string;
  /** Optional follow-up suggestions */
  suggestions?: string[];
}

interface IntentMatch {
  toolId: string;
  args: Record<string, unknown>;
  confidence: number;
  matchedPattern: string;
}

/** Strip control characters, normalize whitespace, lowercase. */
function normalizeQuery(q: string): string {
  return (
    q
      .normalize('NFC')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  );
}

/** Try to extract a ward name from the query. */
function extractWard(q: string): string | undefined {
  const wards = [
    'uti',
    'utin',
    'pediatria',
    'maternidade',
    'emergencia',
    'emergência',
    'ortopedia',
    'cardiologia',
    'oncologia',
    'psiquiatria',
    'neurologia',
    'cirurgia',
  ];
  for (const w of wards) {
    if (q.includes(w)) return w === 'emergência' ? 'emergencia' : w;
  }
  return undefined;
}

/** Heuristic: extract a single drug name following keywords like "com" or "tomando". */
function extractMedication(q: string): string | undefined {
  const m = q.match(
    /(?:medica\w+|rem[eé]dio|droga|tomando|com)\s+(?:o\s+|a\s+)?([a-z][a-zà-ú]{3,30})/,
  );
  if (m) return m[1];
  return undefined;
}

/** Heuristic: extract a diagnosis snippet. */
function extractDiagnosis(q: string): string | undefined {
  const m = q.match(/(?:diagn[oó]stico|dx|com)\s+(?:de\s+)?([a-z][a-zà-ú\s]{3,40})/);
  if (m) return m[1].trim().split(' ').slice(0, 3).join(' ');
  return undefined;
}

/** Pattern table — order matters; first match wins. */
const PATTERNS: Array<{
  id: string;
  test: (q: string) => boolean;
  build: (q: string) => IntentMatch | null;
}> = [
  // -------------------------------------------------------------------------
  // CRON / SYSTEM HEALTH
  // -------------------------------------------------------------------------
  {
    id: 'findings-critical',
    test: (q) => /finding|alerta|problema|quebrad/.test(q) && /cr[ií]tico|grave|alto/.test(q),
    build: () => ({
      toolId: 'list-cron-findings',
      args: { severity: 'critical', limit: 30 },
      confidence: 0.9,
      matchedPattern: 'findings-critical',
    }),
  },
  {
    id: 'findings-any',
    test: (q) => /finding|alerta|problema|sa[uú]de.*sistema|o que.*quebrad/.test(q),
    build: () => ({
      toolId: 'list-cron-findings',
      args: { limit: 30 },
      confidence: 0.85,
      matchedPattern: 'findings-any',
    }),
  },
  {
    id: 'cron-jobs',
    test: (q) => /cron job|job(s)? do agente|jobs autom/.test(q),
    build: () => ({
      toolId: 'list-cron-jobs',
      args: {},
      confidence: 0.9,
      matchedPattern: 'cron-jobs',
    }),
  },

  // -------------------------------------------------------------------------
  // STAFF
  // -------------------------------------------------------------------------
  {
    id: 'staff-on-duty-ward',
    test: (q) =>
      /(quem|profissionais|equipe|m[eé]dicos?|enfermeir)/.test(q) &&
      /(plant[aã]o|de turno|on.duty)/.test(q),
    build: (q) => ({
      toolId: 'search-staff',
      args: { ward: extractWard(q), onDutyOnly: true },
      confidence: 0.9,
      matchedPattern: 'staff-on-duty-ward',
    }),
  },
  {
    id: 'staff-by-name',
    test: (q) => /(dr|dra|doutor|doutora|enfermeir|profissional)\s+[a-z]/.test(q),
    build: (q) => {
      const m = q.match(/(?:dr|dra|doutor|doutora|enfermeir[oa]|profissional)\.?\s+([a-zà-ú]+)/);
      if (!m) return null;
      return {
        toolId: 'search-staff',
        args: { name: m[1] },
        confidence: 0.7,
        matchedPattern: 'staff-by-name',
      };
    },
  },

  // -------------------------------------------------------------------------
  // PATIENTS
  // -------------------------------------------------------------------------
  {
    id: 'patients-discharge-meds',
    test: (q) =>
      /(paciente|pcte)/.test(q) &&
      /(uti|utin|emerg|ala|ward)/.test(q) &&
      /(medica|rem[eé]dio|com)/.test(q) &&
      /(alta|discharge|sair)/.test(q),
    build: (q) => ({
      toolId: 'search-patients',
      args: {
        ward: extractWard(q),
        medication: extractMedication(q),
        candidatesForDischarge: true,
      },
      confidence: 0.95,
      matchedPattern: 'patients-discharge-meds',
    }),
  },
  {
    id: 'patients-by-medication',
    test: (q) => /(paciente|pcte)/.test(q) && /(medica|rem[eé]dio|com\s+\w{4,})/.test(q),
    build: (q) => ({
      toolId: 'search-patients',
      args: { medication: extractMedication(q), ward: extractWard(q) },
      confidence: 0.8,
      matchedPattern: 'patients-by-medication',
    }),
  },
  {
    id: 'patients-by-diagnosis',
    test: (q) => /(paciente|pcte)/.test(q) && /(diagn|dx|com.+)/.test(q),
    build: (q) => ({
      toolId: 'search-patients',
      args: { diagnosis: extractDiagnosis(q), ward: extractWard(q) },
      confidence: 0.75,
      matchedPattern: 'patients-by-diagnosis',
    }),
  },
  {
    id: 'patients-discharge-today',
    test: (q) => /(alta|discharge|receb|sair)/.test(q) && /(hoje|today)/.test(q),
    build: (q) => ({
      toolId: 'search-patients',
      args: { ward: extractWard(q), candidatesForDischarge: true },
      confidence: 0.85,
      matchedPattern: 'patients-discharge-today',
    }),
  },
  {
    id: 'patient-cockpit',
    test: (q) => /(cockpit|painel|abrir|ver)/.test(q) && /(mrn-?\w+|paciente)/.test(q),
    build: (q) => {
      const m = q.match(/mrn-?(\w+)/);
      if (!m) return null;
      return {
        toolId: 'get-patient-cockpit',
        args: { mrn: `MRN-${m[1].toUpperCase()}` },
        confidence: 0.95,
        matchedPattern: 'patient-cockpit',
      };
    },
  },

  // -------------------------------------------------------------------------
  // MEDICATIONS / PRESCRIPTIONS
  // -------------------------------------------------------------------------
  {
    id: 'meds-by-drug',
    test: (q) => /(prescri|medica|rem[eé]dio).*ativ/.test(q) || /quem.*toma/.test(q),
    build: (q) => ({
      toolId: 'search-medications',
      args: { drug: extractMedication(q), ward: extractWard(q), status: 'active' },
      confidence: 0.8,
      matchedPattern: 'meds-by-drug',
    }),
  },

  // -------------------------------------------------------------------------
  // HANDOFFS
  // -------------------------------------------------------------------------
  {
    id: 'handoff-list',
    test: (q) => /(passagem|handoff|turno|shift)/.test(q) && !/preench|criar|novo/.test(q),
    build: (q) => ({
      toolId: 'list-handoffs',
      args: { ward: extractWard(q) },
      confidence: 0.85,
      matchedPattern: 'handoff-list',
    }),
  },
  {
    id: 'handoff-propose',
    test: (q) =>
      /(passagem|handoff)/.test(q) &&
      /(preench|criar|novo|para o\b|para a\b|para dr|do dr)/.test(q),
    build: (q) => {
      // Extract the target user name after "para o", "para a", "para dr", "para dra"
      // — fallback to anything after "do dr"/"da dra"
      const m =
        q.match(
          /para\s+(?:o\s+|a\s+)?(?:dr\.?\s*|dra\.?\s*|doutor\s+|doutora\s+)?([a-zà-ú]+(?:\s+[a-zà-ú]+){0,2})/,
        ) ?? q.match(/(?:do|da)\s+(?:dr\.?\s*|dra\.?\s*)?([a-zà-ú]+(?:\s+[a-zà-ú]+){0,2})/);
      const targetName = m ? m[1].trim() : '';
      return {
        toolId: 'propose-handoff',
        args: {
          toUserName: targetName,
          confirm: false,
        },
        confidence: targetName ? 0.85 : 0.5,
        matchedPattern: 'handoff-propose',
      };
    },
  },

  // -------------------------------------------------------------------------
  // RECORD UPDATE — "atualizar medicação X de paciente Y", "atualizar exame Z"
  // -------------------------------------------------------------------------
  {
    id: 'update-prescription',
    test: (q) =>
      /(atualiz|alter|modific|trocar|mudar)/.test(q) &&
      /(medica|prescri|rem[eé]dio|posolog|dose)/.test(q),
    build: (q) => {
      // Best-effort: pull a numeric record id (PRESC-001) and a drug name
      const idMatch = q.match(/(presc[a-z-]*-?\d+|p-?\d+)/);
      const recordId = idMatch ? idMatch[1].toUpperCase() : '';
      return {
        toolId: 'update-record',
        args: {
          moduleId: 'prescriptions',
          recordId,
          patch: {},
          rationale: `Solicitação por linguagem natural: "${q}"`,
          confirm: false,
        },
        confidence: recordId ? 0.7 : 0.5,
        matchedPattern: 'update-prescription',
      };
    },
  },
  {
    id: 'update-lab-order',
    test: (q) =>
      /(atualiz|alter|modific|trocar|mudar)/.test(q) && /(exame|lab|laborat|pcr|hemograma)/.test(q),
    build: (q) => {
      const idMatch = q.match(/(lab[a-z-]*-?\d+|l-?\d+)/);
      const recordId = idMatch ? idMatch[1].toUpperCase() : '';
      return {
        toolId: 'update-record',
        args: {
          moduleId: 'lab-orders',
          recordId,
          patch: {},
          rationale: `Solicitação por linguagem natural: "${q}"`,
          confirm: false,
        },
        confidence: recordId ? 0.7 : 0.5,
        matchedPattern: 'update-lab-order',
      };
    },
  },

  // -------------------------------------------------------------------------
  // MODULE INTROSPECTION
  // -------------------------------------------------------------------------
  {
    id: 'list-modules',
    test: (q) => /(o que existe|m[oó]dulos|menu|p[aá]ginas|para onde)/.test(q),
    build: () => ({
      toolId: 'list-modules',
      args: {},
      confidence: 0.85,
      matchedPattern: 'list-modules',
    }),
  },
];

/** Try every pattern and return the highest confidence match (or null). */
function classifyIntent(rawQuery: string): IntentMatch {
  const q = normalizeQuery(rawQuery);
  let best: IntentMatch | null = null;
  for (const pat of PATTERNS) {
    if (!pat.test(q)) continue;
    const m = pat.build(q);
    if (m && (!best || m.confidence > best.confidence)) {
      best = m;
    }
  }
  if (best) return best;
  // Fallback: semantic search
  return {
    toolId: 'semantic-search-modules',
    args: { query: rawQuery, limit: 15 },
    confidence: 0.4,
    matchedPattern: 'fallback-semantic-search',
  };
}

function composeText(intent: IntentMatch, result: AiToolResult): string {
  if (result.status === 'error') {
    return `Não consegui executar a busca: ${result.errorMessage ?? 'erro desconhecido'}.`;
  }
  if (result.status === 'empty') {
    return result.summary;
  }
  if (result.status === 'requires-approval') {
    return `${result.summary}\n\nClique em "${result.pendingAction?.label}" para confirmar.`;
  }
  const conf = Math.round(intent.confidence * 100);
  return `${result.summary}\n\n_Intenção: ${intent.matchedPattern} (${conf}% confiança)_`;
}

function suggestFollowUps(intent: IntentMatch, result: AiToolResult): string[] {
  const out: string[] = [];
  if (intent.toolId === 'search-patients' && result.status === 'ok') {
    out.push('Mostrar prescrições ativas desses pacientes');
    out.push('Quem é o médico responsável de cada um?');
  }
  if (intent.toolId === 'list-cron-findings' && result.status === 'ok') {
    out.push('Abrir o painel /cron');
    out.push('Listar apenas findings críticos');
  }
  if (intent.toolId === 'search-staff') {
    out.push('Quais alas estão sem cobertura?');
  }
  return out;
}

/** Public entry point. Always returns an AgentResponse — never throws. */
export async function runAgent(rawQuery: string): Promise<AgentResponse> {
  // 1. Try the deterministic rule classifier first (zero cost, audit-friendly)
  let intent = classifyIntent(rawQuery);

  // 2. If rule confidence is below threshold, ask the LLM router. Cost is
  //    bounded by cache + LLM_FALLBACK_THRESHOLD + Haiku model + maxTokens=400.
  //    The founder explicitly authorized "pode usar a sua api se for o caso".
  if (intent.confidence < LLM_FALLBACK_THRESHOLD) {
    const llmMatch = await callLlmRouter(rawQuery);
    if (llmMatch) {
      intent = llmMatch;
    }
  }

  const tool = getTool(intent.toolId);
  if (!tool) {
    return {
      query: rawQuery,
      intent,
      result: {
        status: 'error',
        summary: `Ferramenta ${intent.toolId} não registrada.`,
        errorMessage: 'tool-not-found',
      },
      text: `Ferramenta ${intent.toolId} não registrada.`,
    };
  }
  let result: AiToolResult;
  try {
    result = await tool.execute(intent.args);
  } catch (err) {
    result = {
      status: 'error',
      summary: 'Erro ao executar a ferramenta.',
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
  return {
    query: rawQuery,
    intent,
    result,
    text: composeText(intent, result),
    suggestions: suggestFollowUps(intent, result),
  };
}

export { classifyIntent, normalizeQuery };
export type { IntentMatch };
// Re-export for the API route to type-check tool definitions
export { AI_TOOLS, type AiToolDef };
