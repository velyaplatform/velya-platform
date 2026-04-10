'use client';

import { ModuleListView } from '../../components/module-list-view';
import { IMAGING_ORDERS } from '../../../lib/fixtures/imaging-orders';

export default function Page() {
  return <ModuleListView moduleId="imaging-orders" data={IMAGING_ORDERS} />;
}
