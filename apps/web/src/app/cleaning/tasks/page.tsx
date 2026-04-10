'use client';

import { ModuleListView } from '../../components/module-list-view';
import { CLEANING_TASKS } from '../../../lib/fixtures/cleaning-tasks';

export default function Page() {
  return <ModuleListView moduleId="cleaning-tasks" data={CLEANING_TASKS} />;
}
