/**
 * Centralized fixtures for housekeeping / cleaning tasks. Mapped to FHIR R4 Task (category=housekeeping).
 * Aligned with ANVISA RDC 63/2011 (boas práticas de funcionamento para serviços de saúde).
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate these IDs in page files.
 */

export type CleaningAreaType =
  | 'leito'
  | 'sala-cirurgica'
  | 'uti'
  | 'corredor'
  | 'ambulatorio'
  | 'banheiro'
  | 'area-comum';

export type CleaningRiskLevel = 'baixo' | 'medio' | 'alto' | 'critico';

export type CleaningType = 'rotina' | 'terminal' | 'concorrente' | 'desinfeccao';

export type CleaningStatus = 'scheduled' | 'in-progress' | 'completed' | 'blocked';

export interface CleaningTask {
  id: string;
  area: string;
  areaType: CleaningAreaType;
  riskLevel: CleaningRiskLevel;
  type: CleaningType;
  status: CleaningStatus;
  assignedTo: string;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  checklistComplete: boolean;
  productsUsed?: string[];
  slaMinutes: number;
}

export const CLEANING_TASKS: CleaningTask[] = [
  {
    id: 'CLN-2026-0001',
    area: 'Leito 207 - Enfermaria Clínica',
    areaType: 'leito',
    riskLevel: 'medio',
    type: 'terminal',
    status: 'in-progress',
    assignedTo: 'EMP-6001',
    scheduledAt: '2026-04-10T07:00:00-03:00',
    startedAt: '2026-04-10T07:12:00-03:00',
    checklistComplete: false,
    productsUsed: ['Hipoclorito 1%', 'Detergente enzimático', 'Álcool 70%'],
    slaMinutes: 90,
  },
  {
    id: 'CLN-2026-0002',
    area: 'Sala Cirúrgica 01',
    areaType: 'sala-cirurgica',
    riskLevel: 'critico',
    type: 'terminal',
    status: 'scheduled',
    assignedTo: 'EMP-6001',
    scheduledAt: '2026-04-10T14:00:00-03:00',
    checklistComplete: false,
    slaMinutes: 60,
  },
  {
    id: 'CLN-2026-0003',
    area: 'Sala Cirúrgica 02',
    areaType: 'sala-cirurgica',
    riskLevel: 'critico',
    type: 'concorrente',
    status: 'completed',
    assignedTo: 'EMP-6001',
    scheduledAt: '2026-04-10T11:30:00-03:00',
    startedAt: '2026-04-10T11:32:00-03:00',
    completedAt: '2026-04-10T12:05:00-03:00',
    checklistComplete: true,
    productsUsed: ['Quaternário de amônio', 'Álcool 70%'],
    slaMinutes: 45,
  },
  {
    id: 'CLN-2026-0004',
    area: 'UTI Adulto - Box 07',
    areaType: 'uti',
    riskLevel: 'critico',
    type: 'terminal',
    status: 'completed',
    assignedTo: 'EMP-6001',
    scheduledAt: '2026-04-10T05:30:00-03:00',
    startedAt: '2026-04-10T05:35:00-03:00',
    completedAt: '2026-04-10T07:10:00-03:00',
    checklistComplete: true,
    productsUsed: ['Peróxido de hidrogênio acelerado', 'Hipoclorito 1%'],
    slaMinutes: 120,
  },
  {
    id: 'CLN-2026-0005',
    area: 'UTI Adulto - Box 12',
    areaType: 'uti',
    riskLevel: 'critico',
    type: 'rotina',
    status: 'in-progress',
    assignedTo: 'EMP-6001',
    scheduledAt: '2026-04-10T09:00:00-03:00',
    startedAt: '2026-04-10T09:15:00-03:00',
    checklistComplete: false,
    productsUsed: ['Álcool 70%', 'Quaternário de amônio'],
    slaMinutes: 30,
  },
  {
    id: 'CLN-2026-0006',
    area: 'Corredor 4º andar - Ala Clínica',
    areaType: 'corredor',
    riskLevel: 'baixo',
    type: 'rotina',
    status: 'scheduled',
    assignedTo: 'EMP-6001',
    scheduledAt: '2026-04-10T16:00:00-03:00',
    checklistComplete: false,
    slaMinutes: 45,
  },
  {
    id: 'CLN-2026-0007',
    area: 'Ambulatório - Sala 12',
    areaType: 'ambulatorio',
    riskLevel: 'medio',
    type: 'concorrente',
    status: 'completed',
    assignedTo: 'EMP-6001',
    scheduledAt: '2026-04-10T10:30:00-03:00',
    startedAt: '2026-04-10T10:35:00-03:00',
    completedAt: '2026-04-10T10:55:00-03:00',
    checklistComplete: true,
    productsUsed: ['Álcool 70%', 'Detergente neutro'],
    slaMinutes: 25,
  },
  {
    id: 'CLN-2026-0008',
    area: 'Banheiro público - Térreo',
    areaType: 'banheiro',
    riskLevel: 'medio',
    type: 'rotina',
    status: 'blocked',
    assignedTo: 'EMP-6001',
    scheduledAt: '2026-04-10T08:00:00-03:00',
    checklistComplete: false,
    slaMinutes: 30,
  },
  {
    id: 'CLN-2026-0009',
    area: 'Leito 112 - Alta pós-cirúrgica',
    areaType: 'leito',
    riskLevel: 'alto',
    type: 'terminal',
    status: 'completed',
    assignedTo: 'EMP-6001',
    scheduledAt: '2026-04-09T18:30:00-03:00',
    startedAt: '2026-04-09T18:45:00-03:00',
    completedAt: '2026-04-09T20:05:00-03:00',
    checklistComplete: true,
    productsUsed: ['Hipoclorito 1%', 'Peróxido de hidrogênio acelerado'],
    slaMinutes: 90,
  },
  {
    id: 'CLN-2026-0010',
    area: 'Isolamento - Box 04 UTI',
    areaType: 'uti',
    riskLevel: 'critico',
    type: 'desinfeccao',
    status: 'scheduled',
    assignedTo: 'EMP-6001',
    scheduledAt: '2026-04-10T18:00:00-03:00',
    checklistComplete: false,
    slaMinutes: 75,
  },
  {
    id: 'CLN-2026-0011',
    area: 'Recepção Pronto Socorro',
    areaType: 'area-comum',
    riskLevel: 'medio',
    type: 'rotina',
    status: 'in-progress',
    assignedTo: 'EMP-6001',
    scheduledAt: '2026-04-10T06:00:00-03:00',
    startedAt: '2026-04-10T04:45:00-03:00',
    checklistComplete: false,
    productsUsed: ['Detergente neutro', 'Álcool 70%'],
    slaMinutes: 40,
  },
  {
    id: 'CLN-2026-0012',
    area: 'Leito 305 - Enfermaria Cirúrgica',
    areaType: 'leito',
    riskLevel: 'medio',
    type: 'concorrente',
    status: 'scheduled',
    assignedTo: 'EMP-6001',
    scheduledAt: '2026-04-10T12:00:00-03:00',
    checklistComplete: false,
    slaMinutes: 35,
  },
];
