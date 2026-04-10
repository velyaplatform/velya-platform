/**
 * Centralized fixtures for purchase orders. Mapped to FHIR R4 SupplyRequest.
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate these IDs in page files.
 */

export type PurchaseOrderStatus =
  | 'draft'
  | 'pending-approval'
  | 'approved'
  | 'sent'
  | 'received'
  | 'cancelled';

export interface PurchaseOrderLine {
  itemCode: string;
  description: string;
  qty: number;
  unitPrice: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  requestedAt: string;
  status: PurchaseOrderStatus;
  totalValue: number;
  lineItems: PurchaseOrderLine[];
  approvedBy?: string;
  expectedDelivery: string;
  receivedAt?: string;
  notes?: string;
}

export const PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'PO-2026-0001',
    supplierId: 'SUP-001',
    supplierName: 'FarmaPlus Distribuidora Ltda.',
    requestedAt: '2026-04-01T08:15:00-03:00',
    status: 'received',
    totalValue: 12480.0,
    lineItems: [
      { itemCode: 'MED-DIPI-500', description: 'Dipirona 500mg/mL ampola 2mL', qty: 1200, unitPrice: 1.85 },
      { itemCode: 'MED-AMOX-875', description: 'Amoxicilina+Clavulanato 875mg', qty: 2400, unitPrice: 2.4 },
      { itemCode: 'MED-INSU-NPH', description: 'Insulina humana NPH 10mL', qty: 100, unitPrice: 42.9 },
    ],
    approvedBy: 'EMP-2001',
    expectedDelivery: '2026-04-05',
    receivedAt: '2026-04-05T10:30:00-03:00',
  },
  {
    id: 'PO-2026-0002',
    supplierId: 'SUP-002',
    supplierName: 'MedSupply Brasil S.A.',
    requestedAt: '2026-04-02T09:40:00-03:00',
    status: 'sent',
    totalValue: 8752.4,
    lineItems: [
      { itemCode: 'MAT-SER-10ML', description: 'Seringa 10mL luer slip', qty: 5000, unitPrice: 0.68 },
      { itemCode: 'MAT-GZE-7.5', description: 'Gaze estéril 7,5cm pct c/10', qty: 1500, unitPrice: 1.95 },
      { itemCode: 'MAT-SF-500', description: 'Soro fisiológico 0,9% 500mL', qty: 450, unitPrice: 5.4 },
    ],
    approvedBy: 'EMP-2001',
    expectedDelivery: '2026-04-11',
  },
  {
    id: 'PO-2026-0003',
    supplierId: 'SUP-003',
    supplierName: 'TecnoMed Equipamentos',
    requestedAt: '2026-03-28T14:20:00-03:00',
    status: 'approved',
    totalValue: 115600.0,
    lineItems: [
      { itemCode: 'OPME-STENT-CX', description: 'Stent coronário farmacológico', qty: 12, unitPrice: 6800.0 },
      { itemCode: 'OPME-PROT-JQ', description: 'Prótese joelho total M', qty: 2, unitPrice: 18500.0 },
    ],
    approvedBy: 'EMP-2002',
    expectedDelivery: '2026-04-18',
    notes: 'Aguardando confirmação logística refrigerada',
  },
  {
    id: 'PO-2026-0004',
    supplierId: 'SUP-002',
    supplierName: 'MedSupply Brasil S.A.',
    requestedAt: '2026-04-03T11:05:00-03:00',
    status: 'pending-approval',
    totalValue: 4820.0,
    lineItems: [
      { itemCode: 'EPI-LUV-P', description: 'Luva procedimento P cx c/100', qty: 100, unitPrice: 32.0 },
      { itemCode: 'EPI-MSC-N95', description: 'Máscara N95 PFF2', qty: 400, unitPrice: 3.8 },
    ],
    expectedDelivery: '2026-04-12',
  },
  {
    id: 'PO-2026-0005',
    supplierId: 'SUP-004',
    supplierName: 'Higi-Limpa Serviços Hospitalares',
    requestedAt: '2026-04-04T08:50:00-03:00',
    status: 'approved',
    totalValue: 9810.0,
    lineItems: [
      { itemCode: 'ROU-LEN-BR', description: 'Lençol brim branco 2,0x1,4m', qty: 300, unitPrice: 24.5 },
      { itemCode: 'ROU-CMP-CIR', description: 'Campo cirúrgico estéril 90x90', qty: 130, unitPrice: 18.9 },
    ],
    approvedBy: 'EMP-2003',
    expectedDelivery: '2026-04-15',
  },
  {
    id: 'PO-2026-0006',
    supplierId: 'SUP-005',
    supplierName: 'TransFarma Logística',
    requestedAt: '2026-04-05T13:25:00-03:00',
    status: 'sent',
    totalValue: 2680.0,
    lineItems: [
      { itemCode: 'ESC-PAPA4', description: 'Papel sulfite A4 75g resma', qty: 100, unitPrice: 26.8 },
    ],
    approvedBy: 'EMP-2003',
    expectedDelivery: '2026-04-09',
  },
  {
    id: 'PO-2026-0007',
    supplierId: 'SUP-001',
    supplierName: 'FarmaPlus Distribuidora Ltda.',
    requestedAt: '2026-04-06T10:15:00-03:00',
    status: 'draft',
    totalValue: 16400.0,
    lineItems: [
      { itemCode: 'CON-IOD-100', description: 'Contraste iodado 300mg/mL 100mL', qty: 100, unitPrice: 98.5 },
      { itemCode: 'CON-GAD-15', description: 'Gadolínio 15mL ressonância', qty: 45, unitPrice: 145.0 },
    ],
    expectedDelivery: '2026-04-16',
    notes: 'Revisar cota mensal de contraste',
  },
  {
    id: 'PO-2026-0008',
    supplierId: 'SUP-002',
    supplierName: 'MedSupply Brasil S.A.',
    requestedAt: '2026-03-20T09:00:00-03:00',
    status: 'received',
    totalValue: 6120.0,
    lineItems: [
      { itemCode: 'REA-HEMO-CBC', description: 'Reagente CBC kit 500 testes', qty: 6, unitPrice: 850.0 },
      { itemCode: 'REA-COVID-AG', description: 'Teste antígeno COVID cx c/25', qty: 5, unitPrice: 215.0 },
    ],
    approvedBy: 'EMP-2002',
    expectedDelivery: '2026-03-27',
    receivedAt: '2026-03-27T14:10:00-03:00',
  },
  {
    id: 'PO-2026-0009',
    supplierId: 'SUP-003',
    supplierName: 'TecnoMed Equipamentos',
    requestedAt: '2026-03-15T16:30:00-03:00',
    status: 'cancelled',
    totalValue: 4200.0,
    lineItems: [
      { itemCode: 'MAT-ATD-15', description: 'Atadura de crepe 15cm x 1,8m', qty: 3500, unitPrice: 1.2 },
    ],
    expectedDelivery: '2026-03-25',
    notes: 'Cancelado por inconsistência de precificação',
  },
  {
    id: 'PO-2026-0010',
    supplierId: 'SUP-002',
    supplierName: 'MedSupply Brasil S.A.',
    requestedAt: '2026-04-07T07:45:00-03:00',
    status: 'pending-approval',
    totalValue: 3152.0,
    lineItems: [
      { itemCode: 'MAT-AG-25x7', description: 'Agulha 25x7mm descartável', qty: 8000, unitPrice: 0.18 },
      { itemCode: 'EPI-AVT-TNT', description: 'Avental TNT 40g manga longa', qty: 700, unitPrice: 2.6 },
    ],
    expectedDelivery: '2026-04-14',
  },
];
