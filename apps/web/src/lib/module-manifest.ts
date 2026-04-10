/**
 * Velya Module Manifest — Single source of truth for the whole hospital platform.
 *
 * Every route in the web app is registered here. A page.tsx file is a 3-line
 * thin wrapper that reads its module from this manifest and renders the shared
 * ModuleListView component.
 *
 * The hospital-modules-map.md document in docs/product/ describes which FHIR
 * resource, data class (A–E), and authorized roles back each module. This
 * manifest is the runtime expression of that map.
 *
 * Rules enforced by CI:
 * - Every module MUST have a unique `route`.
 * - Every module MUST have a non-empty `columns` array.
 * - Every module's `fhirResource` SHOULD match the blueprint (`ServiceRequest`,
 *   `Medication`, `Device`, `Task`, `ChargeItem`, `AuditEvent`, etc.).
 * - `dataClass` follows `apps/web/src/lib/access-control.ts`:
 *   A = operational, B = administrative, C = contextual-clinical,
 *   D = sensitive-clinical, E = highly-restricted.
 */

export type DataClass = 'A' | 'B' | 'C' | 'D' | 'E';

export type ModuleCategory =
  | 'clinical'
  | 'diagnostics'
  | 'pharmacy'
  | 'operations'
  | 'supply-chain'
  | 'facility'
  | 'billing'
  | 'governance'
  | 'master-data';

export type FieldInputType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'boolean'
  | 'tags';

export interface ColumnDef<T = Record<string, unknown>> {
  /** Field key in the data object */
  key: keyof T & string;
  /** Visible header text (Portuguese) */
  label: string;
  /** Optional formatter — if omitted, value is rendered as string */
  format?: (value: unknown, row: T) => string;
  /** Optional tailwind class for cell */
  className?: string;
  /** Column width hint */
  width?: 'sm' | 'md' | 'lg' | 'auto';
  /** If true, render value as a status badge */
  badge?: boolean;
  /** If set, render cell as a link to this route template. Use `${row.X}` tokens. */
  linkTo?: string;
  /**
   * If false, the column is hidden from the auto-generated edit form.
   * Defaults to true for everything except the `id` column.
   */
  editable?: boolean;
  /** Form input type used by the auto-generated edit page. Default 'text'. */
  inputType?: FieldInputType;
  /** For inputType='select' — the allowed values. Each can also have a label. */
  options?: { value: string; label?: string }[];
  /** Inline help shown below the input on the edit page */
  help?: string;
  /** Marks the field as required in the edit form */
  required?: boolean;
}

export interface FilterDef {
  key: string;
  label: string;
  /** 'select' populates from unique values in data; 'search' is free text */
  type: 'select' | 'search';
  /** If type=select, these are the option values. Omit to auto-extract from data. */
  options?: { value: string; label: string }[];
}

export interface ModuleDef {
  /** Canonical module id, matches the URL path without leading slash */
  id: string;
  /** URL route (e.g. '/prescriptions') */
  route: string;
  /** Page title shown in <h1> and topbar */
  title: string;
  /** Page subtitle */
  subtitle: string;
  /** Module category used for grouping in navigation */
  category: ModuleCategory;
  /** FHIR R4 resource this module maps to */
  fhirResource: string;
  /** Data class per access-control.ts */
  dataClass: DataClass;
  /** Roles authorized to view (subset of ProfessionalRole ids from access-control.ts). Use ['*'] for public-to-authenticated. */
  allowedRoles: string[];
  /** Roles authorized to edit records in this module. Defaults to allowedRoles when omitted. Use ['*'] to allow any authenticated user, ['admin'] for admin-only. */
  editorRoles?: string[];
  /** Import path to the fixture file (relative from apps/web/src) */
  fixturePath: string;
  /** Exported name of the fixture const */
  fixtureExport: string;
  /** Columns shown in the list view */
  columns: ColumnDef[];
  /** Filter toolbar at the top of the list view */
  filters?: FilterDef[];
  /** Emoji or single char shown in nav */
  icon: string;
  /** Route for "+ New" CTA, if the module supports creation */
  newRoute?: string;
  /** Brazilian regulations the module satisfies */
  regulatoryBasis?: string[];
}

// ---------------------------------------------------------------------------
// Module registry
// ---------------------------------------------------------------------------

