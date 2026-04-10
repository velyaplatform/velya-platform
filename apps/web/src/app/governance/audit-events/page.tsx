'use client';

import { ModuleListView } from '../../components/module-list-view';
import { AUDIT_EVENTS } from '../../../lib/fixtures/audit-events';

export default function Page() {
  return <ModuleListView moduleId="audit-events" data={AUDIT_EVENTS} />;
}
