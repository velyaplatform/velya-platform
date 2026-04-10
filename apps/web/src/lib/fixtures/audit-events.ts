/**
 * Centralized fixtures for audit log entries. Mapped to FHIR R4 AuditEvent.
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate these IDs in page files.
 */

export type AuditAction =
  | 'view-record'
  | 'modify-record'
  | 'delete-record'
  | 'break-glass'
  | 'print-record'
  | 'export-data'
  | 'login'
  | 'logout'
  | 'grant-access'
  | 'revoke-access';

export type AuditOutcome = 'success' | 'failure' | 'warning';

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  patientMrn?: string;
  ip: string;
  userAgent: string;
  outcome: AuditOutcome;
  reason?: string;
}

export const AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'AUD-2026-0001',
    timestamp: '2026-04-09T06:58:12-03:00',
    actor: 'EMP-1002',
    actorRole: 'medico',
    action: 'login',
    resourceType: 'Session',
    resourceId: 'SESS-88A1',
    ip: '10.42.18.33',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/131.0',
    outcome: 'success',
  },
  {
    id: 'AUD-2026-0002',
    timestamp: '2026-04-09T07:02:41-03:00',
    actor: 'EMP-1002',
    actorRole: 'medico',
    action: 'view-record',
    resourceType: 'Patient',
    resourceId: 'PAT-001',
    patientMrn: 'MRN-001',
    ip: '10.42.18.33',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/131.0',
    outcome: 'success',
  },
  {
    id: 'AUD-2026-0003',
    timestamp: '2026-04-09T07:15:03-03:00',
    actor: 'EMP-1001',
    actorRole: 'medico',
    action: 'modify-record',
    resourceType: 'Observation',
    resourceId: 'OBS-778220',
    patientMrn: 'MRN-004',
    ip: '10.42.18.45',
    userAgent: 'Mozilla/5.0 (Macintosh) Safari/17.4',
    outcome: 'success',
    reason: 'Evolução clínica diária',
  },
  {
    id: 'AUD-2026-0004',
    timestamp: '2026-04-09T07:32:19-03:00',
    actor: 'EMP-2002',
    actorRole: 'enfermeiro',
    action: 'view-record',
    resourceType: 'MedicationRequest',
    resourceId: 'MED-55120',
    patientMrn: 'MRN-003',
    ip: '10.42.19.12',
    userAgent: 'VelyaMobile/2.3 (iOS 17.4)',
    outcome: 'success',
  },
  {
    id: 'AUD-2026-0005',
    timestamp: '2026-04-09T08:05:47-03:00',
    actor: 'EMP-9001',
    actorRole: 'medico',
    action: 'break-glass',
    resourceType: 'Patient',
    resourceId: 'PAT-019',
    patientMrn: 'MRN-019',
    ip: '10.42.20.08',
    userAgent: 'Mozilla/5.0 (X11; Linux) Firefox/125.0',
    outcome: 'warning',
    reason: 'Emergência clínica - paciente em parada cardiorrespiratória, acesso fora da lista de atendimento',
  },
  {
    id: 'AUD-2026-0006',
    timestamp: '2026-04-09T08:22:10-03:00',
    actor: 'EMP-4001',
    actorRole: 'farmaceutico',
    action: 'modify-record',
    resourceType: 'MedicationDispense',
    resourceId: 'DISP-40910',
    patientMrn: 'MRN-011',
    ip: '10.42.21.02',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Edge/131.0',
    outcome: 'success',
    reason: 'Dispensação registrada',
  },
  {
    id: 'AUD-2026-0007',
    timestamp: '2026-04-09T08:41:55-03:00',
    actor: 'EMP-6001',
    actorRole: 'planejador-alta',
    action: 'export-data',
    resourceType: 'DischargePlan',
    resourceId: 'DSP-10290',
    patientMrn: 'MRN-002',
    ip: '10.42.18.60',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/131.0',
    outcome: 'success',
    reason: 'Envio de sumário de alta ao convênio',
  },
  {
    id: 'AUD-2026-0008',
    timestamp: '2026-04-09T09:00:11-03:00',
    actor: 'EMP-2001',
    actorRole: 'enfermeiro',
    action: 'view-record',
    resourceType: 'Patient',
    resourceId: 'PAT-013',
    patientMrn: 'MRN-013',
    ip: '10.42.19.14',
    userAgent: 'VelyaMobile/2.3 (Android 14)',
    outcome: 'failure',
    reason: 'Sem permissão para ver prontuários fora da UTI',
  },
  {
    id: 'AUD-2026-0009',
    timestamp: '2026-04-09T09:15:40-03:00',
    actor: 'EMP-1003',
    actorRole: 'medico',
    action: 'print-record',
    resourceType: 'DiagnosticReport',
    resourceId: 'DR-67701',
    patientMrn: 'MRN-014',
    ip: '10.42.18.71',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/131.0',
    outcome: 'success',
    reason: 'Impressão para centro cirúrgico',
  },
  {
    id: 'AUD-2026-0010',
    timestamp: '2026-04-09T09:45:22-03:00',
    actor: 'EMP-1004',
    actorRole: 'medico',
    action: 'grant-access',
    resourceType: 'PractitionerRole',
    resourceId: 'PR-EMP-2003',
    ip: '10.42.18.76',
    userAgent: 'Mozilla/5.0 (Macintosh) Safari/17.4',
    outcome: 'success',
    reason: 'Inclusão de enfermeira no cuidado de MRN-006',
  },
  {
    id: 'AUD-2026-0011',
    timestamp: '2026-04-09T10:11:08-03:00',
    actor: 'EMP-5001',
    actorRole: 'fisioterapeuta',
    action: 'modify-record',
    resourceType: 'CarePlan',
    resourceId: 'CP-33102',
    patientMrn: 'MRN-019',
    ip: '10.42.20.20',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/131.0',
    outcome: 'success',
    reason: 'Evolução de fisioterapia respiratória',
  },
  {
    id: 'AUD-2026-0012',
    timestamp: '2026-04-09T10:33:50-03:00',
    actor: 'EMP-1002',
    actorRole: 'medico',
    action: 'delete-record',
    resourceType: 'Observation',
    resourceId: 'OBS-778999',
    patientMrn: 'MRN-001',
    ip: '10.42.18.33',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/131.0',
    outcome: 'warning',
    reason: 'Remoção de registro duplicado - revisão necessária',
  },
  {
    id: 'AUD-2026-0013',
    timestamp: '2026-04-09T11:02:17-03:00',
    actor: 'EMP-6001',
    actorRole: 'planejador-alta',
    action: 'revoke-access',
    resourceType: 'PractitionerRole',
    resourceId: 'PR-EMP-3001',
    ip: '10.42.18.60',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/131.0',
    outcome: 'success',
    reason: 'Fim de plantão - acesso removido de MRN-007',
  },
  {
    id: 'AUD-2026-0014',
    timestamp: '2026-04-09T11:28:34-03:00',
    actor: 'unknown',
    actorRole: 'unknown',
    action: 'login',
    resourceType: 'Session',
    resourceId: 'SESS-FAIL-2201',
    ip: '203.0.113.42',
    userAgent: 'curl/8.4.0',
    outcome: 'failure',
    reason: 'Credenciais inválidas - 5 tentativas consecutivas bloqueadas',
  },
  {
    id: 'AUD-2026-0015',
    timestamp: '2026-04-09T12:00:00-03:00',
    actor: 'EMP-1002',
    actorRole: 'medico',
    action: 'logout',
    resourceType: 'Session',
    resourceId: 'SESS-88A1',
    ip: '10.42.18.33',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/131.0',
    outcome: 'success',
  },
];
