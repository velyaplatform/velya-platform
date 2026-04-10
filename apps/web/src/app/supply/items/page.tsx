'use client';

import { ModuleListView } from '../../components/module-list-view';
import { SUPPLY_ITEMS } from '../../../lib/fixtures/supply-items';

export default function Page() {
  return <ModuleListView moduleId="supply-items" data={SUPPLY_ITEMS} />;
}
