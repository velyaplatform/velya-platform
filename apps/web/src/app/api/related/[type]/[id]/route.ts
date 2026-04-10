import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import { listLiveRecords } from '@/lib/entity-resolver';
import { getModuleById } from '@/lib/module-manifest';

interface RouteContext {
  params: Promise<{ type: string; id: string }>;
}

interface RelatedGroup {
  /** module id (e.g. 'lab-orders') */
  module: string;
  /** module display title */
  label: string;
  /** route to the list (with optional ?filter=...) */
  href: string;
  /** number of records found in this relationship */
  count: number;
  /** sample of the first 5 records (id + display label) */
  sample: { id: string; label: string; href: string }[];
}

interface RelatedResponse {
  type: string;
  id: string;
  groups: RelatedGroup[];
}

/**
 * GET /api/related/[type]/[id]
 *
 * Returns a graph of records connected to the given entity. The "type" is
 * the entity kind (e.g. "patient", "employee", "asset", "supplier") and
 * the resolver decides which modules to scan and which fields are foreign
 * keys.
 *
 * Examples:
 *   /api/related/patient/MRN-EXAMPLE →
 *     - prescriptions where patientMrn = MRN-EXAMPLE
 *     - lab-orders where patientMrn = MRN-EXAMPLE
 *     - imaging-orders where patientMrn = MRN-EXAMPLE
 *     - charges where patientMrn = MRN-EXAMPLE
 *     - audit-events where patientMrn = MRN-EXAMPLE
 *
 *   /api/related/employee/EMP-1001 →
 *     - credentials where employeeId = EMP-1001
 *
 *   /api/related/asset/AST-001 →
 *     - work-orders where assetId = AST-001
 */

const RELATED_BY_TYPE: Record<string, { module: string; foreignKey: string; labelField?: string }[]> = {
  patient: [
    { module: 'prescriptions', foreignKey: 'patientMrn', labelField: 'medication' },
    { module: 'lab-orders', foreignKey: 'patientMrn', labelField: 'testName' },
    { module: 'lab-results', foreignKey: 'patientMrn', labelField: 'testName' },
    { module: 'imaging-orders', foreignKey: 'patientMrn', labelField: 'description' },
    { module: 'imaging-results', foreignKey: 'patientMrn', labelField: 'impression' },
    { module: 'meal-orders', foreignKey: 'patientMrn', labelField: 'diet' },
    { module: 'transport-orders', foreignKey: 'patientMrn', labelField: 'destination' },
    { module: 'charges', foreignKey: 'patientMrn', labelField: 'description' },
    { module: 'claims', foreignKey: 'patientMrn', labelField: 'payerName' },
    { module: 'incidents', foreignKey: 'patientMrn', labelField: 'description' },
    { module: 'audit-events', foreignKey: 'patientMrn', labelField: 'action' },
    { module: 'consent-forms', foreignKey: 'patientMrn', labelField: 'type' },
  ],
  employee: [
    { module: 'credentials', foreignKey: 'employeeId', labelField: 'number' },
  ],
  asset: [
    { module: 'work-orders', foreignKey: 'assetId', labelField: 'description' },
  ],
  supplier: [
    { module: 'purchase-orders', foreignKey: 'supplierId', labelField: 'totalValue' },
  ],
  claim: [
    { module: 'denials', foreignKey: 'claimId', labelField: 'reason' },
  ],
  'lab-order': [
    { module: 'lab-results', foreignKey: 'orderId', labelField: 'testName' },
  ],
  'imaging-order': [
    { module: 'imaging-results', foreignKey: 'orderId', labelField: 'impression' },
  ],
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const { type, id } = await context.params;
  const relationDefs = RELATED_BY_TYPE[type];
  if (!relationDefs) {
    return NextResponse.json({ type, id, groups: [] } satisfies RelatedResponse);
  }

  const groups: RelatedGroup[] = [];
  for (const def of relationDefs) {
    const module = getModuleById(def.module);
    if (!module) continue;
    const records = listLiveRecords(def.module);
    const matches = records.filter((r) => String(r.data[def.foreignKey] ?? '') === id);
    if (matches.length === 0) continue;
    groups.push({
      module: def.module,
      label: module.title,
      href: `${module.route}?${def.foreignKey}=${encodeURIComponent(id)}`,
      count: matches.length,
      sample: matches.slice(0, 5).map((m) => ({
        id: m.id,
        label:
          (def.labelField && String(m.data[def.labelField] ?? '')) ||
          String(m.data.id ?? m.id),
        href: `/edit/${def.module}/${encodeURIComponent(m.id)}`,
      })),
    });
  }

  return NextResponse.json({ type, id, groups } satisfies RelatedResponse);
}
