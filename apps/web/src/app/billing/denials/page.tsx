'use client';

import { ModuleListView } from '../../components/module-list-view';
import { DENIALS } from '../../../lib/fixtures/denials';

export default function Page() {
  return <ModuleListView moduleId="denials" data={DENIALS} />;
}
