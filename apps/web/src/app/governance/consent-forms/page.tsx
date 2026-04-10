'use client';

import { ModuleListView } from '../../components/module-list-view';
import { CONSENT_FORMS } from '../../../lib/fixtures/consent-forms';

export default function Page() {
  return <ModuleListView moduleId="consent-forms" data={CONSENT_FORMS} />;
}
