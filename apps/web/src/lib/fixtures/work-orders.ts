/**
 * Centralized fixtures for CMMS maintenance work orders. Mapped to FHIR R4 Task (category=maintenance).
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate these IDs in page files.
 */

export type WorkOrderType =
  | 'preventive'
  | 'corrective'
  | 'calibration'
  | 'inspection'
  | 'recall';

export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'emergency';

export type WorkOrderStatus =
  | 'open'
  | 'assigned'
  | 'in-progress'
  | 'waiting-parts'
  | 'completed'
  | 'cancelled';

export type WorkOrderImpact = 'none' | 'limited' | 'high' | 'critical';

export interface WorkOrder {
  id: string;
  assetId: string;
  type: WorkOrderType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  openedAt: string;
  openedBy: string;
  assignedTo?: string;
  description: string;
  scheduledFor?: string;
  completedAt?: string;
  impactLevel: WorkOrderImpact;
  contractorId?: string;
}

export const WORK_ORDERS: WorkOrder[] = [
  {
    id: 'WO-2026-0001',
    assetId: 'AST-0002',
    type: 'corrective',
    priority: 'emergency',
    status: 'in-progress',
    openedAt: '2026-04-08T04:12:00-03:00',
    openedBy: 'EMP-3001',
    assignedTo: 'EMP-4001',
    description: 'Falha no sensor de fluxo do ventilador Magnamed Oxymag - leito substituído',
    scheduledFor: '2026-04-08T06:00:00-03:00',
    impactLevel: 'critical',
  },
  {
    id: 'WO-2026-0002',
    assetId: 'AST-0001',
    type: 'preventive',
    priority: 'medium',
    status: 'completed',
    openedAt: '2026-02-01T09:00:00-03:00',
    openedBy: 'EMP-4001',
    assignedTo: 'EMP-4001',
    description: 'Manutenção preventiva trimestral Dräger Evita V800 conforme manual do fabricante',
    scheduledFor: '2026-02-10T08:00:00-03:00',
    completedAt: '2026-02-10T12:30:00-03:00',
    impactLevel: 'limited',
  },
  {
    id: 'WO-2026-0003',
    assetId: 'AST-0004',
    type: 'calibration',
    priority: 'high',
    status: 'assigned',
    openedAt: '2026-04-01T10:20:00-03:00',
    openedBy: 'EMP-3001',
    assignedTo: 'EMP-4001',
    description: 'Calibração semestral vencida do monitor BeneVision N15 (sala cirúrgica)',
    scheduledFor: '2026-04-14T07:30:00-03:00',
    impactLevel: 'high',
    contractorId: 'SUP-003',
  },
  {
    id: 'WO-2026-0004',
    assetId: 'AST-0013',
    type: 'corrective',
    priority: 'high',
    status: 'waiting-parts',
    openedAt: '2026-03-30T15:45:00-03:00',
    openedBy: 'EMP-3001',
    assignedTo: 'EMP-4001',
    description: 'Autoclave Cristófoli com falha no sensor de pressão - aguardando peça importada',
    scheduledFor: '2026-04-20T08:00:00-03:00',
    impactLevel: 'high',
    contractorId: 'SUP-003',
  },
  {
    id: 'WO-2026-0005',
    assetId: 'AST-0010',
    type: 'preventive',
    priority: 'high',
    status: 'open',
    openedAt: '2026-04-05T08:00:00-03:00',
    openedBy: 'EMP-3001',
    description: 'Manutenção preventiva quadrimestral do tomógrafo Siemens SOMATOM go.Top',
    scheduledFor: '2026-04-22T22:00:00-03:00',
    impactLevel: 'high',
    contractorId: 'SUP-003',
  },
  {
    id: 'WO-2026-0006',
    assetId: 'AST-0007',
    type: 'inspection',
    priority: 'medium',
    status: 'completed',
    openedAt: '2026-03-05T11:10:00-03:00',
    openedBy: 'EMP-1003',
    assignedTo: 'EMP-4001',
    description: 'Inspeção mensal bateria e pás do desfibrilador ZOLL R Series',
    scheduledFor: '2026-03-12T09:00:00-03:00',
    completedAt: '2026-03-12T09:45:00-03:00',
    impactLevel: 'none',
  },
  {
    id: 'WO-2026-0007',
    assetId: 'AST-0014',
    type: 'preventive',
    priority: 'high',
    status: 'in-progress',
    openedAt: '2026-04-06T07:30:00-03:00',
    openedBy: 'EMP-4001',
    assignedTo: 'EMP-4001',
    description: 'Teste de partida mensal do gerador Stemac ST500 + análise de combustível',
    scheduledFor: '2026-04-10T07:00:00-03:00',
    impactLevel: 'limited',
  },
  {
    id: 'WO-2026-0008',
    assetId: 'AST-0017',
    type: 'preventive',
    priority: 'medium',
    status: 'assigned',
    openedAt: '2026-04-02T09:15:00-03:00',
    openedBy: 'EMP-4001',
    assignedTo: 'EMP-4001',
    description: 'Troca de filtros HEPA do chiller HVAC Trane CVHE - áreas críticas',
    scheduledFor: '2026-04-12T22:00:00-03:00',
    impactLevel: 'limited',
  },
  {
    id: 'WO-2026-0009',
    assetId: 'AST-0005',
    type: 'calibration',
    priority: 'medium',
    status: 'open',
    openedAt: '2026-04-07T14:00:00-03:00',
    openedBy: 'EMP-3001',
    description: 'Verificação de precisão volumétrica da bomba de infusão B.Braun Infusomat',
    scheduledFor: '2026-04-15T10:00:00-03:00',
    impactLevel: 'limited',
  },
  {
    id: 'WO-2026-0010',
    assetId: 'AST-0011',
    type: 'recall',
    priority: 'high',
    status: 'assigned',
    openedAt: '2026-04-03T16:40:00-03:00',
    openedBy: 'EMP-2002',
    assignedTo: 'EMP-4001',
    description: 'Recall ANVISA RES-2026/112 - atualização de firmware do raio-X Canon Radrex-i',
    scheduledFor: '2026-04-13T19:00:00-03:00',
    impactLevel: 'high',
    contractorId: 'SUP-003',
  },
  {
    id: 'WO-2026-0011',
    assetId: 'AST-0016',
    type: 'inspection',
    priority: 'medium',
    status: 'completed',
    openedAt: '2026-03-10T08:20:00-03:00',
    openedBy: 'EMP-4001',
    assignedTo: 'EMP-4001',
    description: 'Teste de autonomia do nobreak Eaton 9PX - UTI Adulto rack técnico',
    scheduledFor: '2026-03-15T23:00:00-03:00',
    completedAt: '2026-03-16T00:30:00-03:00',
    impactLevel: 'none',
  },
  {
    id: 'WO-2026-0012',
    assetId: 'AST-0009',
    type: 'preventive',
    priority: 'low',
    status: 'open',
    openedAt: '2026-04-06T13:30:00-03:00',
    openedBy: 'EMP-3001',
    description: 'Limpeza de transdutores e atualização de software do USG GE Voluson E10',
    scheduledFor: '2026-04-25T18:00:00-03:00',
    impactLevel: 'limited',
  },
  {
    id: 'WO-2026-0013',
    assetId: 'AST-0006',
    type: 'corrective',
    priority: 'medium',
    status: 'cancelled',
    openedAt: '2026-03-25T10:00:00-03:00',
    openedBy: 'EMP-1004',
    assignedTo: 'EMP-4001',
    description: 'Reclamação de alarme sonoro intermitente na bomba Lifemed LF2001',
    impactLevel: 'limited',
  },
  {
    id: 'WO-2026-0014',
    assetId: 'AST-0018',
    type: 'preventive',
    priority: 'high',
    status: 'in-progress',
    openedAt: '2026-04-04T06:00:00-03:00',
    openedBy: 'EMP-4001',
    assignedTo: 'EMP-4001',
    description: 'Limpeza química de serpentinas do HVAC Carrier AquaEdge - centro cirúrgico',
    scheduledFor: '2026-04-09T22:00:00-03:00',
    impactLevel: 'high',
  },
  {
    id: 'WO-2026-0015',
    assetId: 'AST-0012',
    type: 'preventive',
    priority: 'medium',
    status: 'open',
    openedAt: '2026-04-07T09:10:00-03:00',
    openedBy: 'EMP-3001',
    description: 'Validação trimestral Bowie-Dick + teste biológico autoclave Baumer HI-VAC',
    scheduledFor: '2026-04-18T06:00:00-03:00',
    impactLevel: 'limited',
  },
];
