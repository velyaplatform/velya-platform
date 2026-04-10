'use client';

import { ModuleListView } from '../../components/module-list-view';
import { MEAL_ORDERS } from '../../../lib/fixtures/meal-orders';

export default function Page() {
  return <ModuleListView moduleId="meal-orders" data={MEAL_ORDERS} />;
}
