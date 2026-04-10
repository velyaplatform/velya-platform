'use client';

import { ModuleListView } from '../../components/module-list-view';
import { WASTE_MANIFESTS } from '../../../lib/fixtures/waste-manifests';

export default function Page() {
  return <ModuleListView moduleId="waste-manifests" data={WASTE_MANIFESTS} />;
}
