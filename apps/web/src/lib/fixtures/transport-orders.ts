/**
 * Centralized fixtures for internal patient transport orders. Mapped to FHIR R4 Task (category=transport).
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate these IDs in page files.
 */

export type TransportReason = 'exam' | 'surgery' | 'transfer' | 'discharge' | 'admission';

export type TransportPriority = 'routine' | 'urgent' | 'emergency';

export type TransportEquipment = 'maca' | 'cadeira' | 'monitor' | 'o2' | 'bomba';

export type TransportStatus =
  | 'requested'
  | 'assigned'
  | 'in-transit'
  | 'completed'
  | 'cancelled';

export interface TransportOrder {
  id: string;
  patientMrn: string;
  origin: string;
  destination: string;
  reason: TransportReason;
  priority: TransportPriority;
  equipmentRequired: TransportEquipment[];
  requestedAt: string;
  assignedTo?: string;
  status: TransportStatus;
  isolationRequired: boolean;
}

export const TRANSPORT_ORDERS: TransportOrder[] = [
  {
    id: 'TRN-2026-0001',
    patientMrn: 'MRN-001',
    origin: 'Enfermaria Clínica - Leito 207',
    destination: 'Imagem - Sala Tomografia',
    reason: 'exam',
    priority: 'routine',
    equipmentRequired: ['cadeira'],
    requestedAt: '2026-04-10T08:00:00-03:00',
    assignedTo: 'EMP-6001',
    status: 'completed',
    isolationRequired: false,
  },
  {
    id: 'TRN-2026-0002',
    patientMrn: 'MRN-003',
    origin: 'UTI Adulto - Box 07',
    destination: 'Centro Cirúrgico - Sala 01',
    reason: 'surgery',
    priority: 'urgent',
    equipmentRequired: ['maca', 'monitor', 'o2', 'bomba'],
    requestedAt: '2026-04-10T09:30:00-03:00',
    assignedTo: 'EMP-6001',
    status: 'in-transit',
    isolationRequired: false,
  },
  {
    id: 'TRN-2026-0003',
    patientMrn: 'MRN-006',
    origin: 'Pronto Socorro - Sala Amarela',
    destination: 'UTI Adulto - Box 12',
    reason: 'admission',
    priority: 'emergency',
    equipmentRequired: ['maca', 'monitor', 'o2'],
    requestedAt: '2026-04-10T10:15:00-03:00',
    assignedTo: 'EMP-5001',
    status: 'completed',
    isolationRequired: false,
  },
  {
    id: 'TRN-2026-0004',
    patientMrn: 'MRN-009',
    origin: 'Enfermaria Cirúrgica - Leito 305',
    destination: 'Imagem - Sala USG 1',
    reason: 'exam',
    priority: 'routine',
    equipmentRequired: ['cadeira'],
    requestedAt: '2026-04-10T10:40:00-03:00',
    status: 'requested',
    isolationRequired: false,
  },
  {
    id: 'TRN-2026-0005',
    patientMrn: 'MRN-010',
    origin: 'Isolamento - Box 04 UTI',
    destination: 'Imagem - Sala RX 2',
    reason: 'exam',
    priority: 'urgent',
    equipmentRequired: ['maca', 'monitor', 'o2'],
    requestedAt: '2026-04-10T11:00:00-03:00',
    assignedTo: 'EMP-6001',
    status: 'assigned',
    isolationRequired: true,
  },
  {
    id: 'TRN-2026-0006',
    patientMrn: 'MRN-011',
    origin: 'Enfermaria Clínica - Leito 112',
    destination: 'Hall de Alta - Térreo',
    reason: 'discharge',
    priority: 'routine',
    equipmentRequired: ['cadeira'],
    requestedAt: '2026-04-10T11:30:00-03:00',
    assignedTo: 'EMP-6001',
    status: 'completed',
    isolationRequired: false,
  },
  {
    id: 'TRN-2026-0007',
    patientMrn: 'MRN-013',
    origin: 'UTI Adulto - Box 03',
    destination: 'Hemodinâmica - Sala 01',
    reason: 'exam',
    priority: 'urgent',
    equipmentRequired: ['maca', 'monitor', 'bomba', 'o2'],
    requestedAt: '2026-04-10T12:10:00-03:00',
    assignedTo: 'EMP-5001',
    status: 'in-transit',
    isolationRequired: false,
  },
  {
    id: 'TRN-2026-0008',
    patientMrn: 'MRN-014',
    origin: 'Ambulatório - Sala 12',
    destination: 'Pronto Socorro - Triagem',
    reason: 'transfer',
    priority: 'urgent',
    equipmentRequired: ['cadeira'],
    requestedAt: '2026-04-10T12:45:00-03:00',
    assignedTo: 'EMP-6001',
    status: 'assigned',
    isolationRequired: false,
  },
  {
    id: 'TRN-2026-0009',
    patientMrn: 'MRN-015',
    origin: 'Centro Cirúrgico - RPA',
    destination: 'Enfermaria Cirúrgica - Leito 308',
    reason: 'transfer',
    priority: 'routine',
    equipmentRequired: ['maca', 'monitor'],
    requestedAt: '2026-04-10T13:00:00-03:00',
    status: 'requested',
    isolationRequired: false,
  },
  {
    id: 'TRN-2026-0010',
    patientMrn: 'MRN-019',
    origin: 'Pronto Socorro - Sala Vermelha',
    destination: 'Imagem - Sala Tomografia',
    reason: 'exam',
    priority: 'emergency',
    equipmentRequired: ['maca', 'monitor', 'o2', 'bomba'],
    requestedAt: '2026-04-10T13:25:00-03:00',
    assignedTo: 'EMP-5001',
    status: 'cancelled',
    isolationRequired: false,
  },
];
