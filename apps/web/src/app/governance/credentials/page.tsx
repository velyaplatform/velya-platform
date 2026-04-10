'use client';

import { ModuleListView } from '../../components/module-list-view';
import { CREDENTIALS } from '../../../lib/fixtures/credentials';

export default function Page() {
  return <ModuleListView moduleId="credentials" data={CREDENTIALS} />;
}
