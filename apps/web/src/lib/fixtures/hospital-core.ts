/**
 * Hospital core fixture.
 *
 * Single unified dataset for a mid-size Brazilian hospital (200 beds, 75% occupied)
 * that replaces the fragmented fixtures under src/lib/fixtures/*. Conforms to the
 * schemas in src/lib/hospital-core-types.ts and the spec in
 * docs/product/hospital-core-model-reformulation.md section 3.
 *
 * Construction pattern:
 *   1. Hospital + address
 *   2. Organizations (hospital -> departments -> units -> teams)
 *   3. Locations (hospital -> buildings -> floors -> wards -> rooms -> beds)
 *   4. Especialidades (15+)
 *   5. UnidadesAssistenciais (10) wiring Location to Organization
 *   6. HealthcareServices (specialty operating in unit, with coverage model)
 *   7. ProfissionaisSaude (40+) + PractitionerRoles (1-2 each)
 *   8. Turnos for today (2026-04-12)
 *   9. Pacientes (50+) + Internacoes (~150 active) + CareTeams + Transferencias
 *  10. Index helpers with O(1) lookups
 */

import type {
  CareTeam,
  Especialidade,
  EvolucaoClinica,
  HealthcareService,
  Hospital,
  Internacao,
  Location,
  Organization,
  Paciente,
  PractitionerRole,
  PresencaFisica,
  Prescricao,
  PrescricaoItem,
  ProfissionalSaude,
  RegistroSinaisVitais,
  SolicitacaoExame,
  TransferenciaInterna,
  Turno,
  UnidadeAssistencial,
} from '../hospital-core-types';

// ---------------------------------------------------------------------------
// Reference date
// ---------------------------------------------------------------------------

export const FIXTURE_DATE_ISO = '2026-04-12';
const NOW = '2026-04-12T10:30:00-03:00';
const MORNING_START = '2026-04-12T07:00:00-03:00';
const MORNING_END = '2026-04-12T13:00:00-03:00';
const NIGHT_START = '2026-04-12T19:00:00-03:00';
const NIGHT_END = '2026-04-13T07:00:00-03:00';
const PLANTAO12_DAY_START = '2026-04-12T07:00:00-03:00';
const PLANTAO12_DAY_END = '2026-04-12T19:00:00-03:00';

// ---------------------------------------------------------------------------
// Hospital
// ---------------------------------------------------------------------------

export const HOSPITAL: Hospital = {
  id: 'hosp-velya-central',
  nome: 'Hospital Velya Central',
  cnes: '2077469',
  cnpj: '12.345.678/0001-90',
  porte: 'medio',
  tipo: 'geral',
  natureza: 'privado',
  nivelComplexidade: 'terciario',
  certificacoes: ['ONA_2', 'HIMSS_6'],
  enderecoId: 'end-hosp-001',
};

// ---------------------------------------------------------------------------
// Organizations (administrative hierarchy)
// ---------------------------------------------------------------------------

export const ORGANIZATIONS: Organization[] = [
  {
    id: 'org-hosp',
    nome: 'Hospital Velya Central',
    tipo: 'hospital',
    hospitalId: HOSPITAL.id,
  },
  // Departments
  { id: 'org-dep-clinica-medica', nome: 'Departamento de Clinica Medica', tipo: 'department', parentId: 'org-hosp', hospitalId: HOSPITAL.id },
  { id: 'org-dep-cirurgia', nome: 'Departamento de Cirurgia', tipo: 'department', parentId: 'org-hosp', hospitalId: HOSPITAL.id },
  { id: 'org-dep-pediatria', nome: 'Departamento de Pediatria', tipo: 'department', parentId: 'org-hosp', hospitalId: HOSPITAL.id },
  { id: 'org-dep-materno-infantil', nome: 'Departamento Materno-Infantil', tipo: 'department', parentId: 'org-hosp', hospitalId: HOSPITAL.id },
  { id: 'org-dep-medicina-critica', nome: 'Departamento de Medicina Critica', tipo: 'department', parentId: 'org-hosp', hospitalId: HOSPITAL.id },
  { id: 'org-dep-emergencia', nome: 'Departamento de Emergencia', tipo: 'department', parentId: 'org-hosp', hospitalId: HOSPITAL.id },
  { id: 'org-dep-apoio', nome: 'Departamento de Apoio Multiprofissional', tipo: 'department', parentId: 'org-hosp', hospitalId: HOSPITAL.id },
  { id: 'org-dep-farmacia', nome: 'Farmacia Hospitalar', tipo: 'department', parentId: 'org-hosp', hospitalId: HOSPITAL.id },
  { id: 'org-dep-diretoria', nome: 'Diretoria Clinica', tipo: 'department', parentId: 'org-hosp', hospitalId: HOSPITAL.id },
  // Units (one per UnidadeAssistencial, used as organizationId)
  { id: 'org-unit-uti-adulto', nome: 'UTI Adulto', tipo: 'unit', parentId: 'org-dep-medicina-critica', hospitalId: HOSPITAL.id, regulamentacao: ['ANVISA RDC 7/2010'] },
  { id: 'org-unit-uco', nome: 'UCO', tipo: 'unit', parentId: 'org-dep-medicina-critica', hospitalId: HOSPITAL.id, regulamentacao: ['ANVISA RDC 7/2010', 'CFM 2.271/2020'] },
  { id: 'org-unit-uci-adulto', nome: 'UCI Adulto', tipo: 'unit', parentId: 'org-dep-medicina-critica', hospitalId: HOSPITAL.id, regulamentacao: ['ANVISA RDC 7/2010'] },
  { id: 'org-unit-ala-2a', nome: 'Ala 2A - Clinica Medica', tipo: 'unit', parentId: 'org-dep-clinica-medica', hospitalId: HOSPITAL.id },
  { id: 'org-unit-ala-3b', nome: 'Ala 3B - Clinica Cirurgica', tipo: 'unit', parentId: 'org-dep-cirurgia', hospitalId: HOSPITAL.id },
  { id: 'org-unit-pediatria', nome: 'Pediatria', tipo: 'unit', parentId: 'org-dep-pediatria', hospitalId: HOSPITAL.id },
  { id: 'org-unit-maternidade', nome: 'Maternidade', tipo: 'unit', parentId: 'org-dep-materno-infantil', hospitalId: HOSPITAL.id },
  { id: 'org-unit-uti-neo', nome: 'UTI Neonatal', tipo: 'unit', parentId: 'org-dep-materno-infantil', hospitalId: HOSPITAL.id, regulamentacao: ['ANVISA RDC 7/2010'] },
  { id: 'org-unit-ps', nome: 'Pronto Socorro', tipo: 'unit', parentId: 'org-dep-emergencia', hospitalId: HOSPITAL.id, regulamentacao: ['CFM 2.147/2016'] },
  { id: 'org-unit-cc', nome: 'Centro Cirurgico', tipo: 'unit', parentId: 'org-dep-cirurgia', hospitalId: HOSPITAL.id, regulamentacao: ['ANVISA RDC 50/2002'] },
  // Specialty services (operational owners of HealthcareService objects)
  { id: 'org-svc-cardiologia', nome: 'Servico de Cardiologia', tipo: 'specialty_service', parentId: 'org-dep-clinica-medica', hospitalId: HOSPITAL.id },
  { id: 'org-svc-pneumologia', nome: 'Servico de Pneumologia', tipo: 'specialty_service', parentId: 'org-dep-clinica-medica', hospitalId: HOSPITAL.id },
  { id: 'org-svc-nefrologia', nome: 'Servico de Nefrologia', tipo: 'specialty_service', parentId: 'org-dep-clinica-medica', hospitalId: HOSPITAL.id },
  { id: 'org-svc-endocrino', nome: 'Servico de Endocrinologia', tipo: 'specialty_service', parentId: 'org-dep-clinica-medica', hospitalId: HOSPITAL.id },
  { id: 'org-svc-neurologia', nome: 'Servico de Neurologia', tipo: 'specialty_service', parentId: 'org-dep-clinica-medica', hospitalId: HOSPITAL.id },
  { id: 'org-svc-gastro', nome: 'Servico de Gastroenterologia', tipo: 'specialty_service', parentId: 'org-dep-clinica-medica', hospitalId: HOSPITAL.id },
  { id: 'org-svc-infecto', nome: 'Servico de Infectologia', tipo: 'specialty_service', parentId: 'org-dep-clinica-medica', hospitalId: HOSPITAL.id },
  { id: 'org-svc-cir-geral', nome: 'Servico de Cirurgia Geral', tipo: 'specialty_service', parentId: 'org-dep-cirurgia', hospitalId: HOSPITAL.id },
  { id: 'org-svc-ortopedia', nome: 'Servico de Ortopedia', tipo: 'specialty_service', parentId: 'org-dep-cirurgia', hospitalId: HOSPITAL.id },
  { id: 'org-svc-urologia', nome: 'Servico de Urologia', tipo: 'specialty_service', parentId: 'org-dep-cirurgia', hospitalId: HOSPITAL.id },
  { id: 'org-svc-gineco', nome: 'Servico de Ginecologia-Obstetricia', tipo: 'specialty_service', parentId: 'org-dep-materno-infantil', hospitalId: HOSPITAL.id },
  { id: 'org-svc-pediatria', nome: 'Servico de Pediatria', tipo: 'specialty_service', parentId: 'org-dep-pediatria', hospitalId: HOSPITAL.id },
  { id: 'org-svc-intensiva', nome: 'Servico de Medicina Intensiva', tipo: 'specialty_service', parentId: 'org-dep-medicina-critica', hospitalId: HOSPITAL.id },
  { id: 'org-svc-emergencia', nome: 'Servico de Medicina de Emergencia', tipo: 'specialty_service', parentId: 'org-dep-emergencia', hospitalId: HOSPITAL.id },
  { id: 'org-svc-clinica', nome: 'Servico de Clinica Medica', tipo: 'specialty_service', parentId: 'org-dep-clinica-medica', hospitalId: HOSPITAL.id },
  { id: 'org-svc-fisio', nome: 'Servico de Fisioterapia', tipo: 'specialty_service', parentId: 'org-dep-apoio', hospitalId: HOSPITAL.id },
  { id: 'org-svc-nutricao', nome: 'Servico de Nutricao', tipo: 'specialty_service', parentId: 'org-dep-apoio', hospitalId: HOSPITAL.id },
  { id: 'org-svc-farmacia', nome: 'Servico de Farmacia Clinica', tipo: 'specialty_service', parentId: 'org-dep-farmacia', hospitalId: HOSPITAL.id },
  { id: 'org-svc-social', nome: 'Servico Social', tipo: 'specialty_service', parentId: 'org-dep-apoio', hospitalId: HOSPITAL.id },
];

// ---------------------------------------------------------------------------
// Locations (physical tree)
// ---------------------------------------------------------------------------

/**
 * Bed generator: emits N beds under a given ward, filling occupancy
 * deterministically. The occupancy pattern is: `occupied` beds with status O,
 * the next `housekeeping` with H, the next `closed` with C, remaining with U.
 */
function generateBeds(args: {
  wardId: string;
  wardCode: string;
  total: number;
  occupied: number;
  housekeeping?: number;
  closed?: number;
  tipoLeitoSus: Location['tipoLeitoSus'];
  andar: number;
  setor: string;
  sexoDesignado?: Location['sexoDesignado'];
  managingOrganizationId?: string;
  isolamentoIndices?: number[]; // 1-based indices of isolated beds
  isolamentoTipo?: Location['isolamento'];
}): Location[] {
  const {
    wardId,
    wardCode,
    total,
    occupied,
    housekeeping = 0,
    closed = 0,
    tipoLeitoSus,
    andar,
    setor,
    sexoDesignado,
    managingOrganizationId,
    isolamentoIndices = [],
    isolamentoTipo,
  } = args;
  const beds: Location[] = [];
  for (let i = 1; i <= total; i++) {
    let status: Location['operationalStatus'];
    if (i <= occupied) status = 'O';
    else if (i <= occupied + housekeeping) status = 'H';
    else if (i <= occupied + housekeeping + closed) status = 'C';
    else status = 'U';
    const num = i.toString().padStart(2, '0');
    const id = `loc-bed-${wardCode.toLowerCase()}-${num}`;
    beds.push({
      id,
      nome: `${wardCode}-${num}`,
      physicalType: 'bed',
      parentId: wardId,
      hospitalId: HOSPITAL.id,
      managingOrganizationId,
      status: 'active',
      operationalStatus: status,
      coordenadas: { andar, setor, sala: `${wardCode}-${num}` },
      tipoLeitoSus,
      sexoDesignado,
      ...(isolamentoIndices.includes(i) && isolamentoTipo
        ? { isolamento: isolamentoTipo }
        : {}),
    });
  }
  return beds;
}

// Buildings (blocos)
const BUILDINGS: Location[] = [
  { id: 'loc-bloco-a', nome: 'Bloco A', physicalType: 'building', parentId: undefined, hospitalId: HOSPITAL.id, status: 'active', coordenadas: { andar: 0, setor: 'A' } },
  { id: 'loc-bloco-b', nome: 'Bloco B', physicalType: 'building', parentId: undefined, hospitalId: HOSPITAL.id, status: 'active', coordenadas: { andar: 0, setor: 'B' } },
  { id: 'loc-bloco-c', nome: 'Bloco C', physicalType: 'building', parentId: undefined, hospitalId: HOSPITAL.id, status: 'active', coordenadas: { andar: 0, setor: 'C' } },
];

// Floors (5 in Bloco A, 4 in Bloco B, 3 in Bloco C)
const FLOORS: Location[] = [
  // Bloco A - 5 andares
  { id: 'loc-a-1', nome: 'Bloco A - 1 Andar', physicalType: 'level', parentId: 'loc-bloco-a', hospitalId: HOSPITAL.id, status: 'active', coordenadas: { andar: 1, setor: 'A' } },
  { id: 'loc-a-2', nome: 'Bloco A - 2 Andar', physicalType: 'level', parentId: 'loc-bloco-a', hospitalId: HOSPITAL.id, status: 'active', coordenadas: { andar: 2, setor: 'A' } },
  { id: 'loc-a-3', nome: 'Bloco A - 3 Andar', physicalType: 'level', parentId: 'loc-bloco-a', hospitalId: HOSPITAL.id, status: 'active', coordenadas: { andar: 3, setor: 'A' } },
  { id: 'loc-a-4', nome: 'Bloco A - 4 Andar', physicalType: 'level', parentId: 'loc-bloco-a', hospitalId: HOSPITAL.id, status: 'active', coordenadas: { andar: 4, setor: 'A' } },
  { id: 'loc-a-5', nome: 'Bloco A - 5 Andar', physicalType: 'level', parentId: 'loc-bloco-a', hospitalId: HOSPITAL.id, status: 'active', coordenadas: { andar: 5, setor: 'A' } },
  // Bloco B - 4 andares
  { id: 'loc-b-1', nome: 'Bloco B - 1 Andar', physicalType: 'level', parentId: 'loc-bloco-b', hospitalId: HOSPITAL.id, status: 'active', coordenadas: { andar: 1, setor: 'B' } },
  { id: 'loc-b-2', nome: 'Bloco B - 2 Andar', physicalType: 'level', parentId: 'loc-bloco-b', hospitalId: HOSPITAL.id, status: 'active', coordenadas: { andar: 2, setor: 'B' } },
  { id: 'loc-b-3', nome: 'Bloco B - 3 Andar', physicalType: 'level', parentId: 'loc-bloco-b', hospitalId: HOSPITAL.id, status: 'active', coordenadas: { andar: 3, setor: 'B' } },
  { id: 'loc-b-4', nome: 'Bloco B - 4 Andar', physicalType: 'level', parentId: 'loc-bloco-b', hospitalId: HOSPITAL.id, status: 'active', coordenadas: { andar: 4, setor: 'B' } },
  // Bloco C - 3 andares
  { id: 'loc-c-1', nome: 'Bloco C - 1 Andar', physicalType: 'level', parentId: 'loc-bloco-c', hospitalId: HOSPITAL.id, status: 'active', coordenadas: { andar: 1, setor: 'C' } },
  { id: 'loc-c-2', nome: 'Bloco C - 2 Andar', physicalType: 'level', parentId: 'loc-bloco-c', hospitalId: HOSPITAL.id, status: 'active', coordenadas: { andar: 2, setor: 'C' } },
  { id: 'loc-c-3', nome: 'Bloco C - 3 Andar', physicalType: 'level', parentId: 'loc-bloco-c', hospitalId: HOSPITAL.id, status: 'active', coordenadas: { andar: 3, setor: 'C' } },
];

// Wards (10 clinical units)
const WARDS: Location[] = [
  { id: 'loc-ward-uti-adulto', nome: 'UTI Adulto', physicalType: 'ward', parentId: 'loc-a-4', hospitalId: HOSPITAL.id, managingOrganizationId: 'org-unit-uti-adulto', status: 'active', capacidade: 12, coordenadas: { andar: 4, setor: 'A-Norte' } },
  { id: 'loc-ward-uco', nome: 'UCO', physicalType: 'ward', parentId: 'loc-a-4', hospitalId: HOSPITAL.id, managingOrganizationId: 'org-unit-uco', status: 'active', capacidade: 8, coordenadas: { andar: 4, setor: 'A-Sul' } },
  { id: 'loc-ward-uci-adulto', nome: 'UCI Adulto', physicalType: 'ward', parentId: 'loc-a-3', hospitalId: HOSPITAL.id, managingOrganizationId: 'org-unit-uci-adulto', status: 'active', capacidade: 10, coordenadas: { andar: 3, setor: 'A-Norte' } },
  { id: 'loc-ward-ala-2a', nome: 'Ala 2A - Clinica Medica', physicalType: 'ward', parentId: 'loc-a-2', hospitalId: HOSPITAL.id, managingOrganizationId: 'org-unit-ala-2a', status: 'active', capacidade: 30, coordenadas: { andar: 2, setor: 'A' } },
  { id: 'loc-ward-ala-3b', nome: 'Ala 3B - Clinica Cirurgica', physicalType: 'ward', parentId: 'loc-b-3', hospitalId: HOSPITAL.id, managingOrganizationId: 'org-unit-ala-3b', status: 'active', capacidade: 25, coordenadas: { andar: 3, setor: 'B' } },
  { id: 'loc-ward-pediatria', nome: 'Pediatria', physicalType: 'ward', parentId: 'loc-b-2', hospitalId: HOSPITAL.id, managingOrganizationId: 'org-unit-pediatria', status: 'active', capacidade: 20, coordenadas: { andar: 2, setor: 'B' } },
  { id: 'loc-ward-maternidade', nome: 'Maternidade', physicalType: 'ward', parentId: 'loc-b-4', hospitalId: HOSPITAL.id, managingOrganizationId: 'org-unit-maternidade', status: 'active', capacidade: 30, coordenadas: { andar: 4, setor: 'B' } },
  { id: 'loc-ward-uti-neo', nome: 'UTI Neonatal', physicalType: 'ward', parentId: 'loc-b-4', hospitalId: HOSPITAL.id, managingOrganizationId: 'org-unit-uti-neo', status: 'active', capacidade: 8, coordenadas: { andar: 4, setor: 'B-Norte' } },
  { id: 'loc-ward-ps', nome: 'Pronto Socorro', physicalType: 'ward', parentId: 'loc-c-1', hospitalId: HOSPITAL.id, managingOrganizationId: 'org-unit-ps', status: 'active', capacidade: 40, coordenadas: { andar: 1, setor: 'C' } },
  { id: 'loc-ward-cc', nome: 'Centro Cirurgico', physicalType: 'ward', parentId: 'loc-c-2', hospitalId: HOSPITAL.id, managingOrganizationId: 'org-unit-cc', status: 'active', capacidade: 6, coordenadas: { andar: 2, setor: 'C' } },
];

// Beds per ward (75% occupancy target = ~150/200)
// Targets chosen to hit ~150 occupied across 200 total beds.
const BEDS_UTI_ADULTO = generateBeds({ wardId: 'loc-ward-uti-adulto', wardCode: 'UTIA', total: 12, occupied: 10, housekeeping: 1, closed: 1, tipoLeitoSus: 'uti_adulto_ii', andar: 4, setor: 'A-Norte', sexoDesignado: 'misto', managingOrganizationId: 'org-unit-uti-adulto', isolamentoIndices: [3], isolamentoTipo: 'contato' });
const BEDS_UCO = generateBeds({ wardId: 'loc-ward-uco', wardCode: 'UCO', total: 8, occupied: 6, tipoLeitoSus: 'uti_adulto_ii', andar: 4, setor: 'A-Sul', sexoDesignado: 'misto', managingOrganizationId: 'org-unit-uco' });
const BEDS_UCI_ADULTO = generateBeds({ wardId: 'loc-ward-uci-adulto', wardCode: 'UCIA', total: 10, occupied: 8, tipoLeitoSus: 'uci', andar: 3, setor: 'A-Norte', sexoDesignado: 'misto', managingOrganizationId: 'org-unit-uci-adulto' });
const BEDS_ALA_2A = generateBeds({ wardId: 'loc-ward-ala-2a', wardCode: 'A2A', total: 30, occupied: 23, housekeeping: 1, tipoLeitoSus: 'clinico', andar: 2, setor: 'A', sexoDesignado: 'misto', managingOrganizationId: 'org-unit-ala-2a' });
const BEDS_ALA_3B = generateBeds({ wardId: 'loc-ward-ala-3b', wardCode: 'A3B', total: 25, occupied: 19, tipoLeitoSus: 'cirurgico', andar: 3, setor: 'B', sexoDesignado: 'misto', managingOrganizationId: 'org-unit-ala-3b' });
const BEDS_PEDIATRIA = generateBeds({ wardId: 'loc-ward-pediatria', wardCode: 'PED', total: 20, occupied: 14, tipoLeitoSus: 'pediatrico', andar: 2, setor: 'B', sexoDesignado: 'misto', managingOrganizationId: 'org-unit-pediatria' });
const BEDS_MATERNIDADE = generateBeds({ wardId: 'loc-ward-maternidade', wardCode: 'MAT', total: 30, occupied: 22, tipoLeitoSus: 'obstetrico', andar: 4, setor: 'B', sexoDesignado: 'F', managingOrganizationId: 'org-unit-maternidade' });
const BEDS_UTI_NEO = generateBeds({ wardId: 'loc-ward-uti-neo', wardCode: 'UTIN', total: 8, occupied: 6, tipoLeitoSus: 'uti_neo_ii', andar: 4, setor: 'B-Norte', sexoDesignado: 'misto', managingOrganizationId: 'org-unit-uti-neo' });
const BEDS_PS = generateBeds({ wardId: 'loc-ward-ps', wardCode: 'PS', total: 40, occupied: 30, housekeeping: 1, tipoLeitoSus: 'clinico', andar: 1, setor: 'C', sexoDesignado: 'misto', managingOrganizationId: 'org-unit-ps' });
const BEDS_CC = generateBeds({ wardId: 'loc-ward-cc', wardCode: 'CC', total: 6, occupied: 4, tipoLeitoSus: 'cirurgico', andar: 2, setor: 'C', sexoDesignado: 'misto', managingOrganizationId: 'org-unit-cc' });

export const LOCATIONS: Location[] = [
  ...BUILDINGS,
  ...FLOORS,
  ...WARDS,
  ...BEDS_UTI_ADULTO,
  ...BEDS_UCO,
  ...BEDS_UCI_ADULTO,
  ...BEDS_ALA_2A,
  ...BEDS_ALA_3B,
  ...BEDS_PEDIATRIA,
  ...BEDS_MATERNIDADE,
  ...BEDS_UTI_NEO,
  ...BEDS_PS,
  ...BEDS_CC,
];

// ---------------------------------------------------------------------------
// Especialidades (CFM 55 + multiprofissionais)
// ---------------------------------------------------------------------------

export const ESPECIALIDADES: Especialidade[] = [
  { id: 'esp-cardiologia', nome: 'Cardiologia', conselho: 'CRM', cfmCodigo: 'CAR', categoria: 'clinica', residenciaAnos: 3, descricao: 'Diagnostico e tratamento de doencas do sistema cardiovascular.', areasAtuacao: ['ecocardiografia', 'hemodinamica', 'eletrofisiologia'] },
  { id: 'esp-pneumologia', nome: 'Pneumologia', conselho: 'CRM', cfmCodigo: 'PNE', categoria: 'clinica', residenciaAnos: 2, descricao: 'Doencas do sistema respiratorio.', areasAtuacao: ['endoscopia respiratoria', 'pneumologia intervencionista'] },
  { id: 'esp-nefrologia', nome: 'Nefrologia', conselho: 'CRM', cfmCodigo: 'NEF', categoria: 'clinica', residenciaAnos: 2, descricao: 'Doencas renais e terapias de substituicao.', areasAtuacao: ['dialise', 'transplante renal'] },
  { id: 'esp-endocrino', nome: 'Endocrinologia', conselho: 'CRM', cfmCodigo: 'END', categoria: 'clinica', residenciaAnos: 2, descricao: 'Doencas do sistema endocrino e metabolico.', areasAtuacao: ['diabetes', 'tireoide'] },
  { id: 'esp-neurologia', nome: 'Neurologia', conselho: 'CRM', cfmCodigo: 'NEU', categoria: 'clinica', residenciaAnos: 3, descricao: 'Doencas do sistema nervoso.', areasAtuacao: ['AVC', 'epilepsia', 'doencas neuromusculares'] },
  { id: 'esp-gastro', nome: 'Gastroenterologia', conselho: 'CRM', cfmCodigo: 'GAS', categoria: 'clinica', residenciaAnos: 2, descricao: 'Doencas do aparelho digestivo.', areasAtuacao: ['endoscopia digestiva', 'hepatologia'] },
  { id: 'esp-infecto', nome: 'Infectologia', conselho: 'CRM', cfmCodigo: 'INF', categoria: 'clinica', residenciaAnos: 2, descricao: 'Doencas infecciosas e controle de infeccao hospitalar.', areasAtuacao: ['CCIH', 'HIV', 'antimicrobianos'] },
  { id: 'esp-cir-geral', nome: 'Cirurgia Geral', conselho: 'CRM', cfmCodigo: 'CGE', categoria: 'cirurgica', residenciaAnos: 3, descricao: 'Cirurgias do aparelho digestivo e parede abdominal.', areasAtuacao: ['videolaparoscopia', 'cirurgia de urgencia'] },
  { id: 'esp-ortopedia', nome: 'Ortopedia e Traumatologia', conselho: 'CRM', cfmCodigo: 'ORT', categoria: 'cirurgica', residenciaAnos: 3, descricao: 'Doencas e lesoes do aparelho locomotor.', areasAtuacao: ['trauma', 'coluna', 'quadril'] },
  { id: 'esp-urologia', nome: 'Urologia', conselho: 'CRM', cfmCodigo: 'URO', categoria: 'cirurgica', residenciaAnos: 3, descricao: 'Aparelho urinario e genital masculino.', areasAtuacao: ['endourologia', 'litotripsia'] },
  { id: 'esp-gineco', nome: 'Ginecologia e Obstetricia', conselho: 'CRM', cfmCodigo: 'GOB', categoria: 'cirurgica', residenciaAnos: 3, descricao: 'Saude da mulher e assistencia ao parto.', areasAtuacao: ['obstetricia', 'ginecologia'] },
  { id: 'esp-pediatria', nome: 'Pediatria', conselho: 'CRM', cfmCodigo: 'PED', categoria: 'pediatrica', residenciaAnos: 3, descricao: 'Saude da crianca e do adolescente.', areasAtuacao: ['neonatologia', 'emergencia pediatrica'] },
  { id: 'esp-intensiva', nome: 'Medicina Intensiva', conselho: 'CRM', cfmCodigo: 'MIN', categoria: 'critica', residenciaAnos: 2, descricao: 'Cuidado de pacientes criticos em UTI.', areasAtuacao: ['UTI adulto', 'UTI neonatal', 'UTI pediatrica'] },
  { id: 'esp-emergencia', nome: 'Medicina de Emergencia', conselho: 'CRM', cfmCodigo: 'MEM', categoria: 'critica', residenciaAnos: 3, descricao: 'Atendimento de emergencias clinicas e traumaticas.', areasAtuacao: ['trauma', 'triagem Manchester'] },
  { id: 'esp-clinica', nome: 'Clinica Medica', conselho: 'CRM', cfmCodigo: 'CLM', categoria: 'clinica', residenciaAnos: 2, descricao: 'Medicina interna hospitalar.', areasAtuacao: ['hospitalista', 'interconsulta'] },
  { id: 'esp-fisio', nome: 'Fisioterapia Hospitalar', conselho: 'CREFITO', categoria: 'multidisciplinar', descricao: 'Fisioterapia motora, respiratoria e reabilitacao hospitalar.', areasAtuacao: ['fisioterapia respiratoria', 'fisioterapia motora'] },
  { id: 'esp-nutricao', nome: 'Nutricao Clinica', conselho: 'CRN', categoria: 'multidisciplinar', descricao: 'Assistencia nutricional hospitalar.', areasAtuacao: ['TNE', 'TNP'] },
  { id: 'esp-farmacia', nome: 'Farmacia Clinica', conselho: 'CRF', categoria: 'multidisciplinar', descricao: 'Farmacia clinica, conciliacao medicamentosa e antimicrobial stewardship.', areasAtuacao: ['stewardship', 'conciliacao'] },
  { id: 'esp-social', nome: 'Servico Social', conselho: 'CRESS', categoria: 'multidisciplinar', descricao: 'Apoio social ao paciente e familia.', areasAtuacao: ['alta complexa', 'direitos'] },
];

