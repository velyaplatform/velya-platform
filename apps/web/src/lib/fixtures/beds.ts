/**
 * Centralized fixtures for /beds. Source of truth enforced by
 * scripts/check-ui-duplications.ts. Do not duplicate MRN literals in page files.
 */

export type BedStatus =
  | 'available'
  | 'occupied'
  | 'cleaning'
  | 'maintenance'
  | 'reserved'
  | 'blocked';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface BedPatient {
  mrn: string;
  name: string;
  age: number;
  daysAdmitted: number;
  risk: RiskLevel;
  diagnosis: string;
}

export interface Bed {
  number: string;
  ward: string;
  status: BedStatus;
  patient?: BedPatient;
  lastAction: string;
  cleaningEta?: string;
  maintenanceReason?: string;
  reservedFor?: string;
  blockedReason?: string;
}

export const BEDS: Bed[] = [
  // UTI Adulto
  {
    number: 'UTI-01',
    ward: 'UTI Adulto',
    status: 'occupied',
    patient: {
      mrn: 'MRN-201',
      name: 'Helena Costa',
      age: 68,
      daysAdmitted: 4,
      risk: 'critical',
      diagnosis: 'Choque séptico',
    },
    lastAction: '09:12',
  },
  {
    number: 'UTI-02',
    ward: 'UTI Adulto',
    status: 'occupied',
    patient: {
      mrn: 'MRN-202',
      name: 'Ricardo Almeida',
      age: 72,
      daysAdmitted: 7,
      risk: 'critical',
      diagnosis: 'IAM pós-ICP',
    },
    lastAction: '08:45',
  },
  {
    number: 'UTI-03',
    ward: 'UTI Adulto',
    status: 'occupied',
    patient: {
      mrn: 'MRN-203',
      name: 'Mariana Silva',
      age: 55,
      daysAdmitted: 2,
      risk: 'high',
      diagnosis: 'Pós-op abdome agudo',
    },
    lastAction: '10:02',
  },
  {
    number: 'UTI-04',
    ward: 'UTI Adulto',
    status: 'cleaning',
    lastAction: '09:40',
    cleaningEta: '10:25',
  },
  {
    number: 'UTI-05',
    ward: 'UTI Adulto',
    status: 'available',
    lastAction: '08:10',
  },
  {
    number: 'UTI-06',
    ward: 'UTI Adulto',
    status: 'reserved',
    reservedFor: 'Pós-op Cardiotorácica (14:00)',
    lastAction: '07:55',
  },

  // UTI Coronariana
  {
    number: 'UCO-01',
    ward: 'UTI Coronariana',
    status: 'occupied',
    patient: {
      mrn: 'MRN-211',
      name: 'José Tavares',
      age: 64,
      daysAdmitted: 3,
      risk: 'critical',
      diagnosis: 'SCA sem supra',
    },
    lastAction: '09:22',
  },
  {
    number: 'UCO-02',
    ward: 'UTI Coronariana',
    status: 'occupied',
    patient: {
      mrn: 'MRN-212',
      name: 'Ana Beatriz Moraes',
      age: 59,
      daysAdmitted: 1,
      risk: 'high',
      diagnosis: 'ICC descompensada',
    },
    lastAction: '09:58',
  },
  {
    number: 'UCO-03',
    ward: 'UTI Coronariana',
    status: 'available',
    lastAction: '08:30',
  },
  {
    number: 'UCO-04',
    ward: 'UTI Coronariana',
    status: 'maintenance',
    maintenanceReason: 'Bomba de infusão em revisão técnica',
    lastAction: '07:15',
  },

  // Ala 1A
  {
    number: '1A-01',
    ward: 'Ala 1A',
    status: 'occupied',
    patient: {
      mrn: 'MRN-101',
      name: 'Pedro Nascimento',
      age: 47,
      daysAdmitted: 2,
      risk: 'medium',
      diagnosis: 'Pancreatite aguda',
    },
    lastAction: '08:40',
  },
  {
    number: '1A-02',
    ward: 'Ala 1A',
    status: 'occupied',
    patient: {
      mrn: 'MRN-102',
      name: 'Lúcia Ferreira',
      age: 73,
      daysAdmitted: 5,
      risk: 'medium',
      diagnosis: 'Infecção urinária',
    },
    lastAction: '09:00',
  },
  {
    number: '1A-03',
    ward: 'Ala 1A',
    status: 'cleaning',
    lastAction: '08:55',
    cleaningEta: '10:15',
  },
  {
    number: '1A-04',
    ward: 'Ala 1A',
    status: 'available',
    lastAction: '07:50',
  },
  {
    number: '1A-05',
    ward: 'Ala 1A',
    status: 'occupied',
    patient: {
      mrn: 'MRN-103',
      name: 'Marcos Oliveira',
      age: 51,
      daysAdmitted: 8,
      risk: 'low',
      diagnosis: 'Alta programada 12h',
    },
    lastAction: '09:30',
  },

  // Ala 1B
  {
    number: '1B-01',
    ward: 'Ala 1B',
    status: 'occupied',
    patient: {
      mrn: 'MRN-111',
      name: 'Carla Ribeiro',
      age: 39,
      daysAdmitted: 3,
      risk: 'medium',
      diagnosis: 'Colecistite',
    },
    lastAction: '09:15',
  },
  {
    number: '1B-02',
    ward: 'Ala 1B',
    status: 'occupied',
    patient: {
      mrn: 'MRN-112',
      name: 'Henrique Duarte',
      age: 66,
      daysAdmitted: 6,
      risk: 'high',
      diagnosis: 'AVC isquêmico',
    },
    lastAction: '08:25',
  },
  {
    number: '1B-03',
    ward: 'Ala 1B',
    status: 'blocked',
    blockedReason: 'Coorte COVID-19 — bloqueio epidemiológico',
    lastAction: 'ontem 22:00',
  },
  {
    number: '1B-04',
    ward: 'Ala 1B',
    status: 'available',
    lastAction: '08:05',
  },
  {
    number: '1B-05',
    ward: 'Ala 1B',
    status: 'cleaning',
    lastAction: '09:20',
    cleaningEta: '10:50',
  },

  // Ala 2A
  {
    number: '2A-01',
    ward: 'Ala 2A',
    status: 'occupied',
    patient: {
      mrn: 'MRN-121',
      name: 'Eleanor Voss',
      age: 81,
      daysAdmitted: 9,
      risk: 'high',
      diagnosis: 'IAM pós-ICP',
    },
    lastAction: '09:45',
  },
  {
    number: '2A-02',
    ward: 'Ala 2A',
    status: 'occupied',
    patient: {
      mrn: 'MRN-122',
      name: 'Peter Hawkins',
      age: 84,
      daysAdmitted: 14,
      risk: 'medium',
      diagnosis: 'Sepse — recuperação',
    },
    lastAction: '09:00',
  },
  {
    number: '2A-03',
    ward: 'Ala 2A',
    status: 'reserved',
    reservedFor: 'Transferência UTI Adulto — 13:30',
    lastAction: '08:20',
  },
  {
    number: '2A-04',
    ward: 'Ala 2A',
    status: 'available',
    lastAction: '07:40',
  },

  // Ala 2B
  {
    number: '2B-01',
    ward: 'Ala 2B',
    status: 'occupied',
    patient: {
      mrn: 'MRN-131',
      name: 'Robert Ngozi',
      age: 72,
      daysAdmitted: 8,
      risk: 'medium',
      diagnosis: 'DPOC exacerbado',
    },
    lastAction: '08:55',
  },
  {
    number: '2B-02',
    ward: 'Ala 2B',
    status: 'maintenance',
    maintenanceReason: 'Cama hospitalar com defeito na base elétrica',
    lastAction: '07:30',
  },
  {
    number: '2B-03',
    ward: 'Ala 2B',
    status: 'available',
    lastAction: '08:10',
  },
  {
    number: '2B-04',
    ward: 'Ala 2B',
    status: 'cleaning',
    lastAction: '09:35',
    cleaningEta: '10:40',
  },

  // Ala 3A
  {
    number: '3A-01',
    ward: 'Ala 3A',
    status: 'occupied',
    patient: {
      mrn: 'MRN-141',
      name: 'Fatima Al-Rashid',
      age: 38,
      daysAdmitted: 3,
      risk: 'low',
      diagnosis: 'Pós-op ginecológico',
    },
    lastAction: '09:10',
  },
  {
    number: '3A-02',
    ward: 'Ala 3A',
    status: 'occupied',
    patient: {
      mrn: 'MRN-142',
      name: 'Isabela Santos',
      age: 29,
      daysAdmitted: 1,
      risk: 'low',
      diagnosis: 'Apendicectomia',
    },
    lastAction: '09:48',
  },
  {
    number: '3A-03',
    ward: 'Ala 3A',
    status: 'available',
    lastAction: '08:00',
  },
  {
    number: '3A-04',
    ward: 'Ala 3A',
    status: 'available',
    lastAction: '07:55',
  },

  // Ala 3B
  {
    number: '3B-01',
    ward: 'Ala 3B',
    status: 'occupied',
    patient: {
      mrn: 'MRN-151',
      name: 'Sarah Mitchell',
      age: 54,
      daysAdmitted: 6,
      risk: 'low',
      diagnosis: 'Colecistite — alta 12h',
    },
    lastAction: '09:05',
  },
  {
    number: '3B-02',
    ward: 'Ala 3B',
    status: 'occupied',
    patient: {
      mrn: 'MRN-152',
      name: 'Thomas Crane',
      age: 52,
      daysAdmitted: 3,
      risk: 'low',
      diagnosis: 'Hernioplastia',
    },
    lastAction: '09:18',
  },
  {
    number: '3B-03',
    ward: 'Ala 3B',
    status: 'cleaning',
    lastAction: '08:35',
    cleaningEta: '10:05',
  },
  {
    number: '3B-04',
    ward: 'Ala 3B',
    status: 'reserved',
    reservedFor: 'Centro cirúrgico — Sala 3 (11:30)',
    lastAction: '08:15',
  },

  // Pronto Atendimento
  {
    number: 'PA-01',
    ward: 'Pronto Atendimento',
    status: 'occupied',
    patient: {
      mrn: 'MRN-301',
      name: 'Joana Lima',
      age: 44,
      daysAdmitted: 0,
      risk: 'high',
      diagnosis: 'Dor torácica — investigação',
    },
    lastAction: '09:52',
  },
  {
    number: 'PA-02',
    ward: 'Pronto Atendimento',
    status: 'occupied',
    patient: {
      mrn: 'MRN-302',
      name: 'Felipe Andrade',
      age: 27,
      daysAdmitted: 0,
      risk: 'medium',
      diagnosis: 'Trauma membro inferior',
    },
    lastAction: '09:40',
  },
  {
    number: 'PA-03',
    ward: 'Pronto Atendimento',
    status: 'available',
    lastAction: '08:20',
  },
  {
    number: 'PA-04',
    ward: 'Pronto Atendimento',
    status: 'cleaning',
    lastAction: '09:25',
    cleaningEta: '09:55',
  },
];
