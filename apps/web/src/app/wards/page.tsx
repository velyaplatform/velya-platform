'use client';

import { ModuleListView } from '../components/module-list-view';
import { HOSPITAL_WARDS } from '../../lib/fixtures/hospital-wards';

export default function Page() {
  return <ModuleListView moduleId="hospital-wards" data={HOSPITAL_WARDS} />;
}
