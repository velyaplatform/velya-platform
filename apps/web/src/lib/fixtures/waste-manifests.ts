/**
 * Centralized fixtures for hospital waste manifests (PGRSS). Mapped to FHIR R4 Task (category=waste).
 * Aligned with ANVISA RDC 222/2018 (Regulamento Técnico de Resíduos de Serviços de Saúde).
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate these IDs in page files.
 */

export type WasteType =
  | 'infectante-A1'
  | 'infectante-A2'
  | 'quimico-B'
  | 'radioativo-C'
  | 'comum-D'
  | 'perfurocortante-E';

export type WasteFinalDisposal =
  | 'incineracao'
  | 'aterro-sanitario'
  | 'autoclave'
  | 'reciclagem';

export type WasteStatus = 'generated' | 'in-storage' | 'collected' | 'disposed';

export interface WasteManifest {
  id: string;
  wasteType: WasteType;
  originArea: string;
  weightKg: number;
  generatedAt: string;
  collectedAt?: string;
  transportCompanyId?: string;
  transportCompanyName?: string;
  finalDisposal?: WasteFinalDisposal;
  manifestNumber: string;
  status: WasteStatus;
}

export const WASTE_MANIFESTS: WasteManifest[] = [
  {
    id: 'WST-2026-0001',
    wasteType: 'infectante-A1',
    originArea: 'UTI Adulto - Box 07',
    weightKg: 18.4,
    generatedAt: '2026-04-09T19:30:00-03:00',
    collectedAt: '2026-04-10T06:15:00-03:00',
    transportCompanyId: 'SUP-005',
    transportCompanyName: 'TransFarma Logística',
    finalDisposal: 'incineracao',
    manifestNumber: 'MTR-2026-00045',
    status: 'disposed',
  },
  {
    id: 'WST-2026-0002',
    wasteType: 'infectante-A2',
    originArea: 'Isolamento - Box 04 UTI',
    weightKg: 12.9,
    generatedAt: '2026-04-10T07:50:00-03:00',
    finalDisposal: 'autoclave',
    manifestNumber: 'MTR-2026-00046',
    status: 'in-storage',
  },
  {
    id: 'WST-2026-0003',
    wasteType: 'perfurocortante-E',
    originArea: 'Enfermaria Clínica - 4º andar',
    weightKg: 4.6,
    generatedAt: '2026-04-10T09:00:00-03:00',
    collectedAt: '2026-04-10T11:20:00-03:00',
    transportCompanyId: 'SUP-005',
    transportCompanyName: 'TransFarma Logística',
    finalDisposal: 'incineracao',
    manifestNumber: 'MTR-2026-00047',
    status: 'collected',
  },
  {
    id: 'WST-2026-0004',
    wasteType: 'quimico-B',
    originArea: 'Laboratório - Bioquímica',
    weightKg: 8.2,
    generatedAt: '2026-04-09T16:10:00-03:00',
    collectedAt: '2026-04-10T08:00:00-03:00',
    transportCompanyId: 'SUP-005',
    transportCompanyName: 'TransFarma Logística',
    finalDisposal: 'incineracao',
    manifestNumber: 'MTR-2026-00048',
    status: 'collected',
  },
  {
    id: 'WST-2026-0005',
    wasteType: 'radioativo-C',
    originArea: 'Medicina Nuclear - Sala Quente',
    weightKg: 1.2,
    generatedAt: '2026-04-08T10:30:00-03:00',
    manifestNumber: 'MTR-2026-00049',
    status: 'in-storage',
  },
  {
    id: 'WST-2026-0006',
    wasteType: 'comum-D',
    originArea: 'Recepção Ambulatório',
    weightKg: 26.8,
    generatedAt: '2026-04-10T06:00:00-03:00',
    collectedAt: '2026-04-10T09:45:00-03:00',
    transportCompanyId: 'SUP-004',
    transportCompanyName: 'Higi-Limpa Serviços Hospitalares',
    finalDisposal: 'aterro-sanitario',
    manifestNumber: 'MTR-2026-00050',
    status: 'disposed',
  },
  {
    id: 'WST-2026-0007',
    wasteType: 'infectante-A1',
    originArea: 'Centro Cirúrgico - Sala 02',
    weightKg: 22.5,
    generatedAt: '2026-04-10T12:40:00-03:00',
    manifestNumber: 'MTR-2026-00051',
    status: 'generated',
  },
  {
    id: 'WST-2026-0008',
    wasteType: 'perfurocortante-E',
    originArea: 'Pronto Socorro - Sala Amarela',
    weightKg: 3.1,
    generatedAt: '2026-04-10T11:05:00-03:00',
    manifestNumber: 'MTR-2026-00052',
    status: 'generated',
  },
  {
    id: 'WST-2026-0009',
    wasteType: 'quimico-B',
    originArea: 'Farmácia - Quimioterápicos',
    weightKg: 5.7,
    generatedAt: '2026-04-09T14:20:00-03:00',
    collectedAt: '2026-04-10T07:30:00-03:00',
    transportCompanyId: 'SUP-005',
    transportCompanyName: 'TransFarma Logística',
    finalDisposal: 'incineracao',
    manifestNumber: 'MTR-2026-00053',
    status: 'disposed',
  },
  {
    id: 'WST-2026-0010',
    wasteType: 'comum-D',
    originArea: 'Refeitório - Copa hospitalar',
    weightKg: 41.3,
    generatedAt: '2026-04-10T13:00:00-03:00',
    finalDisposal: 'reciclagem',
    manifestNumber: 'MTR-2026-00054',
    status: 'in-storage',
  },
];
