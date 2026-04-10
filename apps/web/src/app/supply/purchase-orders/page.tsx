'use client';

import { ModuleListView } from '../../components/module-list-view';
import { PURCHASE_ORDERS } from '../../../lib/fixtures/purchase-orders';

export default function Page() {
  return <ModuleListView moduleId="purchase-orders" data={PURCHASE_ORDERS} />;
}
