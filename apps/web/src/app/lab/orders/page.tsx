'use client';

import { ModuleListView } from '../../components/module-list-view';
import { LAB_ORDERS } from '../../../lib/fixtures/lab-orders';

export default function Page() {
  return <ModuleListView moduleId="lab-orders" data={LAB_ORDERS} />;
}
