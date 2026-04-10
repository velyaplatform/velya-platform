import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import { resolveAiPolicy, hasAiCapability } from '@/lib/ai-permissions';
import { checkAiRateLimit } from '@/lib/ai-rate-limiter';

/**
 * POST /api/ai/suggest
 *
 * Lightweight autocomplete suggestions endpoint. Used by intelligent
 * autocomplete inputs (medication, diagnosis, ICD-10, TUSS, lab test).
 *
 * This route does NOT call an LLM in the hot path — it returns local
 * fixture-based suggestions to keep latency under 50ms. The full LLM
 * route is /api/ai/chat. We separate them so the autocomplete never
 * hits a slow upstream during typing.
 *
 * Auth + per-user rate limit still apply (suggestions can leak PHI in
 * the response if the kind="patient", so we gate it).
 */

type SuggestKind =
  | 'medication'
  | 'icd10'
  | 'tuss'
  | 'lab-test'
  | 'imaging-procedure'
  | 'allergen';

interface SuggestRequestBody {
  kind: SuggestKind;
  query: string;
  limit?: number;
}

interface SuggestionItem {
  value: string;
  label: string;
  description?: string;
  category?: string;
}

const KIND_TO_CAPABILITY: Record<SuggestKind, Parameters<typeof hasAiCapability>[1]> = {
  medication: 'ai.suggest-medication',
  icd10: 'ai.suggest-icd10',
  tuss: 'ai.suggest-tuss-code',
  'lab-test': 'ai.search-knowledge-base',
  'imaging-procedure': 'ai.search-knowledge-base',
  allergen: 'ai.search-knowledge-base',
};

