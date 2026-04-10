/**
 * Centralized fixtures for professional credentials. Mapped to FHIR R4 PractitionerRole + qualifications.
 * Source of truth enforced by scripts/check-ui-duplications.ts.
 * Do not duplicate these IDs in page files.
 */

export type CredentialType =
  | 'crm'
  | 'coren'
  | 'crf'
  | 'crefito'
  | 'crp'
  | 'crn'
  | 'cro';

export type CredentialStatus = 'active' | 'expired' | 'suspended' | 'under-review';

export interface Credential {
  id: string;
  employeeId: string;
  type: CredentialType;
  number: string;
  state: string;
  issuedAt: string;
  expiresAt: string;
  status: CredentialStatus;
  verifiedAt?: string;
  verifiedBy?: string;
}

export const CREDENTIALS: Credential[] = [
  {
    id: 'CRED-0001',
    employeeId: 'EMP-1001',
    type: 'crm',
    number: '145332',
    state: 'SP',
    issuedAt: '2011-03-15T00:00:00-03:00',
    expiresAt: '2027-03-15T00:00:00-03:00',
    status: 'active',
    verifiedAt: '2026-01-10T10:00:00-03:00',
    verifiedBy: 'EMP-6001',
  },
  {
    id: 'CRED-0002',
    employeeId: 'EMP-1002',
    type: 'crm',
    number: '122887',
    state: 'SP',
    issuedAt: '2008-06-20T00:00:00-03:00',
    expiresAt: '2026-06-20T00:00:00-03:00',
    status: 'active',
    verifiedAt: '2026-01-10T10:05:00-03:00',
    verifiedBy: 'EMP-6001',
  },
  {
    id: 'CRED-0003',
    employeeId: 'EMP-1003',
    type: 'crm',
    number: '188901',
    state: 'SP',
    issuedAt: '2014-09-01T00:00:00-03:00',
    expiresAt: '2026-05-01T00:00:00-03:00',
    status: 'under-review',
    verifiedAt: '2026-03-20T14:30:00-03:00',
    verifiedBy: 'EMP-6001',
  },
  {
    id: 'CRED-0004',
    employeeId: 'EMP-1004',
    type: 'crm',
    number: '165770',
    state: 'SP',
    issuedAt: '2012-11-10T00:00:00-03:00',
    expiresAt: '2027-11-10T00:00:00-03:00',
    status: 'active',
    verifiedAt: '2026-01-12T09:20:00-03:00',
    verifiedBy: 'EMP-6001',
  },
  {
    id: 'CRED-0005',
    employeeId: 'EMP-2001',
    type: 'coren',
    number: '412009',
    state: 'SP',
    issuedAt: '2013-02-18T00:00:00-03:00',
    expiresAt: '2028-02-18T00:00:00-03:00',
    status: 'active',
    verifiedAt: '2026-01-14T11:00:00-03:00',
    verifiedBy: 'EMP-6001',
  },
  {
    id: 'CRED-0006',
    employeeId: 'EMP-2002',
    type: 'coren',
    number: '410220',
    state: 'SP',
    issuedAt: '2010-08-05T00:00:00-03:00',
    expiresAt: '2025-08-05T00:00:00-03:00',
    status: 'expired',
    verifiedAt: '2025-12-01T10:00:00-03:00',
    verifiedBy: 'EMP-6001',
  },
  {
    id: 'CRED-0007',
    employeeId: 'EMP-2003',
    type: 'coren',
    number: '410877',
    state: 'SP',
    issuedAt: '2012-05-22T00:00:00-03:00',
    expiresAt: '2027-05-22T00:00:00-03:00',
    status: 'active',
    verifiedAt: '2026-01-15T08:45:00-03:00',
    verifiedBy: 'EMP-6001',
  },
  {
    id: 'CRED-0008',
    employeeId: 'EMP-3001',
    type: 'coren',
    number: '290144',
    state: 'SP',
    issuedAt: '2015-04-10T00:00:00-03:00',
    expiresAt: '2027-04-10T00:00:00-03:00',
    status: 'active',
    verifiedAt: '2026-02-01T13:15:00-03:00',
    verifiedBy: 'EMP-6001',
  },
  {
    id: 'CRED-0009',
    employeeId: 'EMP-4001',
    type: 'crf',
    number: '67099',
    state: 'SP',
    issuedAt: '2014-07-25T00:00:00-03:00',
    expiresAt: '2027-07-25T00:00:00-03:00',
    status: 'active',
    verifiedAt: '2026-01-20T09:00:00-03:00',
    verifiedBy: 'EMP-6001',
  },
  {
    id: 'CRED-0010',
    employeeId: 'EMP-5001',
    type: 'crefito',
    number: '99211-F',
    state: 'SP',
    issuedAt: '2013-10-02T00:00:00-03:00',
    expiresAt: '2026-10-02T00:00:00-03:00',
    status: 'active',
    verifiedAt: '2026-01-22T16:30:00-03:00',
    verifiedBy: 'EMP-6001',
  },
  {
    id: 'CRED-0011',
    employeeId: 'EMP-9001',
    type: 'crm',
    number: '198440',
    state: 'SP',
    issuedAt: '2015-01-28T00:00:00-03:00',
    expiresAt: '2028-01-28T00:00:00-03:00',
    status: 'active',
    verifiedAt: '2026-02-05T10:40:00-03:00',
    verifiedBy: 'EMP-6001',
  },
  {
    id: 'CRED-0012',
    employeeId: 'EMP-1003',
    type: 'crm',
    number: '188901-RJ',
    state: 'RJ',
    issuedAt: '2019-03-11T00:00:00-03:00',
    expiresAt: '2026-03-11T00:00:00-03:00',
    status: 'suspended',
    verifiedAt: '2026-03-22T15:00:00-03:00',
    verifiedBy: 'EMP-6001',
  },
];
