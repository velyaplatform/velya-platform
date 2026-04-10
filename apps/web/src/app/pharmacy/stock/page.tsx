'use client';

import { ModuleListView } from '../../components/module-list-view';
import { PHARMACY_STOCK } from '../../../lib/fixtures/pharmacy-stock';

export default function Page() {
  return <ModuleListView moduleId="pharmacy-stock" data={PHARMACY_STOCK} />;
}