const SUGGESTIONS: Record<SuggestKind, SuggestionItem[]> = {
  medication: [
    { value: 'Dipirona 500mg', label: 'Dipirona 500mg', description: 'Analgésico/antitérmico', category: 'analgesico' },
    { value: 'Paracetamol 500mg', label: 'Paracetamol 500mg', description: 'Analgésico', category: 'analgesico' },
    { value: 'Ibuprofeno 600mg', label: 'Ibuprofeno 600mg', description: 'AINE', category: 'aine' },
    { value: 'Morfina 10mg/mL', label: 'Morfina 10mg/mL', description: 'Opioide forte', category: 'opioide' },
    { value: 'Tramadol 50mg', label: 'Tramadol 50mg', description: 'Opioide fraco', category: 'opioide' },
    { value: 'Amoxicilina 500mg', label: 'Amoxicilina 500mg', description: 'Betalactâmico', category: 'antibiotico' },
    { value: 'Cefepime 1g', label: 'Cefepime 1g', description: 'Cefalosporina 4ª ger', category: 'antibiotico' },
    { value: 'Ceftriaxona 1g', label: 'Ceftriaxona 1g', description: 'Cefalosporina 3ª ger', category: 'antibiotico' },
    { value: 'Vancomicina 500mg', label: 'Vancomicina 500mg', description: 'Glicopeptídeo', category: 'antibiotico' },
    { value: 'Meropenem 1g', label: 'Meropenem 1g', description: 'Carbapenêmico', category: 'antibiotico' },
    { value: 'Piperacilina+Tazobactam 4.5g', label: 'Piperacilina + Tazobactam 4.5g', description: 'Betalactâmico amplo', category: 'antibiotico' },
    { value: 'Metronidazol 500mg', label: 'Metronidazol 500mg', description: 'Antimicrobiano', category: 'antibiotico' },
    { value: 'Omeprazol 40mg', label: 'Omeprazol 40mg', description: 'Inibidor de bomba', category: 'gastrico' },
    { value: 'Pantoprazol 40mg', label: 'Pantoprazol 40mg', description: 'Inibidor de bomba', category: 'gastrico' },
    { value: 'Furosemida 40mg', label: 'Furosemida 40mg', description: 'Diurético de alça', category: 'diuretico' },
    { value: 'Losartana 50mg', label: 'Losartana 50mg', description: 'Antagonista de angiotensina', category: 'anti-hipertensivo' },
    { value: 'Captopril 25mg', label: 'Captopril 25mg', description: 'IECA', category: 'anti-hipertensivo' },
    { value: 'Anlodipino 5mg', label: 'Anlodipino 5mg', description: 'Bloqueador de canal de cálcio', category: 'anti-hipertensivo' },
    { value: 'Sinvastatina 40mg', label: 'Sinvastatina 40mg', description: 'Estatina', category: 'lipidico' },
    { value: 'Insulina NPH 100UI/mL', label: 'Insulina NPH 100UI/mL', description: 'Insulina basal', category: 'antidiabetico' },
    { value: 'Insulina Regular 100UI/mL', label: 'Insulina Regular 100UI/mL', description: 'Insulina rápida', category: 'antidiabetico' },
    { value: 'Heparina 5000UI', label: 'Heparina 5000UI', description: 'Anticoagulante', category: 'anticoagulante' },
    { value: 'Enoxaparina 40mg', label: 'Enoxaparina 40mg', description: 'HBPM', category: 'anticoagulante' },
    { value: 'Hidrocortisona 100mg', label: 'Hidrocortisona 100mg', description: 'Corticoide IV', category: 'corticoide' },
    { value: 'Dexametasona 4mg', label: 'Dexametasona 4mg', description: 'Corticoide', category: 'corticoide' },
    { value: 'Noradrenalina 4mg/4mL', label: 'Noradrenalina 4mg/4mL', description: 'Vasopressor', category: 'vasopressor' },
    { value: 'Adrenalina 1mg/mL', label: 'Adrenalina 1mg/mL', description: 'Vasopressor / parada', category: 'vasopressor' },
    { value: 'Midazolam 5mg/mL', label: 'Midazolam 5mg/mL', description: 'Sedativo benzodiazepínico', category: 'sedativo' },
    { value: 'Propofol 200mg/20mL', label: 'Propofol 200mg/20mL', description: 'Sedativo IV', category: 'sedativo' },
    { value: 'Soro fisiológico 0.9% 500mL', label: 'Soro fisiológico 0.9% 500mL', description: 'Cristaloide', category: 'fluido' },
    { value: 'Ringer lactato 500mL', label: 'Ringer lactato 500mL', description: 'Cristaloide balanceado', category: 'fluido' },
  ],
  icd10: [
    { value: 'I50.9', label: 'I50.9', description: 'Insuficiência cardíaca, sem especificação' },
    { value: 'I21.9', label: 'I21.9', description: 'Infarto agudo do miocárdio, sem especificação' },
    { value: 'J18.9', label: 'J18.9', description: 'Pneumonia, sem especificação' },
    { value: 'J44.9', label: 'J44.9', description: 'Doença pulmonar obstrutiva crônica, sem especificação' },
    { value: 'J96.0', label: 'J96.0', description: 'Insuficiência respiratória aguda' },
    { value: 'A41.9', label: 'A41.9', description: 'Septicemia, sem especificação' },
    { value: 'R65.2', label: 'R65.2', description: 'Sepse grave' },
    { value: 'N17.9', label: 'N17.9', description: 'Insuficiência renal aguda, sem especificação' },
    { value: 'E11.9', label: 'E11.9', description: 'Diabetes mellitus tipo 2, sem complicações' },
    { value: 'I10', label: 'I10', description: 'Hipertensão essencial' },
    { value: 'I63.9', label: 'I63.9', description: 'AVC isquêmico, sem especificação' },
    { value: 'K35.9', label: 'K35.9', description: 'Apendicite aguda, sem especificação' },
    { value: 'K85.9', label: 'K85.9', description: 'Pancreatite aguda, sem especificação' },
    { value: 'O80', label: 'O80', description: 'Parto único espontâneo' },
    { value: 'S72.0', label: 'S72.0', description: 'Fratura do colo do fêmur' },
  ],
  tuss: [
    { value: '10101012', label: '10101012', description: 'Consulta em consultório (no horário normal)' },
    { value: '10101039', label: '10101039', description: 'Consulta em pronto socorro' },
    { value: '40901114', label: '40901114', description: 'Hemograma com contagem de plaquetas' },
    { value: '40802089', label: '40802089', description: 'Radiografia de tórax PA e perfil' },
    { value: '40904024', label: '40904024', description: 'Sódio (dosagem)' },
    { value: '40904032', label: '40904032', description: 'Potássio (dosagem)' },
    { value: '40901254', label: '40901254', description: 'Creatinina (dosagem)' },
    { value: '40903052', label: '40903052', description: 'Proteína C-reativa (PCR)' },
    { value: '40901327', label: '40901327', description: 'Gasometria arterial' },
    { value: '40901505', label: '40901505', description: 'Hemocultura' },
    { value: '20104073', label: '20104073', description: 'Acesso venoso central por punção' },
    { value: '30602024', label: '30602024', description: 'Drenagem torácica fechada' },
    { value: '30901042', label: '30901042', description: 'Tomografia computadorizada de tórax' },
    { value: '30903037', label: '30903037', description: 'Ressonância magnética do crânio' },
    { value: '40701076', label: '40701076', description: 'Eletrocardiograma convencional' },
  ],
  'lab-test': [
    { value: 'Hemograma completo', label: 'Hemograma completo', description: 'LOINC 58410-2' },
    { value: 'PCR', label: 'PCR — Proteína C-reativa', description: 'LOINC 1988-5' },
    { value: 'Ureia', label: 'Ureia', description: 'LOINC 3094-0' },
    { value: 'Creatinina', label: 'Creatinina', description: 'LOINC 2160-0' },
    { value: 'TGO', label: 'TGO / AST', description: 'LOINC 1920-8' },
    { value: 'TGP', label: 'TGP / ALT', description: 'LOINC 1742-6' },
    { value: 'Sódio', label: 'Sódio', description: 'LOINC 2951-2' },
    { value: 'Potássio', label: 'Potássio', description: 'LOINC 2823-3' },
    { value: 'Glicose', label: 'Glicose', description: 'LOINC 2345-7' },
    { value: 'Gasometria arterial', label: 'Gasometria arterial', description: 'LOINC 2744-1' },
    { value: 'Hemocultura', label: 'Hemocultura', description: 'LOINC 600-7' },
    { value: 'Urina tipo I', label: 'Urina tipo I', description: 'LOINC 24357-6' },
    { value: 'INR', label: 'INR', description: 'LOINC 6301-6' },
    { value: 'Troponina', label: 'Troponina', description: 'LOINC 6598-7' },
    { value: 'Lactato', label: 'Lactato', description: 'LOINC 2524-7' },
  ],
  'imaging-procedure': [
    { value: 'Raio-X de tórax PA e perfil', label: 'Raio-X de tórax PA e perfil', description: 'LOINC 30746-2' },
    { value: 'Tomografia de crânio sem contraste', label: 'TC de crânio sem contraste', description: 'LOINC 30799-1' },
    { value: 'Tomografia de tórax com contraste', label: 'TC de tórax com contraste' },
    { value: 'Ressonância de crânio', label: 'RM de crânio', description: 'LOINC 24727-0' },
    { value: 'Ultrassom abdome total', label: 'USG abdome total' },
    { value: 'Ecocardiograma transtorácico', label: 'Ecocardiograma transtorácico', description: 'LOINC 18745-0' },
    { value: 'Doppler de membros inferiores', label: 'Doppler de membros inferiores' },
    { value: 'Mamografia bilateral', label: 'Mamografia bilateral' },
  ],
  allergen: [
    { value: 'Penicilina', label: 'Penicilina', category: 'medicamento' },
    { value: 'Sulfa', label: 'Sulfa', category: 'medicamento' },
    { value: 'AAS', label: 'AAS / Ácido acetilsalicílico', category: 'medicamento' },
    { value: 'Dipirona', label: 'Dipirona', category: 'medicamento' },
    { value: 'Contraste iodado', label: 'Contraste iodado', category: 'contraste' },
    { value: 'Latéx', label: 'Látex', category: 'contato' },
    { value: 'Frutos do mar', label: 'Frutos do mar', category: 'alimento' },
    { value: 'Amendoim', label: 'Amendoim', category: 'alimento' },
    { value: 'Glúten', label: 'Glúten', category: 'alimento' },
    { value: 'Lactose', label: 'Lactose', category: 'alimento' },
  ],
};

