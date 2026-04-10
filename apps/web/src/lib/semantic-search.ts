/**
 * Local semantic-ish search using BM25 ranking over all module records.
 *
 * No external embeddings, no API key, zero cost. The trade-off vs. true
 * semantic embeddings is that we won't catch synonyms (e.g. "remédio" vs
 * "medicamento"), but we DO catch:
 *   - Typo tolerance (token level)
 *   - Multi-word queries with token weighting
 *   - Field-specific boosts (id and name fields rank higher)
 *   - Per-module result grouping
 *
 * The BM25 implementation is the standard k1=1.5, b=0.75 formulation from
 * Robertson & Walker 1994. Index is built lazily on first call and cached
 * in module memory. Production should swap to a real index (Tantivy, MeiliSearch,
 * Typesense) when scale demands it — the API stays the same.
 */

import { listLiveRecords } from './entity-resolver';
import { MODULES, type ModuleDef } from './module-manifest';

const K1 = 1.5;
const B = 0.75;

/** Boost weights per field type (id and name rank highest) */
const FIELD_BOOSTS: Record<string, number> = {
  id: 3.0,
  name: 2.5,
  title: 2.5,
  patientMrn: 2.0,
  patientName: 2.0,
  description: 1.5,
};

interface IndexedDoc {
  moduleId: string;
  recordId: string;
  /** Pre-tokenized text per field */
  tokensByField: Record<string, string[]>;
  /** Total token count for length normalization */
  length: number;
  /** Original record for serializing back */
  record: Record<string, unknown>;
  /** Display label */
  label: string;
}

interface ModuleIndex {
  module: ModuleDef;
  docs: IndexedDoc[];
  avgLength: number;
  /** Document frequency per token (across this module) */
  df: Map<string, number>;
}

interface GlobalIndex {
  byModule: Map<string, ModuleIndex>;
  totalDocs: number;
  builtAt: number;
}

let CACHED_INDEX: GlobalIndex | null = null;
const INDEX_TTL_MS = 5 * 60 * 1000; // 5 min

/** Tokenize a string into lowercase words, stripped of punctuation. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/**
 * Trigrams of a token for fuzzy matching. "amoxicilina" → ['amo','mox',
 * 'oxi','xic','ici','cil','ili','lin','ina']. Reference: hybrid BM25 +
 * fuzzy n-gram is the EHR clinical search standard (TREC clinical track,
 * NIST 2021; Springer Nature precision-medicine BM25 paper 2021).
 */
function trigrams(token: string): string[] {
  if (token.length < 3) return [token];
  const out: string[] = [];
  for (let i = 0; i <= token.length - 3; i++) {
    out.push(token.slice(i, i + 3));
  }
  return out;
}

/** Jaccard similarity over the trigram sets of two tokens. */
function trigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const ta = new Set(trigrams(a));
  const tb = new Set(trigrams(b));
  let intersect = 0;
  for (const g of ta) if (tb.has(g)) intersect++;
  const union = ta.size + tb.size - intersect;
  return union > 0 ? intersect / union : 0;
}

/**
 * Find vocabulary terms within a fuzzy threshold of the query token.
 * Returns the matched terms with their similarity score (0..1) so the
 * BM25 ranking can use them as soft matches.
 */
function fuzzyExpand(
  queryToken: string,
  vocab: Iterable<string>,
  threshold = 0.6,
): { term: string; sim: number }[] {
  const matches: { term: string; sim: number }[] = [];
  for (const term of vocab) {
    if (term === queryToken) continue;
    if (Math.abs(term.length - queryToken.length) > 4) continue; // length cutoff
    const sim = trigramSimilarity(queryToken, term);
    if (sim >= threshold) {
      matches.push({ term, sim });
    }
  }
  matches.sort((a, b) => b.sim - a.sim);
  return matches.slice(0, 5);
}

function buildIndex(): GlobalIndex {
  const byModule = new Map<string, ModuleIndex>();
  let totalDocs = 0;

  for (const module of MODULES) {
    const records = listLiveRecords(module.id);
    if (records.length === 0) continue;

    const docs: IndexedDoc[] = [];
    const df = new Map<string, number>();
    let totalLength = 0;

    for (const record of records) {
      const tokensByField: Record<string, string[]> = {};
      let docLength = 0;
      const seenInThisDoc = new Set<string>();

      for (const [field, value] of Object.entries(record.data)) {
        if (value == null) continue;
        const text =
          typeof value === 'string'
            ? value
            : typeof value === 'number'
              ? String(value)
              : Array.isArray(value)
                ? value.map((v) => String(v)).join(' ')
                : typeof value === 'object'
                  ? JSON.stringify(value)
                  : String(value);
        const tokens = tokenize(text);
        if (tokens.length === 0) continue;
        tokensByField[field] = tokens;
        docLength += tokens.length;
        for (const token of tokens) {
          if (!seenInThisDoc.has(token)) {
            seenInThisDoc.add(token);
            df.set(token, (df.get(token) ?? 0) + 1);
          }
        }
      }

      // Build a display label from id + name/title/description
      const labelParts: string[] = [];
      if (record.data.id) labelParts.push(String(record.data.id));
      const nameField =
        record.data.name ??
        record.data.title ??
        record.data.patientName ??
        record.data.description;
      if (nameField) labelParts.push(String(nameField));
      const label = labelParts.join(' — ') || record.id;

      docs.push({
        moduleId: module.id,
        recordId: record.id,
        tokensByField,
        length: docLength,
        record: record.data,
        label,
      });
      totalLength += docLength;
    }

    byModule.set(module.id, {
      module,
      docs,
      avgLength: docs.length > 0 ? totalLength / docs.length : 0,
      df,
    });
    totalDocs += docs.length;
  }

  return { byModule, totalDocs, builtAt: Date.now() };
}