// ---------------------------------------------------------------------------
// HealthcareServices (specialty operating in unit)
// ---------------------------------------------------------------------------

export const HEALTHCARE_SERVICES: HealthcareService[] = [
  // Medicina Intensiva
  { id: 'svc-intensiva-uti-adulto', nome: 'Medicina Intensiva em UTI Adulto', especialidadeId: 'esp-intensiva', unidadeIds: ['un-uti-adulto'], providedByOrganizationId: 'org-svc-intensiva', modeloCobertura: 'plantao_24_7_presencial', dimensionamento: { profissionaisPorLeitos: '1/10', regulamentacao: 'RDC 7/2010' }, ativo: true },
  { id: 'svc-intensiva-uti-neo', nome: 'Medicina Intensiva em UTI Neonatal', especialidadeId: 'esp-intensiva', unidadeIds: ['un-uti-neo'], providedByOrganizationId: 'org-svc-intensiva', modeloCobertura: 'plantao_24_7_presencial', dimensionamento: { profissionaisPorLeitos: '1/8', regulamentacao: 'RDC 7/2010' }, ativo: true },
  { id: 'svc-intensiva-uci', nome: 'Medicina Intensiva em UCI Adulto', especialidadeId: 'esp-intensiva', unidadeIds: ['un-uci-adulto'], providedByOrganizationId: 'org-svc-intensiva', modeloCobertura: 'diarista_horizontal', horarioInicio: '07:00', horarioFim: '19:00', ativo: true },
  // Cardiologia
  { id: 'svc-cardio-uti-adulto', nome: 'Cardiologia em UTI Adulto', especialidadeId: 'esp-cardiologia', unidadeIds: ['un-uti-adulto'], providedByOrganizationId: 'org-svc-cardiologia', modeloCobertura: 'plantao_24_7_presencial', ativo: true },
  { id: 'svc-cardio-uco', nome: 'Cardiologia em UCO', especialidadeId: 'esp-cardiologia', unidadeIds: ['un-uco'], providedByOrganizationId: 'org-svc-cardiologia', modeloCobertura: 'plantao_24_7_presencial', dimensionamento: { profissionaisPorLeitos: '1/8', regulamentacao: 'CFM 2.271/2020' }, ativo: true },
  { id: 'svc-cardio-ala-2a', nome: 'Cardiologia em Ala 2A', especialidadeId: 'esp-cardiologia', unidadeIds: ['un-ala-2a'], providedByOrganizationId: 'org-svc-cardiologia', modeloCobertura: 'diarista_horizontal', horarioInicio: '07:00', horarioFim: '19:00', ativo: true },
  // Pneumologia
  { id: 'svc-pneumo-ala-2a', nome: 'Pneumologia em Ala 2A', especialidadeId: 'esp-pneumologia', unidadeIds: ['un-ala-2a'], providedByOrganizationId: 'org-svc-pneumologia', modeloCobertura: 'diarista_horizontal', horarioInicio: '07:00', horarioFim: '19:00', ativo: true },
  { id: 'svc-pneumo-ps', nome: 'Pneumologia em Pronto Socorro', especialidadeId: 'esp-pneumologia', unidadeIds: ['un-ps'], providedByOrganizationId: 'org-svc-pneumologia', modeloCobertura: 'sobreaviso', ativo: true },
  { id: 'svc-pneumo-uti-adulto', nome: 'Pneumologia em UTI Adulto', especialidadeId: 'esp-pneumologia', unidadeIds: ['un-uti-adulto'], providedByOrganizationId: 'org-svc-pneumologia', modeloCobertura: 'sobreaviso', ativo: true },
  // Nefrologia
  { id: 'svc-nefro-uti-adulto', nome: 'Nefrologia em UTI Adulto', especialidadeId: 'esp-nefrologia', unidadeIds: ['un-uti-adulto', 'un-uci-adulto'], providedByOrganizationId: 'org-svc-nefrologia', modeloCobertura: 'sobreaviso', ativo: true },
  { id: 'svc-nefro-ala-2a', nome: 'Nefrologia em Ala 2A', especialidadeId: 'esp-nefrologia', unidadeIds: ['un-ala-2a'], providedByOrganizationId: 'org-svc-nefrologia', modeloCobertura: 'diarista_horizontal', horarioInicio: '07:00', horarioFim: '17:00', ativo: true },
  // Endocrino
  { id: 'svc-endo-ala-2a', nome: 'Endocrinologia em Ala 2A', especialidadeId: 'esp-endocrino', unidadeIds: ['un-ala-2a'], providedByOrganizationId: 'org-svc-endocrino', modeloCobertura: 'diarista_horizontal', horarioInicio: '08:00', horarioFim: '17:00', ativo: true },
  // Neurologia
  { id: 'svc-neuro-ala-2a', nome: 'Neurologia em Ala 2A', especialidadeId: 'esp-neurologia', unidadeIds: ['un-ala-2a'], providedByOrganizationId: 'org-svc-neurologia', modeloCobertura: 'diarista_horizontal', horarioInicio: '07:00', horarioFim: '17:00', ativo: true },
  { id: 'svc-neuro-ps', nome: 'Neurologia em Pronto Socorro', especialidadeId: 'esp-neurologia', unidadeIds: ['un-ps'], providedByOrganizationId: 'org-svc-neurologia', modeloCobertura: 'sobreaviso', ativo: true },
  // Gastro
  { id: 'svc-gastro-ala-2a', nome: 'Gastroenterologia em Ala 2A', especialidadeId: 'esp-gastro', unidadeIds: ['un-ala-2a'], providedByOrganizationId: 'org-svc-gastro', modeloCobertura: 'diarista_horizontal', horarioInicio: '08:00', horarioFim: '17:00', ativo: true },
  // Infecto
  { id: 'svc-infecto-global', nome: 'Infectologia (interconsultas + CCIH)', especialidadeId: 'esp-infecto', unidadeIds: ['un-uti-adulto', 'un-uci-adulto', 'un-ala-2a', 'un-ala-3b', 'un-ps'], providedByOrganizationId: 'org-svc-infecto', modeloCobertura: 'sobreaviso', ativo: true },
  // Cirurgias
  { id: 'svc-cir-geral-ala-3b', nome: 'Cirurgia Geral em Ala 3B', especialidadeId: 'esp-cir-geral', unidadeIds: ['un-ala-3b'], providedByOrganizationId: 'org-svc-cir-geral', modeloCobertura: 'diarista_horizontal', horarioInicio: '07:00', horarioFim: '19:00', ativo: true },
  { id: 'svc-cir-geral-cc', nome: 'Cirurgia Geral em Centro Cirurgico', especialidadeId: 'esp-cir-geral', unidadeIds: ['un-cc'], providedByOrganizationId: 'org-svc-cir-geral', modeloCobertura: 'plantao_24_7_presencial', ativo: true },
  { id: 'svc-ortopedia-ala-3b', nome: 'Ortopedia em Ala 3B', especialidadeId: 'esp-ortopedia', unidadeIds: ['un-ala-3b'], providedByOrganizationId: 'org-svc-ortopedia', modeloCobertura: 'diarista_horizontal', horarioInicio: '07:00', horarioFim: '19:00', ativo: true },
  { id: 'svc-ortopedia-ps', nome: 'Ortopedia em Pronto Socorro', especialidadeId: 'esp-ortopedia', unidadeIds: ['un-ps'], providedByOrganizationId: 'org-svc-ortopedia', modeloCobertura: 'sobreaviso', ativo: true },
  { id: 'svc-urologia-ala-3b', nome: 'Urologia em Ala 3B', especialidadeId: 'esp-urologia', unidadeIds: ['un-ala-3b'], providedByOrganizationId: 'org-svc-urologia', modeloCobertura: 'diarista_horizontal', horarioInicio: '08:00', horarioFim: '17:00', ativo: true },
  // Materno-infantil
  { id: 'svc-gineco-maternidade', nome: 'Ginecologia-Obstetricia em Maternidade', especialidadeId: 'esp-gineco', unidadeIds: ['un-maternidade'], providedByOrganizationId: 'org-svc-gineco', modeloCobertura: 'plantao_24_7_presencial', ativo: true },
  { id: 'svc-pediatria-ped', nome: 'Pediatria em Enfermaria Pediatrica', especialidadeId: 'esp-pediatria', unidadeIds: ['un-pediatria'], providedByOrganizationId: 'org-svc-pediatria', modeloCobertura: 'plantao_24_7_presencial', ativo: true },
  { id: 'svc-pediatria-ps', nome: 'Pediatria em Pronto Socorro', especialidadeId: 'esp-pediatria', unidadeIds: ['un-ps'], providedByOrganizationId: 'org-svc-pediatria', modeloCobertura: 'plantao_24_7_presencial', ativo: true },
  // Emergencia
  { id: 'svc-emerg-ps', nome: 'Medicina de Emergencia em Pronto Socorro', especialidadeId: 'esp-emergencia', unidadeIds: ['un-ps'], providedByOrganizationId: 'org-svc-emergencia', modeloCobertura: 'plantao_24_7_presencial', dimensionamento: { profissionaisPorLeitos: '1/15', regulamentacao: 'CFM 2.147/2016' }, ativo: true },
  // Clinica Medica
  { id: 'svc-clinica-ala-2a', nome: 'Clinica Medica em Ala 2A', especialidadeId: 'esp-clinica', unidadeIds: ['un-ala-2a'], providedByOrganizationId: 'org-svc-clinica', modeloCobertura: 'hospitalista', ativo: true },
  // Multiprofissional
  { id: 'svc-fisio-hospital', nome: 'Fisioterapia Hospitalar', especialidadeId: 'esp-fisio', unidadeIds: ['un-uti-adulto', 'un-uci-adulto', 'un-ala-2a', 'un-ala-3b', 'un-pediatria'], providedByOrganizationId: 'org-svc-fisio', modeloCobertura: 'diarista_horizontal', horarioInicio: '07:00', horarioFim: '19:00', ativo: true },
  { id: 'svc-nutricao-hospital', nome: 'Nutricao Clinica', especialidadeId: 'esp-nutricao', unidadeIds: ['un-uti-adulto', 'un-uci-adulto', 'un-ala-2a', 'un-ala-3b', 'un-pediatria', 'un-maternidade'], providedByOrganizationId: 'org-svc-nutricao', modeloCobertura: 'diarista_horizontal', horarioInicio: '07:00', horarioFim: '17:00', ativo: true },
  { id: 'svc-farmacia-clinica', nome: 'Farmacia Clinica', especialidadeId: 'esp-farmacia', unidadeIds: ['un-uti-adulto', 'un-uci-adulto', 'un-ala-2a', 'un-ala-3b'], providedByOrganizationId: 'org-svc-farmacia', modeloCobertura: 'diarista_horizontal', horarioInicio: '08:00', horarioFim: '18:00', ativo: true },
  { id: 'svc-social-hospital', nome: 'Servico Social Hospitalar', especialidadeId: 'esp-social', unidadeIds: ['un-ala-2a', 'un-ala-3b', 'un-pediatria', 'un-maternidade', 'un-ps'], providedByOrganizationId: 'org-svc-social', modeloCobertura: 'diarista_horizontal', horarioInicio: '08:00', horarioFim: '17:00', ativo: true },
];

// ---------------------------------------------------------------------------
// UnidadesAssistenciais
// ---------------------------------------------------------------------------

export const UNIDADES_ASSISTENCIAIS: UnidadeAssistencial[] = [
  {
    id: 'un-uti-adulto',
    nome: 'UTI Adulto',
    codigo: 'UTIA',
    tipo: 'uti_adulto',
    subtipo: 'tipo_ii',
    nivelCuidado: 'intensivo',
    locationId: 'loc-ward-uti-adulto',
    organizationId: 'org-unit-uti-adulto',
    capacidadeTotal: 12,
    leitoIds: BEDS_UTI_ADULTO.map((b) => b.id),
    horarioFuncionamento: '24h',
    criticidade: 'critica',
    regulamentacoes: ['ANVISA RDC 7/2010', 'CFM 2.271/2020'],
    coordenadorId: 'prof-silva-marcos',
    responsavelTecnicoId: 'prof-silva-marcos',
    healthcareServiceIds: ['svc-intensiva-uti-adulto', 'svc-cardio-uti-adulto', 'svc-pneumo-uti-adulto', 'svc-nefro-uti-adulto', 'svc-infecto-global', 'svc-fisio-hospital', 'svc-nutricao-hospital', 'svc-farmacia-clinica'],
    criadoEm: '2024-01-15T00:00:00-03:00',
    atualizadoEm: NOW,
  },
  {
    id: 'un-uco',
    nome: 'UCO - Unidade Coronariana',
    codigo: 'UCO',
    tipo: 'uti_coronariana',
    nivelCuidado: 'intensivo',
    locationId: 'loc-ward-uco',
    organizationId: 'org-unit-uco',
    capacidadeTotal: 8,
    leitoIds: BEDS_UCO.map((b) => b.id),
    horarioFuncionamento: '24h',
    criticidade: 'critica',
    regulamentacoes: ['ANVISA RDC 7/2010', 'CFM 2.271/2020'],
    coordenadorId: 'prof-rocha-aline',
    responsavelTecnicoId: 'prof-rocha-aline',
    healthcareServiceIds: ['svc-cardio-uco'],
    criadoEm: '2024-01-15T00:00:00-03:00',
    atualizadoEm: NOW,
  },
  {
    id: 'un-uci-adulto',
    nome: 'UCI Adulto',
    codigo: 'UCIA',
    tipo: 'uci_adulto',
    nivelCuidado: 'semi_intensivo',
    locationId: 'loc-ward-uci-adulto',
    organizationId: 'org-unit-uci-adulto',
    capacidadeTotal: 10,
    leitoIds: BEDS_UCI_ADULTO.map((b) => b.id),
    horarioFuncionamento: '24h',
    criticidade: 'alta',
    regulamentacoes: ['ANVISA RDC 7/2010'],
    coordenadorId: 'prof-tavares-renata',
    healthcareServiceIds: ['svc-intensiva-uci', 'svc-nefro-uti-adulto', 'svc-infecto-global', 'svc-fisio-hospital', 'svc-nutricao-hospital', 'svc-farmacia-clinica'],
    criadoEm: '2024-01-15T00:00:00-03:00',
    atualizadoEm: NOW,
  },
  {
    id: 'un-ala-2a',
    nome: 'Ala 2A - Clinica Medica',
    codigo: 'A2A',
    tipo: 'internacao_clinica',
    nivelCuidado: 'intermediario',
    locationId: 'loc-ward-ala-2a',
    organizationId: 'org-unit-ala-2a',
    capacidadeTotal: 30,
    leitoIds: BEDS_ALA_2A.map((b) => b.id),
    horarioFuncionamento: '24h',
    criticidade: 'media',
    regulamentacoes: ['ANVISA RDC 50/2002', 'COFEN 543/2017'],
    coordenadorId: 'prof-cardoso-helena',
    healthcareServiceIds: ['svc-clinica-ala-2a', 'svc-cardio-ala-2a', 'svc-pneumo-ala-2a', 'svc-nefro-ala-2a', 'svc-endo-ala-2a', 'svc-neuro-ala-2a', 'svc-gastro-ala-2a', 'svc-infecto-global', 'svc-fisio-hospital', 'svc-nutricao-hospital', 'svc-farmacia-clinica', 'svc-social-hospital'],
    criadoEm: '2024-01-15T00:00:00-03:00',
    atualizadoEm: NOW,
  },
  {
    id: 'un-ala-3b',
    nome: 'Ala 3B - Clinica Cirurgica',
    codigo: 'A3B',
    tipo: 'internacao_cirurgica',
    nivelCuidado: 'intermediario',
    locationId: 'loc-ward-ala-3b',
    organizationId: 'org-unit-ala-3b',
    capacidadeTotal: 25,
    leitoIds: BEDS_ALA_3B.map((b) => b.id),
    horarioFuncionamento: '24h',
    criticidade: 'media',
    regulamentacoes: ['ANVISA RDC 50/2002', 'COFEN 543/2017'],
    coordenadorId: 'prof-martins-paulo',
    healthcareServiceIds: ['svc-cir-geral-ala-3b', 'svc-ortopedia-ala-3b', 'svc-urologia-ala-3b', 'svc-infecto-global', 'svc-fisio-hospital', 'svc-nutricao-hospital', 'svc-farmacia-clinica', 'svc-social-hospital'],
    criadoEm: '2024-01-15T00:00:00-03:00',
    atualizadoEm: NOW,
  },
  {
    id: 'un-pediatria',
    nome: 'Pediatria',
    codigo: 'PED',
    tipo: 'internacao_pediatrica',
    nivelCuidado: 'intermediario',
    locationId: 'loc-ward-pediatria',
    organizationId: 'org-unit-pediatria',
    capacidadeTotal: 20,
    leitoIds: BEDS_PEDIATRIA.map((b) => b.id),
    horarioFuncionamento: '24h',
    criticidade: 'alta',
    regulamentacoes: ['ANVISA RDC 36/2013', 'COFEN 543/2017'],
    coordenadorId: 'prof-almeida-camila',
    healthcareServiceIds: ['svc-pediatria-ped', 'svc-fisio-hospital', 'svc-nutricao-hospital', 'svc-social-hospital'],
    criadoEm: '2024-01-15T00:00:00-03:00',
    atualizadoEm: NOW,
  },
  {
    id: 'un-maternidade',
    nome: 'Maternidade',
    codigo: 'MAT',
    tipo: 'internacao_obstetrica',
    nivelCuidado: 'intermediario',
    locationId: 'loc-ward-maternidade',
    organizationId: 'org-unit-maternidade',
    capacidadeTotal: 30,
    leitoIds: BEDS_MATERNIDADE.map((b) => b.id),
    horarioFuncionamento: '24h',
    criticidade: 'alta',
    regulamentacoes: ['ANVISA RDC 36/2013'],
    coordenadorId: 'prof-figueiredo-beatriz',
    healthcareServiceIds: ['svc-gineco-maternidade', 'svc-nutricao-hospital', 'svc-social-hospital'],
    criadoEm: '2024-01-15T00:00:00-03:00',
    atualizadoEm: NOW,
  },
  {
    id: 'un-uti-neo',
    nome: 'UTI Neonatal',
    codigo: 'UTIN',
    tipo: 'uti_neonatal',
    subtipo: 'tipo_ii',
    nivelCuidado: 'intensivo',
    locationId: 'loc-ward-uti-neo',
    organizationId: 'org-unit-uti-neo',
    capacidadeTotal: 8,
    leitoIds: BEDS_UTI_NEO.map((b) => b.id),
    horarioFuncionamento: '24h',
    criticidade: 'critica',
    regulamentacoes: ['ANVISA RDC 7/2010', 'ANVISA RDC 36/2013'],
    coordenadorId: 'prof-pereira-luiza',
    responsavelTecnicoId: 'prof-pereira-luiza',
    healthcareServiceIds: ['svc-intensiva-uti-neo'],
    criadoEm: '2024-01-15T00:00:00-03:00',
    atualizadoEm: NOW,
  },
  {
    id: 'un-ps',
    nome: 'Pronto Socorro',
    codigo: 'PS',
    tipo: 'pronto_socorro',
    nivelCuidado: 'alta_dependencia',
    locationId: 'loc-ward-ps',
    organizationId: 'org-unit-ps',
    capacidadeTotal: 40,
    leitoIds: BEDS_PS.map((b) => b.id),
    horarioFuncionamento: '24h',
    criticidade: 'critica',
    regulamentacoes: ['CFM 2.147/2016', 'ANVISA RDC 50/2002'],
    coordenadorId: 'prof-nogueira-bruno',
    responsavelTecnicoId: 'prof-nogueira-bruno',
    healthcareServiceIds: ['svc-emerg-ps', 'svc-pediatria-ps', 'svc-ortopedia-ps', 'svc-neuro-ps', 'svc-pneumo-ps', 'svc-infecto-global', 'svc-social-hospital'],
    criadoEm: '2024-01-15T00:00:00-03:00',
    atualizadoEm: NOW,
  },
  {
    id: 'un-cc',
    nome: 'Centro Cirurgico',
    codigo: 'CC',
    tipo: 'centro_cirurgico',
    nivelCuidado: 'intensivo',
    locationId: 'loc-ward-cc',
    organizationId: 'org-unit-cc',
    capacidadeTotal: 6,
    leitoIds: BEDS_CC.map((b) => b.id),
    horarioFuncionamento: '24h',
    criticidade: 'alta',
    regulamentacoes: ['ANVISA RDC 50/2002'],
    coordenadorId: 'prof-martins-paulo',
    healthcareServiceIds: ['svc-cir-geral-cc'],
    criadoEm: '2024-01-15T00:00:00-03:00',
    atualizadoEm: NOW,
  },
];

// ---------------------------------------------------------------------------
// ProfissionaisSaude
// ---------------------------------------------------------------------------

