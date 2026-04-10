'use client';

import { ModuleListView } from '../../components/module-list-view';
import { INCIDENTS } from '../../../lib/fixtures/incidents';

export default function Page() {
  return <ModuleListView moduleId="incidents" data={INCIDENTS} />;
}