function fuzzyMatch(query: string, item: SuggestionItem): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  const haystack = `${item.label} ${item.description ?? ''} ${item.category ?? ''}`.toLowerCase();
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  let body: SuggestRequestBody;
  try {
    body = (await request.json()) as SuggestRequestBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.kind || !SUGGESTIONS[body.kind]) {
    return NextResponse.json({ error: 'kind inválido' }, { status: 400 });
  }

  const policy = resolveAiPolicy({
    email: session.email,
    professionalRole: session.professionalRole,
  });

  const requiredCapability = KIND_TO_CAPABILITY[body.kind];
  if (!hasAiCapability(policy, requiredCapability)) {
    return NextResponse.json(
      { error: 'Sem permissão para esse tipo de sugestão', kind: body.kind },
      { status: 403 },
    );
  }

  const rateLimit = checkAiRateLimit(session.userId, policy.maxRequestsPerHour);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Limite horário atingido', rateLimit },
      { status: 429 },
    );
  }

  const limit = Math.min(Math.max(body.limit ?? 8, 1), 25);
  const results = SUGGESTIONS[body.kind]
    .filter((item) => fuzzyMatch(body.query ?? '', item))
    .slice(0, limit);

  return NextResponse.json({
    kind: body.kind,
    query: body.query ?? '',
    results,
    rateLimit,
  });
}
