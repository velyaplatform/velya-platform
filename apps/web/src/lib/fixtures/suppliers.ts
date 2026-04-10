/**
 * Centralized supplier & third-party fixtures.
 *
 * Real production system would integrate with:
 *   - ERP / supplier master data
 *   - Procurement / contract management
 *   - SLA monitoring (delivery, response time)
 *
 * Categories follow Brazilian hospital procurement taxonomy:
 *   - medicamentos / insumos médicos / equipamentos / serviços / outros
 */

export type SupplierCategory =
  | 'medicamentos'
  | 'insumos-medicos'
  | 'equipamentos'
  | 'servicos'
  | 'outros';

export type SupplierStatus = 'ativo' | 'em-revisao' | 'suspenso' | 'descredenciado';

export interface SupplierRecord {
  id: string;
  name: string;
  cnpj: string;
  category: SupplierCategory;
  status: SupplierStatus;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contractStart: string;
  contractEnd: string;
  slaResponseHours: number;
  rating: number; // 0-5
  lastDelivery?: string;
  notes?: string;
}

export const SUPPLIERS: SupplierRecord[] = [
  {
    id: 'SUP-001',
    name: 'FarmaPlus Distribuidora Ltda.',
    cnpj: '12.345.678/0001-90',
    category: 'medicamentos',
    status: 'ativo',
    contactName: 'Marcos Vieira',
    contactEmail: 'marcos@farmaplus.com.br',
    contactPhone: '(11) 4422-1010',
    contractStart: '2025-01-01',
    contractEnd: '2026-12-31',
    slaResponseHours: 4,
    rating: 4.6,
    lastDelivery: '2026-04-09',
  },
  {
    id: 'SUP-002',
    name: 'MedSupply Brasil S.A.',
    cnpj: '23.456.789/0001-12',
    category: 'insumos-medicos',
    status: 'ativo',
    contactName: 'Tatiana Lopes',
    contactEmail: 'tatiana.lopes@medsupply.com.br',
    contactPhone: '(11) 5544-2200',
    contractStart: '2024-06-01',
    contractEnd: '2026-05-31',
    slaResponseHours: 8,
    rating: 4.2,
    lastDelivery: '2026-04-08',
  },
  {
    id: 'SUP-003',
    name: 'TecnoMed Equipamentos',
    cnpj: '34.567.890/0001-34',
    category: 'equipamentos',
    status: 'em-revisao',
    contactName: 'Roberto Faria',
    contactEmail: 'rfaria@tecnomed.com.br',
    contactPhone: '(11) 3322-7788',
    contractStart: '2023-09-01',
    contractEnd: '2026-08-31',
    slaResponseHours: 24,
    rating: 3.8,
    notes: 'Atrasos recentes em manutenção preventiva',
  },
  {
    id: 'SUP-004',
    name: 'Higi-Limpa Serviços Hospitalares',
    cnpj: '45.678.901/0001-56',
    category: 'servicos',
    status: 'ativo',
    contactName: 'Vanessa Carneiro',
    contactEmail: 'contato@higilimpa.com.br',
    contactPhone: '(11) 2233-4455',
    contractStart: '2025-03-01',
    contractEnd: '2027-02-28',
    slaResponseHours: 2,
    rating: 4.4,
  },
  {
    id: 'SUP-005',
    name: 'TransFarma Logística',
    cnpj: '56.789.012/0001-78',
    category: 'servicos',
    status: 'ativo',
    contactName: 'Eduardo Pires',
    contactEmail: 'eduardo@transfarma.com',
    contactPhone: '(11) 9988-7766',
    contractStart: '2025-01-15',
    contractEnd: '2026-01-14',
    slaResponseHours: 6,
    rating: 4.0,
    lastDelivery: '2026-04-09',
  },
];

export const CATEGORY_LABELS: Record<SupplierCategory, string> = {
  medicamentos: 'Medicamentos',
  'insumos-medicos': 'Insumos Médicos',
  equipamentos: 'Equipamentos',
  servicos: 'Serviços',
  outros: 'Outros',
};

export const STATUS_LABELS: Record<SupplierStatus, string> = {
  ativo: 'Ativo',
  'em-revisao': 'Em Revisão',
  suspenso: 'Suspenso',
  descredenciado: 'Descredenciado',
};

export function getSupplierById(id: string): SupplierRecord | undefined {
  return SUPPLIERS.find((s) => s.id === id);
}