function getIndex(): GlobalIndex {
  if (CACHED_INDEX && Date.now() - CACHED_INDEX.builtAt < INDEX_TTL_MS) {
    return CACHED_INDEX;
  }
  CACHED_INDEX = buildIndex();
  return CACHED_INDEX;
}

export function invalidateSearchIndex(): void {
  CACHED_INDEX = null;
}

export interface SearchResult {
  moduleId: string;
  moduleLabel: string;
  recordId: string;
  label: string;
  score: number;
  href: string;
  highlights?: string[];
}

export interface SearchOptions {
  /** Restrict search to specific modules */
  moduleIds?: string[];
  /** Max results per module */
  perModuleLimit?: number;
  /** Max total results */
  totalLimit?: number;
}

/**
 * BM25-ranked semantic-ish search across all modules.
 */
export function search(query: string, opts: SearchOptions = {}): SearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const index = getIndex();
  const perModuleLimit = opts.perModuleLimit ?? 5;
  const totalLimit = opts.totalLimit ?? 25;
  const allowedModules = opts.moduleIds ? new Set(opts.moduleIds) : null;

  const allHits: SearchResult[] = [];

  for (const [moduleId, modIndex] of index.byModule) {
    if (allowedModules && !allowedModules.has(moduleId)) continue;

    const N = modIndex.docs.length;
    if (N === 0) continue;

    // Pre-compute fuzzy expansion per query token (typo tolerance via
    // trigram similarity over the module's vocabulary).
    const expandedTokens = tokens.map((tok) => {
      const fuzzy = fuzzyExpand(tok, modIndex.df.keys());
      return { token: tok, fuzzy };
    });

    // Compute BM25 score for each doc against the query
    const scoredDocs: { doc: IndexedDoc; score: number }[] = [];
    for (const doc of modIndex.docs) {
      let score = 0;
      for (const { token, fuzzy } of expandedTokens) {
        // 1. Exact match path
        const dfToken = modIndex.df.get(token) ?? 0;
        if (dfToken > 0) {
          const idf = Math.log(1 + (N - dfToken + 0.5) / (dfToken + 0.5));
          let tf = 0;
          for (const [field, fieldTokens] of Object.entries(doc.tokensByField)) {
            const boost = FIELD_BOOSTS[field] ?? 1.0;
            for (const ft of fieldTokens) {
              if (ft === token) tf += boost;
            }
          }
          if (tf > 0) {
            const norm = 1 - B + B * (doc.length / (modIndex.avgLength || 1));
            score += idf * ((tf * (K1 + 1)) / (tf + K1 * norm));
          }
        }

        // 2. Fuzzy fallback (capped at 50% of the exact-match weight)
        for (const { term, sim } of fuzzy) {
          const dfFuzzy = modIndex.df.get(term) ?? 0;
          if (dfFuzzy === 0) continue;
          const idf = Math.log(1 + (N - dfFuzzy + 0.5) / (dfFuzzy + 0.5));
          let tf = 0;
          for (const [field, fieldTokens] of Object.entries(doc.tokensByField)) {
            const boost = FIELD_BOOSTS[field] ?? 1.0;
            for (const ft of fieldTokens) {
              if (ft === term) tf += boost;
            }
          }
          if (tf > 0) {
            const norm = 1 - B + B * (doc.length / (modIndex.avgLength || 1));
            // Multiply by similarity × 0.5 so fuzzy never beats exact
            score += sim * 0.5 * idf * ((tf * (K1 + 1)) / (tf + K1 * norm));
          }
        }
      }
      if (score > 0) {
        scoredDocs.push({ doc, score });
      }
    }

    scoredDocs.sort((a, b) => b.score - a.score);
    for (const { doc, score } of scoredDocs.slice(0, perModuleLimit)) {
      allHits.push({
        moduleId,
        moduleLabel: modIndex.module.title,
        recordId: doc.recordId,
        label: doc.label,
        score,
        href: `/edit/${moduleId}/${encodeURIComponent(doc.recordId)}`,
      });
    }
  }

  allHits.sort((a, b) => b.score - a.score);
  return allHits.slice(0, totalLimit);
}
