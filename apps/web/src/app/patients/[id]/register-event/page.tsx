import { redirect } from 'next/navigation';

interface PatientEventLegacyRedirectPageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function PatientEventLegacyRedirectPage({
  params,
}: PatientEventLegacyRedirectPageProps) {
  const resolvedParams = await params;
  redirect(`/pacientes/${encodeURIComponent(resolvedParams.id)}`);
}