export const MODULES: ModuleDef[] = [
  // =====================================================================
  // CLINICAL — prescrição, ordens, resultados
  // =====================================================================
  {
    id: 'prescriptions',
    route: '/prescriptions',
    title: 'Prescrições Médicas',
    subtitle: 'Ordens medicamentosas ativas, em preparo e completadas',
    category: 'clinical',
    fhirResource: 'MedicationRequest',
    dataClass: 'D',
    allowedRoles: ['medical_staff_attending', 'medical_staff_on_call', 'pharmacist_clinical', 'nurse'],
    fixturePath: 'lib/fixtures/prescriptions',
    fixtureExport: 'PRESCRIPTIONS',
    icon: '\uD83D\uDC8A',
    newRoute: '/prescriptions/new',
    regulatoryBasis: ['CFM Res. 1821/2007', 'ANVISA RDC 20/2011'],
    filters: [
      { key: 'status', label: 'Status', type: 'select' },
      { key: 'priority', label: 'Prioridade', type: 'select' },
      { key: 'patientMrn', label: 'Paciente (MRN)', type: 'search' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'patientMrn', label: 'Paciente', width: 'sm', linkTo: '/patients/${row.patientMrn}' },
      { key: 'medication', label: 'Medicamento' },
      { key: 'dose', label: 'Dose', width: 'sm' },
      { key: 'route', label: 'Via', width: 'sm' },
      { key: 'frequency', label: 'Frequência', width: 'md' },
      { key: 'prescriberName', label: 'Prescritor', width: 'md' },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
      { key: 'priority', label: 'Prioridade', width: 'sm', badge: true },
    ],
  },

  // =====================================================================
  // DIAGNOSTICS — laboratório + imagem
  // =====================================================================
  {
    id: 'lab-orders',
    route: '/lab/orders',
    title: 'Ordens de Laboratório',
    subtitle: 'Solicitações de exames laboratoriais e coletas',
    category: 'diagnostics',
    fhirResource: 'ServiceRequest (category=laboratory)',
    dataClass: 'D',
    allowedRoles: ['medical_staff_attending', 'lab_staff', 'nurse'],
    fixturePath: 'lib/fixtures/lab-orders',
    fixtureExport: 'LAB_ORDERS',
    icon: '\uD83E\uDDEA',
    newRoute: '/lab/orders/new',
    filters: [
      { key: 'status', label: 'Status', type: 'select' },
      { key: 'priority', label: 'Prioridade', type: 'select' },
      { key: 'category', label: 'Categoria', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'patientMrn', label: 'Paciente', width: 'sm', linkTo: '/patients/${row.patientMrn}' },
      { key: 'testCode', label: 'Código', width: 'sm' },
      { key: 'testName', label: 'Exame' },
      { key: 'category', label: 'Categoria', width: 'sm' },
      { key: 'priority', label: 'Prioridade', width: 'sm', badge: true },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
      { key: 'requesterName', label: 'Solicitante', width: 'md' },
    ],
  },
  {
    id: 'lab-results',
    route: '/lab/results',
    title: 'Resultados de Laboratório',
    subtitle: 'Valores liberados, alertas críticos e laudos',
    category: 'diagnostics',
    fhirResource: 'DiagnosticReport + Observation (laboratory)',
    dataClass: 'D',
    allowedRoles: ['medical_staff_attending', 'lab_staff', 'nurse'],
    fixturePath: 'lib/fixtures/lab-results',
    fixtureExport: 'LAB_RESULTS',
    icon: '\uD83D\uDCCA',
    filters: [
      { key: 'flag', label: 'Flag', type: 'select' },
      { key: 'status', label: 'Status', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'patientMrn', label: 'Paciente', width: 'sm', linkTo: '/patients/${row.patientMrn}' },
      { key: 'testName', label: 'Exame' },
      { key: 'result', label: 'Resultado', width: 'sm' },
      { key: 'unit', label: 'Unidade', width: 'sm' },
      { key: 'referenceRange', label: 'Referência', width: 'md' },
      { key: 'flag', label: 'Alerta', width: 'sm', badge: true },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
    ],
  },
  {
    id: 'imaging-orders',
    route: '/imaging/orders',
    title: 'Ordens de Imagem',
    subtitle: 'Radiologia, tomografia, RM, ultrassom e medicina nuclear',
    category: 'diagnostics',
    fhirResource: 'ServiceRequest (category=imaging) + ImagingStudy',
    dataClass: 'D',
    allowedRoles: ['medical_staff_attending', 'imaging_staff', 'nurse'],
    fixturePath: 'lib/fixtures/imaging-orders',
    fixtureExport: 'IMAGING_ORDERS',
    icon: '\uD83E\uDE7B',
    newRoute: '/imaging/orders/new',
    filters: [
      { key: 'modality', label: 'Modalidade', type: 'select' },
      { key: 'status', label: 'Status', type: 'select' },
      { key: 'priority', label: 'Prioridade', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'patientMrn', label: 'Paciente', width: 'sm', linkTo: '/patients/${row.patientMrn}' },
      { key: 'modality', label: 'Modalidade', width: 'sm' },
      { key: 'region', label: 'Região', width: 'md' },
      { key: 'description', label: 'Descrição' },
      { key: 'contrast', label: 'Contraste', width: 'sm' },
      { key: 'priority', label: 'Prioridade', width: 'sm', badge: true },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
    ],
  },
  {
    id: 'imaging-results',
    route: '/imaging/results',
    title: 'Laudos de Imagem',
    subtitle: 'Laudos liberados e achados críticos',
    category: 'diagnostics',
    fhirResource: 'DiagnosticReport (imaging)',
    dataClass: 'D',
    allowedRoles: ['medical_staff_attending', 'imaging_staff'],
    fixturePath: 'lib/fixtures/imaging-results',
    fixtureExport: 'IMAGING_RESULTS',
    icon: '\uD83D\uDDBC\uFE0F',
    filters: [
      { key: 'status', label: 'Status', type: 'select' },
      { key: 'modality', label: 'Modalidade', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'patientMrn', label: 'Paciente', width: 'sm', linkTo: '/patients/${row.patientMrn}' },
      { key: 'modality', label: 'Modalidade', width: 'sm' },
      { key: 'impression', label: 'Impressão' },
      { key: 'criticalFinding', label: 'Crítico', width: 'sm' },
      { key: 'reportedBy', label: 'Radiologista', width: 'md' },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
    ],
  },

  // =====================================================================
  // PHARMACY — estoque
  // =====================================================================
  {
    id: 'pharmacy-stock',
    route: '/pharmacy/stock',
    title: 'Estoque da Farmácia',
    subtitle: 'Medicamentos, lotes, validade e níveis críticos',
    category: 'pharmacy',
    fhirResource: 'Medication + SupplyDelivery',
    dataClass: 'A',
    allowedRoles: ['pharmacist_clinical', 'admin_system'],
    fixturePath: 'lib/fixtures/pharmacy-stock',
    fixtureExport: 'PHARMACY_STOCK',
    icon: '\uD83C\uDFEA',
    regulatoryBasis: ['ANVISA RDC 304/2019', 'Portaria SVS 344/1998'],
    filters: [
      { key: 'criticalLevel', label: 'Crítico', type: 'select' },
      { key: 'form', label: 'Forma', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'name', label: 'Medicamento' },
      { key: 'activeIngredient', label: 'Princípio ativo', width: 'md' },
      { key: 'strength', label: 'Concentração', width: 'sm' },
      { key: 'form', label: 'Forma', width: 'sm' },
      { key: 'lot', label: 'Lote', width: 'sm' },
      { key: 'expiry', label: 'Validade', width: 'sm' },
      { key: 'stockQty', label: 'Qtd', width: 'sm' },
      { key: 'criticalLevel', label: 'Crítico', width: 'sm', badge: true },
    ],
  },

  // =====================================================================
  // OPERATIONS — limpeza, transporte
  // =====================================================================
  {
    id: 'cleaning-tasks',
    route: '/cleaning/tasks',
    title: 'Higienização',
    subtitle: 'Tarefas de limpeza rotineira, concorrente e terminal',
    category: 'operations',
    fhirResource: 'Task (category=housekeeping)',
    dataClass: 'A',
    allowedRoles: ['cleaning_hygiene', 'bed_management', 'admin_system'],
    fixturePath: 'lib/fixtures/cleaning-tasks',
    fixtureExport: 'CLEANING_TASKS',
    icon: '\uD83E\uDDF9',
    regulatoryBasis: ['ANVISA RDC 63/2011', 'ANVISA Manual de Limpeza e Desinfecção 2012'],
    filters: [
      { key: 'status', label: 'Status', type: 'select' },
      { key: 'type', label: 'Tipo', type: 'select' },
      { key: 'riskLevel', label: 'Risco', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'area', label: 'Área' },
      { key: 'areaType', label: 'Tipo de área', width: 'md' },
      { key: 'type', label: 'Modo', width: 'sm' },
      { key: 'riskLevel', label: 'Risco', width: 'sm', badge: true },
      { key: 'assignedTo', label: 'Responsável', width: 'md' },
      { key: 'slaMinutes', label: 'SLA (min)', width: 'sm' },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
    ],
  },
  {
    id: 'transport-orders',
    route: '/transport/orders',
    title: 'Transporte Interno',
    subtitle: 'Movimentação de pacientes entre setores',
    category: 'operations',
    fhirResource: 'Task (category=transport)',
    dataClass: 'B',
    allowedRoles: ['patient_transporter', 'nurse', 'ambulance_driver'],
    fixturePath: 'lib/fixtures/transport-orders',
    fixtureExport: 'TRANSPORT_ORDERS',
    icon: '\uD83D\uDEB6',
    filters: [
      { key: 'status', label: 'Status', type: 'select' },
      { key: 'priority', label: 'Prioridade', type: 'select' },
      { key: 'reason', label: 'Motivo', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'patientMrn', label: 'Paciente', width: 'sm', linkTo: '/patients/${row.patientMrn}' },
      { key: 'origin', label: 'Origem', width: 'md' },
      { key: 'destination', label: 'Destino', width: 'md' },
      { key: 'reason', label: 'Motivo', width: 'sm' },
      { key: 'priority', label: 'Prioridade', width: 'sm', badge: true },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
    ],
  },
  {
    id: 'meal-orders',
    route: '/meals/orders',
    title: 'Nutrição Clínica',
    subtitle: 'Dietas prescritas, alergênicos e entregas',
    category: 'operations',
    fhirResource: 'NutritionOrder',
    dataClass: 'C',
    allowedRoles: ['nutritionist', 'nurse'],
    fixturePath: 'lib/fixtures/meal-orders',
    fixtureExport: 'MEAL_ORDERS',
    icon: '\uD83C\uDF7D\uFE0F',
    filters: [
      { key: 'status', label: 'Status', type: 'select' },
      { key: 'diet', label: 'Dieta', type: 'select' },
      { key: 'mealType', label: 'Refeição', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'patientMrn', label: 'Paciente', width: 'sm', linkTo: '/patients/${row.patientMrn}' },
      { key: 'diet', label: 'Dieta', width: 'sm' },
      { key: 'mealType', label: 'Refeição', width: 'sm' },
      { key: 'scheduledAt', label: 'Horário', width: 'md' },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
    ],
  },

  // =====================================================================
  // SUPPLY CHAIN — itens, ordens de compra
  // =====================================================================
  {
    id: 'supply-items',
    route: '/supply/items',
    title: 'Catálogo de Itens',
    subtitle: 'Cadastro mestre de materiais, medicamentos e OPME',
    category: 'supply-chain',
    fhirResource: 'Medication + Substance + Device',
    dataClass: 'A',
    allowedRoles: ['admin_system', 'pharmacist_clinical'],
    fixturePath: 'lib/fixtures/supply-items',
    fixtureExport: 'SUPPLY_ITEMS',
    icon: '\uD83D\uDCE6',
    regulatoryBasis: ['GS1 UDI', 'ANVISA RDC 751/2022'],
    filters: [
      { key: 'category', label: 'Categoria', type: 'select' },
      { key: 'abcClass', label: 'Curva ABC', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'code', label: 'Código', width: 'sm' },
      { key: 'description', label: 'Descrição' },
      { key: 'category', label: 'Categoria', width: 'sm' },
      { key: 'manufacturer', label: 'Fabricante', width: 'md' },
      { key: 'abcClass', label: 'ABC', width: 'sm' },
      { key: 'currentStock', label: 'Estoque', width: 'sm' },
      { key: 'minStock', label: 'Mínimo', width: 'sm' },
    ],
  },
  {
    id: 'purchase-orders',
    route: '/supply/purchase-orders',
    title: 'Ordens de Compra',
    subtitle: 'Pedidos a fornecedores, aprovações e recebimento',
    category: 'supply-chain',
    fhirResource: 'SupplyRequest',
    dataClass: 'B',
    allowedRoles: ['admin_system', 'billing_authorization'],
    fixturePath: 'lib/fixtures/purchase-orders',
    fixtureExport: 'PURCHASE_ORDERS',
    icon: '\uD83D\uDCDD',
    filters: [
      { key: 'status', label: 'Status', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'supplierName', label: 'Fornecedor' },
      { key: 'requestedAt', label: 'Solicitado em', width: 'md' },
      { key: 'expectedDelivery', label: 'Previsão', width: 'md' },
      { key: 'totalValue', label: 'Total (R$)', width: 'sm' },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
    ],
  },

  // =====================================================================
  // FACILITY — ativos, ordens de manutenção, resíduos
  // =====================================================================
  {
    id: 'assets',
    route: '/assets',
    title: 'Ativos e Equipamentos',
    subtitle: 'Engenharia clínica, patrimônio e ciclo de vida dos equipamentos',
    category: 'facility',
    fhirResource: 'Device',
    dataClass: 'A',
    allowedRoles: ['admin_system'],
    fixturePath: 'lib/fixtures/assets',
    fixtureExport: 'ASSETS',
    icon: '\uD83D\uDD27',
    regulatoryBasis: ['ANVISA RDC 2/2010 (engenharia clínica)', 'ISO 55000'],
    filters: [
      { key: 'type', label: 'Tipo', type: 'select' },
      { key: 'status', label: 'Status', type: 'select' },
      { key: 'criticality', label: 'Criticidade', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'type', label: 'Tipo', width: 'sm' },
      { key: 'manufacturer', label: 'Fabricante', width: 'md' },
      { key: 'model', label: 'Modelo', width: 'md' },
      { key: 'serial', label: 'Serial', width: 'sm' },
      { key: 'location', label: 'Localização', width: 'md' },
      { key: 'criticality', label: 'Criticidade', width: 'sm', badge: true },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
    ],
  },
  {
    id: 'work-orders',
    route: '/facility/work-orders',
    title: 'Ordens de Manutenção',
    subtitle: 'CMMS — manutenção preventiva, corretiva, calibração',
    category: 'facility',
    fhirResource: 'Task (category=maintenance)',
    dataClass: 'A',
    allowedRoles: ['admin_system'],
    fixturePath: 'lib/fixtures/work-orders',
    fixtureExport: 'WORK_ORDERS',
    icon: '\uD83D\uDEE0\uFE0F',
    filters: [
      { key: 'status', label: 'Status', type: 'select' },
      { key: 'type', label: 'Tipo', type: 'select' },
      { key: 'priority', label: 'Prioridade', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'assetId', label: 'Ativo', width: 'sm', linkTo: '/assets#${row.assetId}' },
      { key: 'type', label: 'Tipo', width: 'sm' },
      { key: 'description', label: 'Descrição' },
      { key: 'assignedTo', label: 'Responsável', width: 'md' },
      { key: 'impactLevel', label: 'Impacto', width: 'sm', badge: true },
      { key: 'priority', label: 'Prioridade', width: 'sm', badge: true },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
    ],
  },
  {
    id: 'waste-manifests',
    route: '/waste/manifests',
    title: 'Manifesto de Resíduos',
    subtitle: 'Gestão de resíduos hospitalares RSS segundo ANVISA RDC 222/2018',
    category: 'facility',
    fhirResource: 'Task (waste-management)',
    dataClass: 'A',
    allowedRoles: ['cleaning_hygiene', 'admin_system'],
    fixturePath: 'lib/fixtures/waste-manifests',
    fixtureExport: 'WASTE_MANIFESTS',
    icon: '\uD83D\uDDD1\uFE0F',
    regulatoryBasis: ['ANVISA RDC 222/2018', 'CONAMA 358/2005'],
    filters: [
      { key: 'wasteType', label: 'Tipo', type: 'select' },
      { key: 'status', label: 'Status', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'wasteType', label: 'Tipo de resíduo', width: 'md' },
      { key: 'originArea', label: 'Origem', width: 'md' },
      { key: 'weightKg', label: 'Peso (kg)', width: 'sm' },
      { key: 'generatedAt', label: 'Gerado em', width: 'md' },
      { key: 'finalDisposal', label: 'Destinação', width: 'md' },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
    ],
  },

  // =====================================================================
  // BILLING — charges, claims, denials
  // =====================================================================
  {
    id: 'charges',
    route: '/billing/charges',
    title: 'Cobranças',
    subtitle: 'Lançamentos por atendimento, procedimento, material e medicamento',
    category: 'billing',
    fhirResource: 'ChargeItem',
    dataClass: 'B',
    allowedRoles: ['billing_authorization', 'admin_system'],
    fixturePath: 'lib/fixtures/charges',
    fixtureExport: 'CHARGES',
    icon: '\uD83D\uDCB0',
    regulatoryBasis: ['TISS ANS Res. 305/2012', 'TUSS/CBHPM'],
    filters: [
      { key: 'status', label: 'Status', type: 'select' },
      { key: 'category', label: 'Categoria', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'patientMrn', label: 'Paciente', width: 'sm', linkTo: '/patients/${row.patientMrn}' },
      { key: 'code', label: 'Código', width: 'sm' },
      { key: 'description', label: 'Descrição' },
      { key: 'category', label: 'Categoria', width: 'sm' },
      { key: 'quantity', label: 'Qtd', width: 'sm' },
      { key: 'totalPrice', label: 'Total (R$)', width: 'sm' },
      { key: 'payerName', label: 'Convênio', width: 'md' },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
    ],
  },
  {
    id: 'claims',
    route: '/billing/claims',
    title: 'Contas Hospitalares',
    subtitle: 'Claims enviadas para convênios e status de pagamento',
    category: 'billing',
    fhirResource: 'Claim',
    dataClass: 'B',
    allowedRoles: ['billing_authorization', 'admin_system'],
    fixturePath: 'lib/fixtures/claims',
    fixtureExport: 'CLAIMS',
    icon: '\uD83D\uDCC4',
    regulatoryBasis: ['TISS ANS Res. 305/2012'],
    filters: [
      { key: 'status', label: 'Status', type: 'select' },
      { key: 'payerName', label: 'Convênio', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'patientMrn', label: 'Paciente', width: 'sm', linkTo: '/patients/${row.patientMrn}' },
      { key: 'payerName', label: 'Convênio', width: 'md' },
      { key: 'submittedAt', label: 'Envio', width: 'md' },
      { key: 'totalValue', label: 'Total (R$)', width: 'sm' },
      { key: 'approvedValue', label: 'Aprovado', width: 'sm' },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
    ],
  },
  {
    id: 'denials',
    route: '/billing/denials',
    title: 'Glosas',
    subtitle: 'Negativas de convênio, motivos e recursos',
    category: 'billing',
    fhirResource: 'ClaimResponse',
    dataClass: 'B',
    allowedRoles: ['billing_authorization', 'admin_system'],
    fixturePath: 'lib/fixtures/denials',
    fixtureExport: 'DENIALS',
    icon: '\u274C',
    filters: [
      { key: 'status', label: 'Status', type: 'select' },
      { key: 'category', label: 'Categoria', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'claimId', label: 'Claim', width: 'sm' },
      { key: 'code', label: 'Código', width: 'sm' },
      { key: 'reason', label: 'Motivo' },
      { key: 'category', label: 'Categoria', width: 'sm' },
      { key: 'deniedValue', label: 'Valor (R$)', width: 'sm' },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
    ],
  },

  // =====================================================================
  // GOVERNANCE — incidentes, audit, credenciais, consents
  // =====================================================================
  {
    id: 'incidents',
    route: '/quality/incidents',
    title: 'Eventos Adversos',
    subtitle: 'Incidentes, near-miss, investigação e plano de ação (CAPA)',
    category: 'governance',
    fhirResource: 'AdverseEvent',
    dataClass: 'D',
    allowedRoles: ['compliance_auditor', 'medical_staff_attending', 'nurse', 'admin_system'],
    fixturePath: 'lib/fixtures/incidents',
    fixtureExport: 'INCIDENTS',
    icon: '\u26A0\uFE0F',
    regulatoryBasis: ['ANVISA RDC 36/2013', 'Protocolos do Ministério da Saúde'],
    filters: [
      { key: 'type', label: 'Tipo', type: 'select' },
      { key: 'severity', label: 'Gravidade', type: 'select' },
      { key: 'status', label: 'Status', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'type', label: 'Tipo', width: 'md' },
      { key: 'severity', label: 'Gravidade', width: 'sm', badge: true },
      { key: 'location', label: 'Local', width: 'md' },
      { key: 'reportedAt', label: 'Reportado em', width: 'md' },
      { key: 'reportedBy', label: 'Reportado por', width: 'md' },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
    ],
  },
  {
    id: 'audit-events',
    route: '/governance/audit-events',
    title: 'Trilha de Auditoria',
    subtitle: 'Logs imutáveis de acesso e modificação de dados sensíveis',
    category: 'governance',
    fhirResource: 'AuditEvent',
    dataClass: 'B',
    allowedRoles: ['compliance_auditor', 'admin_system'],
    fixturePath: 'lib/fixtures/audit-events',
    fixtureExport: 'AUDIT_EVENTS',
    icon: '\uD83D\uDD0D',
    regulatoryBasis: ['LGPD Art. 37', 'CFM/SBIS NGS2'],
    filters: [
      { key: 'action', label: 'Ação', type: 'select' },
      { key: 'outcome', label: 'Resultado', type: 'select' },
    ],
    columns: [
      { key: 'timestamp', label: 'Quando', width: 'md' },
      { key: 'actor', label: 'Ator', width: 'md' },
      { key: 'actorRole', label: 'Papel', width: 'md' },
      { key: 'action', label: 'Ação', width: 'md' },
      { key: 'resourceType', label: 'Recurso', width: 'sm' },
      { key: 'patientMrn', label: 'MRN', width: 'sm' },
      { key: 'ip', label: 'IP', width: 'md' },
      { key: 'outcome', label: 'Resultado', width: 'sm', badge: true },
    ],
  },
  {
    id: 'credentials',
    route: '/governance/credentials',
    title: 'Credenciais Profissionais',
    subtitle: 'Conselhos, CRM/COREN/CRF, validade e verificação',
    category: 'governance',
    fhirResource: 'PractitionerRole + Qualification',
    dataClass: 'B',
    allowedRoles: ['compliance_auditor', 'admin_system'],
    fixturePath: 'lib/fixtures/credentials',
    fixtureExport: 'CREDENTIALS',
    icon: '\uD83C\uDD94',
    filters: [
      { key: 'type', label: 'Conselho', type: 'select' },
      { key: 'status', label: 'Status', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'employeeId', label: 'Matrícula', width: 'sm', linkTo: '/employees/${row.employeeId}' },
      { key: 'type', label: 'Conselho', width: 'sm' },
      { key: 'number', label: 'Número', width: 'md' },
      { key: 'state', label: 'UF', width: 'sm' },
      { key: 'expiresAt', label: 'Validade', width: 'md' },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
    ],
  },
  {
    id: 'consent-forms',
    route: '/governance/consent-forms',
    title: 'Termos de Consentimento',
    subtitle: 'LGPD, cirurgia, anestesia, transfusão, uso de imagem',
    category: 'governance',
    fhirResource: 'Consent',
    dataClass: 'B',
    allowedRoles: ['medical_staff_attending', 'receptionist_registration', 'admin_system'],
    fixturePath: 'lib/fixtures/consent-forms',
    fixtureExport: 'CONSENT_FORMS',
    icon: '\u270D\uFE0F',
    regulatoryBasis: ['LGPD Art. 7 e 11', 'CFM Res. 2217/2018'],
    filters: [
      { key: 'type', label: 'Tipo', type: 'select' },
      { key: 'status', label: 'Status', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'patientMrn', label: 'Paciente', width: 'sm', linkTo: '/patients/${row.patientMrn}' },
      { key: 'type', label: 'Tipo', width: 'md' },
      { key: 'scope', label: 'Escopo' },
      { key: 'signedAt', label: 'Assinado em', width: 'md' },
      { key: 'signedBy', label: 'Assinado por', width: 'md' },
      { key: 'status', label: 'Status', width: 'sm', badge: true },
    ],
  },

  // =====================================================================
  // MASTER DATA — referência clínica e operacional
  // =====================================================================
  {
    id: 'medical-specialties',
    route: '/specialties',
    title: 'Especialidades Médicas',
    subtitle: '55 especialidades CFM (Res. 2.380/2024) — condições, procedimentos e exames',
    category: 'master-data',
    fhirResource: 'PractitionerRole.specialty + CodeSystem',
    dataClass: 'A',
    allowedRoles: ['*'],
    editorRoles: ['admin_system'],
    fixturePath: 'lib/fixtures/medical-specialties',
    fixtureExport: 'MEDICAL_SPECIALTIES',
    icon: '\uD83E\uDE7A',
    regulatoryBasis: ['CFM Res. 2.380/2024'],
    filters: [
      { key: 'category', label: 'Categoria', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'name', label: 'Especialidade' },
      { key: 'category', label: 'Categoria', width: 'sm' },
      { key: 'cfmCode', label: 'CFM', width: 'sm' },
      { key: 'residencyYears', label: 'Anos R.', width: 'sm' },
      { key: 'description', label: 'Descrição' },
    ],
  },
  {
    id: 'hospital-wards',
    route: '/wards',
    title: 'Alas e Setores',
    subtitle: 'Mapa completo das alas, com regras de funcionamento, ocupação e regulação',
    category: 'master-data',
    fhirResource: 'Location',
    dataClass: 'A',
    allowedRoles: ['*'],
    editorRoles: ['admin_system', 'bed_management'],
    fixturePath: 'lib/fixtures/hospital-wards',
    fixtureExport: 'HOSPITAL_WARDS',
    icon: '\uD83C\uDFE5',
    regulatoryBasis: ['ANVISA RDC 50/2002', 'ANVISA RDC 7/2010', 'ANVISA RDC 36/2008'],
    filters: [
      { key: 'type', label: 'Tipo', type: 'select' },
      { key: 'criticality', label: 'Criticidade', type: 'select' },
    ],
    columns: [
      { key: 'id', label: 'ID', width: 'sm' },
      { key: 'name', label: 'Nome' },
      { key: 'type', label: 'Tipo', width: 'sm' },
      { key: 'capacity', label: 'Capacidade', width: 'sm' },
      { key: 'occupied', label: 'Ocupado', width: 'sm' },
      { key: 'criticality', label: 'Criticidade', width: 'sm', badge: true },
      { key: 'operatingHours', label: 'Horário', width: 'sm' },
    ],
  },
];

