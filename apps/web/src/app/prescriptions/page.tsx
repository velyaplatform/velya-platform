'use client';

import { ModuleListView } from '../components/module-list-view';
import { PRESCRIPTIONS } from '../../lib/fixtures/prescriptions';

export default function PrescriptionsPage() {
  return <ModuleListView moduleId="prescriptions" data={PRESCRIPTIONS} />;
}
