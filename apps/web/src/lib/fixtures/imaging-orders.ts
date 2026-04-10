/**
 * Centralized fixtures for imaging orders. Mapped to FHIR R4 ServiceRequest (category=imaging) + ImagingStudy.
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate these IDs in page files.
 */

export interface ImagingOrder {
  id: string;
  patientMrn: string;
  modality: 'RX' | 'CT' | 'MR' | 'US' | 'NM' | 'ECG' | 'ECHO';
  region: string;
  description: string;
  requesterId: string;
  requesterName: string;
  requestedAt: string;
  priority: 'routine' | 'urgent' | 'stat';
  status: 'requested' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  clinicalIndication: string;
  contrast: boolean;
  renalFunctionChecked: boolean;
}

export const IMAGING_ORDERS: ImagingOrder[] = [
  {
    id: 'IMG-0001',
    patientMrn: 'MRN-001',
    modality: 'RX',
    region: 'Tórax',
    description: 'Radiografia de tórax PA e perfil',
    requesterId: 'CRM-SP-112233',
    requesterName: 'Dr. Carlos Lima',
    requestedAt: '2026-04-04T09:45:00',
    priority: 'routine',
    status: 'completed',
    clinicalIndication: 'Suspeita de pneumonia',
    contrast: false,
    renalFunctionChecked: false,
  },
  {
    id: 'IMG-0002',
    patientMrn: 'MRN-004',
    modality: 'CT',
    region: 'Crânio',
    description: 'TC de crânio sem contraste',
    requesterId: 'CRM-SP-445566',
    requesterName: 'Dra. Helena Rocha',
    requestedAt: '2026-04-01T16:20:00',
    priority: 'stat',
    status: 'completed',
    clinicalIndication: 'Controle pós-trombólise',
    contrast: false,
    renalFunctionChecked: true,
  },
  {
    id: 'IMG-0003',
    patientMrn: 'MRN-006',
    modality: 'CT',
    region: 'Abdome e pelve',
    description: 'TC de abdome com contraste IV',
    requesterId: 'CRM-SP-778899',
    requesterName: 'Dr. Marcio Tavares',
    requestedAt: '2026-04-08T13:30:00',
    priority: 'urgent',
    status: 'completed',
    clinicalIndication: 'Pancreatite aguda — estadiamento',
    contrast: true,
    renalFunctionChecked: true,
  },
  {
    id: 'IMG-0004',
    patientMrn: 'MRN-010',
    modality: 'ECHO',
    region: 'Coração',
    description: 'Ecocardiograma transtorácico',
    requesterId: 'CRM-SP-334455',
    requesterName: 'Dr. Henrique Monte',
    requestedAt: '2026-04-05T10:15:00',
    priority: 'urgent',
    status: 'completed',
    clinicalIndication: 'Avaliação de FEVE pós-IAM',
    contrast: false,
    renalFunctionChecked: false,
  },
  {
    id: 'IMG-0005',
    patientMrn: 'MRN-007',
    modality: 'RX',
    region: 'Tórax',
    description: 'Radiografia de tórax no leito',
    requesterId: 'CRM-SP-445566',
    requesterName: 'Dra. Helena Rocha',
    requestedAt: '2026-04-09T07:00:00',
    priority: 'routine',
    status: 'scheduled',
    clinicalIndication: 'Reavaliação congestão pulmonar',
    contrast: false,
    renalFunctionChecked: false,
  },
  {
    id: 'IMG-0006',
    patientMrn: 'MRN-015',
    modality: 'US',
    region: 'Rins e vias urinárias',
    description: 'Ultrassonografia de rins e vias urinárias',
    requesterId: 'CRM-SP-112233',
    requesterName: 'Dr. Carlos Lima',
    requestedAt: '2026-04-08T14:40:00',
    priority: 'routine',
    status: 'in-progress',
    clinicalIndication: 'ITU complicada — descartar obstrução',
    contrast: false,
    renalFunctionChecked: false,
  },
  {
    id: 'IMG-0007',
    patientMrn: 'MRN-003',
    modality: 'CT',
    region: 'Tórax',
    description: 'TC de tórax de alta resolução',
    requesterId: 'CRM-SP-112233',
    requesterName: 'Dr. Carlos Lima',
    requestedAt: '2026-04-06T11:10:00',
    priority: 'urgent',
    status: 'completed',
    clinicalIndication: 'DPOC exacerbada — avaliação estrutural',
    contrast: false,
    renalFunctionChecked: true,
  },
  {
    id: 'IMG-0008',
    patientMrn: 'MRN-010',
    modality: 'ECG',
    region: 'Coração',
    description: 'Eletrocardiograma 12 derivações',
    requesterId: 'CRM-SP-334455',
    requesterName: 'Dr. Henrique Monte',
    requestedAt: '2026-04-05T07:30:00',
    priority: 'stat',
    status: 'completed',
    clinicalIndication: 'Controle pós-IAM',
    contrast: false,
    renalFunctionChecked: false,
  },
  {
    id: 'IMG-0009',
    patientMrn: 'MRN-019',
    modality: 'US',
    region: 'Abdome',
    description: 'US de abdome à beira leito (POCUS)',
    requesterId: 'CRM-SP-778899',
    requesterName: 'Dr. Marcio Tavares',
    requestedAt: '2026-04-09T04:00:00',
    priority: 'stat',
    status: 'completed',
    clinicalIndication: 'Suspeita de coleção pós-op',
    contrast: false,
    renalFunctionChecked: false,
  },
  {
    id: 'IMG-0010',
    patientMrn: 'MRN-013',
    modality: 'MR',
    region: 'Pelve',
    description: 'RM de pelve sem contraste',
    requesterId: 'CRM-SP-445566',
    requesterName: 'Dra. Helena Rocha',
    requestedAt: '2026-04-04T09:00:00',
    priority: 'routine',
    status: 'requested',
    clinicalIndication: 'Avaliação de abscesso pélvico',
    contrast: false,
    renalFunctionChecked: true,
  },
];
