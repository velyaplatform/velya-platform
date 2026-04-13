import { redirect } from 'next/navigation';

interface PatientsLegacyAliasPageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function PatientsLegacyAliasPage({
  params,
}: PatientsLegacyAliasPageProps) {
  const resolvedParams = await params;
  redirect(`/pacientes/${encodeURIComponent(resolvedParams.id)}`);
}
