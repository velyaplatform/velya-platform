/**
 * Centralized fixtures for clinical and facility assets. Mapped to FHIR R4 Device.
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate these IDs in page files.
 */

export type AssetType =
  | 'ventilador'
  | 'monitor'
  | 'bomba-infusao'
  | 'desfibrilador'
  | 'ultrassom'
  | 'tomografo'
  | 'raio-x'
  | 'autoclave'
  | 'gerador'
  | 'nobreak'
  | 'hvac';

export type AssetRiskClass = 'I' | 'II' | 'III' | 'IV';

export type AssetStatus =
  | 'active'
  | 'in-maintenance'
  | 'calibration-due'
  | 'out-of-service'
  | 'retired';

export type AssetCriticality = 'low' | 'medium' | 'high' | 'critical';

export interface Asset {
  id: string;
  type: AssetType;
  manufacturer: string;
  model: string;
  serial: string;
  patrimony: string;
  location: string;
  riskClass: AssetRiskClass;
  status: AssetStatus;
  installedAt: string;
  warrantyEnd: string;
  lastMaintenance: string;
  nextMaintenance: string;
  criticality: AssetCriticality;
}

export const ASSETS: Asset[] = [
  {
    id: 'AST-0001',
    type: 'ventilador',
    manufacturer: 'Dräger',
    model: 'Evita V800',
    serial: 'DRG-V800-44211',
    patrimony: 'PAT-0004211',
    location: 'UTI Adulto - Leito 07',
    riskClass: 'IV',
    status: 'active',
    installedAt: '2023-06-15',
    warrantyEnd: '2027-06-14',
    lastMaintenance: '2026-02-10',
    nextMaintenance: '2026-05-10',
    criticality: 'critical',
  },
  {
    id: 'AST-0002',
    type: 'ventilador',
    manufacturer: 'Magnamed',
    model: 'Oxymag',
    serial: 'MGN-OXM-10822',
    patrimony: 'PAT-0004212',
    location: 'UTI Adulto - Leito 12',
    riskClass: 'IV',
    status: 'in-maintenance',
    installedAt: '2022-11-02',
    warrantyEnd: '2026-11-01',
    lastMaintenance: '2026-04-08',
    nextMaintenance: '2026-07-08',
    criticality: 'critical',
  },
  {
    id: 'AST-0003',
    type: 'monitor',
    manufacturer: 'Philips',
    model: 'IntelliVue MX550',
    serial: 'PHIL-MX-99881',
    patrimony: 'PAT-0003101',
    location: 'UTI Adulto - Leito 03',
    riskClass: 'III',
    status: 'active',
    installedAt: '2024-01-20',
    warrantyEnd: '2028-01-19',
    lastMaintenance: '2026-03-01',
    nextMaintenance: '2026-06-01',
    criticality: 'high',
  },
  {
    id: 'AST-0004',
    type: 'monitor',
    manufacturer: 'Mindray',
    model: 'BeneVision N15',
    serial: 'MND-N15-44023',
    patrimony: 'PAT-0003102',
    location: 'Centro Cirúrgico - Sala 02',
    riskClass: 'III',
    status: 'calibration-due',
    installedAt: '2023-04-05',
    warrantyEnd: '2027-04-04',
    lastMaintenance: '2025-10-15',
    nextMaintenance: '2026-04-15',
    criticality: 'high',
  },
  {
    id: 'AST-0005',
    type: 'bomba-infusao',
    manufacturer: 'B.Braun',
    model: 'Infusomat Space',
    serial: 'BBR-IS-55410',
    patrimony: 'PAT-0002501',
    location: 'Enfermaria Clínica - 4º andar',
    riskClass: 'II',
    status: 'active',
    installedAt: '2024-07-11',
    warrantyEnd: '2027-07-10',
    lastMaintenance: '2026-03-20',
    nextMaintenance: '2026-09-20',
    criticality: 'high',
  },
  {
    id: 'AST-0006',
    type: 'bomba-infusao',
    manufacturer: 'Lifemed',
    model: 'LF2001',
    serial: 'LFM-2001-33099',
    patrimony: 'PAT-0002502',
    location: 'Oncologia - Sala Quimio 1',
    riskClass: 'II',
    status: 'active',
    installedAt: '2023-09-02',
    warrantyEnd: '2026-09-01',
    lastMaintenance: '2026-02-14',
    nextMaintenance: '2026-08-14',
    criticality: 'high',
  },
  {
    id: 'AST-0007',
    type: 'desfibrilador',
    manufacturer: 'ZOLL',
    model: 'R Series Plus',
    serial: 'ZOL-RSP-77812',
    patrimony: 'PAT-0005201',
    location: 'Pronto Socorro - Sala Amarela',
    riskClass: 'III',
    status: 'active',
    installedAt: '2024-03-12',
    warrantyEnd: '2028-03-11',
    lastMaintenance: '2026-03-12',
    nextMaintenance: '2026-09-12',
    criticality: 'critical',
  },
  {
    id: 'AST-0008',
    type: 'desfibrilador',
    manufacturer: 'Philips',
    model: 'HeartStart XL+',
    serial: 'PHIL-HS-88444',
    patrimony: 'PAT-0005202',
    location: 'Centro Cirúrgico - Sala 01',
    riskClass: 'III',
    status: 'active',
    installedAt: '2023-12-01',
    warrantyEnd: '2027-11-30',
    lastMaintenance: '2026-01-30',
    nextMaintenance: '2026-07-30',
    criticality: 'critical',
  },
  {
    id: 'AST-0009',
    type: 'ultrassom',
    manufacturer: 'GE Healthcare',
    model: 'Voluson E10',
    serial: 'GE-VE10-22900',
    patrimony: 'PAT-0007701',
    location: 'Imagem - Sala USG 1',
    riskClass: 'II',
    status: 'active',
    installedAt: '2022-05-18',
    warrantyEnd: '2026-05-17',
    lastMaintenance: '2026-02-25',
    nextMaintenance: '2026-08-25',
    criticality: 'medium',
  },
  {
    id: 'AST-0010',
    type: 'tomografo',
    manufacturer: 'Siemens Healthineers',
    model: 'SOMATOM go.Top',
    serial: 'SMS-SGT-10001',
    patrimony: 'PAT-0009901',
    location: 'Imagem - Sala Tomografia',
    riskClass: 'IV',
    status: 'active',
    installedAt: '2021-09-30',
    warrantyEnd: '2026-09-29',
    lastMaintenance: '2026-03-05',
    nextMaintenance: '2026-06-05',
    criticality: 'critical',
  },
  {
    id: 'AST-0011',
    type: 'raio-x',
    manufacturer: 'Canon Medical',
    model: 'Radrex-i',
    serial: 'CNM-RDX-55630',
    patrimony: 'PAT-0009801',
    location: 'Imagem - Sala RX 2',
    riskClass: 'III',
    status: 'active',
    installedAt: '2023-02-10',
    warrantyEnd: '2027-02-09',
    lastMaintenance: '2026-01-15',
    nextMaintenance: '2026-07-15',
    criticality: 'high',
  },
  {
    id: 'AST-0012',
    type: 'autoclave',
    manufacturer: 'Baumer',
    model: 'HI-VAC II 424L',
    serial: 'BMR-HIV-40120',
    patrimony: 'PAT-0008801',
    location: 'CME - Central de Material',
    riskClass: 'II',
    status: 'active',
    installedAt: '2022-08-22',
    warrantyEnd: '2026-08-21',
    lastMaintenance: '2026-03-28',
    nextMaintenance: '2026-06-28',
    criticality: 'high',
  },
  {
    id: 'AST-0013',
    type: 'autoclave',
    manufacturer: 'Cristófoli',
    model: 'Vitale Class 75',
    serial: 'CRF-VC75-22018',
    patrimony: 'PAT-0008802',
    location: 'Centro Cirúrgico - Expurgo',
    riskClass: 'II',
    status: 'out-of-service',
    installedAt: '2020-04-10',
    warrantyEnd: '2024-04-09',
    lastMaintenance: '2026-01-10',
    nextMaintenance: '2026-04-10',
    criticality: 'medium',
  },
  {
    id: 'AST-0014',
    type: 'gerador',
    manufacturer: 'Stemac',
    model: 'ST500 Diesel',
    serial: 'STM-ST500-77001',
    patrimony: 'PAT-0001101',
    location: 'Casa de Máquinas - Subsolo',
    riskClass: 'I',
    status: 'active',
    installedAt: '2019-11-05',
    warrantyEnd: '2024-11-04',
    lastMaintenance: '2026-02-28',
    nextMaintenance: '2026-05-28',
    criticality: 'critical',
  },
  {
    id: 'AST-0015',
    type: 'nobreak',
    manufacturer: 'APC',
    model: 'Symmetra LX 16kVA',
    serial: 'APC-SLX-88210',
    patrimony: 'PAT-0001201',
    location: 'Data Center - Térreo',
    riskClass: 'I',
    status: 'active',
    installedAt: '2022-01-15',
    warrantyEnd: '2027-01-14',
    lastMaintenance: '2026-03-10',
    nextMaintenance: '2026-09-10',
    criticality: 'high',
  },
  {
    id: 'AST-0016',
    type: 'nobreak',
    manufacturer: 'Eaton',
    model: '9PX 6kVA',
    serial: 'ETN-9PX-44520',
    patrimony: 'PAT-0001202',
    location: 'UTI Adulto - Rack técnico',
    riskClass: 'I',
    status: 'active',
    installedAt: '2023-05-09',
    warrantyEnd: '2026-05-08',
    lastMaintenance: '2026-03-15',
    nextMaintenance: '2026-09-15',
    criticality: 'critical',
  },
  {
    id: 'AST-0017',
    type: 'hvac',
    manufacturer: 'Trane',
    model: 'CVHE 500TR Chiller',
    serial: 'TRN-CVHE-11020',
    patrimony: 'PAT-0006601',
    location: 'Cobertura - Casa de Máquinas AC',
    riskClass: 'I',
    status: 'active',
    installedAt: '2020-07-01',
    warrantyEnd: '2025-06-30',
    lastMaintenance: '2026-03-25',
    nextMaintenance: '2026-06-25',
    criticality: 'high',
  },
  {
    id: 'AST-0018',
    type: 'hvac',
    manufacturer: 'Carrier',
    model: 'AquaEdge 19DV',
    serial: 'CAR-AE19-33221',
    patrimony: 'PAT-0006602',
    location: 'Centro Cirúrgico - Shaft técnico',
    riskClass: 'I',
    status: 'active',
    installedAt: '2021-10-20',
    warrantyEnd: '2026-10-19',
    lastMaintenance: '2026-02-05',
    nextMaintenance: '2026-05-05',
    criticality: 'critical',
  },
];