export const PROFISSIONAIS: ProfissionalSaude[] = [
  // Diretoria
  { id: 'prof-diretor-clinico', nome: 'Dr. Eduardo Vasconcelos', cpf: '111.111.111-11', dataNascimento: '1968-03-14', categoria: 'diretor_clinico', registros: [{ conselho: 'CRM', numero: '45321', uf: 'SP', rqeEspecialidadeIds: ['esp-clinica'] }], email: 'eduardo.vasconcelos@velya.health', ativo: true, dataAdmissao: '2018-02-01' },
  { id: 'prof-diretor-tecnico', nome: 'Dra. Marcia Pimentel', cpf: '112.222.333-44', dataNascimento: '1970-07-22', categoria: 'diretor_tecnico', registros: [{ conselho: 'CRM', numero: '52119', uf: 'SP', rqeEspecialidadeIds: ['esp-cir-geral'] }], email: 'marcia.pimentel@velya.health', ativo: true, dataAdmissao: '2019-08-01' },
  // Medicos - Intensivistas / Cardio / Pneumo
  { id: 'prof-silva-marcos', nome: 'Dr. Marcos Silva', cpf: '123.456.789-01', dataNascimento: '1975-05-10', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '145332', uf: 'SP', rqeEspecialidadeIds: ['esp-intensiva', 'esp-cardiologia'] }], email: 'marcos.silva@velya.health', telefone: '(11) 98765-4321', ramal: '2010', ativo: true, dataAdmissao: '2020-03-15' },
  { id: 'prof-rocha-aline', nome: 'Dra. Aline Rocha', cpf: '234.567.890-12', dataNascimento: '1978-09-03', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '156789', uf: 'SP', rqeEspecialidadeIds: ['esp-cardiologia'] }], email: 'aline.rocha@velya.health', ramal: '2015', ativo: true, dataAdmissao: '2019-06-01' },
  { id: 'prof-tavares-renata', nome: 'Dra. Renata Tavares', cpf: '345.678.901-23', dataNascimento: '1980-11-18', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '167543', uf: 'SP', rqeEspecialidadeIds: ['esp-intensiva'] }], email: 'renata.tavares@velya.health', ramal: '2020', ativo: true, dataAdmissao: '2021-01-10' },
  { id: 'prof-costa-fernando', nome: 'Dr. Fernando Costa', cpf: '456.789.012-34', dataNascimento: '1972-02-25', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '132456', uf: 'SP', rqeEspecialidadeIds: ['esp-intensiva'] }], email: 'fernando.costa@velya.health', ativo: true, dataAdmissao: '2017-05-20' },
  { id: 'prof-dias-helio', nome: 'Dr. Helio Dias', cpf: '567.890.123-45', dataNascimento: '1982-06-14', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '178912', uf: 'SP', rqeEspecialidadeIds: ['esp-pneumologia'] }], email: 'helio.dias@velya.health', ativo: true, dataAdmissao: '2022-08-15' },
  { id: 'prof-andrade-rosa', nome: 'Dra. Rosa Andrade', cpf: '678.901.234-56', dataNascimento: '1985-10-30', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '189234', uf: 'SP', rqeEspecialidadeIds: ['esp-nefrologia'] }], email: 'rosa.andrade@velya.health', ativo: true, dataAdmissao: '2023-02-01' },
  { id: 'prof-barros-tiago', nome: 'Dr. Tiago Barros', cpf: '789.012.345-67', dataNascimento: '1977-08-12', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '145678', uf: 'SP', rqeEspecialidadeIds: ['esp-endocrino'] }], email: 'tiago.barros@velya.health', ativo: true, dataAdmissao: '2019-04-22' },
  { id: 'prof-gomes-patricia', nome: 'Dra. Patricia Gomes', cpf: '890.123.456-78', dataNascimento: '1981-12-05', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '167890', uf: 'SP', rqeEspecialidadeIds: ['esp-neurologia'] }], email: 'patricia.gomes@velya.health', ativo: true, dataAdmissao: '2020-11-10' },
  { id: 'prof-cardoso-helena', nome: 'Dra. Helena Cardoso', cpf: '901.234.567-89', dataNascimento: '1974-04-17', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '134567', uf: 'SP', rqeEspecialidadeIds: ['esp-clinica', 'esp-gastro'] }], email: 'helena.cardoso@velya.health', ativo: true, dataAdmissao: '2018-09-01' },
  { id: 'prof-lima-ricardo', nome: 'Dr. Ricardo Lima', cpf: '012.345.678-90', dataNascimento: '1979-01-08', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '156234', uf: 'SP', rqeEspecialidadeIds: ['esp-infecto'] }], email: 'ricardo.lima@velya.health', ativo: true, dataAdmissao: '2020-07-15' },
  { id: 'prof-martins-paulo', nome: 'Dr. Paulo Martins', cpf: '111.234.567-80', dataNascimento: '1971-05-20', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '128765', uf: 'SP', rqeEspecialidadeIds: ['esp-cir-geral'] }], email: 'paulo.martins@velya.health', ativo: true, dataAdmissao: '2017-03-10' },
  { id: 'prof-sousa-gabriel', nome: 'Dr. Gabriel Sousa', cpf: '222.345.678-91', dataNascimento: '1983-07-27', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '178345', uf: 'SP', rqeEspecialidadeIds: ['esp-ortopedia'] }], email: 'gabriel.sousa@velya.health', ativo: true, dataAdmissao: '2022-01-20' },
  { id: 'prof-melo-diego', nome: 'Dr. Diego Melo', cpf: '333.456.789-02', dataNascimento: '1984-11-11', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '182145', uf: 'SP', rqeEspecialidadeIds: ['esp-urologia'] }], email: 'diego.melo@velya.health', ativo: true, dataAdmissao: '2022-09-05' },
  { id: 'prof-figueiredo-beatriz', nome: 'Dra. Beatriz Figueiredo', cpf: '444.567.890-13', dataNascimento: '1976-03-30', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '142876', uf: 'SP', rqeEspecialidadeIds: ['esp-gineco'] }], email: 'beatriz.figueiredo@velya.health', ativo: true, dataAdmissao: '2019-02-14' },
  { id: 'prof-almeida-camila', nome: 'Dra. Camila Almeida', cpf: '555.678.901-24', dataNascimento: '1980-06-22', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '159873', uf: 'SP', rqeEspecialidadeIds: ['esp-pediatria'] }], email: 'camila.almeida@velya.health', ativo: true, dataAdmissao: '2020-05-30' },
  { id: 'prof-pereira-luiza', nome: 'Dra. Luiza Pereira', cpf: '666.789.012-35', dataNascimento: '1973-09-15', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '136541', uf: 'SP', rqeEspecialidadeIds: ['esp-pediatria', 'esp-intensiva'] }], email: 'luiza.pereira@velya.health', ativo: true, dataAdmissao: '2018-11-01' },
  { id: 'prof-nogueira-bruno', nome: 'Dr. Bruno Nogueira', cpf: '777.890.123-46', dataNascimento: '1978-12-03', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '154789', uf: 'SP', rqeEspecialidadeIds: ['esp-emergencia'] }], email: 'bruno.nogueira@velya.health', ativo: true, dataAdmissao: '2019-07-18' },
  // Enfermeiros
  { id: 'prof-enf-ana', nome: 'Ana Paula Ferreira', cpf: '811.000.001-11', dataNascimento: '1986-02-08', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '234567', uf: 'SP' }], email: 'ana.ferreira@velya.health', ativo: true, dataAdmissao: '2021-03-01' },
  { id: 'prof-enf-beatriz', nome: 'Beatriz Ramos', cpf: '812.000.002-12', dataNascimento: '1988-05-14', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '245678', uf: 'SP' }], email: 'beatriz.ramos@velya.health', ativo: true, dataAdmissao: '2022-01-15' },
  { id: 'prof-enf-carla', nome: 'Carla Mendes', cpf: '813.000.003-13', dataNascimento: '1985-08-21', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '256789', uf: 'SP' }], email: 'carla.mendes@velya.health', ativo: true, dataAdmissao: '2020-11-12' },
  { id: 'prof-enf-daniel', nome: 'Daniel Oliveira', cpf: '814.000.004-14', dataNascimento: '1984-11-02', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '267890', uf: 'SP' }], email: 'daniel.oliveira@velya.health', ativo: true, dataAdmissao: '2019-09-20' },
  { id: 'prof-enf-elaine', nome: 'Elaine Santos', cpf: '815.000.005-15', dataNascimento: '1987-01-30', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '278901', uf: 'SP' }], email: 'elaine.santos@velya.health', ativo: true, dataAdmissao: '2021-05-10' },
  { id: 'prof-enf-fernanda', nome: 'Fernanda Lopes', cpf: '816.000.006-16', dataNascimento: '1983-06-17', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '289012', uf: 'SP' }], email: 'fernanda.lopes@velya.health', ativo: true, dataAdmissao: '2019-02-25' },
  { id: 'prof-enf-gustavo', nome: 'Gustavo Alves', cpf: '817.000.007-17', dataNascimento: '1989-04-23', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '290123', uf: 'SP' }], email: 'gustavo.alves@velya.health', ativo: true, dataAdmissao: '2022-08-01' },
  { id: 'prof-enf-helena', nome: 'Helena Pinto', cpf: '818.000.008-18', dataNascimento: '1986-10-09', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '301234', uf: 'SP' }], email: 'helena.pinto@velya.health', ativo: true, dataAdmissao: '2020-04-05' },
  // Tecnicos de enfermagem
  { id: 'prof-tec-isabel', nome: 'Isabel Moreira', cpf: '821.000.009-19', dataNascimento: '1990-07-11', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '312345', uf: 'SP' }], email: 'isabel.moreira@velya.health', ativo: true, dataAdmissao: '2022-02-14' },
  { id: 'prof-tec-joao', nome: 'Joao Batista', cpf: '822.000.010-20', dataNascimento: '1988-09-25', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '323456', uf: 'SP' }], email: 'joao.batista@velya.health', ativo: true, dataAdmissao: '2021-06-18' },
  { id: 'prof-tec-karla', nome: 'Karla Vieira', cpf: '823.000.011-21', dataNascimento: '1991-12-13', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '334567', uf: 'SP' }], email: 'karla.vieira@velya.health', ativo: true, dataAdmissao: '2023-03-20' },
  { id: 'prof-tec-lucas', nome: 'Lucas Teixeira', cpf: '824.000.012-22', dataNascimento: '1989-03-07', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '345678', uf: 'SP' }], email: 'lucas.teixeira@velya.health', ativo: true, dataAdmissao: '2021-09-12' },
  { id: 'prof-tec-mariana', nome: 'Mariana Ribeiro', cpf: '825.000.013-23', dataNascimento: '1992-05-28', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '356789', uf: 'SP' }], email: 'mariana.ribeiro@velya.health', ativo: true, dataAdmissao: '2023-07-01' },
  { id: 'prof-tec-nelson', nome: 'Nelson Cunha', cpf: '826.000.014-24', dataNascimento: '1987-02-16', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '367890', uf: 'SP' }], email: 'nelson.cunha@velya.health', ativo: true, dataAdmissao: '2020-08-22' },
  { id: 'prof-tec-olivia', nome: 'Olivia Freitas', cpf: '827.000.015-25', dataNascimento: '1990-10-04', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '378901', uf: 'SP' }], email: 'olivia.freitas@velya.health', ativo: true, dataAdmissao: '2022-04-15' },
  { id: 'prof-tec-pedro', nome: 'Pedro Henrique Dias', cpf: '828.000.016-26', dataNascimento: '1991-08-19', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '389012', uf: 'SP' }], email: 'pedro.dias@velya.health', ativo: true, dataAdmissao: '2022-11-30' },
  { id: 'prof-tec-quiteria', nome: 'Quiteria Souza', cpf: '829.000.017-27', dataNascimento: '1986-06-05', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '390123', uf: 'SP' }], email: 'quiteria.souza@velya.health', ativo: true, dataAdmissao: '2020-10-08' },
  { id: 'prof-tec-rafael', nome: 'Rafael Macedo', cpf: '830.000.018-28', dataNascimento: '1993-01-22', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '401234', uf: 'SP' }], email: 'rafael.macedo@velya.health', ativo: true, dataAdmissao: '2024-02-12' },
  { id: 'prof-tec-sandra', nome: 'Sandra Barbosa', cpf: '831.000.019-29', dataNascimento: '1988-11-14', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '412345', uf: 'SP' }], email: 'sandra.barbosa@velya.health', ativo: true, dataAdmissao: '2021-07-26' },
  { id: 'prof-tec-tiago', nome: 'Tiago Rezende', cpf: '832.000.020-30', dataNascimento: '1992-09-17', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '423456', uf: 'SP' }], email: 'tiago.rezende@velya.health', ativo: true, dataAdmissao: '2023-05-04' },
  // Multiprofissional
  { id: 'prof-fisio-victor', nome: 'Victor Nascimento', cpf: '841.000.021-31', dataNascimento: '1987-04-09', categoria: 'fisioterapeuta', registros: [{ conselho: 'CREFITO', numero: 'F-45678', uf: 'SP' }], email: 'victor.nascimento@velya.health', ativo: true, dataAdmissao: '2021-02-08' },
  { id: 'prof-fisio-wagner', nome: 'Wagner Moraes', cpf: '842.000.022-32', dataNascimento: '1985-07-24', categoria: 'fisioterapeuta', registros: [{ conselho: 'CREFITO', numero: 'F-56789', uf: 'SP' }], email: 'wagner.moraes@velya.health', ativo: true, dataAdmissao: '2020-06-15' },
  { id: 'prof-fisio-yara', nome: 'Yara Nunes', cpf: '843.000.023-33', dataNascimento: '1989-12-02', categoria: 'fisioterapeuta', registros: [{ conselho: 'CREFITO', numero: 'F-67890', uf: 'SP' }], email: 'yara.nunes@velya.health', ativo: true, dataAdmissao: '2022-03-10' },
  { id: 'prof-nut-zara', nome: 'Zara Coelho', cpf: '844.000.024-34', dataNascimento: '1988-03-15', categoria: 'nutricionista', registros: [{ conselho: 'CRN', numero: '12345', uf: 'SP' }], email: 'zara.coelho@velya.health', ativo: true, dataAdmissao: '2021-04-19' },
  { id: 'prof-nut-andre', nome: 'Andre Lacerda', cpf: '845.000.025-35', dataNascimento: '1990-08-28', categoria: 'nutricionista', registros: [{ conselho: 'CRN', numero: '23456', uf: 'SP' }], email: 'andre.lacerda@velya.health', ativo: true, dataAdmissao: '2022-07-02' },
  { id: 'prof-farm-bruna', nome: 'Bruna Salgado', cpf: '846.000.026-36', dataNascimento: '1986-05-19', categoria: 'farmaceutico', registros: [{ conselho: 'CRF', numero: '34567', uf: 'SP' }], email: 'bruna.salgado@velya.health', ativo: true, dataAdmissao: '2020-09-07' },
  { id: 'prof-farm-caio', nome: 'Caio Barreto', cpf: '847.000.027-37', dataNascimento: '1984-10-11', categoria: 'farmaceutico', registros: [{ conselho: 'CRF', numero: '45678', uf: 'SP' }], email: 'caio.barreto@velya.health', ativo: true, dataAdmissao: '2019-12-03' },
  { id: 'prof-social-diana', nome: 'Diana Queiroz', cpf: '848.000.028-38', dataNascimento: '1982-11-06', categoria: 'assistente_social', registros: [{ conselho: 'CRESS', numero: '56789', uf: 'SP' }], email: 'diana.queiroz@velya.health', ativo: true, dataAdmissao: '2018-06-21' },

  // ---------- EXPANSION BLOCK: extra medicos (25) ----------
  // Cardiologia (+3)
  { id: 'prof-m-cardio-01', nome: 'Dr. Heitor Bandeira', cpf: '101.100.001-01', dataNascimento: '1979-02-11', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201001', uf: 'SP', rqeEspecialidadeIds: ['esp-cardiologia'] }], email: 'heitor.bandeira@velya.health', ativo: true, dataAdmissao: '2020-06-10' },
  { id: 'prof-m-cardio-02', nome: 'Dra. Leticia Vidal', cpf: '101.100.002-02', dataNascimento: '1982-10-04', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201002', uf: 'SP', rqeEspecialidadeIds: ['esp-cardiologia'] }], email: 'leticia.vidal@velya.health', ativo: true, dataAdmissao: '2021-03-18' },
  { id: 'prof-m-cardio-03', nome: 'Dr. Sergio Caldeira', cpf: '101.100.003-03', dataNascimento: '1976-06-23', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201003', uf: 'SP', rqeEspecialidadeIds: ['esp-cardiologia'] }], email: 'sergio.caldeira@velya.health', ativo: true, dataAdmissao: '2018-11-02' },
  // Pneumologia (+3)
  { id: 'prof-m-pneumo-01', nome: 'Dra. Talita Amorim', cpf: '101.100.004-04', dataNascimento: '1983-01-27', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201004', uf: 'SP', rqeEspecialidadeIds: ['esp-pneumologia'] }], email: 'talita.amorim@velya.health', ativo: true, dataAdmissao: '2021-09-14' },
  { id: 'prof-m-pneumo-02', nome: 'Dr. Felipe Monteiro', cpf: '101.100.005-05', dataNascimento: '1978-08-08', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201005', uf: 'SP', rqeEspecialidadeIds: ['esp-pneumologia', 'esp-intensiva'] }], email: 'felipe.monteiro@velya.health', ativo: true, dataAdmissao: '2020-01-20' },
  { id: 'prof-m-pneumo-03', nome: 'Dra. Vanessa Paiva', cpf: '101.100.006-06', dataNascimento: '1985-11-30', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201006', uf: 'SP', rqeEspecialidadeIds: ['esp-pneumologia'] }], email: 'vanessa.paiva@velya.health', ativo: true, dataAdmissao: '2023-02-06' },
  // Nefrologia (+3)
  { id: 'prof-m-nefro-01', nome: 'Dr. Ivan Raposo', cpf: '101.100.007-07', dataNascimento: '1977-04-19', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201007', uf: 'SP', rqeEspecialidadeIds: ['esp-nefrologia'] }], email: 'ivan.raposo@velya.health', ativo: true, dataAdmissao: '2019-08-12' },
  { id: 'prof-m-nefro-02', nome: 'Dra. Juliana Assis', cpf: '101.100.008-08', dataNascimento: '1984-07-02', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201008', uf: 'SP', rqeEspecialidadeIds: ['esp-nefrologia'] }], email: 'juliana.assis@velya.health', ativo: true, dataAdmissao: '2022-04-25' },
  { id: 'prof-m-nefro-03', nome: 'Dr. Otavio Mourao', cpf: '101.100.009-09', dataNascimento: '1980-12-14', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201009', uf: 'SP', rqeEspecialidadeIds: ['esp-nefrologia'] }], email: 'otavio.mourao@velya.health', ativo: true, dataAdmissao: '2020-10-05' },
  // Endocrinologia (+3)
  { id: 'prof-m-endo-01', nome: 'Dra. Sabrina Grossi', cpf: '101.100.010-10', dataNascimento: '1981-03-09', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201010', uf: 'SP', rqeEspecialidadeIds: ['esp-endocrino'] }], email: 'sabrina.grossi@velya.health', ativo: true, dataAdmissao: '2020-02-17' },
  { id: 'prof-m-endo-02', nome: 'Dr. Heitor Miranda', cpf: '101.100.011-11', dataNascimento: '1979-09-21', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201011', uf: 'SP', rqeEspecialidadeIds: ['esp-endocrino'] }], email: 'heitor.miranda@velya.health', ativo: true, dataAdmissao: '2019-05-23' },
  { id: 'prof-m-endo-03', nome: 'Dra. Paloma Tavares', cpf: '101.100.012-12', dataNascimento: '1986-06-01', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201012', uf: 'SP', rqeEspecialidadeIds: ['esp-endocrino'] }], email: 'paloma.tavares@velya.health', ativo: true, dataAdmissao: '2023-06-09' },
  // Neurologia (+3)
  { id: 'prof-m-neuro-01', nome: 'Dr. Leandro Fiuza', cpf: '101.100.013-13', dataNascimento: '1975-10-28', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201013', uf: 'SP', rqeEspecialidadeIds: ['esp-neurologia'] }], email: 'leandro.fiuza@velya.health', ativo: true, dataAdmissao: '2018-07-30' },
  { id: 'prof-m-neuro-02', nome: 'Dra. Clara Bessa', cpf: '101.100.014-14', dataNascimento: '1983-05-05', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201014', uf: 'SP', rqeEspecialidadeIds: ['esp-neurologia'] }], email: 'clara.bessa@velya.health', ativo: true, dataAdmissao: '2021-11-14' },
  { id: 'prof-m-neuro-03', nome: 'Dr. Mauricio Brant', cpf: '101.100.015-15', dataNascimento: '1978-01-18', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201015', uf: 'SP', rqeEspecialidadeIds: ['esp-neurologia'] }], email: 'mauricio.brant@velya.health', ativo: true, dataAdmissao: '2019-09-03' },
  // Gastroenterologia (+2)
  { id: 'prof-m-gastro-01', nome: 'Dra. Fabiana Perez', cpf: '101.100.016-16', dataNascimento: '1982-02-25', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201016', uf: 'SP', rqeEspecialidadeIds: ['esp-gastro'] }], email: 'fabiana.perez@velya.health', ativo: true, dataAdmissao: '2021-06-22' },
  { id: 'prof-m-gastro-02', nome: 'Dr. Rodrigo Mansur', cpf: '101.100.017-17', dataNascimento: '1977-12-12', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201017', uf: 'SP', rqeEspecialidadeIds: ['esp-gastro'] }], email: 'rodrigo.mansur@velya.health', ativo: true, dataAdmissao: '2019-04-04' },
  // Infectologia (+2)
  { id: 'prof-m-infecto-01', nome: 'Dra. Iara Farias', cpf: '101.100.018-18', dataNascimento: '1980-07-17', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201018', uf: 'SP', rqeEspecialidadeIds: ['esp-infecto'] }], email: 'iara.farias@velya.health', ativo: true, dataAdmissao: '2020-08-28' },
  { id: 'prof-m-infecto-02', nome: 'Dr. Tadeu Vilanova', cpf: '101.100.019-19', dataNascimento: '1974-05-08', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201019', uf: 'SP', rqeEspecialidadeIds: ['esp-infecto'] }], email: 'tadeu.vilanova@velya.health', ativo: true, dataAdmissao: '2017-10-16' },
  // Cirurgia Geral (+3)
  { id: 'prof-m-cir-01', nome: 'Dr. Anderson Caiafa', cpf: '101.100.020-20', dataNascimento: '1976-09-13', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201020', uf: 'SP', rqeEspecialidadeIds: ['esp-cir-geral'] }], email: 'anderson.caiafa@velya.health', ativo: true, dataAdmissao: '2018-03-27' },
  { id: 'prof-m-cir-02', nome: 'Dra. Mirella Bittencourt', cpf: '101.100.021-21', dataNascimento: '1984-11-26', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201021', uf: 'SP', rqeEspecialidadeIds: ['esp-cir-geral'] }], email: 'mirella.bittencourt@velya.health', ativo: true, dataAdmissao: '2022-05-17' },
  { id: 'prof-m-cir-03', nome: 'Dr. Bruno Rondinelli', cpf: '101.100.022-22', dataNascimento: '1981-08-04', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201022', uf: 'SP', rqeEspecialidadeIds: ['esp-cir-geral'] }], email: 'bruno.rondinelli@velya.health', ativo: true, dataAdmissao: '2020-12-01' },
  // Ortopedia (+3)
  { id: 'prof-m-orto-01', nome: 'Dr. Alessandro Zani', cpf: '101.100.023-23', dataNascimento: '1979-03-16', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201023', uf: 'SP', rqeEspecialidadeIds: ['esp-ortopedia'] }], email: 'alessandro.zani@velya.health', ativo: true, dataAdmissao: '2019-10-21' },
  { id: 'prof-m-orto-02', nome: 'Dra. Natalia Penteado', cpf: '101.100.024-24', dataNascimento: '1985-06-07', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201024', uf: 'SP', rqeEspecialidadeIds: ['esp-ortopedia'] }], email: 'natalia.penteado@velya.health', ativo: true, dataAdmissao: '2022-02-28' },
  { id: 'prof-m-orto-03', nome: 'Dr. Ricardo Malafaia', cpf: '101.100.025-25', dataNascimento: '1977-11-20', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201025', uf: 'SP', rqeEspecialidadeIds: ['esp-ortopedia'] }], email: 'ricardo.malafaia@velya.health', ativo: true, dataAdmissao: '2018-12-10' },
  // Urologia (+2)
  { id: 'prof-m-uro-01', nome: 'Dr. Eduardo Pacheco', cpf: '101.100.026-26', dataNascimento: '1980-02-02', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201026', uf: 'SP', rqeEspecialidadeIds: ['esp-urologia'] }], email: 'eduardo.pacheco@velya.health', ativo: true, dataAdmissao: '2020-04-09' },
  { id: 'prof-m-uro-02', nome: 'Dra. Camila Luzardo', cpf: '101.100.027-27', dataNascimento: '1983-12-29', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201027', uf: 'SP', rqeEspecialidadeIds: ['esp-urologia'] }], email: 'camila.luzardo@velya.health', ativo: true, dataAdmissao: '2021-08-03' },
  // Ginecologia-Obstetricia (+3)
  { id: 'prof-m-gineco-01', nome: 'Dra. Roberta Felix', cpf: '101.100.028-28', dataNascimento: '1981-04-11', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201028', uf: 'SP', rqeEspecialidadeIds: ['esp-gineco'] }], email: 'roberta.felix@velya.health', ativo: true, dataAdmissao: '2020-03-19' },
  { id: 'prof-m-gineco-02', nome: 'Dr. Eliseu Marcondes', cpf: '101.100.029-29', dataNascimento: '1976-08-22', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201029', uf: 'SP', rqeEspecialidadeIds: ['esp-gineco'] }], email: 'eliseu.marcondes@velya.health', ativo: true, dataAdmissao: '2018-05-15' },
  { id: 'prof-m-gineco-03', nome: 'Dra. Barbara Salles', cpf: '101.100.030-30', dataNascimento: '1984-10-10', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201030', uf: 'SP', rqeEspecialidadeIds: ['esp-gineco'] }], email: 'barbara.salles@velya.health', ativo: true, dataAdmissao: '2022-09-27' },
  // Pediatria (+3)
  { id: 'prof-m-ped-01', nome: 'Dra. Viviane Kano', cpf: '101.100.031-31', dataNascimento: '1982-06-19', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201031', uf: 'SP', rqeEspecialidadeIds: ['esp-pediatria'] }], email: 'viviane.kano@velya.health', ativo: true, dataAdmissao: '2021-01-28' },
  { id: 'prof-m-ped-02', nome: 'Dr. Thiago Marinho', cpf: '101.100.032-32', dataNascimento: '1978-03-31', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201032', uf: 'SP', rqeEspecialidadeIds: ['esp-pediatria'] }], email: 'thiago.marinho@velya.health', ativo: true, dataAdmissao: '2019-11-22' },
  { id: 'prof-m-ped-03', nome: 'Dra. Alice Schimidt', cpf: '101.100.033-33', dataNascimento: '1986-01-15', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201033', uf: 'SP', rqeEspecialidadeIds: ['esp-pediatria'] }], email: 'alice.schimidt@velya.health', ativo: true, dataAdmissao: '2023-04-03' },
  // Medicina Intensiva (+3)
  { id: 'prof-m-int-01', nome: 'Dr. Samuel Costeira', cpf: '101.100.034-34', dataNascimento: '1975-12-08', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201034', uf: 'SP', rqeEspecialidadeIds: ['esp-intensiva'] }], email: 'samuel.costeira@velya.health', ativo: true, dataAdmissao: '2018-02-19' },
  { id: 'prof-m-int-02', nome: 'Dra. Isadora Henrique', cpf: '101.100.035-35', dataNascimento: '1981-07-26', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201035', uf: 'SP', rqeEspecialidadeIds: ['esp-intensiva'] }], email: 'isadora.henrique@velya.health', ativo: true, dataAdmissao: '2020-05-12' },
  { id: 'prof-m-int-03', nome: 'Dr. Paulo Ulisses', cpf: '101.100.036-36', dataNascimento: '1979-09-14', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201036', uf: 'SP', rqeEspecialidadeIds: ['esp-intensiva'] }], email: 'paulo.ulisses@velya.health', ativo: true, dataAdmissao: '2019-07-08' },
  // Medicina de Emergencia (+3)
  { id: 'prof-m-emerg-01', nome: 'Dra. Karina Toledo', cpf: '101.100.037-37', dataNascimento: '1982-05-24', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201037', uf: 'SP', rqeEspecialidadeIds: ['esp-emergencia'] }], email: 'karina.toledo@velya.health', ativo: true, dataAdmissao: '2020-09-30' },
  { id: 'prof-m-emerg-02', nome: 'Dr. Andre Weingartner', cpf: '101.100.038-38', dataNascimento: '1978-11-17', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201038', uf: 'SP', rqeEspecialidadeIds: ['esp-emergencia'] }], email: 'andre.weingartner@velya.health', ativo: true, dataAdmissao: '2019-06-11' },
  { id: 'prof-m-emerg-03', nome: 'Dra. Larissa Zenkner', cpf: '101.100.039-39', dataNascimento: '1984-02-07', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201039', uf: 'SP', rqeEspecialidadeIds: ['esp-emergencia'] }], email: 'larissa.zenkner@velya.health', ativo: true, dataAdmissao: '2022-01-05' },
  // Clinica Medica (+3)
  { id: 'prof-m-clinica-01', nome: 'Dr. Joaquim Valadares', cpf: '101.100.040-40', dataNascimento: '1976-04-16', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201040', uf: 'SP', rqeEspecialidadeIds: ['esp-clinica'] }], email: 'joaquim.valadares@velya.health', ativo: true, dataAdmissao: '2018-08-14' },
  { id: 'prof-m-clinica-02', nome: 'Dra. Tatiana Sayao', cpf: '101.100.041-41', dataNascimento: '1983-10-02', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201041', uf: 'SP', rqeEspecialidadeIds: ['esp-clinica'] }], email: 'tatiana.sayao@velya.health', ativo: true, dataAdmissao: '2021-07-09' },
  { id: 'prof-m-clinica-03', nome: 'Dr. Silvio Rassi', cpf: '101.100.042-42', dataNascimento: '1979-06-28', categoria: 'medico', registros: [{ conselho: 'CRM', numero: '201042', uf: 'SP', rqeEspecialidadeIds: ['esp-clinica'] }], email: 'silvio.rassi@velya.health', ativo: true, dataAdmissao: '2020-01-13' },

  // ---------- EXPANSION BLOCK: extra enfermeiros (15) ----------
  { id: 'prof-enf-ivete', nome: 'Ivete Magalhaes', cpf: '861.000.101-01', dataNascimento: '1986-03-12', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '501001', uf: 'SP' }], email: 'ivete.magalhaes@velya.health', ativo: true, dataAdmissao: '2021-04-08' },
  { id: 'prof-enf-jorge', nome: 'Jorge Paiva', cpf: '861.000.102-02', dataNascimento: '1987-07-19', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '501002', uf: 'SP' }], email: 'jorge.paiva@velya.health', ativo: true, dataAdmissao: '2022-02-25' },
  { id: 'prof-enf-kelly', nome: 'Kelly Abreu', cpf: '861.000.103-03', dataNascimento: '1984-09-26', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '501003', uf: 'SP' }], email: 'kelly.abreu@velya.health', ativo: true, dataAdmissao: '2020-03-15' },
  { id: 'prof-enf-luana', nome: 'Luana Quadros', cpf: '861.000.104-04', dataNascimento: '1989-12-03', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '501004', uf: 'SP' }], email: 'luana.quadros@velya.health', ativo: true, dataAdmissao: '2023-01-11' },
  { id: 'prof-enf-marcos', nome: 'Marcos Velasco', cpf: '861.000.105-05', dataNascimento: '1985-05-08', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '501005', uf: 'SP' }], email: 'marcos.velasco@velya.health', ativo: true, dataAdmissao: '2019-11-07' },
  { id: 'prof-enf-nubia', nome: 'Nubia Fontes', cpf: '861.000.106-06', dataNascimento: '1988-02-22', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '501006', uf: 'SP' }], email: 'nubia.fontes@velya.health', ativo: true, dataAdmissao: '2022-06-02' },
  { id: 'prof-enf-otacilio', nome: 'Otacilio Rezende', cpf: '861.000.107-07', dataNascimento: '1983-10-14', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '501007', uf: 'SP' }], email: 'otacilio.rezende@velya.health', ativo: true, dataAdmissao: '2019-08-29' },
  { id: 'prof-enf-priscila', nome: 'Priscila Bandeira', cpf: '861.000.108-08', dataNascimento: '1990-06-07', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '501008', uf: 'SP' }], email: 'priscila.bandeira@velya.health', ativo: true, dataAdmissao: '2023-05-18' },
  { id: 'prof-enf-quezia', nome: 'Quezia Nogueira', cpf: '861.000.109-09', dataNascimento: '1986-08-30', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '501009', uf: 'SP' }], email: 'quezia.nogueira@velya.health', ativo: true, dataAdmissao: '2021-12-04' },
  { id: 'prof-enf-rogerio', nome: 'Rogerio Sampaio', cpf: '861.000.110-10', dataNascimento: '1982-04-18', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '501010', uf: 'SP' }], email: 'rogerio.sampaio@velya.health', ativo: true, dataAdmissao: '2018-10-23' },
  { id: 'prof-enf-silvia', nome: 'Silvia Espinheira', cpf: '861.000.111-11', dataNascimento: '1987-01-09', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '501011', uf: 'SP' }], email: 'silvia.espinheira@velya.health', ativo: true, dataAdmissao: '2022-03-16' },
  { id: 'prof-enf-tarcisio', nome: 'Tarcisio Boaventura', cpf: '861.000.112-12', dataNascimento: '1984-11-21', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '501012', uf: 'SP' }], email: 'tarcisio.boaventura@velya.health', ativo: true, dataAdmissao: '2020-07-13' },
  { id: 'prof-enf-ursula', nome: 'Ursula Prado', cpf: '861.000.113-13', dataNascimento: '1989-03-04', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '501013', uf: 'SP' }], email: 'ursula.prado@velya.health', ativo: true, dataAdmissao: '2023-08-21' },
  { id: 'prof-enf-valter', nome: 'Valter Bittar', cpf: '861.000.114-14', dataNascimento: '1985-07-28', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '501014', uf: 'SP' }], email: 'valter.bittar@velya.health', ativo: true, dataAdmissao: '2020-11-09' },
  { id: 'prof-enf-wanda', nome: 'Wanda Lacerda', cpf: '861.000.115-15', dataNascimento: '1988-09-15', categoria: 'enfermeiro', registros: [{ conselho: 'COREN', numero: '501015', uf: 'SP' }], email: 'wanda.lacerda@velya.health', ativo: true, dataAdmissao: '2022-09-12' },

  // ---------- EXPANSION BLOCK: extra tecnicos enfermagem (20) ----------
  { id: 'prof-tec-xavier', nome: 'Xavier Montenegro', cpf: '871.000.201-01', dataNascimento: '1989-02-04', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502001', uf: 'SP' }], email: 'xavier.montenegro@velya.health', ativo: true, dataAdmissao: '2022-03-07' },
  { id: 'prof-tec-yuri', nome: 'Yuri Penteado', cpf: '871.000.202-02', dataNascimento: '1990-05-17', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502002', uf: 'SP' }], email: 'yuri.penteado@velya.health', ativo: true, dataAdmissao: '2023-04-19' },
  { id: 'prof-tec-zilda', nome: 'Zilda Portela', cpf: '871.000.203-03', dataNascimento: '1986-08-25', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502003', uf: 'SP' }], email: 'zilda.portela@velya.health', ativo: true, dataAdmissao: '2020-12-14' },
  { id: 'prof-tec-adilson', nome: 'Adilson Peixoto', cpf: '871.000.204-04', dataNascimento: '1988-01-30', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502004', uf: 'SP' }], email: 'adilson.peixoto@velya.health', ativo: true, dataAdmissao: '2021-11-02' },
  { id: 'prof-tec-beatriz2', nome: 'Beatriz Caetano', cpf: '871.000.205-05', dataNascimento: '1991-06-11', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502005', uf: 'SP' }], email: 'beatriz.caetano@velya.health', ativo: true, dataAdmissao: '2023-09-25' },
  { id: 'prof-tec-catia', nome: 'Catia Severino', cpf: '871.000.206-06', dataNascimento: '1987-10-02', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502006', uf: 'SP' }], email: 'catia.severino@velya.health', ativo: true, dataAdmissao: '2021-05-06' },
  { id: 'prof-tec-denilson', nome: 'Denilson Rocha', cpf: '871.000.207-07', dataNascimento: '1989-12-18', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502007', uf: 'SP' }], email: 'denilson.rocha@velya.health', ativo: true, dataAdmissao: '2022-08-11' },
  { id: 'prof-tec-eliana', nome: 'Eliana Passos', cpf: '871.000.208-08', dataNascimento: '1984-03-26', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502008', uf: 'SP' }], email: 'eliana.passos@velya.health', ativo: true, dataAdmissao: '2019-10-01' },
  { id: 'prof-tec-fabio', nome: 'Fabio Salgueiro', cpf: '871.000.209-09', dataNascimento: '1990-07-09', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502009', uf: 'SP' }], email: 'fabio.salgueiro@velya.health', ativo: true, dataAdmissao: '2023-02-20' },
  { id: 'prof-tec-glauce', nome: 'Glauce Ferraz', cpf: '871.000.210-10', dataNascimento: '1985-09-22', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502010', uf: 'SP' }], email: 'glauce.ferraz@velya.health', ativo: true, dataAdmissao: '2020-06-16' },
  { id: 'prof-tec-hamilton', nome: 'Hamilton Veloso', cpf: '871.000.211-11', dataNascimento: '1988-04-13', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502011', uf: 'SP' }], email: 'hamilton.veloso@velya.health', ativo: true, dataAdmissao: '2022-01-24' },
  { id: 'prof-tec-iolanda', nome: 'Iolanda Siqueira', cpf: '871.000.212-12', dataNascimento: '1986-11-06', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502012', uf: 'SP' }], email: 'iolanda.siqueira@velya.health', ativo: true, dataAdmissao: '2021-03-28' },
  { id: 'prof-tec-joao2', nome: 'Joao Ventura', cpf: '871.000.213-13', dataNascimento: '1989-05-14', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502013', uf: 'SP' }], email: 'joao.ventura@velya.health', ativo: true, dataAdmissao: '2022-04-05' },
  { id: 'prof-tec-kauane', nome: 'Kauane Peralta', cpf: '871.000.214-14', dataNascimento: '1991-08-19', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502014', uf: 'SP' }], email: 'kauane.peralta@velya.health', ativo: true, dataAdmissao: '2023-07-10' },
  { id: 'prof-tec-leandro', nome: 'Leandro Arruda', cpf: '871.000.215-15', dataNascimento: '1984-10-27', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502015', uf: 'SP' }], email: 'leandro.arruda@velya.health', ativo: true, dataAdmissao: '2019-12-12' },
  { id: 'prof-tec-magali', nome: 'Magali Bastos', cpf: '871.000.216-16', dataNascimento: '1987-02-08', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502016', uf: 'SP' }], email: 'magali.bastos@velya.health', ativo: true, dataAdmissao: '2021-08-30' },
  { id: 'prof-tec-nicacio', nome: 'Nicacio Rodovalho', cpf: '871.000.217-17', dataNascimento: '1988-06-23', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502017', uf: 'SP' }], email: 'nicacio.rodovalho@velya.health', ativo: true, dataAdmissao: '2022-06-19' },
  { id: 'prof-tec-odete', nome: 'Odete Mascarenhas', cpf: '871.000.218-18', dataNascimento: '1985-01-02', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502018', uf: 'SP' }], email: 'odete.mascarenhas@velya.health', ativo: true, dataAdmissao: '2020-02-17' },
  { id: 'prof-tec-paulinho', nome: 'Paulinho Valente', cpf: '871.000.219-19', dataNascimento: '1990-09-04', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502019', uf: 'SP' }], email: 'paulinho.valente@velya.health', ativo: true, dataAdmissao: '2023-03-08' },
  { id: 'prof-tec-queila', nome: 'Queila Moreno', cpf: '871.000.220-20', dataNascimento: '1986-12-16', categoria: 'tecnico_enfermagem', registros: [{ conselho: 'COREN', numero: '502020', uf: 'SP' }], email: 'queila.moreno@velya.health', ativo: true, dataAdmissao: '2021-07-22' },

  // ---------- EXPANSION BLOCK: extra multiprofissionais (10) ----------
  { id: 'prof-fisio-rita', nome: 'Rita Colares', cpf: '881.000.301-01', dataNascimento: '1986-03-05', categoria: 'fisioterapeuta', registros: [{ conselho: 'CREFITO', numero: 'F-78901', uf: 'SP' }], email: 'rita.colares@velya.health', ativo: true, dataAdmissao: '2021-05-10' },
  { id: 'prof-fisio-saulo', nome: 'Saulo Dantas', cpf: '881.000.302-02', dataNascimento: '1983-11-18', categoria: 'fisioterapeuta', registros: [{ conselho: 'CREFITO', numero: 'F-89012', uf: 'SP' }], email: 'saulo.dantas@velya.health', ativo: true, dataAdmissao: '2019-09-03' },
  { id: 'prof-fisio-tania', nome: 'Tania Berenguer', cpf: '881.000.303-03', dataNascimento: '1989-08-30', categoria: 'fisioterapeuta', registros: [{ conselho: 'CREFITO', numero: 'F-90123', uf: 'SP' }], email: 'tania.berenguer@velya.health', ativo: true, dataAdmissao: '2023-01-16' },
  { id: 'prof-nut-ulisses', nome: 'Ulisses Castelo', cpf: '881.000.304-04', dataNascimento: '1987-06-24', categoria: 'nutricionista', registros: [{ conselho: 'CRN', numero: '34501', uf: 'SP' }], email: 'ulisses.castelo@velya.health', ativo: true, dataAdmissao: '2022-10-04' },
  { id: 'prof-nut-valeria', nome: 'Valeria Nicolau', cpf: '881.000.305-05', dataNascimento: '1984-01-11', categoria: 'nutricionista', registros: [{ conselho: 'CRN', numero: '34502', uf: 'SP' }], email: 'valeria.nicolau@velya.health', ativo: true, dataAdmissao: '2019-03-27' },
  { id: 'prof-fono-wilma', nome: 'Wilma Tavora', cpf: '881.000.306-06', dataNascimento: '1985-04-20', categoria: 'fonoaudiologo', registros: [{ conselho: 'CFFa', numero: 'FA-12001', uf: 'SP' }], email: 'wilma.tavora@velya.health', ativo: true, dataAdmissao: '2020-07-15' },
  { id: 'prof-psico-xenia', nome: 'Xenia Matarazzo', cpf: '881.000.307-07', dataNascimento: '1982-10-08', categoria: 'psicologo', registros: [{ conselho: 'CRP', numero: 'PS-15001', uf: 'SP' }], email: 'xenia.matarazzo@velya.health', ativo: true, dataAdmissao: '2018-11-29' },
  { id: 'prof-social-yolanda', nome: 'Yolanda Macedo', cpf: '881.000.308-08', dataNascimento: '1980-05-03', categoria: 'assistente_social', registros: [{ conselho: 'CRESS', numero: '56890', uf: 'SP' }], email: 'yolanda.macedo@velya.health', ativo: true, dataAdmissao: '2018-08-17' },
  { id: 'prof-farm-zuleika', nome: 'Zuleika Pampolha', cpf: '881.000.309-09', dataNascimento: '1986-12-09', categoria: 'farmaceutico', registros: [{ conselho: 'CRF', numero: '45901', uf: 'SP' }], email: 'zuleika.pampolha@velya.health', ativo: true, dataAdmissao: '2021-06-01' },
  { id: 'prof-farm-alvaro', nome: 'Alvaro Xavier', cpf: '881.000.310-10', dataNascimento: '1984-02-17', categoria: 'farmaceutico', registros: [{ conselho: 'CRF', numero: '45902', uf: 'SP' }], email: 'alvaro.xavier@velya.health', ativo: true, dataAdmissao: '2019-10-14' },
];

// ---------------------------------------------------------------------------
// PractitionerRoles
// ---------------------------------------------------------------------------

export const PRACTITIONER_ROLES: PractitionerRole[] = [
  // Medicos - assistentes e plantonistas
  { id: 'role-silva-uti-assistente', profissionalId: 'prof-silva-marcos', organizationId: 'org-svc-intensiva', healthcareServiceIds: ['svc-intensiva-uti-adulto', 'svc-cardio-uti-adulto'], locationIds: ['un-uti-adulto'], especialidadeIds: ['esp-intensiva', 'esp-cardiologia'], codigo: 'assistente', cargaHoraria: 40, inicioVigencia: '2020-03-15', ativo: true },
  { id: 'role-silva-rt-uti', profissionalId: 'prof-silva-marcos', organizationId: 'org-unit-uti-adulto', healthcareServiceIds: ['svc-intensiva-uti-adulto'], locationIds: ['un-uti-adulto'], especialidadeIds: ['esp-intensiva'], codigo: 'responsavel_tecnico', cargaHoraria: 20, inicioVigencia: '2022-01-01', ativo: true },
  { id: 'role-rocha-uco-assistente', profissionalId: 'prof-rocha-aline', organizationId: 'org-svc-cardiologia', healthcareServiceIds: ['svc-cardio-uco', 'svc-cardio-uti-adulto'], locationIds: ['un-uco', 'un-uti-adulto'], especialidadeIds: ['esp-cardiologia'], codigo: 'assistente', cargaHoraria: 40, inicioVigencia: '2019-06-01', ativo: true },
  { id: 'role-rocha-uco-coord', profissionalId: 'prof-rocha-aline', organizationId: 'org-unit-uco', healthcareServiceIds: ['svc-cardio-uco'], locationIds: ['un-uco'], especialidadeIds: ['esp-cardiologia'], codigo: 'coordenador_unidade', cargaHoraria: 10, inicioVigencia: '2021-01-01', ativo: true },
  { id: 'role-tavares-uci-assistente', profissionalId: 'prof-tavares-renata', organizationId: 'org-svc-intensiva', healthcareServiceIds: ['svc-intensiva-uci'], locationIds: ['un-uci-adulto'], especialidadeIds: ['esp-intensiva'], codigo: 'assistente', cargaHoraria: 40, inicioVigencia: '2021-01-10', ativo: true },
  { id: 'role-costa-uti-plantao', profissionalId: 'prof-costa-fernando', organizationId: 'org-svc-intensiva', healthcareServiceIds: ['svc-intensiva-uti-adulto'], locationIds: ['un-uti-adulto'], especialidadeIds: ['esp-intensiva'], codigo: 'plantonista', cargaHoraria: 36, inicioVigencia: '2017-05-20', ativo: true },
  { id: 'role-dias-ala2a-diarista', profissionalId: 'prof-dias-helio', organizationId: 'org-svc-pneumologia', healthcareServiceIds: ['svc-pneumo-ala-2a', 'svc-pneumo-ps', 'svc-pneumo-uti-adulto'], locationIds: ['un-ala-2a', 'un-ps', 'un-uti-adulto'], especialidadeIds: ['esp-pneumologia'], codigo: 'diarista', cargaHoraria: 30, inicioVigencia: '2022-08-15', ativo: true },
  { id: 'role-andrade-nefro', profissionalId: 'prof-andrade-rosa', organizationId: 'org-svc-nefrologia', healthcareServiceIds: ['svc-nefro-uti-adulto', 'svc-nefro-ala-2a'], locationIds: ['un-uti-adulto', 'un-uci-adulto', 'un-ala-2a'], especialidadeIds: ['esp-nefrologia'], codigo: 'diarista', cargaHoraria: 30, inicioVigencia: '2023-02-01', ativo: true },
  { id: 'role-barros-endo', profissionalId: 'prof-barros-tiago', organizationId: 'org-svc-endocrino', healthcareServiceIds: ['svc-endo-ala-2a'], locationIds: ['un-ala-2a'], especialidadeIds: ['esp-endocrino'], codigo: 'diarista', cargaHoraria: 20, inicioVigencia: '2019-04-22', ativo: true },
  { id: 'role-gomes-neuro', profissionalId: 'prof-gomes-patricia', organizationId: 'org-svc-neurologia', healthcareServiceIds: ['svc-neuro-ala-2a', 'svc-neuro-ps'], locationIds: ['un-ala-2a', 'un-ps'], especialidadeIds: ['esp-neurologia'], codigo: 'diarista', cargaHoraria: 30, inicioVigencia: '2020-11-10', ativo: true },
  { id: 'role-cardoso-clinica-ala2a', profissionalId: 'prof-cardoso-helena', organizationId: 'org-svc-clinica', healthcareServiceIds: ['svc-clinica-ala-2a', 'svc-gastro-ala-2a'], locationIds: ['un-ala-2a'], especialidadeIds: ['esp-clinica', 'esp-gastro'], codigo: 'assistente', cargaHoraria: 40, inicioVigencia: '2018-09-01', ativo: true },
  { id: 'role-cardoso-coord-ala2a', profissionalId: 'prof-cardoso-helena', organizationId: 'org-unit-ala-2a', healthcareServiceIds: ['svc-clinica-ala-2a'], locationIds: ['un-ala-2a'], especialidadeIds: ['esp-clinica'], codigo: 'coordenador_unidade', cargaHoraria: 10, inicioVigencia: '2021-01-01', ativo: true },
  { id: 'role-lima-infecto', profissionalId: 'prof-lima-ricardo', organizationId: 'org-svc-infecto', healthcareServiceIds: ['svc-infecto-global'], locationIds: ['un-uti-adulto', 'un-uci-adulto', 'un-ala-2a', 'un-ala-3b', 'un-ps'], especialidadeIds: ['esp-infecto'], codigo: 'diarista', cargaHoraria: 30, inicioVigencia: '2020-07-15', ativo: true },
  { id: 'role-martins-cir-ala3b', profissionalId: 'prof-martins-paulo', organizationId: 'org-svc-cir-geral', healthcareServiceIds: ['svc-cir-geral-ala-3b', 'svc-cir-geral-cc'], locationIds: ['un-ala-3b', 'un-cc'], especialidadeIds: ['esp-cir-geral'], codigo: 'assistente', cargaHoraria: 40, inicioVigencia: '2017-03-10', ativo: true },
  { id: 'role-martins-coord-ala3b', profissionalId: 'prof-martins-paulo', organizationId: 'org-unit-ala-3b', healthcareServiceIds: ['svc-cir-geral-ala-3b'], locationIds: ['un-ala-3b'], especialidadeIds: ['esp-cir-geral'], codigo: 'coordenador_unidade', cargaHoraria: 10, inicioVigencia: '2021-01-01', ativo: true },
  { id: 'role-sousa-orto', profissionalId: 'prof-sousa-gabriel', organizationId: 'org-svc-ortopedia', healthcareServiceIds: ['svc-ortopedia-ala-3b', 'svc-ortopedia-ps'], locationIds: ['un-ala-3b', 'un-ps'], especialidadeIds: ['esp-ortopedia'], codigo: 'assistente', cargaHoraria: 40, inicioVigencia: '2022-01-20', ativo: true },
  { id: 'role-melo-uro', profissionalId: 'prof-melo-diego', organizationId: 'org-svc-urologia', healthcareServiceIds: ['svc-urologia-ala-3b'], locationIds: ['un-ala-3b'], especialidadeIds: ['esp-urologia'], codigo: 'assistente', cargaHoraria: 30, inicioVigencia: '2022-09-05', ativo: true },
  { id: 'role-figueiredo-mat', profissionalId: 'prof-figueiredo-beatriz', organizationId: 'org-svc-gineco', healthcareServiceIds: ['svc-gineco-maternidade'], locationIds: ['un-maternidade'], especialidadeIds: ['esp-gineco'], codigo: 'assistente', cargaHoraria: 40, inicioVigencia: '2019-02-14', ativo: true },
  { id: 'role-figueiredo-coord-mat', profissionalId: 'prof-figueiredo-beatriz', organizationId: 'org-unit-maternidade', healthcareServiceIds: ['svc-gineco-maternidade'], locationIds: ['un-maternidade'], especialidadeIds: ['esp-gineco'], codigo: 'coordenador_unidade', cargaHoraria: 10, inicioVigencia: '2021-01-01', ativo: true },
  { id: 'role-almeida-ped', profissionalId: 'prof-almeida-camila', organizationId: 'org-svc-pediatria', healthcareServiceIds: ['svc-pediatria-ped', 'svc-pediatria-ps'], locationIds: ['un-pediatria', 'un-ps'], especialidadeIds: ['esp-pediatria'], codigo: 'assistente', cargaHoraria: 40, inicioVigencia: '2020-05-30', ativo: true },
  { id: 'role-almeida-coord-ped', profissionalId: 'prof-almeida-camila', organizationId: 'org-unit-pediatria', healthcareServiceIds: ['svc-pediatria-ped'], locationIds: ['un-pediatria'], especialidadeIds: ['esp-pediatria'], codigo: 'coordenador_unidade', cargaHoraria: 10, inicioVigencia: '2021-01-01', ativo: true },
  { id: 'role-pereira-uti-neo', profissionalId: 'prof-pereira-luiza', organizationId: 'org-svc-intensiva', healthcareServiceIds: ['svc-intensiva-uti-neo'], locationIds: ['un-uti-neo'], especialidadeIds: ['esp-intensiva', 'esp-pediatria'], codigo: 'assistente', cargaHoraria: 40, inicioVigencia: '2018-11-01', ativo: true },
  { id: 'role-pereira-rt-uti-neo', profissionalId: 'prof-pereira-luiza', organizationId: 'org-unit-uti-neo', healthcareServiceIds: ['svc-intensiva-uti-neo'], locationIds: ['un-uti-neo'], especialidadeIds: ['esp-intensiva'], codigo: 'responsavel_tecnico', cargaHoraria: 20, inicioVigencia: '2021-01-01', ativo: true },
  { id: 'role-nogueira-ps', profissionalId: 'prof-nogueira-bruno', organizationId: 'org-svc-emergencia', healthcareServiceIds: ['svc-emerg-ps'], locationIds: ['un-ps'], especialidadeIds: ['esp-emergencia'], codigo: 'assistente', cargaHoraria: 40, inicioVigencia: '2019-07-18', ativo: true },
  { id: 'role-nogueira-coord-ps', profissionalId: 'prof-nogueira-bruno', organizationId: 'org-unit-ps', healthcareServiceIds: ['svc-emerg-ps'], locationIds: ['un-ps'], especialidadeIds: ['esp-emergencia'], codigo: 'coordenador_unidade', cargaHoraria: 10, inicioVigencia: '2021-01-01', ativo: true },
  // Enfermeiros
  { id: 'role-enf-ana-uti', profissionalId: 'prof-enf-ana', organizationId: 'org-unit-uti-adulto', healthcareServiceIds: ['svc-intensiva-uti-adulto'], locationIds: ['un-uti-adulto'], especialidadeIds: [], codigo: 'enfermeiro_coordenador', cargaHoraria: 40, inicioVigencia: '2021-03-01', ativo: true },
  { id: 'role-enf-beatriz-uti', profissionalId: 'prof-enf-beatriz', organizationId: 'org-unit-uti-adulto', healthcareServiceIds: ['svc-intensiva-uti-adulto'], locationIds: ['un-uti-adulto'], especialidadeIds: [], codigo: 'enfermeiro_assistencial', cargaHoraria: 36, inicioVigencia: '2022-01-15', ativo: true },
  { id: 'role-enf-carla-uco', profissionalId: 'prof-enf-carla', organizationId: 'org-unit-uco', healthcareServiceIds: ['svc-cardio-uco'], locationIds: ['un-uco'], especialidadeIds: [], codigo: 'enfermeiro_coordenador', cargaHoraria: 40, inicioVigencia: '2020-11-12', ativo: true },
  { id: 'role-enf-daniel-uci', profissionalId: 'prof-enf-daniel', organizationId: 'org-unit-uci-adulto', healthcareServiceIds: ['svc-intensiva-uci'], locationIds: ['un-uci-adulto'], especialidadeIds: [], codigo: 'enfermeiro_coordenador', cargaHoraria: 40, inicioVigencia: '2019-09-20', ativo: true },
  { id: 'role-enf-elaine-ala2a', profissionalId: 'prof-enf-elaine', organizationId: 'org-unit-ala-2a', healthcareServiceIds: ['svc-clinica-ala-2a'], locationIds: ['un-ala-2a'], especialidadeIds: [], codigo: 'enfermeiro_coordenador', cargaHoraria: 40, inicioVigencia: '2021-05-10', ativo: true },
  { id: 'role-enf-fernanda-ala3b', profissionalId: 'prof-enf-fernanda', organizationId: 'org-unit-ala-3b', healthcareServiceIds: ['svc-cir-geral-ala-3b'], locationIds: ['un-ala-3b'], especialidadeIds: [], codigo: 'enfermeiro_coordenador', cargaHoraria: 40, inicioVigencia: '2019-02-25', ativo: true },
  { id: 'role-enf-gustavo-ps', profissionalId: 'prof-enf-gustavo', organizationId: 'org-unit-ps', healthcareServiceIds: ['svc-emerg-ps'], locationIds: ['un-ps'], especialidadeIds: [], codigo: 'enfermeiro_assistencial', cargaHoraria: 36, inicioVigencia: '2022-08-01', ativo: true },
  { id: 'role-enf-helena-mat', profissionalId: 'prof-enf-helena', organizationId: 'org-unit-maternidade', healthcareServiceIds: ['svc-gineco-maternidade'], locationIds: ['un-maternidade'], especialidadeIds: [], codigo: 'enfermeiro_coordenador', cargaHoraria: 40, inicioVigencia: '2020-04-05', ativo: true },
  // Tecnicos enfermagem
  { id: 'role-tec-isabel-uti', profissionalId: 'prof-tec-isabel', organizationId: 'org-unit-uti-adulto', healthcareServiceIds: [], locationIds: ['un-uti-adulto'], especialidadeIds: [], codigo: 'tecnico', cargaHoraria: 36, inicioVigencia: '2022-02-14', ativo: true },
  { id: 'role-tec-joao-uti', profissionalId: 'prof-tec-joao', organizationId: 'org-unit-uti-adulto', healthcareServiceIds: [], locationIds: ['un-uti-adulto'], especialidadeIds: [], codigo: 'tecnico', cargaHoraria: 36, inicioVigencia: '2021-06-18', ativo: true },
  { id: 'role-tec-karla-uco', profissionalId: 'prof-tec-karla', organizationId: 'org-unit-uco', healthcareServiceIds: [], locationIds: ['un-uco'], especialidadeIds: [], codigo: 'tecnico', cargaHoraria: 36, inicioVigencia: '2023-03-20', ativo: true },
  { id: 'role-tec-lucas-uci', profissionalId: 'prof-tec-lucas', organizationId: 'org-unit-uci-adulto', healthcareServiceIds: [], locationIds: ['un-uci-adulto'], especialidadeIds: [], codigo: 'tecnico', cargaHoraria: 36, inicioVigencia: '2021-09-12', ativo: true },
  { id: 'role-tec-mariana-ala2a', profissionalId: 'prof-tec-mariana', organizationId: 'org-unit-ala-2a', healthcareServiceIds: [], locationIds: ['un-ala-2a'], especialidadeIds: [], codigo: 'tecnico', cargaHoraria: 36, inicioVigencia: '2023-07-01', ativo: true },
  { id: 'role-tec-nelson-ala2a', profissionalId: 'prof-tec-nelson', organizationId: 'org-unit-ala-2a', healthcareServiceIds: [], locationIds: ['un-ala-2a'], especialidadeIds: [], codigo: 'tecnico', cargaHoraria: 36, inicioVigencia: '2020-08-22', ativo: true },
  { id: 'role-tec-olivia-ala3b', profissionalId: 'prof-tec-olivia', organizationId: 'org-unit-ala-3b', healthcareServiceIds: [], locationIds: ['un-ala-3b'], especialidadeIds: [], codigo: 'tecnico', cargaHoraria: 36, inicioVigencia: '2022-04-15', ativo: true },
  { id: 'role-tec-pedro-ped', profissionalId: 'prof-tec-pedro', organizationId: 'org-unit-pediatria', healthcareServiceIds: [], locationIds: ['un-pediatria'], especialidadeIds: [], codigo: 'tecnico', cargaHoraria: 36, inicioVigencia: '2022-11-30', ativo: true },
  { id: 'role-tec-quiteria-mat', profissionalId: 'prof-tec-quiteria', organizationId: 'org-unit-maternidade', healthcareServiceIds: [], locationIds: ['un-maternidade'], especialidadeIds: [], codigo: 'tecnico', cargaHoraria: 36, inicioVigencia: '2020-10-08', ativo: true },
  { id: 'role-tec-rafael-ps', profissionalId: 'prof-tec-rafael', organizationId: 'org-unit-ps', healthcareServiceIds: [], locationIds: ['un-ps'], especialidadeIds: [], codigo: 'tecnico', cargaHoraria: 36, inicioVigencia: '2024-02-12', ativo: true },
  { id: 'role-tec-sandra-ps', profissionalId: 'prof-tec-sandra', organizationId: 'org-unit-ps', healthcareServiceIds: [], locationIds: ['un-ps'], especialidadeIds: [], codigo: 'tecnico', cargaHoraria: 36, inicioVigencia: '2021-07-26', ativo: true },
  { id: 'role-tec-tiago-uti-neo', profissionalId: 'prof-tec-tiago', organizationId: 'org-unit-uti-neo', healthcareServiceIds: [], locationIds: ['un-uti-neo'], especialidadeIds: [], codigo: 'tecnico', cargaHoraria: 36, inicioVigencia: '2023-05-04', ativo: true },
  // Multiprofissional
  { id: 'role-fisio-victor', profissionalId: 'prof-fisio-victor', organizationId: 'org-svc-fisio', healthcareServiceIds: ['svc-fisio-hospital'], locationIds: ['un-uti-adulto', 'un-uci-adulto', 'un-ala-2a'], especialidadeIds: ['esp-fisio'], codigo: 'diarista', cargaHoraria: 40, inicioVigencia: '2021-02-08', ativo: true },
  { id: 'role-fisio-wagner', profissionalId: 'prof-fisio-wagner', organizationId: 'org-svc-fisio', healthcareServiceIds: ['svc-fisio-hospital'], locationIds: ['un-ala-3b', 'un-pediatria'], especialidadeIds: ['esp-fisio'], codigo: 'diarista', cargaHoraria: 40, inicioVigencia: '2020-06-15', ativo: true },
  { id: 'role-fisio-yara', profissionalId: 'prof-fisio-yara', organizationId: 'org-svc-fisio', healthcareServiceIds: ['svc-fisio-hospital'], locationIds: ['un-uti-adulto', 'un-ala-2a'], especialidadeIds: ['esp-fisio'], codigo: 'diarista', cargaHoraria: 30, inicioVigencia: '2022-03-10', ativo: true },
  { id: 'role-nut-zara', profissionalId: 'prof-nut-zara', organizationId: 'org-svc-nutricao', healthcareServiceIds: ['svc-nutricao-hospital'], locationIds: ['un-uti-adulto', 'un-uci-adulto', 'un-ala-2a'], especialidadeIds: ['esp-nutricao'], codigo: 'diarista', cargaHoraria: 40, inicioVigencia: '2021-04-19', ativo: true },
  { id: 'role-nut-andre', profissionalId: 'prof-nut-andre', organizationId: 'org-svc-nutricao', healthcareServiceIds: ['svc-nutricao-hospital'], locationIds: ['un-ala-3b', 'un-pediatria', 'un-maternidade'], especialidadeIds: ['esp-nutricao'], codigo: 'diarista', cargaHoraria: 40, inicioVigencia: '2022-07-02', ativo: true },
  { id: 'role-farm-bruna', profissionalId: 'prof-farm-bruna', organizationId: 'org-svc-farmacia', healthcareServiceIds: ['svc-farmacia-clinica'], locationIds: ['un-uti-adulto', 'un-uci-adulto'], especialidadeIds: ['esp-farmacia'], codigo: 'diarista', cargaHoraria: 40, inicioVigencia: '2020-09-07', ativo: true },
  { id: 'role-farm-caio', profissionalId: 'prof-farm-caio', organizationId: 'org-svc-farmacia', healthcareServiceIds: ['svc-farmacia-clinica'], locationIds: ['un-ala-2a', 'un-ala-3b'], especialidadeIds: ['esp-farmacia'], codigo: 'diarista', cargaHoraria: 40, inicioVigencia: '2019-12-03', ativo: true },
  { id: 'role-social-diana', profissionalId: 'prof-social-diana', organizationId: 'org-svc-social', healthcareServiceIds: ['svc-social-hospital'], locationIds: ['un-ala-2a', 'un-ala-3b', 'un-pediatria', 'un-maternidade', 'un-ps'], especialidadeIds: ['esp-social'], codigo: 'diarista', cargaHoraria: 40, inicioVigencia: '2018-06-21', ativo: true },
];

// ---------------------------------------------------------------------------
// Turnos (shifts for 2026-04-12) + Presencas
// ---------------------------------------------------------------------------

export const TURNOS: Turno[] = [
  // UTI Adulto - plantao 12h manha (em andamento)
  { id: 'turno-silva-uti-1', practitionerRoleId: 'role-silva-uti-assistente', unidadeId: 'un-uti-adulto', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-costa-uti-1', practitionerRoleId: 'role-costa-uti-plantao', unidadeId: 'un-uti-adulto', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-enf-ana-uti-1', practitionerRoleId: 'role-enf-ana-uti', unidadeId: 'un-uti-adulto', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-enf-beatriz-uti-1', practitionerRoleId: 'role-enf-beatriz-uti', unidadeId: 'un-uti-adulto', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-tec-isabel-uti-1', practitionerRoleId: 'role-tec-isabel-uti', unidadeId: 'un-uti-adulto', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-tec-joao-uti-1', practitionerRoleId: 'role-tec-joao-uti', unidadeId: 'un-uti-adulto', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  // UCO
  { id: 'turno-rocha-uco-1', practitionerRoleId: 'role-rocha-uco-assistente', unidadeId: 'un-uco', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-enf-carla-uco-1', practitionerRoleId: 'role-enf-carla-uco', unidadeId: 'un-uco', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-tec-karla-uco-1', practitionerRoleId: 'role-tec-karla-uco', unidadeId: 'un-uco', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  // UCI
  { id: 'turno-tavares-uci-1', practitionerRoleId: 'role-tavares-uci-assistente', unidadeId: 'un-uci-adulto', tipo: 'matutino', inicioEm: MORNING_START, fimEm: MORNING_END, status: 'em_andamento' },
  { id: 'turno-enf-daniel-uci-1', practitionerRoleId: 'role-enf-daniel-uci', unidadeId: 'un-uci-adulto', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-tec-lucas-uci-1', practitionerRoleId: 'role-tec-lucas-uci', unidadeId: 'un-uci-adulto', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  // Ala 2A
  { id: 'turno-cardoso-ala2a-1', practitionerRoleId: 'role-cardoso-clinica-ala2a', unidadeId: 'un-ala-2a', tipo: 'matutino', inicioEm: MORNING_START, fimEm: MORNING_END, status: 'em_andamento' },
  { id: 'turno-dias-ala2a-1', practitionerRoleId: 'role-dias-ala2a-diarista', unidadeId: 'un-ala-2a', tipo: 'matutino', inicioEm: MORNING_START, fimEm: MORNING_END, status: 'em_andamento' },
  { id: 'turno-barros-ala2a-1', practitionerRoleId: 'role-barros-endo', unidadeId: 'un-ala-2a', tipo: 'matutino', inicioEm: '2026-04-12T08:00:00-03:00', fimEm: '2026-04-12T12:00:00-03:00', status: 'em_andamento' },
  { id: 'turno-enf-elaine-ala2a-1', practitionerRoleId: 'role-enf-elaine-ala2a', unidadeId: 'un-ala-2a', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-tec-mariana-ala2a-1', practitionerRoleId: 'role-tec-mariana-ala2a', unidadeId: 'un-ala-2a', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-tec-nelson-ala2a-1', practitionerRoleId: 'role-tec-nelson-ala2a', unidadeId: 'un-ala-2a', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  // Ala 3B
  { id: 'turno-martins-ala3b-1', practitionerRoleId: 'role-martins-cir-ala3b', unidadeId: 'un-ala-3b', tipo: 'matutino', inicioEm: MORNING_START, fimEm: MORNING_END, status: 'em_andamento' },
  { id: 'turno-sousa-ala3b-1', practitionerRoleId: 'role-sousa-orto', unidadeId: 'un-ala-3b', tipo: 'matutino', inicioEm: MORNING_START, fimEm: MORNING_END, status: 'em_andamento' },
  { id: 'turno-enf-fernanda-ala3b-1', practitionerRoleId: 'role-enf-fernanda-ala3b', unidadeId: 'un-ala-3b', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-tec-olivia-ala3b-1', practitionerRoleId: 'role-tec-olivia-ala3b', unidadeId: 'un-ala-3b', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  // Pediatria
  { id: 'turno-almeida-ped-1', practitionerRoleId: 'role-almeida-ped', unidadeId: 'un-pediatria', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-tec-pedro-ped-1', practitionerRoleId: 'role-tec-pedro-ped', unidadeId: 'un-pediatria', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  // Maternidade
  { id: 'turno-figueiredo-mat-1', practitionerRoleId: 'role-figueiredo-mat', unidadeId: 'un-maternidade', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-enf-helena-mat-1', practitionerRoleId: 'role-enf-helena-mat', unidadeId: 'un-maternidade', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-tec-quiteria-mat-1', practitionerRoleId: 'role-tec-quiteria-mat', unidadeId: 'un-maternidade', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  // UTI Neonatal
  { id: 'turno-pereira-uti-neo-1', practitionerRoleId: 'role-pereira-uti-neo', unidadeId: 'un-uti-neo', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-tec-tiago-uti-neo-1', practitionerRoleId: 'role-tec-tiago-uti-neo', unidadeId: 'un-uti-neo', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  // PS
  { id: 'turno-nogueira-ps-1', practitionerRoleId: 'role-nogueira-ps', unidadeId: 'un-ps', tipo: 'plantao_24', inicioEm: PLANTAO12_DAY_START, fimEm: '2026-04-13T07:00:00-03:00', status: 'em_andamento' },
  { id: 'turno-enf-gustavo-ps-1', practitionerRoleId: 'role-enf-gustavo-ps', unidadeId: 'un-ps', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-tec-rafael-ps-1', practitionerRoleId: 'role-tec-rafael-ps', unidadeId: 'un-ps', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  { id: 'turno-tec-sandra-ps-1', practitionerRoleId: 'role-tec-sandra-ps', unidadeId: 'un-ps', tipo: 'plantao_12', inicioEm: PLANTAO12_DAY_START, fimEm: PLANTAO12_DAY_END, status: 'em_andamento' },
  // Multiprofissional diaristas (matutino ou completo)
  { id: 'turno-fisio-victor-1', practitionerRoleId: 'role-fisio-victor', unidadeId: 'un-uti-adulto', tipo: 'matutino', inicioEm: MORNING_START, fimEm: MORNING_END, status: 'em_andamento' },
  { id: 'turno-fisio-wagner-1', practitionerRoleId: 'role-fisio-wagner', unidadeId: 'un-ala-3b', tipo: 'matutino', inicioEm: MORNING_START, fimEm: MORNING_END, status: 'em_andamento' },
  { id: 'turno-fisio-yara-1', practitionerRoleId: 'role-fisio-yara', unidadeId: 'un-ala-2a', tipo: 'matutino', inicioEm: MORNING_START, fimEm: MORNING_END, status: 'em_andamento' },
  { id: 'turno-nut-zara-1', practitionerRoleId: 'role-nut-zara', unidadeId: 'un-ala-2a', tipo: 'matutino', inicioEm: MORNING_START, fimEm: MORNING_END, status: 'em_andamento' },
  { id: 'turno-nut-andre-1', practitionerRoleId: 'role-nut-andre', unidadeId: 'un-pediatria', tipo: 'matutino', inicioEm: MORNING_START, fimEm: MORNING_END, status: 'em_andamento' },
  { id: 'turno-farm-bruna-1', practitionerRoleId: 'role-farm-bruna', unidadeId: 'un-uti-adulto', tipo: 'matutino', inicioEm: '2026-04-12T08:00:00-03:00', fimEm: '2026-04-12T18:00:00-03:00', status: 'em_andamento' },
  { id: 'turno-farm-caio-1', practitionerRoleId: 'role-farm-caio', unidadeId: 'un-ala-2a', tipo: 'matutino', inicioEm: '2026-04-12T08:00:00-03:00', fimEm: '2026-04-12T18:00:00-03:00', status: 'em_andamento' },
  { id: 'turno-social-diana-1', practitionerRoleId: 'role-social-diana', unidadeId: 'un-ala-2a', tipo: 'matutino', inicioEm: '2026-04-12T08:00:00-03:00', fimEm: '2026-04-12T17:00:00-03:00', status: 'em_andamento' },
  // Noturno (agendado para mais tarde)
  { id: 'turno-costa-uti-noturno', practitionerRoleId: 'role-costa-uti-plantao', unidadeId: 'un-uti-adulto', tipo: 'noturno', inicioEm: NIGHT_START, fimEm: NIGHT_END, status: 'agendado' },
  { id: 'turno-andrade-nefro-sobreaviso', practitionerRoleId: 'role-andrade-nefro', unidadeId: 'un-uti-adulto', tipo: 'sobreaviso', inicioEm: NIGHT_START, fimEm: NIGHT_END, status: 'agendado' },
];

export const PRESENCAS_FISICAS: PresencaFisica[] = [
  { id: 'pres-silva', profissionalId: 'prof-silva-marcos', turnoId: 'turno-silva-uti-1', badgeInEm: '2026-04-12T06:52:00-03:00', unidadeAtualId: 'un-uti-adulto', status: 'presente' },
  { id: 'pres-costa', profissionalId: 'prof-costa-fernando', turnoId: 'turno-costa-uti-1', badgeInEm: '2026-04-12T07:05:00-03:00', unidadeAtualId: 'un-uti-adulto', status: 'presente' },
  { id: 'pres-rocha', profissionalId: 'prof-rocha-aline', turnoId: 'turno-rocha-uco-1', badgeInEm: '2026-04-12T06:58:00-03:00', unidadeAtualId: 'un-uco', status: 'presente' },
  { id: 'pres-tavares', profissionalId: 'prof-tavares-renata', turnoId: 'turno-tavares-uci-1', badgeInEm: '2026-04-12T07:00:00-03:00', unidadeAtualId: 'un-uci-adulto', status: 'em_pausa' },
  { id: 'pres-enf-ana', profissionalId: 'prof-enf-ana', turnoId: 'turno-enf-ana-uti-1', badgeInEm: '2026-04-12T06:45:00-03:00', unidadeAtualId: 'un-uti-adulto', status: 'presente' },
  { id: 'pres-nogueira', profissionalId: 'prof-nogueira-bruno', turnoId: 'turno-nogueira-ps-1', badgeInEm: '2026-04-12T06:50:00-03:00', unidadeAtualId: 'un-ps', status: 'presente' },
  { id: 'pres-almeida', profissionalId: 'prof-almeida-camila', turnoId: 'turno-almeida-ped-1', badgeInEm: '2026-04-12T07:10:00-03:00', unidadeAtualId: 'un-pediatria', status: 'presente' },
  { id: 'pres-pereira', profissionalId: 'prof-pereira-luiza', turnoId: 'turno-pereira-uti-neo-1', badgeInEm: '2026-04-12T06:55:00-03:00', unidadeAtualId: 'un-uti-neo', status: 'presente' },
  { id: 'pres-figueiredo', profissionalId: 'prof-figueiredo-beatriz', turnoId: 'turno-figueiredo-mat-1', badgeInEm: '2026-04-12T07:02:00-03:00', unidadeAtualId: 'un-maternidade', status: 'presente' },
];

// ---------------------------------------------------------------------------
// Pacientes + Internacoes + CareTeams + Transferencias
// ---------------------------------------------------------------------------

/** Admission seed data for a single occupied bed. */
interface AdmissionSeed {
  nome: string;
  sexo: 'M' | 'F';
  idade: number;
  tipoSanguineo?: string;
  cpf: string;
  cns?: string;
  convenio?: { nome: string; plano: string };
  diagnostico: string;
  cid: string;
  cidsSecundarios?: string[];
  via: Internacao['admissao']['via'];
  servicoId: string; // HealthcareService
  especialidadeId: string;
  assistenteRoleId: string;
  admissaoDiasAtras: number;
  status?: Internacao['status'];
  scp?: Internacao['scpAtual'];
  newsScore?: number;
  alergias?: Paciente['alergias'];
  alertas?: Paciente['alertas'];
  manchester?: 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul';
  consultores?: { roleId: string; tipo: 'parecer' | 'acompanhamento' }[];
  origem?: string;
  transferenciasHistorico?: { origemLocationId: string; tipo: TransferenciaInterna['tipo']; motivo: string; diasAtras: number }[];
}

function computeAdmissao(diasAtras: number): string {
  const base = new Date('2026-04-12T08:00:00-03:00').getTime();
  const d = new Date(base - diasAtras * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

function computeDob(idade: number): string {
  const y = 2026 - idade;
  return `${y}-01-15`;
}

/** Admissions per ward, aligned 1:1 with the occupied beds (status === 'O'). */
const ADMISSIONS_UTI_ADULTO: AdmissionSeed[] = [
  { nome: 'Ana Beatriz Santos', sexo: 'F', idade: 68, tipoSanguineo: 'O+', cpf: '901.234.567-01', cns: '700123456789012', convenio: { nome: 'Amil', plano: 'Blue 400' }, diagnostico: 'Sepse pulmonar - em VM', cid: 'A41.9', cidsSecundarios: ['J18.9'], via: 'emergencia', servicoId: 'svc-intensiva-uti-adulto', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-silva-uti-assistente', admissaoDiasAtras: 4, scp: 'intensivo', newsScore: 7, alergias: [{ substancia: 'Penicilina', reacao: 'rash', severidade: 'moderada' }], consultores: [{ roleId: 'role-dias-ala2a-diarista', tipo: 'acompanhamento' }, { roleId: 'role-lima-infecto', tipo: 'parecer' }], manchester: 'vermelho', origem: 'Pronto Socorro', transferenciasHistorico: [{ origemLocationId: 'loc-bed-ps-05', tipo: 'step_up', motivo: 'Piora respiratoria', diasAtras: 4 }] },
  { nome: 'Carlos Augusto Pereira', sexo: 'M', idade: 72, tipoSanguineo: 'A+', cpf: '902.234.567-02', convenio: { nome: 'Bradesco', plano: 'Top' }, diagnostico: 'IAM com supra - pos ICP primaria', cid: 'I21.0', via: 'emergencia', servicoId: 'svc-cardio-uti-adulto', especialidadeId: 'esp-cardiologia', assistenteRoleId: 'role-rocha-uco-assistente', admissaoDiasAtras: 2, scp: 'intensivo', newsScore: 6, consultores: [{ roleId: 'role-silva-uti-assistente', tipo: 'acompanhamento' }], manchester: 'vermelho', origem: 'Hemodinamica' },
  { nome: 'Juliana Ferreira Lima', sexo: 'F', idade: 55, tipoSanguineo: 'B+', cpf: '903.234.567-03', diagnostico: 'SDRA grave pos-COVID', cid: 'J80', cidsSecundarios: ['U07.1'], via: 'transferencia_externa', servicoId: 'svc-intensiva-uti-adulto', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-silva-uti-assistente', admissaoDiasAtras: 7, scp: 'intensivo', newsScore: 8, alertas: [{ codigo: 'ISO-CONTATO', descricao: 'Isolamento por contato', desde: computeAdmissao(7) }], manchester: 'vermelho', origem: 'Hospital Sao Camilo' },
  { nome: 'Roberto Nunes Costa', sexo: 'M', idade: 63, tipoSanguineo: 'O-', cpf: '904.234.567-04', convenio: { nome: 'Unimed', plano: 'Beta' }, diagnostico: 'Choque septico abdominal', cid: 'R65.21', cidsSecundarios: ['K65.9'], via: 'emergencia', servicoId: 'svc-intensiva-uti-adulto', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-silva-uti-assistente', admissaoDiasAtras: 3, scp: 'intensivo', newsScore: 9, consultores: [{ roleId: 'role-martins-cir-ala3b', tipo: 'acompanhamento' }, { roleId: 'role-lima-infecto', tipo: 'acompanhamento' }], manchester: 'vermelho' },
  { nome: 'Mariana de Souza', sexo: 'F', idade: 48, tipoSanguineo: 'A-', cpf: '905.234.567-05', diagnostico: 'Pos-operatorio de craniotomia', cid: 'I60.9', via: 'eletiva', servicoId: 'svc-intensiva-uti-adulto', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-silva-uti-assistente', admissaoDiasAtras: 1, scp: 'intensivo', newsScore: 5, consultores: [{ roleId: 'role-gomes-neuro', tipo: 'acompanhamento' }], origem: 'Centro Cirurgico' },
  { nome: 'Pedro Henrique Alves', sexo: 'M', idade: 58, tipoSanguineo: 'B-', cpf: '906.234.567-06', diagnostico: 'Insuficiencia renal aguda dialitica', cid: 'N17.9', cidsSecundarios: ['I50.9'], via: 'emergencia', servicoId: 'svc-intensiva-uti-adulto', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-silva-uti-assistente', admissaoDiasAtras: 5, scp: 'intensivo', newsScore: 6, consultores: [{ roleId: 'role-andrade-nefro', tipo: 'acompanhamento' }], manchester: 'laranja' },
  { nome: 'Isabel Martins', sexo: 'F', idade: 74, tipoSanguineo: 'AB+', cpf: '907.234.567-07', convenio: { nome: 'SulAmerica', plano: 'Executivo' }, diagnostico: 'AVC isquemico em fossa posterior', cid: 'I63.9', via: 'emergencia', servicoId: 'svc-intensiva-uti-adulto', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-silva-uti-assistente', admissaoDiasAtras: 6, scp: 'intensivo', newsScore: 5, consultores: [{ roleId: 'role-gomes-neuro', tipo: 'acompanhamento' }], manchester: 'laranja' },
  { nome: 'Marcos Vieira', sexo: 'M', idade: 67, tipoSanguineo: 'O+', cpf: '908.234.567-08', diagnostico: 'Exacerbacao grave de DPOC', cid: 'J44.1', via: 'emergencia', servicoId: 'svc-intensiva-uti-adulto', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-silva-uti-assistente', admissaoDiasAtras: 3, scp: 'intensivo', newsScore: 6, consultores: [{ roleId: 'role-dias-ala2a-diarista', tipo: 'acompanhamento' }], manchester: 'vermelho' },
  { nome: 'Cristina Oliveira', sexo: 'F', idade: 52, cpf: '909.234.567-09', diagnostico: 'Pancreatite necrotizante', cid: 'K85.9', via: 'emergencia', servicoId: 'svc-intensiva-uti-adulto', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-silva-uti-assistente', admissaoDiasAtras: 8, status: 'alta_solicitada', scp: 'alta_dependencia', newsScore: 4, consultores: [{ roleId: 'role-cardoso-clinica-ala2a', tipo: 'parecer' }], manchester: 'laranja' },
  { nome: 'Eduardo Sampaio', sexo: 'M', idade: 61, cpf: '910.234.567-10', diagnostico: 'Pos-PCR em reanimacao prolongada', cid: 'I46.0', via: 'emergencia', servicoId: 'svc-cardio-uti-adulto', especialidadeId: 'esp-cardiologia', assistenteRoleId: 'role-rocha-uco-assistente', admissaoDiasAtras: 1, scp: 'intensivo', newsScore: 8, manchester: 'vermelho' },
];

const ADMISSIONS_UCO: AdmissionSeed[] = [
  { nome: 'Fernanda Moura', sexo: 'F', idade: 64, cpf: '911.234.567-11', convenio: { nome: 'Amil', plano: 'Blue 400' }, diagnostico: 'Angina instavel - aguarda CATE', cid: 'I20.0', via: 'emergencia', servicoId: 'svc-cardio-uco', especialidadeId: 'esp-cardiologia', assistenteRoleId: 'role-rocha-uco-assistente', admissaoDiasAtras: 1, scp: 'alta_dependencia', newsScore: 4, manchester: 'laranja' },
  { nome: 'Joao Batista Ribeiro', sexo: 'M', idade: 70, cpf: '912.234.567-12', diagnostico: 'IAM sem supra', cid: 'I21.4', via: 'emergencia', servicoId: 'svc-cardio-uco', especialidadeId: 'esp-cardiologia', assistenteRoleId: 'role-rocha-uco-assistente', admissaoDiasAtras: 2, scp: 'alta_dependencia', newsScore: 3, manchester: 'laranja' },
  { nome: 'Sandra Pacheco', sexo: 'F', idade: 59, cpf: '913.234.567-13', diagnostico: 'Arritmia ventricular sustentada', cid: 'I47.2', via: 'emergencia', servicoId: 'svc-cardio-uco', especialidadeId: 'esp-cardiologia', assistenteRoleId: 'role-rocha-uco-assistente', admissaoDiasAtras: 3, scp: 'alta_dependencia', newsScore: 5, manchester: 'vermelho' },
  { nome: 'Antonio Machado', sexo: 'M', idade: 75, cpf: '914.234.567-14', diagnostico: 'ICC descompensada classe IV', cid: 'I50.9', via: 'emergencia', servicoId: 'svc-cardio-uco', especialidadeId: 'esp-cardiologia', assistenteRoleId: 'role-rocha-uco-assistente', admissaoDiasAtras: 4, scp: 'alta_dependencia', newsScore: 6, manchester: 'laranja' },
  { nome: 'Lucia Mendes', sexo: 'F', idade: 66, cpf: '915.234.567-15', diagnostico: 'Endocardite infecciosa', cid: 'I33.0', via: 'transferencia_externa', servicoId: 'svc-cardio-uco', especialidadeId: 'esp-cardiologia', assistenteRoleId: 'role-rocha-uco-assistente', admissaoDiasAtras: 10, scp: 'intermediarios', newsScore: 3, consultores: [{ roleId: 'role-lima-infecto', tipo: 'acompanhamento' }] },
  { nome: 'Ricardo Teixeira', sexo: 'M', idade: 57, cpf: '916.234.567-16', diagnostico: 'Pos-CATE eletivo', cid: 'Z95.5', via: 'eletiva', servicoId: 'svc-cardio-uco', especialidadeId: 'esp-cardiologia', assistenteRoleId: 'role-rocha-uco-assistente', admissaoDiasAtras: 1, status: 'alta_solicitada', scp: 'intermediarios', newsScore: 1 },
];

const ADMISSIONS_UCI_ADULTO: AdmissionSeed[] = [
  { nome: 'Vera Lucia Dantas', sexo: 'F', idade: 69, cpf: '917.234.567-17', diagnostico: 'Desmame de VM pos UTI', cid: 'J96.0', via: 'direto_uti', servicoId: 'svc-intensiva-uci', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-tavares-uci-assistente', admissaoDiasAtras: 2, scp: 'alta_dependencia', newsScore: 3, transferenciasHistorico: [{ origemLocationId: 'loc-bed-utia-02', tipo: 'step_down', motivo: 'Estabilidade respiratoria', diasAtras: 2 }] },
  { nome: 'Osvaldo Brito', sexo: 'M', idade: 71, cpf: '918.234.567-18', diagnostico: 'Pneumonia nosocomial em melhora', cid: 'J18.9', via: 'emergencia', servicoId: 'svc-intensiva-uci', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-tavares-uci-assistente', admissaoDiasAtras: 5, scp: 'alta_dependencia', newsScore: 3 },
  { nome: 'Maria Clara Duarte', sexo: 'F', idade: 62, cpf: '919.234.567-19', diagnostico: 'Pos-operatorio de colecistectomia complicada', cid: 'K81.0', via: 'eletiva', servicoId: 'svc-intensiva-uci', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-tavares-uci-assistente', admissaoDiasAtras: 2, scp: 'intermediarios', newsScore: 2, consultores: [{ roleId: 'role-martins-cir-ala3b', tipo: 'acompanhamento' }] },
  { nome: 'Jorge Pinto', sexo: 'M', idade: 65, cpf: '920.234.567-20', diagnostico: 'AVC em reabilitacao precoce', cid: 'I63.9', via: 'transferencia_externa', servicoId: 'svc-intensiva-uci', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-tavares-uci-assistente', admissaoDiasAtras: 9, scp: 'alta_dependencia', newsScore: 2, consultores: [{ roleId: 'role-gomes-neuro', tipo: 'acompanhamento' }] },
  { nome: 'Teresa Lima', sexo: 'F', idade: 58, cpf: '921.234.567-21', diagnostico: 'Cetoacidose diabetica resolvida', cid: 'E10.1', via: 'emergencia', servicoId: 'svc-intensiva-uci', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-tavares-uci-assistente', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 2, consultores: [{ roleId: 'role-barros-endo', tipo: 'acompanhamento' }] },
  { nome: 'Andre Lopes', sexo: 'M', idade: 60, cpf: '922.234.567-22', diagnostico: 'IRA em melhora', cid: 'N17.9', via: 'emergencia', servicoId: 'svc-intensiva-uci', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-tavares-uci-assistente', admissaoDiasAtras: 6, scp: 'alta_dependencia', newsScore: 3, consultores: [{ roleId: 'role-andrade-nefro', tipo: 'acompanhamento' }] },
  { nome: 'Clara Beatriz Soares', sexo: 'F', idade: 54, cpf: '923.234.567-23', diagnostico: 'Hepatite medicamentosa', cid: 'K71.9', via: 'emergencia', servicoId: 'svc-intensiva-uci', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-tavares-uci-assistente', admissaoDiasAtras: 4, scp: 'alta_dependencia', newsScore: 3, consultores: [{ roleId: 'role-cardoso-clinica-ala2a', tipo: 'acompanhamento' }] },
  { nome: 'Wellington Moreira', sexo: 'M', idade: 67, cpf: '924.234.567-24', diagnostico: 'Pos-AVC aguardando reabilitacao', cid: 'I69.3', via: 'direto_uti', servicoId: 'svc-intensiva-uci', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-tavares-uci-assistente', admissaoDiasAtras: 12, status: 'alta_solicitada', scp: 'alta_dependencia', newsScore: 2 },
];

const ADMISSIONS_ALA_2A: AdmissionSeed[] = [
  { nome: 'Helena Ferraz', sexo: 'F', idade: 78, cpf: '925.234.567-25', convenio: { nome: 'SulAmerica', plano: 'Classico' }, diagnostico: 'Pneumonia adquirida na comunidade', cid: 'J18.9', via: 'emergencia', servicoId: 'svc-pneumo-ala-2a', especialidadeId: 'esp-pneumologia', assistenteRoleId: 'role-dias-ala2a-diarista', admissaoDiasAtras: 4, scp: 'intermediarios', newsScore: 3 },
  { nome: 'Agostinho Silva', sexo: 'M', idade: 64, cpf: '926.234.567-26', diagnostico: 'ICC descompensada classe III', cid: 'I50.0', via: 'emergencia', servicoId: 'svc-cardio-ala-2a', especialidadeId: 'esp-cardiologia', assistenteRoleId: 'role-cardoso-clinica-ala2a', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 3, consultores: [{ roleId: 'role-rocha-uco-assistente', tipo: 'parecer' }] },
  { nome: 'Leticia Monteiro', sexo: 'F', idade: 71, cpf: '927.234.567-27', diagnostico: 'Descompensacao de diabetes tipo 2', cid: 'E11.9', via: 'emergencia', servicoId: 'svc-endo-ala-2a', especialidadeId: 'esp-endocrino', assistenteRoleId: 'role-barros-endo', admissaoDiasAtras: 5, scp: 'minimos', newsScore: 1 },
  { nome: 'Tomaz Ramalho', sexo: 'M', idade: 69, cpf: '928.234.567-28', diagnostico: 'Doenca renal cronica agudizada', cid: 'N18.9', via: 'emergencia', servicoId: 'svc-nefro-ala-2a', especialidadeId: 'esp-nefrologia', assistenteRoleId: 'role-andrade-nefro', admissaoDiasAtras: 6, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Sonia Figueira', sexo: 'F', idade: 66, cpf: '929.234.567-29', diagnostico: 'AVC isquemico leve em reabilitacao', cid: 'I63.9', via: 'emergencia', servicoId: 'svc-neuro-ala-2a', especialidadeId: 'esp-neurologia', assistenteRoleId: 'role-gomes-neuro', admissaoDiasAtras: 7, scp: 'alta_dependencia', newsScore: 2 },
  { nome: 'Rafael Azevedo', sexo: 'M', idade: 52, cpf: '930.234.567-30', diagnostico: 'Hepatite aguda em investigacao', cid: 'K72.0', via: 'emergencia', servicoId: 'svc-gastro-ala-2a', especialidadeId: 'esp-gastro', assistenteRoleId: 'role-cardoso-clinica-ala2a', admissaoDiasAtras: 4, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Beatriz Carneiro', sexo: 'F', idade: 59, cpf: '931.234.567-31', diagnostico: 'Crise asmatica grave', cid: 'J46', via: 'emergencia', servicoId: 'svc-pneumo-ala-2a', especialidadeId: 'esp-pneumologia', assistenteRoleId: 'role-dias-ala2a-diarista', admissaoDiasAtras: 2, scp: 'intermediarios', newsScore: 3, alergias: [{ substancia: 'AAS', reacao: 'broncoespasmo', severidade: 'grave' }] },
  { nome: 'Silvio Bezerra', sexo: 'M', idade: 73, cpf: '932.234.567-32', diagnostico: 'Fibrilacao atrial com RVR', cid: 'I48.0', via: 'emergencia', servicoId: 'svc-cardio-ala-2a', especialidadeId: 'esp-cardiologia', assistenteRoleId: 'role-cardoso-clinica-ala2a', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Marta Dias', sexo: 'F', idade: 61, cpf: '933.234.567-33', diagnostico: 'ITU complicada com pielonefrite', cid: 'N12', via: 'emergencia', servicoId: 'svc-clinica-ala-2a', especialidadeId: 'esp-clinica', assistenteRoleId: 'role-cardoso-clinica-ala2a', admissaoDiasAtras: 5, scp: 'intermediarios', newsScore: 2, consultores: [{ roleId: 'role-lima-infecto', tipo: 'parecer' }] },
  { nome: 'Henrique Braga', sexo: 'M', idade: 55, cpf: '934.234.567-34', diagnostico: 'Anemia por deficiencia de ferro grave', cid: 'D50.0', via: 'emergencia', servicoId: 'svc-clinica-ala-2a', especialidadeId: 'esp-clinica', assistenteRoleId: 'role-cardoso-clinica-ala2a', admissaoDiasAtras: 4, scp: 'minimos', newsScore: 1 },
  { nome: 'Aparecida Nogueira', sexo: 'F', idade: 82, cpf: '935.234.567-35', diagnostico: 'Delirium em idoso', cid: 'F05', via: 'emergencia', servicoId: 'svc-clinica-ala-2a', especialidadeId: 'esp-clinica', assistenteRoleId: 'role-cardoso-clinica-ala2a', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 2, alertas: [{ codigo: 'RISCO-QUEDA', descricao: 'Alto risco de queda', desde: computeAdmissao(3) }] },
  { nome: 'Otavio Campos', sexo: 'M', idade: 47, cpf: '936.234.567-36', diagnostico: 'Pancreatite alcoolica', cid: 'K85.2', via: 'emergencia', servicoId: 'svc-gastro-ala-2a', especialidadeId: 'esp-gastro', assistenteRoleId: 'role-cardoso-clinica-ala2a', admissaoDiasAtras: 6, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Celia Valente', sexo: 'F', idade: 68, cpf: '937.234.567-37', diagnostico: 'Cirrose descompensada', cid: 'K74.6', via: 'emergencia', servicoId: 'svc-gastro-ala-2a', especialidadeId: 'esp-gastro', assistenteRoleId: 'role-cardoso-clinica-ala2a', admissaoDiasAtras: 8, scp: 'alta_dependencia', newsScore: 3 },
  { nome: 'Paulo Barreto Jr', sexo: 'M', idade: 57, cpf: '938.234.567-38', diagnostico: 'Osteomielite cronica', cid: 'M86.6', via: 'transferencia_externa', servicoId: 'svc-clinica-ala-2a', especialidadeId: 'esp-clinica', assistenteRoleId: 'role-cardoso-clinica-ala2a', admissaoDiasAtras: 12, scp: 'minimos', newsScore: 1, consultores: [{ roleId: 'role-lima-infecto', tipo: 'acompanhamento' }, { roleId: 'role-sousa-orto', tipo: 'parecer' }] },
  { nome: 'Jacira Rodrigues', sexo: 'F', idade: 74, cpf: '939.234.567-39', diagnostico: 'AVC em investigacao', cid: 'I63.9', via: 'emergencia', servicoId: 'svc-neuro-ala-2a', especialidadeId: 'esp-neurologia', assistenteRoleId: 'role-gomes-neuro', admissaoDiasAtras: 2, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Marcelo Pontes', sexo: 'M', idade: 50, cpf: '940.234.567-40', diagnostico: 'Lupus em atividade', cid: 'M32.9', via: 'emergencia', servicoId: 'svc-clinica-ala-2a', especialidadeId: 'esp-clinica', assistenteRoleId: 'role-cardoso-clinica-ala2a', admissaoDiasAtras: 5, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Esther Caldeira', sexo: 'F', idade: 63, cpf: '941.234.567-41', diagnostico: 'Bronquiectasia infectada', cid: 'J47', via: 'emergencia', servicoId: 'svc-pneumo-ala-2a', especialidadeId: 'esp-pneumologia', assistenteRoleId: 'role-dias-ala2a-diarista', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Rafael Correa', sexo: 'M', idade: 42, cpf: '942.234.567-42', diagnostico: 'TVP membro inferior direito', cid: 'I80.2', via: 'emergencia', servicoId: 'svc-clinica-ala-2a', especialidadeId: 'esp-clinica', assistenteRoleId: 'role-cardoso-clinica-ala2a', admissaoDiasAtras: 2, scp: 'minimos', newsScore: 1 },
  { nome: 'Iracema Damasceno', sexo: 'F', idade: 76, cpf: '943.234.567-43', diagnostico: 'Tireotoxicose', cid: 'E05.9', via: 'emergencia', servicoId: 'svc-endo-ala-2a', especialidadeId: 'esp-endocrino', assistenteRoleId: 'role-barros-endo', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Nilson Gurgel', sexo: 'M', idade: 60, cpf: '944.234.567-44', diagnostico: 'Diabetes descompensada', cid: 'E11.6', via: 'emergencia', servicoId: 'svc-endo-ala-2a', especialidadeId: 'esp-endocrino', assistenteRoleId: 'role-barros-endo', admissaoDiasAtras: 4, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Zilda Passos', sexo: 'F', idade: 70, cpf: '945.234.567-45', diagnostico: 'ICC em ajuste', cid: 'I50.9', via: 'emergencia', servicoId: 'svc-cardio-ala-2a', especialidadeId: 'esp-cardiologia', assistenteRoleId: 'role-cardoso-clinica-ala2a', admissaoDiasAtras: 6, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Adalberto Xavier', sexo: 'M', idade: 58, cpf: '946.234.567-46', diagnostico: 'Sindrome nefrotica em investigacao', cid: 'N04.9', via: 'emergencia', servicoId: 'svc-nefro-ala-2a', especialidadeId: 'esp-nefrologia', assistenteRoleId: 'role-andrade-nefro', admissaoDiasAtras: 7, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Cleide Prado', sexo: 'F', idade: 53, cpf: '947.234.567-47', diagnostico: 'Miastenia gravis exacerbada', cid: 'G70.0', via: 'emergencia', servicoId: 'svc-neuro-ala-2a', especialidadeId: 'esp-neurologia', assistenteRoleId: 'role-gomes-neuro', admissaoDiasAtras: 4, scp: 'intermediarios', newsScore: 2 },
];

const ADMISSIONS_ALA_3B: AdmissionSeed[] = [
  { nome: 'Ernesto Vasques', sexo: 'M', idade: 56, cpf: '948.234.567-48', diagnostico: 'Pos-operatorio de colecistectomia videolap', cid: 'K80.2', via: 'eletiva', servicoId: 'svc-cir-geral-ala-3b', especialidadeId: 'esp-cir-geral', assistenteRoleId: 'role-martins-cir-ala3b', admissaoDiasAtras: 2, scp: 'minimos', newsScore: 1 },
  { nome: 'Daniela Queiroz', sexo: 'F', idade: 34, cpf: '949.234.567-49', diagnostico: 'Apendicectomia em pos-op', cid: 'K35.8', via: 'emergencia', servicoId: 'svc-cir-geral-ala-3b', especialidadeId: 'esp-cir-geral', assistenteRoleId: 'role-martins-cir-ala3b', admissaoDiasAtras: 1, status: 'alta_solicitada', scp: 'minimos', newsScore: 1 },
  { nome: 'Fabiano Duarte', sexo: 'M', idade: 67, cpf: '950.234.567-50', diagnostico: 'Pos-artroplastia de quadril', cid: 'S72.0', via: 'eletiva', servicoId: 'svc-ortopedia-ala-3b', especialidadeId: 'esp-ortopedia', assistenteRoleId: 'role-sousa-orto', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Gilberto Magalhaes', sexo: 'M', idade: 45, cpf: '951.234.567-51', diagnostico: 'Pos-op cirurgia de coluna', cid: 'M51.1', via: 'eletiva', servicoId: 'svc-ortopedia-ala-3b', especialidadeId: 'esp-ortopedia', assistenteRoleId: 'role-sousa-orto', admissaoDiasAtras: 4, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Kleber Mendonca', sexo: 'M', idade: 62, cpf: '952.234.567-52', diagnostico: 'Pos-prostatectomia radical', cid: 'C61', via: 'eletiva', servicoId: 'svc-urologia-ala-3b', especialidadeId: 'esp-urologia', assistenteRoleId: 'role-melo-uro', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Lindalva Bastos', sexo: 'F', idade: 58, cpf: '953.234.567-53', diagnostico: 'Hernia incisional corrigida', cid: 'K43.0', via: 'eletiva', servicoId: 'svc-cir-geral-ala-3b', especialidadeId: 'esp-cir-geral', assistenteRoleId: 'role-martins-cir-ala3b', admissaoDiasAtras: 2, scp: 'minimos', newsScore: 1 },
  { nome: 'Newton Bandeira', sexo: 'M', idade: 48, cpf: '954.234.567-54', diagnostico: 'Fratura de femur - pos fixacao', cid: 'S72.3', via: 'emergencia', servicoId: 'svc-ortopedia-ala-3b', especialidadeId: 'esp-ortopedia', assistenteRoleId: 'role-sousa-orto', admissaoDiasAtras: 5, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Olga Sartori', sexo: 'F', idade: 65, cpf: '955.234.567-55', diagnostico: 'Diverticulite operada', cid: 'K57.3', via: 'emergencia', servicoId: 'svc-cir-geral-ala-3b', especialidadeId: 'esp-cir-geral', assistenteRoleId: 'role-martins-cir-ala3b', admissaoDiasAtras: 4, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Patricio Galvao', sexo: 'M', idade: 71, cpf: '956.234.567-56', diagnostico: 'Pos-colectomia por CA', cid: 'C18.7', via: 'eletiva', servicoId: 'svc-cir-geral-ala-3b', especialidadeId: 'esp-cir-geral', assistenteRoleId: 'role-martins-cir-ala3b', admissaoDiasAtras: 6, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Quirino Peixoto', sexo: 'M', idade: 53, cpf: '957.234.567-57', diagnostico: 'Litiase renal com obstrucao', cid: 'N20.0', via: 'emergencia', servicoId: 'svc-urologia-ala-3b', especialidadeId: 'esp-urologia', assistenteRoleId: 'role-melo-uro', admissaoDiasAtras: 2, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Rute Amaral', sexo: 'F', idade: 40, cpf: '958.234.567-58', diagnostico: 'Pos-tireoidectomia', cid: 'E05.0', via: 'eletiva', servicoId: 'svc-cir-geral-ala-3b', especialidadeId: 'esp-cir-geral', assistenteRoleId: 'role-martins-cir-ala3b', admissaoDiasAtras: 2, scp: 'minimos', newsScore: 1 },
  { nome: 'Sebastiao Rangel', sexo: 'M', idade: 66, cpf: '959.234.567-59', diagnostico: 'Artroplastia de joelho', cid: 'M17.1', via: 'eletiva', servicoId: 'svc-ortopedia-ala-3b', especialidadeId: 'esp-ortopedia', assistenteRoleId: 'role-sousa-orto', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Talita Godoy', sexo: 'F', idade: 29, cpf: '960.234.567-60', diagnostico: 'Pos-op esplenectomia por trauma', cid: 'S36.0', via: 'emergencia', servicoId: 'svc-cir-geral-ala-3b', especialidadeId: 'esp-cir-geral', assistenteRoleId: 'role-martins-cir-ala3b', admissaoDiasAtras: 4, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Ubiratan Linhares', sexo: 'M', idade: 59, cpf: '961.234.567-61', diagnostico: 'Fasceite necrotizante pos-debridamento', cid: 'M72.6', via: 'emergencia', servicoId: 'svc-cir-geral-ala-3b', especialidadeId: 'esp-cir-geral', assistenteRoleId: 'role-martins-cir-ala3b', admissaoDiasAtras: 7, scp: 'alta_dependencia', newsScore: 3, consultores: [{ roleId: 'role-lima-infecto', tipo: 'acompanhamento' }] },
  { nome: 'Vania Cordeiro', sexo: 'F', idade: 55, cpf: '962.234.567-62', diagnostico: 'Pos-mastectomia por CA mama', cid: 'C50.9', via: 'eletiva', servicoId: 'svc-cir-geral-ala-3b', especialidadeId: 'esp-cir-geral', assistenteRoleId: 'role-martins-cir-ala3b', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Wilson Salgueiro', sexo: 'M', idade: 72, cpf: '963.234.567-63', diagnostico: 'RTU prostatica pos-op', cid: 'N40', via: 'eletiva', servicoId: 'svc-urologia-ala-3b', especialidadeId: 'esp-urologia', assistenteRoleId: 'role-melo-uro', admissaoDiasAtras: 2, scp: 'minimos', newsScore: 1 },
  { nome: 'Xenia Rebelo', sexo: 'F', idade: 38, cpf: '964.234.567-64', diagnostico: 'Hernia umbilical corrigida', cid: 'K42.9', via: 'eletiva', servicoId: 'svc-cir-geral-ala-3b', especialidadeId: 'esp-cir-geral', assistenteRoleId: 'role-martins-cir-ala3b', admissaoDiasAtras: 1, status: 'alta_solicitada', scp: 'minimos', newsScore: 1 },
  { nome: 'Yago Portela', sexo: 'M', idade: 27, cpf: '965.234.567-65', diagnostico: 'Fratura aberta de tibia - pos-op', cid: 'S82.2', via: 'emergencia', servicoId: 'svc-ortopedia-ala-3b', especialidadeId: 'esp-ortopedia', assistenteRoleId: 'role-sousa-orto', admissaoDiasAtras: 5, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Zoraide Brito', sexo: 'F', idade: 44, cpf: '966.234.567-66', diagnostico: 'Cistectomia parcial', cid: 'C67.9', via: 'eletiva', servicoId: 'svc-urologia-ala-3b', especialidadeId: 'esp-urologia', assistenteRoleId: 'role-melo-uro', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 1 },
];

const ADMISSIONS_PEDIATRIA: AdmissionSeed[] = [
  { nome: 'Arthur Goncalves', sexo: 'M', idade: 5, cpf: '967.234.567-67', diagnostico: 'Bronquiolite viral', cid: 'J21.9', via: 'emergencia', servicoId: 'svc-pediatria-ped', especialidadeId: 'esp-pediatria', assistenteRoleId: 'role-almeida-ped', admissaoDiasAtras: 2, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Bianca Nobre', sexo: 'F', idade: 7, cpf: '968.234.567-68', diagnostico: 'Pneumonia comunitaria pediatrica', cid: 'J18.9', via: 'emergencia', servicoId: 'svc-pediatria-ped', especialidadeId: 'esp-pediatria', assistenteRoleId: 'role-almeida-ped', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Caio Drummond', sexo: 'M', idade: 10, cpf: '969.234.567-69', diagnostico: 'Crise de asma', cid: 'J46', via: 'emergencia', servicoId: 'svc-pediatria-ped', especialidadeId: 'esp-pediatria', assistenteRoleId: 'role-almeida-ped', admissaoDiasAtras: 1, scp: 'minimos', newsScore: 1 },
  { nome: 'Duda Valadares', sexo: 'F', idade: 4, cpf: '970.234.567-70', diagnostico: 'GECA com desidratacao', cid: 'A09', via: 'emergencia', servicoId: 'svc-pediatria-ped', especialidadeId: 'esp-pediatria', assistenteRoleId: 'role-almeida-ped', admissaoDiasAtras: 2, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Enzo Fialho', sexo: 'M', idade: 2, cpf: '971.234.567-71', diagnostico: 'ITU febril', cid: 'N39.0', via: 'emergencia', servicoId: 'svc-pediatria-ped', especialidadeId: 'esp-pediatria', assistenteRoleId: 'role-almeida-ped', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Flavia Honorato', sexo: 'F', idade: 12, cpf: '972.234.567-72', diagnostico: 'Cetoacidose diabetica', cid: 'E10.1', via: 'emergencia', servicoId: 'svc-pediatria-ped', especialidadeId: 'esp-pediatria', assistenteRoleId: 'role-almeida-ped', admissaoDiasAtras: 2, scp: 'alta_dependencia', newsScore: 3, consultores: [{ roleId: 'role-barros-endo', tipo: 'acompanhamento' }] },
  { nome: 'Guilherme Ipiranga', sexo: 'M', idade: 8, cpf: '973.234.567-73', diagnostico: 'Apendicectomia pos-op', cid: 'K35.8', via: 'emergencia', servicoId: 'svc-pediatria-ped', especialidadeId: 'esp-pediatria', assistenteRoleId: 'role-almeida-ped', admissaoDiasAtras: 2, scp: 'intermediarios', newsScore: 1, consultores: [{ roleId: 'role-martins-cir-ala3b', tipo: 'acompanhamento' }] },
  { nome: 'Helena Juvenal', sexo: 'F', idade: 6, cpf: '974.234.567-74', diagnostico: 'Meningite viral', cid: 'G03.0', via: 'emergencia', servicoId: 'svc-pediatria-ped', especialidadeId: 'esp-pediatria', assistenteRoleId: 'role-almeida-ped', admissaoDiasAtras: 4, scp: 'intermediarios', newsScore: 2, consultores: [{ roleId: 'role-lima-infecto', tipo: 'parecer' }] },
  { nome: 'Icaro Krause', sexo: 'M', idade: 11, cpf: '975.234.567-75', diagnostico: 'Fratura de radio pos-imobilizacao', cid: 'S52.5', via: 'emergencia', servicoId: 'svc-pediatria-ped', especialidadeId: 'esp-pediatria', assistenteRoleId: 'role-almeida-ped', admissaoDiasAtras: 1, status: 'alta_solicitada', scp: 'minimos', newsScore: 1 },
  { nome: 'Julia Lemos', sexo: 'F', idade: 3, cpf: '976.234.567-76', diagnostico: 'Laringite estridulosa', cid: 'J05.0', via: 'emergencia', servicoId: 'svc-pediatria-ped', especialidadeId: 'esp-pediatria', assistenteRoleId: 'role-almeida-ped', admissaoDiasAtras: 1, scp: 'minimos', newsScore: 1 },
  { nome: 'Kauan Martucci', sexo: 'M', idade: 9, cpf: '977.234.567-77', diagnostico: 'Anemia falciforme em crise', cid: 'D57.1', via: 'emergencia', servicoId: 'svc-pediatria-ped', especialidadeId: 'esp-pediatria', assistenteRoleId: 'role-almeida-ped', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Lara Nascimento', sexo: 'F', idade: 1, cpf: '978.234.567-78', diagnostico: 'Bronquiolite grave', cid: 'J21.9', via: 'emergencia', servicoId: 'svc-pediatria-ped', especialidadeId: 'esp-pediatria', assistenteRoleId: 'role-almeida-ped', admissaoDiasAtras: 4, scp: 'alta_dependencia', newsScore: 3 },
  { nome: 'Miguel Otani', sexo: 'M', idade: 13, cpf: '979.234.567-79', diagnostico: 'Dengue grave', cid: 'A91', via: 'emergencia', servicoId: 'svc-pediatria-ped', especialidadeId: 'esp-pediatria', assistenteRoleId: 'role-almeida-ped', admissaoDiasAtras: 3, scp: 'alta_dependencia', newsScore: 3 },
  { nome: 'Nicole Padilha', sexo: 'F', idade: 14, cpf: '980.234.567-80', diagnostico: 'Apendicite em pos-op complicado', cid: 'K35.2', via: 'emergencia', servicoId: 'svc-pediatria-ped', especialidadeId: 'esp-pediatria', assistenteRoleId: 'role-almeida-ped', admissaoDiasAtras: 5, scp: 'intermediarios', newsScore: 2 },
];

const ADMISSIONS_MATERNIDADE: AdmissionSeed[] = [
  { nome: 'Amanda Aparecida Souza', sexo: 'F', idade: 28, cpf: '981.234.567-81', diagnostico: 'Pos-parto normal 24h', cid: 'Z39.0', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 1, scp: 'minimos', newsScore: 1 },
  { nome: 'Bianca Catarina', sexo: 'F', idade: 32, cpf: '982.234.567-82', diagnostico: 'Pos-cesariana', cid: 'O82', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 2, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Carolina Daros', sexo: 'F', idade: 25, cpf: '983.234.567-83', diagnostico: 'Pos-parto normal', cid: 'Z39.0', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 1, scp: 'minimos', newsScore: 1 },
  { nome: 'Debora Estrela', sexo: 'F', idade: 30, cpf: '984.234.567-84', diagnostico: 'Pre-eclampsia em puerperio', cid: 'O14.0', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Elaine Farias', sexo: 'F', idade: 36, cpf: '985.234.567-85', diagnostico: 'Pos-cesariana por SFA', cid: 'O68.0', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 2, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Flor Gontijo', sexo: 'F', idade: 22, cpf: '986.234.567-86', diagnostico: 'Pos-parto normal adolescente', cid: 'Z39.0', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 1, scp: 'minimos', newsScore: 1 },
  { nome: 'Gabriela Hortencia', sexo: 'F', idade: 34, cpf: '987.234.567-87', diagnostico: 'Diabetes gestacional em controle', cid: 'O24.4', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 2, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Helena Ipanema', sexo: 'F', idade: 29, cpf: '988.234.567-88', diagnostico: 'Trabalho de parto prematuro', cid: 'O60.1', via: 'emergencia', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 2, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Ingrid Jesus', sexo: 'F', idade: 27, cpf: '989.234.567-89', diagnostico: 'Pos-parto normal', cid: 'Z39.0', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 1, scp: 'minimos', newsScore: 1 },
  { nome: 'Juliane Kassab', sexo: 'F', idade: 31, cpf: '990.234.567-90', diagnostico: 'Pos-cesariana iterativa', cid: 'O82', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 2, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Karina Lacerda', sexo: 'F', idade: 38, cpf: '991.234.567-91', diagnostico: 'HELLP em investigacao', cid: 'O14.2', via: 'emergencia', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 3, scp: 'alta_dependencia', newsScore: 3 },
  { nome: 'Larissa Mauad', sexo: 'F', idade: 24, cpf: '992.234.567-92', diagnostico: 'Pos-parto normal', cid: 'Z39.0', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 1, scp: 'minimos', newsScore: 1 },
  { nome: 'Marta Nascentes', sexo: 'F', idade: 33, cpf: '993.234.567-93', diagnostico: 'Pos-cesariana', cid: 'O82', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 2, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Natalia Oliveira Paes', sexo: 'F', idade: 26, cpf: '994.234.567-94', diagnostico: 'Pos-parto normal', cid: 'Z39.0', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 1, scp: 'minimos', newsScore: 1 },
  { nome: 'Olga Pantanal', sexo: 'F', idade: 35, cpf: '995.234.567-95', diagnostico: 'Pos-cesariana com DPP previo', cid: 'O82', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Patricia Queluz', sexo: 'F', idade: 37, cpf: '996.234.567-96', diagnostico: 'Descolamento placentario em puerperio', cid: 'O45.9', via: 'emergencia', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 2, scp: 'alta_dependencia', newsScore: 2 },
  { nome: 'Quenia Rosa', sexo: 'F', idade: 23, cpf: '997.234.567-97', diagnostico: 'Pos-parto normal', cid: 'Z39.0', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 1, scp: 'minimos', newsScore: 1 },
  { nome: 'Renata Simoes', sexo: 'F', idade: 40, cpf: '998.234.567-98', diagnostico: 'Pos-laparotomia por gravidez ectopica', cid: 'O00.1', via: 'emergencia', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 3, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Sabrina Tome', sexo: 'F', idade: 21, cpf: '999.234.567-99', diagnostico: 'Pos-parto normal adolescente', cid: 'Z39.0', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 1, scp: 'minimos', newsScore: 1 },
  { nome: 'Talia Uzumaki', sexo: 'F', idade: 29, cpf: '100.234.567-00', diagnostico: 'Pos-cesariana eletiva', cid: 'O82', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 2, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Ursula Vilhena', sexo: 'F', idade: 32, cpf: '101.234.567-01', diagnostico: 'Puerperio com infeccao', cid: 'O86.0', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 4, scp: 'intermediarios', newsScore: 2 },
  { nome: 'Vitoria Wendel', sexo: 'F', idade: 28, cpf: '102.234.567-02', diagnostico: 'Pos-parto normal', cid: 'Z39.0', via: 'maternidade', servicoId: 'svc-gineco-maternidade', especialidadeId: 'esp-gineco', assistenteRoleId: 'role-figueiredo-mat', admissaoDiasAtras: 1, status: 'alta_solicitada', scp: 'minimos', newsScore: 1 },
];

const ADMISSIONS_UTI_NEO: AdmissionSeed[] = [
  { nome: 'RN Silva', sexo: 'M', idade: 0, cpf: '103.234.567-03', diagnostico: 'Prematuridade extrema 28 semanas', cid: 'P07.2', via: 'direto_uti', servicoId: 'svc-intensiva-uti-neo', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-pereira-uti-neo', admissaoDiasAtras: 14, scp: 'intensivo', newsScore: 4 },
  { nome: 'RN Costa', sexo: 'F', idade: 0, cpf: '104.234.567-04', diagnostico: 'Sindrome do desconforto respiratorio neonatal', cid: 'P22.0', via: 'direto_uti', servicoId: 'svc-intensiva-uti-neo', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-pereira-uti-neo', admissaoDiasAtras: 7, scp: 'intensivo', newsScore: 3 },
  { nome: 'RN Almeida', sexo: 'M', idade: 0, cpf: '105.234.567-05', diagnostico: 'Sepse neonatal precoce', cid: 'P36.9', via: 'direto_uti', servicoId: 'svc-intensiva-uti-neo', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-pereira-uti-neo', admissaoDiasAtras: 3, scp: 'intensivo', newsScore: 4, consultores: [{ roleId: 'role-lima-infecto', tipo: 'acompanhamento' }] },
  { nome: 'RN Oliveira', sexo: 'F', idade: 0, cpf: '106.234.567-06', diagnostico: 'Hipoglicemia neonatal', cid: 'P70.4', via: 'direto_uti', servicoId: 'svc-intensiva-uti-neo', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-pereira-uti-neo', admissaoDiasAtras: 2, scp: 'alta_dependencia', newsScore: 2 },
  { nome: 'RN Pereira', sexo: 'M', idade: 0, cpf: '107.234.567-07', diagnostico: 'Icteria neonatal severa', cid: 'P59.9', via: 'direto_uti', servicoId: 'svc-intensiva-uti-neo', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-pereira-uti-neo', admissaoDiasAtras: 4, scp: 'alta_dependencia', newsScore: 2 },
  { nome: 'RN Rocha', sexo: 'F', idade: 0, cpf: '108.234.567-08', diagnostico: 'Cardiopatia congenita em avaliacao', cid: 'Q24.9', via: 'transferencia_externa', servicoId: 'svc-intensiva-uti-neo', especialidadeId: 'esp-intensiva', assistenteRoleId: 'role-pereira-uti-neo', admissaoDiasAtras: 6, scp: 'intensivo', newsScore: 3, consultores: [{ roleId: 'role-rocha-uco-assistente', tipo: 'acompanhamento' }] },
];

const ADMISSIONS_PS: AdmissionSeed[] = Array.from({ length: 30 }, (_, i) => {
  const idx = i + 1;
  const seeds: AdmissionSeed[] = [
    { nome: 'Adalto Bezerra', sexo: 'M', idade: 45, cpf: `109.234.568-${String(idx).padStart(2, '0')}`, diagnostico: 'Dor toracica em investigacao', cid: 'R07.4', via: 'emergencia', servicoId: 'svc-emerg-ps', especialidadeId: 'esp-emergencia', assistenteRoleId: 'role-nogueira-ps', admissaoDiasAtras: 0, scp: 'intermediarios', newsScore: 2, manchester: 'laranja' },
    { nome: 'Barbara Catelo', sexo: 'F', idade: 34, cpf: `110.234.568-${String(idx).padStart(2, '0')}`, diagnostico: 'Crise convulsiva', cid: 'R56.8', via: 'emergencia', servicoId: 'svc-emerg-ps', especialidadeId: 'esp-emergencia', assistenteRoleId: 'role-nogueira-ps', admissaoDiasAtras: 0, scp: 'intermediarios', newsScore: 2, manchester: 'laranja', consultores: [{ roleId: 'role-gomes-neuro', tipo: 'parecer' }] },
    { nome: 'Caetano Dumont', sexo: 'M', idade: 67, cpf: `111.234.568-${String(idx).padStart(2, '0')}`, diagnostico: 'Politrauma pos-queda', cid: 'T07', via: 'emergencia', servicoId: 'svc-emerg-ps', especialidadeId: 'esp-emergencia', assistenteRoleId: 'role-nogueira-ps', admissaoDiasAtras: 0, scp: 'alta_dependencia', newsScore: 4, manchester: 'vermelho', consultores: [{ roleId: 'role-sousa-orto', tipo: 'parecer' }] },
    { nome: 'Diana Esteves', sexo: 'F', idade: 28, cpf: `112.234.568-${String(idx).padStart(2, '0')}`, diagnostico: 'Abdome agudo', cid: 'R10.0', via: 'emergencia', servicoId: 'svc-emerg-ps', especialidadeId: 'esp-emergencia', assistenteRoleId: 'role-nogueira-ps', admissaoDiasAtras: 0, scp: 'intermediarios', newsScore: 2, manchester: 'laranja' },
    { nome: 'Eliseu Fortes', sexo: 'M', idade: 52, cpf: `113.234.568-${String(idx).padStart(2, '0')}`, diagnostico: 'Hemorragia digestiva alta', cid: 'K92.2', via: 'emergencia', servicoId: 'svc-emerg-ps', especialidadeId: 'esp-emergencia', assistenteRoleId: 'role-nogueira-ps', admissaoDiasAtras: 1, scp: 'alta_dependencia', newsScore: 3, manchester: 'vermelho' },
    { nome: 'Fatima Gusmao', sexo: 'F', idade: 71, cpf: `114.234.568-${String(idx).padStart(2, '0')}`, diagnostico: 'AVC em investigacao', cid: 'I64', via: 'emergencia', servicoId: 'svc-neuro-ps', especialidadeId: 'esp-neurologia', assistenteRoleId: 'role-gomes-neuro', admissaoDiasAtras: 0, scp: 'alta_dependencia', newsScore: 3, manchester: 'vermelho' },
  ];
  return seeds[i % seeds.length];
}).map((seed, i) => ({ ...seed, nome: `${seed.nome} ${i + 1}`, cpf: `120.234.${String(i).padStart(3, '0')}-00` }));

const ADMISSIONS_CC: AdmissionSeed[] = [
  { nome: 'Edivaldo Cirurgia', sexo: 'M', idade: 58, cpf: '130.234.567-20', diagnostico: 'Em cirurgia - colectomia', cid: 'C18.7', via: 'eletiva', servicoId: 'svc-cir-geral-cc', especialidadeId: 'esp-cir-geral', assistenteRoleId: 'role-martins-cir-ala3b', admissaoDiasAtras: 0, scp: 'intensivo', newsScore: 2 },
  { nome: 'Fatima Cirurgia', sexo: 'F', idade: 45, cpf: '131.234.567-21', diagnostico: 'Em cirurgia - histerectomia', cid: 'N80.9', via: 'eletiva', servicoId: 'svc-cir-geral-cc', especialidadeId: 'esp-cir-geral', assistenteRoleId: 'role-martins-cir-ala3b', admissaoDiasAtras: 0, scp: 'intermediarios', newsScore: 1 },
  { nome: 'Genivaldo Cirurgia', sexo: 'M', idade: 72, cpf: '132.234.567-22', diagnostico: 'Em cirurgia - revascularizacao', cid: 'I25.1', via: 'eletiva', servicoId: 'svc-cir-geral-cc', especialidadeId: 'esp-cir-geral', assistenteRoleId: 'role-martins-cir-ala3b', admissaoDiasAtras: 0, scp: 'intensivo', newsScore: 3 },
  { nome: 'Helia Cirurgia', sexo: 'F', idade: 39, cpf: '133.234.567-23', diagnostico: 'Em cirurgia - colecistectomia', cid: 'K80.2', via: 'eletiva', servicoId: 'svc-cir-geral-cc', especialidadeId: 'esp-cir-geral', assistenteRoleId: 'role-martins-cir-ala3b', admissaoDiasAtras: 0, scp: 'intermediarios', newsScore: 1 },
];

/** Default CareTeam member templates per unit. */
const CARE_TEAM_UNIT_TEMPLATES: Record<string, { enfRoleId: string; farmRoleId?: string; fisioRoleId?: string; nutRoleId?: string; socialRoleId?: string }> = {
  'un-uti-adulto': { enfRoleId: 'role-enf-ana-uti', farmRoleId: 'role-farm-bruna', fisioRoleId: 'role-fisio-victor', nutRoleId: 'role-nut-zara' },
  'un-uco': { enfRoleId: 'role-enf-carla-uco', farmRoleId: 'role-farm-bruna' },
  'un-uci-adulto': { enfRoleId: 'role-enf-daniel-uci', farmRoleId: 'role-farm-bruna', fisioRoleId: 'role-fisio-victor', nutRoleId: 'role-nut-zara' },
  'un-ala-2a': { enfRoleId: 'role-enf-elaine-ala2a', farmRoleId: 'role-farm-caio', fisioRoleId: 'role-fisio-yara', nutRoleId: 'role-nut-zara', socialRoleId: 'role-social-diana' },
  'un-ala-3b': { enfRoleId: 'role-enf-fernanda-ala3b', farmRoleId: 'role-farm-caio', fisioRoleId: 'role-fisio-wagner', nutRoleId: 'role-nut-andre', socialRoleId: 'role-social-diana' },
  'un-pediatria': { enfRoleId: 'role-tec-pedro-ped', fisioRoleId: 'role-fisio-wagner', nutRoleId: 'role-nut-andre', socialRoleId: 'role-social-diana' },
  'un-maternidade': { enfRoleId: 'role-enf-helena-mat', nutRoleId: 'role-nut-andre', socialRoleId: 'role-social-diana' },
  'un-uti-neo': { enfRoleId: 'role-tec-tiago-uti-neo' },
  'un-ps': { enfRoleId: 'role-enf-gustavo-ps', socialRoleId: 'role-social-diana' },
  'un-cc': { enfRoleId: 'role-enf-fernanda-ala3b' },
};

/** Map from PractitionerRole id to its ProfissionalSaude id (needed for CareTeam participants). */
const ROLE_TO_PROF: Record<string, string> = Object.fromEntries(
  // Will be built dynamically below after PRACTITIONER_ROLES is in scope.
  PRACTITIONER_ROLES.map((r) => [r.id, r.profissionalId]),
);

/** Build Paciente / Internacao / CareTeam / Transferencia from seed + bed allocation. */
function buildFromSeeds(args: {
  seeds: AdmissionSeed[];
  bedIds: string[];
  unidadeId: string;
  pacientePrefix: string;
  internacaoPrefix: string;
  mrnStart: number;
  atnStart: number;
}): { pacientes: Paciente[]; internacoes: Internacao[]; careTeams: CareTeam[]; transferencias: TransferenciaInterna[] } {
  const { seeds, bedIds, unidadeId, pacientePrefix, internacaoPrefix, mrnStart, atnStart } = args;
  const pacientes: Paciente[] = [];
  const internacoes: Internacao[] = [];
  const careTeams: CareTeam[] = [];
  const transferencias: TransferenciaInterna[] = [];

  seeds.forEach((seed, i) => {
    if (i >= bedIds.length) return;
    const pid = `${pacientePrefix}${String(mrnStart + i).padStart(3, '0')}`;
    const mrn = `MRN-${String(mrnStart + i).padStart(3, '0')}`;
    const atn = `ATN-2026-${String(atnStart + i).padStart(5, '0')}`;
    const iid = `${internacaoPrefix}${String(atnStart + i).padStart(5, '0')}`;
    const ctId = `ct-${iid}`;
    const locationAtualId = bedIds[i];
    const admissaoEm = computeAdmissao(seed.admissaoDiasAtras);
    const template = CARE_TEAM_UNIT_TEMPLATES[unidadeId];

    // Paciente
    pacientes.push({
      id: pid,
      mrn,
      nome: seed.nome,
      cpf: seed.cpf,
      cns: seed.cns,
      dataNascimento: computeDob(seed.idade),
      sexo: seed.sexo,
      tipoSanguineo: seed.tipoSanguineo,
      contato: {},
      convenio: seed.convenio ? { nome: seed.convenio.nome, numero: `${seed.convenio.nome.substring(0, 3).toUpperCase()}-${100000 + mrnStart + i}`, plano: seed.convenio.plano } : undefined,
      alergias: seed.alergias ?? [],
      alertas: seed.alertas ?? [],
    });

    // Transferencias historicas
    const transferenciaIds: string[] = [];
    if (seed.transferenciasHistorico) {
      seed.transferenciasHistorico.forEach((t, ti) => {
        const tid = `trans-${iid}-${ti}`;
        transferenciaIds.push(tid);
        transferencias.push({
          id: tid,
          internacaoId: iid,
          origemLocationId: t.origemLocationId,
          destinoLocationId: locationAtualId,
          tipo: t.tipo,
          motivo: t.motivo,
          solicitadoPorRoleId: seed.assistenteRoleId,
          solicitadoEm: computeAdmissao(t.diasAtras),
          executadoEm: computeAdmissao(t.diasAtras),
          receptorRoleId: template?.enfRoleId,
          transporteChecklistCompleto: true,
        });
      });
    }

    // Internacao
    internacoes.push({
      id: iid,
      pacienteId: pid,
      numeroAtendimento: atn,
      admissao: {
        em: admissaoEm,
        via: seed.via,
        origem: seed.origem,
        ...(seed.manchester
          ? { classificacaoRisco: { manchester: seed.manchester, avaliadorId: 'prof-nogueira-bruno', em: admissaoEm } }
          : {}),
      },
      status: seed.status ?? 'internado',
      locationAtualId,
      unidadeAtualId: unidadeId,
      servicoPrimarioId: seed.servicoId,
      especialidadePrimariaId: seed.especialidadeId,
      medicoAssistenteRoleId: seed.assistenteRoleId,
      consultores: (seed.consultores ?? []).map((c) => ({ roleId: c.roleId, tipo: c.tipo, solicitadoEm: computeAdmissao(Math.max(0, seed.admissaoDiasAtras - 1)) })),
      careTeamId: ctId,
      cidPrincipal: seed.cid,
      cidsSecundarios: seed.cidsSecundarios ?? [],
      hipoteseDiagnostica: seed.diagnostico,
      scpAtual: seed.scp,
      newsScore: seed.newsScore,
      transferencias: transferenciaIds,
      criadoEm: admissaoEm,
      atualizadoEm: NOW,
    });

    // CareTeam
    const participantes: CareTeam['participantes'] = [
      {
        profissionalId: ROLE_TO_PROF[seed.assistenteRoleId] ?? 'prof-silva-marcos',
        roleId: seed.assistenteRoleId,
        papel: 'medico_assistente',
        especialidadeId: seed.especialidadeId,
        desde: admissaoEm,
      },
    ];
    if (template?.enfRoleId) {
      participantes.push({
        profissionalId: ROLE_TO_PROF[template.enfRoleId],
        roleId: template.enfRoleId,
        papel: 'enfermeiro_referencia',
        desde: admissaoEm,
      });
    }
    if (template?.farmRoleId) {
      participantes.push({
        profissionalId: ROLE_TO_PROF[template.farmRoleId],
        roleId: template.farmRoleId,
        papel: 'farmaceutico_clinico',
        especialidadeId: 'esp-farmacia',
        desde: admissaoEm,
      });
    }
    if (template?.fisioRoleId) {
      participantes.push({
        profissionalId: ROLE_TO_PROF[template.fisioRoleId],
        roleId: template.fisioRoleId,
        papel: 'fisioterapeuta',
        especialidadeId: 'esp-fisio',
        desde: admissaoEm,
      });
    }
    if (template?.nutRoleId) {
      participantes.push({
        profissionalId: ROLE_TO_PROF[template.nutRoleId],
        roleId: template.nutRoleId,
        papel: 'nutricionista',
        especialidadeId: 'esp-nutricao',
        desde: admissaoEm,
      });
    }
    if (template?.socialRoleId) {
      participantes.push({
        profissionalId: ROLE_TO_PROF[template.socialRoleId],
        roleId: template.socialRoleId,
        papel: 'assistente_social',
        especialidadeId: 'esp-social',
        desde: admissaoEm,
      });
    }
    // Consultores (medicos) as medico_consultor
    (seed.consultores ?? []).forEach((c) => {
      const profId = ROLE_TO_PROF[c.roleId];
      if (profId) {
        participantes.push({
          profissionalId: profId,
          roleId: c.roleId,
          papel: 'medico_consultor',
          desde: computeAdmissao(Math.max(0, seed.admissaoDiasAtras - 1)),
        });
      }
    });

    careTeams.push({
      id: ctId,
      internacaoId: iid,
      pacienteId: pid,
      status: 'ativo',
      participantes,
    });
  });

  return { pacientes, internacoes, careTeams, transferencias };
}

const OCCUPIED_UTI_ADULTO = BEDS_UTI_ADULTO.filter((b) => b.operationalStatus === 'O').map((b) => b.id);
const OCCUPIED_UCO = BEDS_UCO.filter((b) => b.operationalStatus === 'O').map((b) => b.id);
const OCCUPIED_UCI_ADULTO = BEDS_UCI_ADULTO.filter((b) => b.operationalStatus === 'O').map((b) => b.id);
const OCCUPIED_ALA_2A = BEDS_ALA_2A.filter((b) => b.operationalStatus === 'O').map((b) => b.id);
const OCCUPIED_ALA_3B = BEDS_ALA_3B.filter((b) => b.operationalStatus === 'O').map((b) => b.id);
const OCCUPIED_PEDIATRIA = BEDS_PEDIATRIA.filter((b) => b.operationalStatus === 'O').map((b) => b.id);
const OCCUPIED_MATERNIDADE = BEDS_MATERNIDADE.filter((b) => b.operationalStatus === 'O').map((b) => b.id);
const OCCUPIED_UTI_NEO = BEDS_UTI_NEO.filter((b) => b.operationalStatus === 'O').map((b) => b.id);
const OCCUPIED_PS = BEDS_PS.filter((b) => b.operationalStatus === 'O').map((b) => b.id);
const OCCUPIED_CC = BEDS_CC.filter((b) => b.operationalStatus === 'O').map((b) => b.id);

const BUILT_UTI_ADULTO = buildFromSeeds({ seeds: ADMISSIONS_UTI_ADULTO, bedIds: OCCUPIED_UTI_ADULTO, unidadeId: 'un-uti-adulto', pacientePrefix: 'pac-', internacaoPrefix: 'int-', mrnStart: 1, atnStart: 1 });
const BUILT_UCO = buildFromSeeds({ seeds: ADMISSIONS_UCO, bedIds: OCCUPIED_UCO, unidadeId: 'un-uco', pacientePrefix: 'pac-', internacaoPrefix: 'int-', mrnStart: 11, atnStart: 11 });
const BUILT_UCI_ADULTO = buildFromSeeds({ seeds: ADMISSIONS_UCI_ADULTO, bedIds: OCCUPIED_UCI_ADULTO, unidadeId: 'un-uci-adulto', pacientePrefix: 'pac-', internacaoPrefix: 'int-', mrnStart: 17, atnStart: 17 });
const BUILT_ALA_2A = buildFromSeeds({ seeds: ADMISSIONS_ALA_2A, bedIds: OCCUPIED_ALA_2A, unidadeId: 'un-ala-2a', pacientePrefix: 'pac-', internacaoPrefix: 'int-', mrnStart: 25, atnStart: 25 });
const BUILT_ALA_3B = buildFromSeeds({ seeds: ADMISSIONS_ALA_3B, bedIds: OCCUPIED_ALA_3B, unidadeId: 'un-ala-3b', pacientePrefix: 'pac-', internacaoPrefix: 'int-', mrnStart: 48, atnStart: 48 });
const BUILT_PEDIATRIA = buildFromSeeds({ seeds: ADMISSIONS_PEDIATRIA, bedIds: OCCUPIED_PEDIATRIA, unidadeId: 'un-pediatria', pacientePrefix: 'pac-', internacaoPrefix: 'int-', mrnStart: 67, atnStart: 67 });
const BUILT_MATERNIDADE = buildFromSeeds({ seeds: ADMISSIONS_MATERNIDADE, bedIds: OCCUPIED_MATERNIDADE, unidadeId: 'un-maternidade', pacientePrefix: 'pac-', internacaoPrefix: 'int-', mrnStart: 81, atnStart: 81 });
const BUILT_UTI_NEO = buildFromSeeds({ seeds: ADMISSIONS_UTI_NEO, bedIds: OCCUPIED_UTI_NEO, unidadeId: 'un-uti-neo', pacientePrefix: 'pac-', internacaoPrefix: 'int-', mrnStart: 103, atnStart: 103 });
const BUILT_PS = buildFromSeeds({ seeds: ADMISSIONS_PS, bedIds: OCCUPIED_PS, unidadeId: 'un-ps', pacientePrefix: 'pac-', internacaoPrefix: 'int-', mrnStart: 109, atnStart: 109 });
const BUILT_CC = buildFromSeeds({ seeds: ADMISSIONS_CC, bedIds: OCCUPIED_CC, unidadeId: 'un-cc', pacientePrefix: 'pac-', internacaoPrefix: 'int-', mrnStart: 139, atnStart: 139 });

export const PACIENTES: Paciente[] = [
  ...BUILT_UTI_ADULTO.pacientes,
  ...BUILT_UCO.pacientes,
  ...BUILT_UCI_ADULTO.pacientes,
  ...BUILT_ALA_2A.pacientes,
  ...BUILT_ALA_3B.pacientes,
  ...BUILT_PEDIATRIA.pacientes,
  ...BUILT_MATERNIDADE.pacientes,
  ...BUILT_UTI_NEO.pacientes,
  ...BUILT_PS.pacientes,
  ...BUILT_CC.pacientes,
];

export const INTERNACOES: Internacao[] = [
  ...BUILT_UTI_ADULTO.internacoes,
  ...BUILT_UCO.internacoes,
  ...BUILT_UCI_ADULTO.internacoes,
  ...BUILT_ALA_2A.internacoes,
  ...BUILT_ALA_3B.internacoes,
  ...BUILT_PEDIATRIA.internacoes,
  ...BUILT_MATERNIDADE.internacoes,
  ...BUILT_UTI_NEO.internacoes,
  ...BUILT_PS.internacoes,
  ...BUILT_CC.internacoes,
];

export const CARE_TEAMS: CareTeam[] = [
  ...BUILT_UTI_ADULTO.careTeams,
  ...BUILT_UCO.careTeams,
  ...BUILT_UCI_ADULTO.careTeams,
  ...BUILT_ALA_2A.careTeams,
  ...BUILT_ALA_3B.careTeams,
  ...BUILT_PEDIATRIA.careTeams,
  ...BUILT_MATERNIDADE.careTeams,
  ...BUILT_UTI_NEO.careTeams,
  ...BUILT_PS.careTeams,
  ...BUILT_CC.careTeams,
];

export const TRANSFERENCIAS_INTERNAS: TransferenciaInterna[] = [
  ...BUILT_UTI_ADULTO.transferencias,
  ...BUILT_UCO.transferencias,
  ...BUILT_UCI_ADULTO.transferencias,
  ...BUILT_ALA_2A.transferencias,
  ...BUILT_ALA_3B.transferencias,
  ...BUILT_PEDIATRIA.transferencias,
  ...BUILT_MATERNIDADE.transferencias,
  ...BUILT_UTI_NEO.transferencias,
  ...BUILT_PS.transferencias,
  ...BUILT_CC.transferencias,
];

// ---------------------------------------------------------------------------
// Indices (O(1) lookup)
// ---------------------------------------------------------------------------

const LOCATION_INDEX: ReadonlyMap<string, Location> = new Map(LOCATIONS.map((l) => [l.id, l]));
const UNIDADE_INDEX: ReadonlyMap<string, UnidadeAssistencial> = new Map(UNIDADES_ASSISTENCIAIS.map((u) => [u.id, u]));
const ESPECIALIDADE_INDEX: ReadonlyMap<string, Especialidade> = new Map(ESPECIALIDADES.map((e) => [e.id, e]));
const PACIENTE_INDEX: ReadonlyMap<string, Paciente> = new Map(PACIENTES.map((p) => [p.id, p]));
const INTERNACAO_INDEX: ReadonlyMap<string, Internacao> = new Map(INTERNACOES.map((i) => [i.id, i]));
const PROFISSIONAL_INDEX: ReadonlyMap<string, ProfissionalSaude> = new Map(PROFISSIONAIS.map((p) => [p.id, p]));
const ROLE_INDEX: ReadonlyMap<string, PractitionerRole> = new Map(PRACTITIONER_ROLES.map((r) => [r.id, r]));
const ORGANIZATION_INDEX: ReadonlyMap<string, Organization> = new Map(ORGANIZATIONS.map((o) => [o.id, o]));
const HEALTHCARE_SERVICE_INDEX: ReadonlyMap<string, HealthcareService> = new Map(HEALTHCARE_SERVICES.map((s) => [s.id, s]));
const CARE_TEAM_INDEX: ReadonlyMap<string, CareTeam> = new Map(CARE_TEAMS.map((c) => [c.id, c]));
const INTERNACAO_BY_LOCATION: ReadonlyMap<string, Internacao> = new Map(INTERNACOES.filter((i) => i.status !== 'alta_completada').map((i) => [i.locationAtualId, i]));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getLocationById(id: string): Location | undefined {
  return LOCATION_INDEX.get(id);
}

export function getUnidadeById(id: string): UnidadeAssistencial | undefined {
  return UNIDADE_INDEX.get(id);
}

export function getEspecialidadeById(id: string): Especialidade | undefined {
  return ESPECIALIDADE_INDEX.get(id);
}

export function getPacienteById(id: string): Paciente | undefined {
  return PACIENTE_INDEX.get(id);
}

export function getInternacaoById(id: string): Internacao | undefined {
  return INTERNACAO_INDEX.get(id);
}

export function getProfissionalById(id: string): ProfissionalSaude | undefined {
  return PROFISSIONAL_INDEX.get(id);
}

export function getPractitionerRoleById(id: string): PractitionerRole | undefined {
  return ROLE_INDEX.get(id);
}

export function getOrganizationById(id: string): Organization | undefined {
  return ORGANIZATION_INDEX.get(id);
}

export function getHealthcareServiceById(id: string): HealthcareService | undefined {
  return HEALTHCARE_SERVICE_INDEX.get(id);
}

export function getCareTeamById(id: string): CareTeam | undefined {
  return CARE_TEAM_INDEX.get(id);
}

export function getInternacoesPorUnidade(unidadeId: string): Internacao[] {
  return INTERNACOES.filter((i) => i.unidadeAtualId === unidadeId && i.status !== 'alta_completada');
}

export function getProfissionaisPorUnidade(unidadeId: string, turnoTipo?: Turno['tipo']): ProfissionalSaude[] {
  // Find roles that touch this unidade
  const rolesAqui = PRACTITIONER_ROLES.filter((r) => r.locationIds.includes(unidadeId) && r.ativo);
  if (!turnoTipo) {
    const ids = new Set(rolesAqui.map((r) => r.profissionalId));
    return PROFISSIONAIS.filter((p) => ids.has(p.id));
  }
  const roleIdsAqui = new Set(rolesAqui.map((r) => r.id));
  const turnosMatch = TURNOS.filter(
    (t) => t.unidadeId === unidadeId && t.tipo === turnoTipo && roleIdsAqui.has(t.practitionerRoleId),
  );
  const profIds = new Set(
    turnosMatch
      .map((t) => ROLE_INDEX.get(t.practitionerRoleId)?.profissionalId)
      .filter((x): x is string => Boolean(x)),
  );
  return PROFISSIONAIS.filter((p) => profIds.has(p.id));
}

export function getEspecialidadesPorUnidade(unidadeId: string): Especialidade[] {
  const unidade = UNIDADE_INDEX.get(unidadeId);
  if (!unidade) return [];
  const especialidadeIds = new Set<string>();
  unidade.healthcareServiceIds.forEach((sid) => {
    const svc = HEALTHCARE_SERVICE_INDEX.get(sid);
    if (svc) especialidadeIds.add(svc.especialidadeId);
  });
  return ESPECIALIDADES.filter((e) => especialidadeIds.has(e.id));
}

export function getUnidadesPorEspecialidade(especialidadeId: string): UnidadeAssistencial[] {
  const unidadeIds = new Set<string>();
  HEALTHCARE_SERVICES.filter((s) => s.especialidadeId === especialidadeId).forEach((svc) => {
    svc.unidadeIds.forEach((uid) => unidadeIds.add(uid));
  });
  return UNIDADES_ASSISTENCIAIS.filter((u) => unidadeIds.has(u.id));
}

export function getLeitosPorUnidade(unidadeId: string): Location[] {
  const unidade = UNIDADE_INDEX.get(unidadeId);
  if (!unidade) return [];
  return unidade.leitoIds
    .map((id) => LOCATION_INDEX.get(id))
    .filter((l): l is Location => Boolean(l));
}

export function getLeitoOcupado(locationId: string): Internacao | null {
  return INTERNACAO_BY_LOCATION.get(locationId) ?? null;
}

export function getHealthcareServicesPorUnidade(unidadeId: string): HealthcareService[] {
  const unidade = UNIDADE_INDEX.get(unidadeId);
  if (!unidade) return [];
  return unidade.healthcareServiceIds
    .map((id) => HEALTHCARE_SERVICE_INDEX.get(id))
    .filter((s): s is HealthcareService => Boolean(s));
}

export function getInternacoesPorProfissional(profissionalId: string): Internacao[] {
  const roleIds = new Set(PRACTITIONER_ROLES.filter((r) => r.profissionalId === profissionalId).map((r) => r.id));
  return INTERNACOES.filter(
    (i) =>
      i.status !== 'alta_completada' &&
      (roleIds.has(i.medicoAssistenteRoleId) || i.consultores.some((c) => roleIds.has(c.roleId))),
  );
}

export function getTurnosAtivosPorUnidade(unidadeId: string): Turno[] {
  return TURNOS.filter((t) => t.unidadeId === unidadeId && t.status === 'em_andamento');
}

export function getCareTeamPorInternacao(internacaoId: string): CareTeam | undefined {
  return CARE_TEAMS.find((c) => c.internacaoId === internacaoId);
}

// ---------------------------------------------------------------------------
// Clinical record fixtures: evolucoes, prescricoes, exames, sinais vitais
// ---------------------------------------------------------------------------
//
// Covers 10 representative internacoes across UTI adulto, UCO, UCI, ala 2A,
// cirurgia 3B, pediatria, maternidade, UTI neo and PS, mirroring the mix that
// the hospital-core spec requires for EHR-style clinical record views.
// All timestamps anchored to NOW (2026-04-12T10:30:00-03:00); nothing older
// than 5 days. IDs follow spec patterns: EV-YYYYMMDD-XXXX, RX-2026-XXXXX,
// EX-2026-XXXXX, SV-YYYYMMDD-XXXX.

function isoMinus(hoursAgo: number): string {
  const base = new Date('2026-04-12T10:30:00-03:00').getTime();
  return new Date(base - hoursAgo * 3_600_000).toISOString();
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

function pad5(n: number): string {
  return String(n).padStart(5, '0');
}

function ymd(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '');
}

/** Indexes inside INTERNACOES to materialize rich records for. */
const CLINICAL_TARGETS = [
  // UTI adulto (idx 0..9 in file order)
  { idx: 0, kind: 'uti', preceptorRoleId: 'role-silva-rt-uti' }, // Ana Beatriz (sepse pulmonar, VM)
  { idx: 1, kind: 'uti', preceptorRoleId: 'role-silva-rt-uti' }, // Carlos Augusto (IAM pos ICP)
  { idx: 3, kind: 'uti', preceptorRoleId: 'role-silva-rt-uti' }, // Roberto Nunes (choque septico abdominal)
  { idx: 4, kind: 'uti', preceptorRoleId: 'role-silva-rt-uti' }, // Mariana Souza (pos-craniotomia)
  // UCO (idx 10..15)
  { idx: 10, kind: 'uco', preceptorRoleId: 'role-rocha-uco-coord' }, // Fernanda Moura (angina instavel)
  // UCI (idx 16..23)
  { idx: 16, kind: 'uci', preceptorRoleId: undefined }, // Vera Lucia (desmame VM)
  { idx: 18, kind: 'uci', preceptorRoleId: undefined }, // Maria Clara (pos-colecisto)
  // Ala 2A (idx 24..46)
  { idx: 24, kind: 'enfermaria', preceptorRoleId: 'role-cardoso-coord-ala2a' }, // Helena Ferraz (PAC)
  // Pediatria (idx 66..79 roughly; first ped at mrnStart 67 => idx 66)
  { idx: 66, kind: 'pediatria', preceptorRoleId: 'role-almeida-coord-ped' }, // Flavia (CAD pediatrica) -- if not CAD, adapt
  // Maternidade (idx 80..)
  { idx: 80, kind: 'maternidade', preceptorRoleId: undefined },
] as const;

type ClinicalTarget = (typeof CLINICAL_TARGETS)[number];

function targetInternacao(target: ClinicalTarget): Internacao | undefined {
  return INTERNACOES[target.idx];
}

// Nursing role IDs keyed by unidadeId — for sinais vitais registrations.
const ENF_BY_UNIDADE: Record<string, string> = {
  'un-uti-adulto': 'role-silva-uti-assistente', // fallback to medico; enf role is template-driven
  'un-uco': 'role-rocha-uco-assistente',
  'un-uci-adulto': 'role-tavares-uci-assistente',
  'un-ala-2a': 'role-cardoso-clinica-ala2a',
  'un-ala-3b': 'role-martins-cir-ala3b',
  'un-pediatria': 'role-almeida-ped',
  'un-maternidade': 'role-almeida-ped',
  'un-uti-neo': 'role-pereira-uti-neo',
  'un-ps': 'role-nogueira-ps',
  'un-cc': 'role-martins-cir-ala3b',
};

// Realistic vital ranges by SCP category.
function vitalsForScp(scp: Internacao['scpAtual']): Partial<RegistroSinaisVitais> {
  switch (scp) {
    case 'intensivo':
      return {
        pressaoSistolica: 95 + Math.floor(Math.random() * 20),
        pressaoDiastolica: 55 + Math.floor(Math.random() * 15),
        frequenciaCardiaca: 92 + Math.floor(Math.random() * 20),
        frequenciaRespiratoria: 22 + Math.floor(Math.random() * 6),
        temperatura: 37.4 + Math.random() * 1.2,
        saturacaoO2: 90 + Math.floor(Math.random() * 6),
        dor: 2,
        nivelConsciencia: 'verbal',
      };
    case 'alta_dependencia':
      return {
        pressaoSistolica: 110 + Math.floor(Math.random() * 15),
        pressaoDiastolica: 65 + Math.floor(Math.random() * 10),
        frequenciaCardiaca: 82 + Math.floor(Math.random() * 16),
        frequenciaRespiratoria: 18 + Math.floor(Math.random() * 4),
        temperatura: 37.0 + Math.random() * 0.9,
        saturacaoO2: 94 + Math.floor(Math.random() * 4),
        dor: 3,
        nivelConsciencia: 'alerta',
      };
    case 'intermediarios':
      return {
        pressaoSistolica: 118 + Math.floor(Math.random() * 14),
        pressaoDiastolica: 72 + Math.floor(Math.random() * 10),
        frequenciaCardiaca: 74 + Math.floor(Math.random() * 14),
        frequenciaRespiratoria: 16 + Math.floor(Math.random() * 4),
        temperatura: 36.6 + Math.random() * 0.7,
        saturacaoO2: 95 + Math.floor(Math.random() * 4),
        dor: 2,
        nivelConsciencia: 'alerta',
      };
    default:
      return {
        pressaoSistolica: 122 + Math.floor(Math.random() * 10),
        pressaoDiastolica: 76 + Math.floor(Math.random() * 8),
        frequenciaCardiaca: 72 + Math.floor(Math.random() * 12),
        frequenciaRespiratoria: 16,
        temperatura: 36.6 + Math.random() * 0.5,
        saturacaoO2: 97 + Math.floor(Math.random() * 2),
        dor: 1,
        nivelConsciencia: 'alerta',
      };
  }
}

// Deterministic pseudo-random for stable fixtures across reloads.
let __seed = 1;
function seededRandom(): number {
  __seed = (__seed * 9301 + 49297) % 233280;
  return __seed / 233280;
}
// Override Math.random inside this block so vitals are stable.
const _origRandom = Math.random;
Math.random = seededRandom;

const _EVOLUCOES: EvolucaoClinica[] = [];
const _PRESCRICOES: Prescricao[] = [];
const _EXAMES: SolicitacaoExame[] = [];
const _SINAIS: RegistroSinaisVitais[] = [];

let _evSeq = 1;
let _rxSeq = 1;
let _exSeq = 1;
let _svSeq = 1;

function nextEvId(iso: string): string {
  const id = `EV-${ymd(iso)}-${pad4(_evSeq++)}`;
  return id;
}
function nextRxCode(): string {
  return `RX-2026-${pad5(_rxSeq++)}`;
}
function nextExCode(): string {
  return `EX-2026-${pad5(_exSeq++)}`;
}
function nextSvId(iso: string): string {
  return `SV-${ymd(iso)}-${pad4(_svSeq++)}`;
}

interface PrescriptionTemplate {
  medicamento: string;
  dosagem: string;
  via: PrescricaoItem['via'];
  frequencia: string;
  duracao?: string;
  horarios?: string[];
  observacoes?: string;
  ehSos?: boolean;
  ehAltaCusto?: boolean;
  ehControlado?: boolean;
}

// Medication sets by clinical scenario — keyed off primary CID / diagnosis.
function prescriptionItemsForDiagnosis(cid: string, diagnostico: string): PrescriptionTemplate[] {
  const d = diagnostico.toLowerCase();
  if (cid.startsWith('A41') || d.includes('sepse')) {
    return [
      { medicamento: 'Piperacilina-tazobactam', dosagem: '4,5 g', via: 'intravenosa', frequencia: '6/6h', duracao: '7 dias', horarios: ['06:00', '12:00', '18:00', '00:00'], ehAltaCusto: true },
      { medicamento: 'Vancomicina', dosagem: '1 g', via: 'intravenosa', frequencia: '12/12h', duracao: '7 dias', horarios: ['08:00', '20:00'], observacoes: 'Ajustar por nivel serico' },
      { medicamento: 'Noradrenalina', dosagem: '0,1 mcg/kg/min', via: 'intravenosa', frequencia: 'continuo', observacoes: 'Titular para PAM >= 65 mmHg' },
      { medicamento: 'Enoxaparina', dosagem: '40 mg', via: 'subcutanea', frequencia: '1x/dia', horarios: ['18:00'] },
      { medicamento: 'Omeprazol', dosagem: '40 mg', via: 'intravenosa', frequencia: '1x/dia', horarios: ['08:00'] },
      { medicamento: 'Dipirona', dosagem: '1 g', via: 'intravenosa', frequencia: '6/6h SOS', ehSos: true, observacoes: 'Se T >= 37,8 C ou dor EVA >= 4' },
    ];
  }
  if (cid.startsWith('I21') || d.includes('iam')) {
    return [
      { medicamento: 'AAS', dosagem: '100 mg', via: 'oral', frequencia: '1x/dia', horarios: ['08:00'] },
      { medicamento: 'Clopidogrel', dosagem: '75 mg', via: 'oral', frequencia: '1x/dia', horarios: ['08:00'] },
      { medicamento: 'Atorvastatina', dosagem: '80 mg', via: 'oral', frequencia: '1x/dia', horarios: ['20:00'] },
      { medicamento: 'Metoprolol', dosagem: '25 mg', via: 'oral', frequencia: '12/12h', horarios: ['08:00', '20:00'] },
      { medicamento: 'Enoxaparina', dosagem: '1 mg/kg', via: 'subcutanea', frequencia: '12/12h', horarios: ['08:00', '20:00'] },
    ];
  }
  if (cid.startsWith('R65') || d.includes('choque')) {
    return [
      { medicamento: 'Meropenem', dosagem: '1 g', via: 'intravenosa', frequencia: '8/8h', duracao: '10 dias', horarios: ['06:00', '14:00', '22:00'], ehAltaCusto: true },
      { medicamento: 'Noradrenalina', dosagem: '0,3 mcg/kg/min', via: 'intravenosa', frequencia: 'continuo', observacoes: 'Titular conforme PAM' },
      { medicamento: 'Hidrocortisona', dosagem: '50 mg', via: 'intravenosa', frequencia: '6/6h', horarios: ['06:00', '12:00', '18:00', '00:00'] },
      { medicamento: 'Albumina 20%', dosagem: '100 mL', via: 'intravenosa', frequencia: '12/12h', duracao: '3 dias' },
      { medicamento: 'Propofol', dosagem: '2 mg/kg/h', via: 'intravenosa', frequencia: 'continuo', ehControlado: true, observacoes: 'Sedacao para VM' },
      { medicamento: 'Fentanil', dosagem: '50 mcg/h', via: 'intravenosa', frequencia: 'continuo', ehControlado: true },
    ];
  }
  if (cid.startsWith('I60') || d.includes('craniotomia')) {
    return [
      { medicamento: 'Nimodipino', dosagem: '60 mg', via: 'oral', frequencia: '4/4h', horarios: ['04:00', '08:00', '12:00', '16:00', '20:00', '00:00'] },
      { medicamento: 'Fenitoina', dosagem: '100 mg', via: 'intravenosa', frequencia: '8/8h', horarios: ['06:00', '14:00', '22:00'] },
      { medicamento: 'Dexametasona', dosagem: '4 mg', via: 'intravenosa', frequencia: '6/6h', horarios: ['06:00', '12:00', '18:00', '00:00'] },
      { medicamento: 'Morfina', dosagem: '2 mg', via: 'intravenosa', frequencia: '4/4h SOS', ehSos: true, ehControlado: true, observacoes: 'EVA >= 5' },
      { medicamento: 'Omeprazol', dosagem: '40 mg', via: 'intravenosa', frequencia: '1x/dia', horarios: ['08:00'] },
    ];
  }
  if (cid.startsWith('I20') || d.includes('angina')) {
    return [
      { medicamento: 'AAS', dosagem: '100 mg', via: 'oral', frequencia: '1x/dia', horarios: ['08:00'] },
      { medicamento: 'Enoxaparina', dosagem: '1 mg/kg', via: 'subcutanea', frequencia: '12/12h', horarios: ['08:00', '20:00'] },
      { medicamento: 'Atorvastatina', dosagem: '40 mg', via: 'oral', frequencia: '1x/dia', horarios: ['20:00'] },
      { medicamento: 'Isossorbida', dosagem: '5 mg', via: 'sublingual', frequencia: 'SOS', ehSos: true, observacoes: 'Se dor precordial' },
    ];
  }
  if (cid.startsWith('J96') || d.includes('desmame')) {
    return [
      { medicamento: 'Salbutamol', dosagem: '2,5 mg', via: 'inalatoria', frequencia: '6/6h', horarios: ['06:00', '12:00', '18:00', '00:00'] },
      { medicamento: 'Ipratropio', dosagem: '0,5 mg', via: 'inalatoria', frequencia: '6/6h', horarios: ['06:00', '12:00', '18:00', '00:00'] },
      { medicamento: 'Enoxaparina', dosagem: '40 mg', via: 'subcutanea', frequencia: '1x/dia', horarios: ['18:00'] },
      { medicamento: 'Omeprazol', dosagem: '40 mg', via: 'oral', frequencia: '1x/dia', horarios: ['08:00'] },
    ];
  }
  if (cid.startsWith('K81') || d.includes('colecist')) {
    return [
      { medicamento: 'Cefazolina', dosagem: '1 g', via: 'intravenosa', frequencia: '8/8h', duracao: '3 dias', horarios: ['06:00', '14:00', '22:00'] },
      { medicamento: 'Dipirona', dosagem: '1 g', via: 'intravenosa', frequencia: '6/6h', horarios: ['06:00', '12:00', '18:00', '00:00'] },
      { medicamento: 'Tramadol', dosagem: '100 mg', via: 'intravenosa', frequencia: '8/8h SOS', ehSos: true, ehControlado: true, observacoes: 'EVA >= 5' },
      { medicamento: 'Enoxaparina', dosagem: '40 mg', via: 'subcutanea', frequencia: '1x/dia', horarios: ['18:00'] },
    ];
  }
  if (cid.startsWith('J18') || d.includes('pneumonia')) {
    return [
      { medicamento: 'Ceftriaxona', dosagem: '2 g', via: 'intravenosa', frequencia: '1x/dia', duracao: '7 dias', horarios: ['10:00'] },
      { medicamento: 'Azitromicina', dosagem: '500 mg', via: 'oral', frequencia: '1x/dia', duracao: '5 dias', horarios: ['10:00'] },
      { medicamento: 'Dipirona', dosagem: '1 g', via: 'oral', frequencia: '6/6h SOS', ehSos: true, observacoes: 'Se T >= 37,8 C' },
      { medicamento: 'Enoxaparina', dosagem: '40 mg', via: 'subcutanea', frequencia: '1x/dia', horarios: ['18:00'] },
    ];
  }
  if (cid.startsWith('E10') || d.includes('cetoacid')) {
    return [
      { medicamento: 'Insulina regular', dosagem: '0,1 UI/kg/h', via: 'intravenosa', frequencia: 'continuo', observacoes: 'Titular por glicemia capilar 1/1h' },
      { medicamento: 'Soro fisiologico 0,9%', dosagem: '1000 mL', via: 'intravenosa', frequencia: '4/4h', horarios: ['04:00', '08:00', '12:00', '16:00', '20:00', '00:00'] },
      { medicamento: 'Cloreto de potassio 19,1%', dosagem: '10 mL', via: 'intravenosa', frequencia: '12/12h', horarios: ['08:00', '20:00'], observacoes: 'Diluir em SF 500 mL' },
    ];
  }
  // Maternity default (labor/puerperio).
  return [
    { medicamento: 'Ocitocina', dosagem: '10 UI', via: 'intramuscular', frequencia: 'dose unica', observacoes: 'Puerperio imediato' },
    { medicamento: 'Dipirona', dosagem: '1 g', via: 'oral', frequencia: '6/6h', horarios: ['06:00', '12:00', '18:00', '00:00'] },
    { medicamento: 'Sulfato ferroso', dosagem: '40 mg', via: 'oral', frequencia: '1x/dia', horarios: ['08:00'] },
  ];
}

function examSetForDiagnosis(cid: string): { nome: string; categoria: SolicitacaoExame['categoria']; urgencia: SolicitacaoExame['urgencia']; status: SolicitacaoExame['status']; resultado?: string; valoresCriticos?: SolicitacaoExame['valoresCriticos'] }[] {
  if (cid.startsWith('A41') || cid.startsWith('R65')) {
    return [
      { nome: 'Hemograma completo', categoria: 'laboratorio', urgencia: 'urgente', status: 'laudado', resultado: 'Leucocitose 18.400/mm3 com desvio a esquerda; Hb 9,8; plaquetas 95.000', valoresCriticos: [{ nome: 'Plaquetas', valor: '95.000/mm3', referencia: '150.000-450.000', flag: 'baixo' }] },
      { nome: 'Lactato arterial', categoria: 'laboratorio', urgencia: 'urgente', status: 'laudado', resultado: 'Lactato 3,8 mmol/L', valoresCriticos: [{ nome: 'Lactato', valor: '3,8', referencia: '< 2,0 mmol/L', flag: 'alto' }] },
      { nome: 'Hemocultura 2 amostras', categoria: 'laboratorio', urgencia: 'urgente', status: 'em_analise' },
      { nome: 'PCR e procalcitonina', categoria: 'laboratorio', urgencia: 'urgente', status: 'laudado', resultado: 'PCR 242 mg/L; procalcitonina 18,3 ng/mL' },
      { nome: 'TC torax com contraste', categoria: 'imagem', urgencia: 'urgente', status: 'laudado', resultado: 'Consolidacao em LID com broncograma aereo e derrame pleural laminar' },
      { nome: 'Ecocardiograma transtoracico', categoria: 'cardiologico', urgencia: 'rotina', status: 'solicitado' },
    ];
  }
  if (cid.startsWith('I21') || cid.startsWith('I20')) {
    return [
      { nome: 'Troponina I', categoria: 'laboratorio', urgencia: 'emergente', status: 'laudado', resultado: 'Troponina I 8,4 ng/mL', valoresCriticos: [{ nome: 'Troponina I', valor: '8,4 ng/mL', referencia: '< 0,04', flag: 'critico' }] },
      { nome: 'ECG 12 derivacoes', categoria: 'cardiologico', urgencia: 'emergente', status: 'laudado', resultado: 'Supra de ST em parede anterior' },
      { nome: 'Ecocardiograma transtoracico', categoria: 'cardiologico', urgencia: 'urgente', status: 'laudado', resultado: 'FEVE 38%, hipocinesia anterior' },
      { nome: 'Cineangiocoronariografia', categoria: 'cardiologico', urgencia: 'emergente', status: 'entregue', resultado: 'Lesao 95% DA proximal - ICP com stent farmacologico' },
      { nome: 'Perfil lipidico', categoria: 'laboratorio', urgencia: 'rotina', status: 'laudado', resultado: 'LDL 168; HDL 32; TG 212' },
    ];
  }
  if (cid.startsWith('I60')) {
    return [
      { nome: 'TC cranio sem contraste', categoria: 'imagem', urgencia: 'emergente', status: 'laudado', resultado: 'Pos-craniotomia frontal direita, sem sangramento agudo' },
      { nome: 'Angio-TC cerebral', categoria: 'imagem', urgencia: 'urgente', status: 'laudado', resultado: 'Aneurisma de ACM D clipado, sem vasoespasmo' },
      { nome: 'Nivel de fenitoina', categoria: 'laboratorio', urgencia: 'rotina', status: 'laudado', resultado: 'Fenitoina 14 mcg/mL (terapeutico)' },
      { nome: 'Hemograma completo', categoria: 'laboratorio', urgencia: 'rotina', status: 'laudado', resultado: 'Hb 11,2; leuco 9.800; plaq 220.000' },
    ];
  }
  if (cid.startsWith('J96')) {
    return [
      { nome: 'Gasometria arterial', categoria: 'laboratorio', urgencia: 'urgente', status: 'laudado', resultado: 'pH 7,38; pCO2 42; pO2 78; HCO3 24' },
      { nome: 'Radiografia de torax', categoria: 'imagem', urgencia: 'rotina', status: 'laudado', resultado: 'Opacidade residual em LID em regressao' },
      { nome: 'Teste de respiracao espontanea', categoria: 'funcional', urgencia: 'rotina', status: 'entregue', resultado: 'Tolerou TRE 30 min; FR 22; SatO2 95%' },
    ];
  }
  if (cid.startsWith('K81') || cid.startsWith('K80')) {
    return [
      { nome: 'Hemograma completo', categoria: 'laboratorio', urgencia: 'rotina', status: 'laudado', resultado: 'Hb 11,0; leuco 11.200; plaq 260.000' },
      { nome: 'USG abdome total', categoria: 'imagem', urgencia: 'urgente', status: 'laudado', resultado: 'Colecistectomia recente; pequena colecao perihepatica em regressao' },
      { nome: 'Amilase e lipase', categoria: 'laboratorio', urgencia: 'rotina', status: 'laudado', resultado: 'Amilase 180; lipase 220' },
    ];
  }
  if (cid.startsWith('J18')) {
    return [
      { nome: 'Radiografia de torax PA + perfil', categoria: 'imagem', urgencia: 'urgente', status: 'laudado', resultado: 'Consolidacao em lobo inferior direito' },
      { nome: 'Hemograma completo', categoria: 'laboratorio', urgencia: 'rotina', status: 'laudado', resultado: 'Leuco 14.600 com 82% de neutrofilos' },
      { nome: 'Antigeno urinario Legionella', categoria: 'laboratorio', urgencia: 'rotina', status: 'laudado', resultado: 'Negativo' },
      { nome: 'Escarro cultura + BAAR', categoria: 'laboratorio', urgencia: 'rotina', status: 'em_analise' },
    ];
  }
  if (cid.startsWith('E10')) {
    return [
      { nome: 'Gasometria venosa', categoria: 'laboratorio', urgencia: 'emergente', status: 'laudado', resultado: 'pH 7,18; HCO3 12; BE -14', valoresCriticos: [{ nome: 'pH', valor: '7,18', referencia: '7,35-7,45', flag: 'critico' }] },
      { nome: 'Glicemia capilar seriada', categoria: 'laboratorio', urgencia: 'urgente', status: 'entregue', resultado: '1h: 412; 2h: 310; 3h: 240 mg/dL' },
      { nome: 'Cetonemia', categoria: 'laboratorio', urgencia: 'urgente', status: 'laudado', resultado: 'Beta-hidroxibutirato 5,2 mmol/L' },
      { nome: 'Eletrolitos completos', categoria: 'laboratorio', urgencia: 'urgente', status: 'laudado', resultado: 'K+ 3,2; Na+ 138; Cl- 104' },
    ];
  }
  // Default maternity / generic.
  return [
    { nome: 'Hemograma completo', categoria: 'laboratorio', urgencia: 'rotina', status: 'laudado', resultado: 'Dentro de parametros normais' },
    { nome: 'Tipagem sanguinea e Coombs', categoria: 'laboratorio', urgencia: 'rotina', status: 'laudado', resultado: 'O+ ; Coombs negativo' },
    { nome: 'USG obstetrico', categoria: 'imagem', urgencia: 'rotina', status: 'entregue', resultado: 'Feto unico em apresentacao cefalica, ILA normal' },
  ];
}

function buildForTarget(target: ClinicalTarget): void {
  const internacao = targetInternacao(target);
  if (!internacao) return;
  const { id: internacaoId, pacienteId, medicoAssistenteRoleId, consultores, unidadeAtualId } = internacao;
  const cidPrincipal: string = internacao.cidPrincipal ?? 'Z99.9';
  const hipoteseDiagnostica: string = internacao.hipoteseDiagnostica ?? 'Quadro em investigacao';
  const scpAtual: NonNullable<Internacao['scpAtual']> = internacao.scpAtual ?? 'intermediarios';

  const admissaoEm = internacao.admissao.em;
  const admissaoHoursAgo = Math.max(
    2,
    Math.floor((new Date('2026-04-12T10:30:00-03:00').getTime() - new Date(admissaoEm).getTime()) / 3_600_000),
  );
  // Cap at 5 days for evolucao/sinais history per spec.
  const historyHoursAgo = Math.min(admissaoHoursAgo, 5 * 24);

  // 1. Admission evolucao (SOAP)
  const admIso = isoMinus(Math.min(historyHoursAgo, 120));
  _EVOLUCOES.push({
    id: nextEvId(admIso),
    internacaoId,
    pacienteId,
    tipo: 'admissao',
    em: admIso,
    autorRoleId: medicoAssistenteRoleId,
    autorCategoria: 'medico',
    subjetivo: `Paciente admitido com quadro compativel com ${hipoteseDiagnostica.toLowerCase()}. Acompanhante refere piora progressiva nas ultimas 48h.`,
    objetivo: `Exame fisico inicial: paciente ${scpAtual === 'intensivo' ? 'sedado, sob VMI' : 'lucido, orientado'}. Ausculta e exame segmentar compativeis com hipotese diagnostica. Sinais vitais registrados em prontuario.`,
    avaliacao: `Hipotese: ${hipoteseDiagnostica}. CID ${cidPrincipal}. Gravidade compativel com ${scpAtual.replace('_', ' ')}.`,
    plano: `Iniciar protocolo institucional para ${hipoteseDiagnostica.toLowerCase()}. Monitorizacao continua. Prescricao registrada. Exames complementares solicitados. Reavaliacao em 6h.`,
    cidsAtualizados: [cidPrincipal, ...(internacao.cidsSecundarios ?? [])],
    condutaChange: 'manter',
    assinadoEm: admIso,
    versao: 1,
  });

  // 2. Daily evolucoes (3-5)
  const daysSinceAdmission = Math.max(1, Math.floor(historyHoursAgo / 24));
  const dailyCount = Math.min(5, Math.max(3, daysSinceAdmission));
  for (let d = dailyCount; d >= 1; d--) {
    const iso = isoMinus(d * 24 - 2); // around 8h each morning
    const isResidentNote = d % 2 === 0 && target.preceptorRoleId !== undefined;
    _EVOLUCOES.push({
      id: nextEvId(iso),
      internacaoId,
      pacienteId,
      tipo: 'evolucao_diaria',
      em: iso,
      autorRoleId: medicoAssistenteRoleId,
      autorCategoria: 'medico',
      subjetivo: d === 1 ? 'Paciente refere melhora do quadro dor; aceita dieta oral parcialmente.' : 'Sem queixas novas. Familia presente e orientada.',
      objetivo: `BEG ${scpAtual === 'intensivo' ? 'sob sedacao leve' : 'corado, hidratado'}. Ausculta ${d === 1 ? 'sem ruidos adventicios' : 'com roncos esparsos'}. Abdome flacido, indolor. MMII sem edema.`,
      avaliacao: `${hipoteseDiagnostica} em ${d === 1 ? 'melhora clinica' : 'evolucao estavel'}. Mantem suporte atual.`,
      plano: d === 1 ? 'Progredir dieta. Suspender antibiotico IV em 24h se apiretico. Discutir alta com equipe multi.' : 'Manter antibioticoterapia. Ajustar analgesia. Solicitar controle laboratorial amanha.',
      condutaChange: d === 1 ? 'desescalar' : 'manter',
      assinadoEm: iso,
      ...(isResidentNote && target.preceptorRoleId ? { revisaoRoleId: target.preceptorRoleId } : {}),
      versao: 1,
    });
  }

  // 3. Interconsulta (only if consultores present)
  if (consultores.length > 0) {
    const count = Math.min(2, consultores.length);
    for (let c = 0; c < count; c++) {
      const consultor = consultores[c];
      const iso = isoMinus((c + 1) * 36);
      _EVOLUCOES.push({
        id: nextEvId(iso),
        internacaoId,
        pacienteId,
        tipo: 'interconsulta',
        em: iso,
        autorRoleId: consultor.roleId,
        autorCategoria: 'medico',
        texto: `Parecer de especialista solicitado para ${hipoteseDiagnostica.toLowerCase()}. Revisado prontuario e exame fisico. Concordo com conduta atual. Sugestoes: otimizar terapia conforme protocolo da especialidade; reavaliar resposta em 48h; manter comunicacao com equipe assistente.`,
        condutaChange: 'ajustar',
        assinadoEm: iso,
        versao: 1,
      });
    }
  }

  // 4. Rounds multidisciplinares
  const roundsIso = isoMinus(22);
  _EVOLUCOES.push({
    id: nextEvId(roundsIso),
    internacaoId,
    pacienteId,
    tipo: 'rounds_multidisciplinar',
    em: roundsIso,
    autorRoleId: medicoAssistenteRoleId,
    autorCategoria: 'medico',
    texto: `Rounds multidisciplinares. Presentes: medico assistente, enfermagem, farmaceutica clinica, fisioterapia e nutricao. Discussao do caso: ${hipoteseDiagnostica}. Metas do dia: mobilizacao precoce, otimizacao nutricional (dieta via oral quando possivel), reconciliacao medicamentosa realizada, plano de alta discutido. Sem eventos adversos nas ultimas 24h.`,
    assinadoEm: roundsIso,
    versao: 1,
  });

  // 5. Prescricoes (2-4, most recent active)
  const rxCount = scpAtual === 'intensivo' || scpAtual === 'alta_dependencia' ? 3 : 2;
  const rxItemsTemplate = prescriptionItemsForDiagnosis(cidPrincipal, hipoteseDiagnostica);
  for (let r = 0; r < rxCount; r++) {
    const iso = isoMinus((rxCount - r - 1) * 24 + 1);
    const valida = isoMinus((rxCount - r - 1) * 24 - 23);
    const itens: PrescricaoItem[] = rxItemsTemplate.map((t, k) => ({
      id: `${nextRxCode()}-item-${k + 1}`,
      medicamento: t.medicamento,
      dosagem: t.dosagem,
      via: t.via,
      frequencia: t.frequencia,
      duracao: t.duracao,
      horarios: t.horarios,
      observacoes: t.observacoes,
      status: r === rxCount - 1 ? 'ativo' : 'completo',
      ehSos: t.ehSos ?? false,
      ehAltaCusto: t.ehAltaCusto,
      ehControlado: t.ehControlado,
    }));
    _PRESCRICOES.push({
      id: nextRxCode(),
      codigo: nextRxCode(),
      internacaoId,
      pacienteId,
      prescritorRoleId: medicoAssistenteRoleId,
      em: iso,
      validaAte: valida,
      status: r === rxCount - 1 ? 'ativa' : 'encerrada',
      itens,
      farmaceuticoValidouEm: isoMinus((rxCount - r - 1) * 24 + 0.5),
      farmaceuticoRoleId: medicoAssistenteRoleId, // approximation; no farm role id in fixture context
      observacoes: r === rxCount - 1 ? 'Prescricao ativa revisada em rounds.' : 'Prescricao encerrada por substituicao.',
    });
  }

  // 6. Exames (3-6)
  const exames = examSetForDiagnosis(cidPrincipal);
  exames.forEach((ex, i) => {
    const solicitadoEm = isoMinus(Math.min(historyHoursAgo, 96) - i * 8);
    const laudadoEm = ex.status === 'laudado' || ex.status === 'entregue' ? isoMinus(Math.min(historyHoursAgo, 96) - i * 8 - 2) : undefined;
    const coletadoEm = ex.status !== 'solicitado' ? isoMinus(Math.min(historyHoursAgo, 96) - i * 8 - 0.5) : undefined;
    _EXAMES.push({
      id: nextExCode(),
      codigo: nextExCode(),
      internacaoId,
      pacienteId,
      categoria: ex.categoria,
      nome: ex.nome,
      urgencia: ex.urgencia,
      status: ex.status,
      solicitanteRoleId: medicoAssistenteRoleId,
      solicitadoEm,
      justificativa: `Investigacao de ${hipoteseDiagnostica.toLowerCase()}.`,
      hipotese: hipoteseDiagnostica,
      coletadoEm,
      laudadoEm,
      laudadorRoleId: laudadoEm ? medicoAssistenteRoleId : undefined,
      resultado: ex.resultado,
      valoresCriticos: ex.valoresCriticos,
    });
  });

  // 7. Sinais vitais: every 6h for last 3 days (12 records); for low-acuity, 6 records.
  const svTotal = scpAtual === 'intensivo' || scpAtual === 'alta_dependencia' ? 12 : 8;
  const enfRoleId = ENF_BY_UNIDADE[unidadeAtualId] ?? medicoAssistenteRoleId;
  for (let s = 0; s < svTotal; s++) {
    const iso = isoMinus(s * 6 + 1);
    const vitals = vitalsForScp(scpAtual);
    _SINAIS.push({
      id: nextSvId(iso),
      internacaoId,
      pacienteId,
      em: iso,
      registradoPorRoleId: enfRoleId,
      pressaoSistolica: vitals.pressaoSistolica,
      pressaoDiastolica: vitals.pressaoDiastolica,
      frequenciaCardiaca: vitals.frequenciaCardiaca,
      frequenciaRespiratoria: vitals.frequenciaRespiratoria,
      temperatura: vitals.temperatura ? Math.round(vitals.temperatura * 10) / 10 : undefined,
      saturacaoO2: vitals.saturacaoO2,
      glicemiaCapilar: s % 3 === 0 ? 110 + Math.floor(Math.random() * 40) : undefined,
      dor: vitals.dor,
      nivelConsciencia: vitals.nivelConsciencia,
      observacoes: s === 0 ? 'Sinais coletados a beira do leito pela equipe de enfermagem.' : undefined,
    });
  }
}

CLINICAL_TARGETS.forEach(buildForTarget);

// Restore original Math.random now that fixtures are materialized.
Math.random = _origRandom;

export const EVOLUCOES_CLINICAS: EvolucaoClinica[] = _EVOLUCOES;
export const PRESCRICOES: Prescricao[] = _PRESCRICOES;
export const SOLICITACOES_EXAME: SolicitacaoExame[] = _EXAMES;
export const SINAIS_VITAIS: RegistroSinaisVitais[] = _SINAIS;

export function getEvolucoesPorInternacao(internacaoId: string): EvolucaoClinica[] {
  return EVOLUCOES_CLINICAS.filter((e) => e.internacaoId === internacaoId).sort((a, b) => b.em.localeCompare(a.em));
}

export function getPrescricoesPorInternacao(internacaoId: string): Prescricao[] {
  return PRESCRICOES.filter((p) => p.internacaoId === internacaoId).sort((a, b) => b.em.localeCompare(a.em));
}

export function getExamesPorInternacao(internacaoId: string): SolicitacaoExame[] {
  return SOLICITACOES_EXAME.filter((e) => e.internacaoId === internacaoId).sort((a, b) => b.solicitadoEm.localeCompare(a.solicitadoEm));
}

export function getSinaisVitaisPorInternacao(internacaoId: string): RegistroSinaisVitais[] {
  return SINAIS_VITAIS.filter((s) => s.internacaoId === internacaoId).sort((a, b) => b.em.localeCompare(a.em));
}
