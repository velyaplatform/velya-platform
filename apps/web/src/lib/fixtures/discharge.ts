/**
 * Centralized fixtures for /discharge. Source of truth enforced by scripts/check-ui-duplications.ts. Do not duplicate MRN literals in page files.
 */

export type DischargeStatus = 'ready' | 'blocked' | 'pending' | 'in-progress';

export interface DischargePatient {
  mrn: string;
  name: string;
  age: number;
  ward: string;
  bed: string;
  admissionDate: string;
  los: number;
  targetDischarge: string;
  status: DischargeStatus;
  blockers: string[];
  owner: string;
  consultant: string;
  diagnosis: string;
  notes: string;
}

export const DISCHARGE_PATIENTS: DischargePatient[] = [
  {
    mrn: 'MRN-004',
    name: 'Eleanor Voss',
    age: 81,
    ward: 'Ala 2A',
    bed: '2A-02',
    admissionDate: '2026-03-30',
    los: 9,
    targetDischarge: '2026-04-08 08:00',
    status: 'blocked',
    blockers: ['Transporte', 'Documentação'],
    owner: 'James Okafor',
    consultant: 'Dr. Mbeki',
    diagnosis: 'IAM — pós-ICP',
    notes:
      'Paciente liberada clinicamente. Família contatada. Transporte deve ser providenciado com urgência.',
  },
  {
    mrn: 'MRN-007',
    name: 'Marcus Bell',
    age: 57,
    ward: 'Ala 4C',
    bed: '4C-03',
    admissionDate: '2026-03-27',
    los: 12,
    targetDischarge: '2026-04-08 16:00',
    status: 'blocked',
    blockers: ['Pré-autorização do plano'],
    owner: 'Equipe Admin',
    consultant: 'Dr. Patel',
    diagnosis: 'Estenose vertebral — pós-cirúrgica',
    notes: 'Pré-autorização enviada há 48h. Escalar para operadora — gerente de caso atribuído.',
  },
  {
    mrn: 'MRN-013',
    name: 'Peter Hawkins',
    age: 84,
    ward: 'Ala 2A',
    bed: '2A-10',
    admissionDate: '2026-03-25',
    los: 14,
    targetDischarge: '2026-04-08 12:00',
    status: 'blocked',
    blockers: [
      'Vaga em casa de repouso',
      'Liberação do serviço social',
      'Avaliação DOLS',
      'Consentimento familiar',
    ],
    owner: 'Equipe de Serviço Social',
    consultant: 'Dr. Osei',
    diagnosis: 'Sepse — recuperação',
    notes:
      'Situação social complexa. 3 casas de repouso contatadas, 1 confirmada aguardando documentação.',
  },
  {
    mrn: 'MRN-006',
    name: 'Anna Kowalski',
    age: 63,
    ward: 'Ala 1B',
    bed: '1B-06',
    admissionDate: '2026-03-29',
    los: 10,
    targetDischarge: '2026-04-08 14:00',
    status: 'blocked',
    blockers: [
      'Avaliação de reabilitação',
      'Pacote de cuidado domiciliar',
      'Entrega de equipamentos',
    ],
    owner: 'Equipe de TO',
    consultant: 'Dr. Osei',
    diagnosis: 'AVC isquêmico',
    notes:
      'Avaliação de TO agendada para 13:00 hoje. Solicitação de cuidado domiciliar enviada. Equipamentos com prazo de 2 dias.',
  },
  {
    mrn: 'MRN-019',
    name: 'Claire Beaumont',
    age: 77,
    ward: 'Ala 1B',
    bed: '1B-03',
    admissionDate: '2026-03-30',
    los: 9,
    targetDischarge: '2026-04-09 10:00',
    status: 'blocked',
    blockers: ['Casa de repouso', 'Consentimento familiar'],
    owner: 'Equipe de Serviço Social',
    consultant: 'Dr. Osei',
    diagnosis: 'Fratura de fêmur — conservadora',
    notes:
      'Reunião com família agendada para 15:00 hoje. Vaga em casa de repouso confirmada para amanhã.',
  },
  {
    mrn: 'MRN-011',
    name: 'Diana Reyes',
    age: 61,
    ward: 'Ala 1D',
    bed: '1D-01',
    admissionDate: '2026-04-04',
    los: 4,
    targetDischarge: '2026-04-09 10:00',
    status: 'pending',
    blockers: ['Kit de medicamentos da farmácia'],
    owner: 'Farmacêutico da Ala',
    consultant: 'Dr. Patel',
    diagnosis: 'Artroplastia de joelho',
    notes:
      'Kit da farmácia pronto até 09:00 amanhã. Fisioterapia liberada. Carta para o clínico pendente.',
  },
  {
    mrn: 'MRN-016',
    name: 'David Osei',
    age: 67,
    ward: 'Ala 4C',
    bed: '4C-11',
    admissionDate: '2026-03-28',
    los: 11,
    targetDischarge: '2026-04-09 14:00',
    status: 'pending',
    blockers: ['Liberação da fisioterapia', 'Visita domiciliar de TO'],
    owner: 'Equipe de Fisioterapia',
    consultant: 'Dr. Patel',
    diagnosis: 'Prótese total de quadril',
    notes:
      'Última sessão de fisioterapia amanhã cedo. Relatório da visita domiciliar de TO esperado até 12:00.',
  },
  {
    mrn: 'MRN-003',
    name: 'Robert Ngozi',
    age: 72,
    ward: 'Ala 2B',
    bed: '2B-07',
    admissionDate: '2026-03-31',
    los: 8,
    targetDischarge: '2026-04-09 12:00',
    status: 'pending',
    blockers: ['Encaminhamento para serviço social'],
    owner: 'Equipe de Serviço Social',
    consultant: 'Dr. Ibrahim',
    diagnosis: 'Exacerbação de DPOC',
    notes:
      'Encaminhamento para suporte comunitário enviado. Consulta de retorno agendada com equipe respiratória.',
  },
  {
    mrn: 'MRN-002',
    name: 'Sarah Mitchell',
    age: 54,
    ward: 'Ala 3B',
    bed: '3B-12',
    admissionDate: '2026-04-02',
    los: 6,
    targetDischarge: '2026-04-08 12:00',
    status: 'ready',
    blockers: [],
    owner: 'Dr. Chen',
    consultant: 'Dr. Chen',
    diagnosis: 'Colecistite — laparoscópica',
    notes: 'Tudo liberado. Transporte providenciado. Carta de alta assinada. Paciente informada.',
  },
  {
    mrn: 'MRN-014',
    name: 'Thomas Crane',
    age: 52,
    ward: 'Ala 3B',
    bed: '3B-09',
    admissionDate: '2026-04-05',
    los: 3,
    targetDischarge: '2026-04-09 14:00',
    status: 'ready',
    blockers: [],
    owner: 'Dr. Chen',
    consultant: 'Dr. Chen',
    diagnosis: 'Hernioplastia',
    notes:
      'Alta simples. Carta para o clínico enviada. Paciente orientado sobre cuidados pós-alta.',
  },
  {
    mrn: 'MRN-008',
    name: 'Fatima Al-Rashid',
    age: 38,
    ward: 'Ala 3A',
    bed: '3A-11',
    admissionDate: '2026-04-05',
    los: 3,
    targetDischarge: '2026-04-08 15:00',
    status: 'in-progress',
    blockers: [],
    owner: 'Dr. Nkosi',
    consultant: 'Dr. Nkosi',
    diagnosis: 'Gravidez ectópica — cirúrgica',
    notes: 'Processo de alta iniciado. Aguardando exames finais. Prescrição sendo preparada.',
  },
  {
    mrn: 'MRN-005',
    name: 'Carlos Diaz',
    age: 45,
    ward: 'Ala 4A',
    bed: '4A-09',
    admissionDate: '2026-04-04',
    los: 4,
    targetDischarge: '2026-04-09 10:00',
    status: 'in-progress',
    blockers: [],
    owner: 'Dr. Chen',
    consultant: 'Dr. Chen',
    diagnosis: 'Apendicectomia',
    notes:
      'Sumário de alta em elaboração. Paciente deambulando bem. Aguardando avaliação da ferida.',
  },
];
