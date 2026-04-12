'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EntityPanel } from '../entity-panel';
import { Badge } from '../../ui/badge';

interface PatientData {
  id: string;
  name: string;
  mrn: string;
  birthDate: string;
  gender: string;
  ward: string;
  bed: string;
  admissionDate: string;
  attendingPhysician: string;
  allergies: string[];
  alerts: string[];
  los: number;
}

interface PatientPanelProps {
  patientId: string;
  open: boolean;
  onClose: () => void;
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5 border-b border-neutral-100 last:border-0">
      <span className="text-xs text-neutral-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-neutral-900 text-right">{value}</span>
    </div>
  );
}

export function PatientPanel({ patientId, open, onClose }: PatientPanelProps) {
  const [data, setData] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !patientId) return;
    setLoading(true);
    fetch(`/api/patients/${patientId}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, patientId]);

  return (
    <EntityPanel
      open={open}
      onClose={onClose}
      title={data?.name ?? 'Paciente'}
      subtitle={data?.mrn ? `MRN ${data.mrn}` : undefined}
      href={`/patients/${patientId}`}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          Carregando...
        </div>
      ) : !data ? (
        <div className="text-sm text-neutral-500">Paciente nao encontrado.</div>
      ) : (
        <>
          <PanelSection title="Dados do paciente">
            <DataRow label="Nome" value={data.name} />
            <DataRow label="MRN" value={<span className="font-mono">{data.mrn}</span>} />
            <DataRow label="Nascimento" value={data.birthDate} />
            <DataRow label="Genero" value={data.gender} />
          </PanelSection>

          <PanelSection title="Internacao">
            <DataRow label="Ala" value={data.ward} />
            <DataRow label="Leito" value={data.bed} />
            <DataRow label="Admissao" value={data.admissionDate} />
            <DataRow label="Tempo internacao" value={`${data.los} dias`} />
            <DataRow label="Medico responsavel" value={data.attendingPhysician} />
          </PanelSection>

          {data.allergies.length > 0 && (
            <PanelSection title="Alergias">
              <div className="flex flex-wrap gap-1">
                {data.allergies.map((a) => (
                  <Badge key={a} variant="default">{a}</Badge>
                ))}
              </div>
            </PanelSection>
          )}

          {data.alerts.length > 0 && (
            <PanelSection title="Alertas ativos">
              <div className="flex flex-col gap-1">
                {data.alerts.map((a) => (
                  <div key={a} className="rounded border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-800">
                    {a}
                  </div>
                ))}
              </div>
            </PanelSection>
          )}

          <PanelSection title="Acesso rapido">
            <div className="flex flex-wrap gap-2">
              <Link href={`/patients/${patientId}`} className="text-xs font-medium text-neutral-700 underline hover:text-neutral-900">
                Prontuario completo
              </Link>
              <Link href="/prescriptions" className="text-xs font-medium text-neutral-700 underline hover:text-neutral-900">
                Prescricoes
              </Link>
              <Link href="/lab/results" className="text-xs font-medium text-neutral-700 underline hover:text-neutral-900">
                Resultados lab
              </Link>
              <Link href="/tasks" className="text-xs font-medium text-neutral-700 underline hover:text-neutral-900">
                Tarefas
              </Link>
            </div>
          </PanelSection>
        </>
      )}
    </EntityPanel>
  );
}
