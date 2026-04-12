'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EntityPanel } from '../entity-panel';
import { Badge } from '../../ui/badge';

interface PrescriptionData {
  id: string;
  medication: string;
  dosage: string;
  route: string;
  frequency: string;
  status: string;
  prescriber: string;
  patient: string;
  patientId: string;
  startDate: string;
  endDate?: string;
  notes?: string;
}

interface PrescriptionPanelProps {
  prescriptionId: string;
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

export function PrescriptionPanel({ prescriptionId, open, onClose }: PrescriptionPanelProps) {
  const [data, setData] = useState<PrescriptionData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !prescriptionId) return;
    setLoading(true);
    fetch(`/api/prescriptions/${prescriptionId}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, prescriptionId]);

  return (
    <EntityPanel
      open={open}
      onClose={onClose}
      title={data?.medication ?? 'Prescricao'}
      subtitle={data ? `${data.dosage} - ${data.route}` : undefined}
      href="/prescriptions"
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          Carregando...
        </div>
      ) : !data ? (
        <div className="text-sm text-neutral-500">Prescricao nao encontrada.</div>
      ) : (
        <>
          <PanelSection title="Medicamento">
            <DataRow label="Medicamento" value={data.medication} />
            <DataRow label="Dosagem" value={data.dosage} />
            <DataRow label="Via" value={data.route} />
            <DataRow label="Frequencia" value={data.frequency} />
            <DataRow label="Status" value={<Badge variant="default">{data.status}</Badge>} />
          </PanelSection>

          <PanelSection title="Prescricao">
            <DataRow label="Prescritor" value={data.prescriber} />
            <DataRow
              label="Paciente"
              value={
                <Link href={`/patients/${data.patientId}`} className="text-neutral-900 underline hover:text-neutral-700">
                  {data.patient}
                </Link>
              }
            />
            <DataRow label="Inicio" value={data.startDate} />
            {data.endDate && <DataRow label="Fim" value={data.endDate} />}
          </PanelSection>

          {data.notes && (
            <PanelSection title="Observacoes">
              <p className="text-sm text-neutral-700">{data.notes}</p>
            </PanelSection>
          )}

          <PanelSection title="Acesso rapido">
            <div className="flex flex-wrap gap-2">
              <Link href="/prescriptions" className="text-xs font-medium text-neutral-700 underline hover:text-neutral-900">
                Todas prescricoes
              </Link>
              <Link href="/pharmacy" className="text-xs font-medium text-neutral-700 underline hover:text-neutral-900">
                Farmacia
              </Link>
              <Link href="/pharmacy/stock" className="text-xs font-medium text-neutral-700 underline hover:text-neutral-900">
                Estoque
              </Link>
            </div>
          </PanelSection>
        </>
      )}
    </EntityPanel>
  );
}
