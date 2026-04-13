import { redirect } from 'next/navigation';

export default function NewPatientLegacyRedirect() {
  redirect('/pacientes');
}
