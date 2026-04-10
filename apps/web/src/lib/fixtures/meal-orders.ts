/**
 * Centralized fixtures for patient meal orders. Mapped to FHIR R4 NutritionOrder.
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate these IDs in page files.
 */

export type MealDiet =
  | 'geral'
  | 'diabetica'
  | 'hipossodica'
  | 'liquida'
  | 'pastosa'
  | 'branda'
  | 'zero'
  | 'enteral'
  | 'parenteral';

export type MealType =
  | 'desjejum'
  | 'colacao'
  | 'almoco'
  | 'lanche'
  | 'jantar'
  | 'ceia';

export type MealOrderStatus =
  | 'ordered'
  | 'in-preparation'
  | 'delivered'
  | 'refused'
  | 'cancelled';

export interface MealOrder {
  id: string;
  patientMrn: string;
  diet: MealDiet;
  consistency?: string;
  allergens: string[];
  mealType: MealType;
  scheduledAt: string;
  status: MealOrderStatus;
  observations?: string;
}

export const MEAL_ORDERS: MealOrder[] = [
  {
    id: 'NUT-2026-0001',
    patientMrn: 'MRN-001',
    diet: 'geral',
    allergens: [],
    mealType: 'desjejum',
    scheduledAt: '2026-04-10T07:00:00-03:00',
    status: 'delivered',
  },
  {
    id: 'NUT-2026-0002',
    patientMrn: 'MRN-002',
    diet: 'diabetica',
    allergens: ['lactose'],
    mealType: 'almoco',
    scheduledAt: '2026-04-10T12:00:00-03:00',
    status: 'in-preparation',
    observations: 'Substituir leite por bebida vegetal sem açúcar',
  },
  {
    id: 'NUT-2026-0003',
    patientMrn: 'MRN-003',
    diet: 'zero',
    allergens: [],
    mealType: 'desjejum',
    scheduledAt: '2026-04-10T07:00:00-03:00',
    status: 'cancelled',
    observations: 'Jejum pré-operatório cirurgia cardiovascular',
  },
  {
    id: 'NUT-2026-0004',
    patientMrn: 'MRN-004',
    diet: 'hipossodica',
    allergens: ['amendoim'],
    mealType: 'almoco',
    scheduledAt: '2026-04-10T12:00:00-03:00',
    status: 'ordered',
    observations: 'Máximo 2g sódio/dia - HAS descompensada',
  },
  {
    id: 'NUT-2026-0005',
    patientMrn: 'MRN-006',
    diet: 'liquida',
    consistency: 'líquida restrita',
    allergens: [],
    mealType: 'lanche',
    scheduledAt: '2026-04-10T15:00:00-03:00',
    status: 'delivered',
    observations: 'Pós-operatório imediato - progressão gradual',
  },
  {
    id: 'NUT-2026-0006',
    patientMrn: 'MRN-007',
    diet: 'pastosa',
    consistency: 'pastosa homogênea',
    allergens: ['glúten'],
    mealType: 'jantar',
    scheduledAt: '2026-04-10T18:30:00-03:00',
    status: 'ordered',
    observations: 'Disfagia leve pós-AVC - acompanhar fonoaudiologia',
  },
  {
    id: 'NUT-2026-0007',
    patientMrn: 'MRN-009',
    diet: 'branda',
    allergens: [],
    mealType: 'almoco',
    scheduledAt: '2026-04-10T12:00:00-03:00',
    status: 'in-preparation',
  },
  {
    id: 'NUT-2026-0008',
    patientMrn: 'MRN-010',
    diet: 'enteral',
    allergens: ['lactose'],
    mealType: 'desjejum',
    scheduledAt: '2026-04-10T06:30:00-03:00',
    status: 'delivered',
    observations: 'Dieta enteral hipercalórica 1,5 kcal/mL - SNG',
  },
  {
    id: 'NUT-2026-0009',
    patientMrn: 'MRN-011',
    diet: 'geral',
    allergens: ['frutos-do-mar'],
    mealType: 'colacao',
    scheduledAt: '2026-04-10T09:30:00-03:00',
    status: 'refused',
    observations: 'Paciente recusou lanche da manhã',
  },
  {
    id: 'NUT-2026-0010',
    patientMrn: 'MRN-013',
    diet: 'parenteral',
    allergens: [],
    mealType: 'almoco',
    scheduledAt: '2026-04-10T12:00:00-03:00',
    status: 'in-preparation',
    observations: 'NPT central - bolsa personalizada EMTN',
  },
  {
    id: 'NUT-2026-0011',
    patientMrn: 'MRN-014',
    diet: 'diabetica',
    allergens: [],
    mealType: 'ceia',
    scheduledAt: '2026-04-10T21:00:00-03:00',
    status: 'ordered',
    observations: 'Incluir 1 fruta pequena para evitar hipoglicemia noturna',
  },
  {
    id: 'NUT-2026-0012',
    patientMrn: 'MRN-015',
    diet: 'hipossodica',
    allergens: ['ovo'],
    mealType: 'jantar',
    scheduledAt: '2026-04-10T18:30:00-03:00',
    status: 'ordered',
  },
];