export function getModuleById(id: string): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id);
}

/**
 * Returns true if a user with the given professional role + email may edit
 * records in the given module. Admin emails always pass.
 */
export function canEditModule(
  module: ModuleDef,
  professionalRole: string | null | undefined,
  email: string | null | undefined,
): boolean {
  // Admin allowlist always wins. Hardcoded for the platform owner.
  const adminEmails = (process.env.AI_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (email && (adminEmails.includes(email.toLowerCase()) || email.toLowerCase() === 'lucaslima4132@gmail.com')) {
    return true;
  }
  const editors = module.editorRoles ?? module.allowedRoles;
  if (editors.includes('*')) return true;
  if (!professionalRole) return false;
  return editors.includes(professionalRole) || editors.includes('admin_system');
}

/**
 * Returns the columns that should appear in the auto-generated edit form.
 * Excludes `id` and any column explicitly marked editable: false.
 */
export function getEditableColumns(module: ModuleDef): ColumnDef[] {
  return module.columns.filter((c) => c.key !== 'id' && c.editable !== false);
}

export function getModulesByCategory(category: ModuleCategory): ModuleDef[] {
  return MODULES.filter((m) => m.category === category);
}

export const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  clinical: 'Clínico',
  diagnostics: 'Diagnóstico',
  pharmacy: 'Farmácia',
  operations: 'Operações',
  'supply-chain': 'Suprimentos',
  facility: 'Engenharia e Ativos',
  billing: 'Faturamento',
  governance: 'Governança',
  'master-data': 'Dados Mestres',
};
