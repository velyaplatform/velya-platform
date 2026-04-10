'use client';

import { ModuleListView } from '../../components/module-list-view';
import { TRANSPORT_ORDERS } from '../../../lib/fixtures/transport-orders';

export default function Page() {
  return <ModuleListView moduleId="transport-orders" data={TRANSPORT_ORDERS} />;
}
