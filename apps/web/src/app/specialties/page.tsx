'use client';

import { ModuleListView } from '../components/module-list-view';
import { MEDICAL_SPECIALTIES } from '../../lib/fixtures/medical-specialties';

export default function Page() {
  return <ModuleListView moduleId="medical-specialties" data={MEDICAL_SPECIALTIES} />;
}
