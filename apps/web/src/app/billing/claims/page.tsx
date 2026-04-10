'use client';

import { ModuleListView } from '../../components/module-list-view';
import { CLAIMS } from '../../../lib/fixtures/claims';

export default function Page() {
  return <ModuleListView moduleId="claims" data={CLAIMS} />;
}
