'use client';

import { ModuleListView } from '../../components/module-list-view';
import { IMAGING_RESULTS } from '../../../lib/fixtures/imaging-results';

export default function Page() {
  return <ModuleListView moduleId="imaging-results" data={IMAGING_RESULTS} />;
}
