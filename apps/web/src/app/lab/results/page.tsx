'use client';

import { ModuleListView } from '../../components/module-list-view';
import { LAB_RESULTS } from '../../../lib/fixtures/lab-results';

export default function Page() {
  return <ModuleListView moduleId="lab-results" data={LAB_RESULTS} />;
}
