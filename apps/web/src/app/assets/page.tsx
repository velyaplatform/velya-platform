'use client';

import { ModuleListView } from '../components/module-list-view';
import { ASSETS } from '../../lib/fixtures/assets';

export default function Page() {
  return <ModuleListView moduleId="assets" data={ASSETS} />;
}
