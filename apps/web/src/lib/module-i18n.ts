/**
 * Portuguese translations and formatters for the generic ModuleListView.
 *
 * Context: fixtures across the platform store enum values in English
 * (FHIR-style `active`, `in-progress`, `on-hold`, `stat`, `routine`, etc.)
 * and ISO timestamps (`2026-04-10T07:00:00-03:00`). The list view used
 * to render these raw strings, which leaked into the clinician's view as
 * `active` badges, `urgent` priorities, and unreadable ISO datetimes.
 *
 * This module centralises:
 *   - `translate(value)` — best-effort enum → pt-BR.
 *   - `formatDateTimeBR(value)` — ISO → `dd/mm/aaaa HH:MM`.
 *   - `formatDateBR(value)` / `formatTimeBR(value)` — split variants.
 *
 * Column definitions in `module-manifest.ts` use these helpers via the
 * `format` hook so every list view renders clinician-facing Portuguese
 * without touching the underlying fixture shape.
 */

/** Case-insensitive lookup — keys stored lowercase. */
const STATUS_PT: Record<string, string> = {
  // Generic lifecycle
  active: 'Ativo',
  inactive: 'Inativo',
  completed: 'Concluído',
  complete: 'Concluído',
  pending: 'Pendente',
  'in-progress': 'Em andamento',
  in_progress: 'Em andamento',
  'on-hold': 'Em espera',
  on_hold: 'Em espera',
  hold: 'Em espera',
  draft: 'Rascunho',
  cancelled: 'Cancelado',
  canceled: 'Cancelado',
  failed: 'Falhou',
  revoked: 'Revogado',
  stopped: 'Interrompido',
  entered_in_error: 'Registrado por engano',
  'entered-in-error': 'Registrado por engano',
  unknown: 'Desconhecido',
  error: 'Erro',
  // Orders and requests
  requested: 'Solicitado',
  received: 'Recebido',
  accepted: 'Aceito',
  rejected: 'Rejeitado',
  ready: 'Pronto',
  'on-way': 'A caminho',
  'in-transit': 'Em trânsito',
  in_transit: 'Em trânsito',
  arrived: 'Chegou',
  delivered: 'Entregue',
  dispatched: 'Despachado',
  // Lab / imaging
  collected: 'Coletado',
  'in-review': 'Em revisão',
  in_review: 'Em revisão',
  reviewed: 'Revisado',
  released: 'Liberado',
  preliminary: 'Preliminar',
  final: 'Final',
  corrected: 'Corrigido',
  amended: 'Retificado',
  registered: 'Registrado',
  partial: 'Parcial',
  // Scheduling
  scheduled: 'Agendado',
  booked: 'Marcado',
  arrived_appt: 'Paciente chegou',
  fulfilled: 'Realizado',
  'no-show': 'Não compareceu',
  no_show: 'Não compareceu',
  waitlist: 'Lista de espera',
  // Pharmacy / medication
  'on-order': 'Em pedido',
  preparing: 'Em preparo',
  'in-preparation': 'Em preparo',
  in_preparation: 'Em preparo',
  dispensed: 'Dispensado',
  administered: 'Administrado',
  // Beds / operations
  available: 'Disponível',
  occupied: 'Ocupado',
  cleaning: 'Higienização',
  maintenance: 'Manutenção',
  reserved: 'Reservado',
  blocked: 'Bloqueado',
  assigned: 'Atribuído',
  unassigned: 'Sem atribuição',
  planned: 'Planejado',
  preop: 'Pré-operatório',
  // Task-ish
  open: 'Aberta',
  closed: 'Fechada',
  resolved: 'Resolvida',
  deferred: 'Adiada',
  acknowledged: 'Reconhecido',
  triaged: 'Triado',
  // Priority / urgency
  routine: 'Rotina',
  urgent: 'Urgente',
  stat: 'Imediato',
  asap: 'Imediato',
  emergency: 'Emergência',
  high: 'Alta',
  medium: 'Média',
  normal: 'Normal',
  low: 'Baixa',
  critical: 'Crítico',
  // Common reasons
  exam: 'Exame',
  surgery: 'Cirurgia',
  admission: 'Admissão',
  discharge: 'Alta',
  transfer: 'Transferência',
  // Ward / ambulance categories — shared with the NAV filters
  'uti-adulto': 'UTI Adulto',
  'uti-neonatal': 'UTI Neonatal',
  'uti-pediatrica': 'UTI Pediátrica',
  'internacao-clinica': 'Internação Clínica',
  'internacao-cirurgica': 'Internação Cirúrgica',
  'pronto-socorro': 'Pronto-Socorro',
  'centro-cirurgico': 'Centro Cirúrgico',
  maternidade: 'Maternidade',
  pediatria: 'Pediatria',
  // Imaging modalities
  xr: 'Raio-X',
  ct: 'Tomografia',
  mri: 'Ressonância',
  us: 'Ultrassom',
  nm: 'Medicina Nuclear',
  pet: 'PET',
  mg: 'Mamografia',
  // Meal / diet
  breakfast: 'Café da manhã',
  lunch: 'Almoço',
  dinner: 'Jantar',
  snack: 'Lanche',
  supper: 'Ceia',
};

/**
 * Translate a single enum value to its pt-BR label. Falls back to a
 * Title-Cased version of the input so unknown values are still readable
 * (`pending-review` → `Pending Review`). Never throws.
 */
export function translate(value: unknown): string {
  if (value == null) return '—';
  const s = String(value).trim();
  if (!s) return '—';
  const pt = STATUS_PT[s.toLowerCase()];
  if (pt) return pt;
  // Title-case the fallback so raw enums don't look like code.
  return s
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ---------------------------------------------------------------------------
// Date / time formatting — pt-BR, America/Sao_Paulo-friendly (we pass through
// whatever offset the ISO string carries, Intl handles localisation).
// ---------------------------------------------------------------------------

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const DATETIME_FMT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const TIME_FMT = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
});

function parseDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `2026-04-10T07:00:00-03:00` → `10/04/2026 07:00`. */
export function formatDateTimeBR(value: unknown): string {
  const d = parseDate(value);
  if (!d) return String(value ?? '—');
  return DATETIME_FMT.format(d).replace(',', '');
}

/** `2026-04-10` → `10/04/2026`. */
export function formatDateBR(value: unknown): string {
  const d = parseDate(value);
  if (!d) return String(value ?? '—');
  return DATE_FMT.format(d);
}

/** `07:00` → `07:00` (pass-through for HH:MM strings, parses ISO too). */
export function formatTimeBR(value: unknown): string {
  if (value == null) return '—';
  const s = String(value).trim();
  // Short-circuit for already-HH:MM values from fixtures.
  if (/^\d{1,2}:\d{2}$/.test(s)) return s.padStart(5, '0');
  const d = parseDate(s);
  if (!d) return s || '—';
  return TIME_FMT.format(d);
}
