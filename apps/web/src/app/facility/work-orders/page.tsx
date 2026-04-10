'use client';

import { ModuleListView } from '../../components/module-list-view';
import { WORK_ORDERS } from '../../../lib/fixtures/work-orders';

export default function Page() {
  return <ModuleListView moduleId="work-orders" data={WORK_ORDERS} />;
}
