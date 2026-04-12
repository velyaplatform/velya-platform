'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EntityPanel } from '../entity-panel';
import { Badge } from '../../ui/badge';

interface BedData {
  id: string;
  number: string;
  ward: string;
  floor: string;
  status: string;
  patient?: string;
  patientId?: string;
  isolation: boolean;
  lastCleaned?: string;
  equipment: string[];
}

interface BedPanelProps {
  bedId: string;
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

export function BedPanel({ bedId, open, onClose }: BedPanelProps) {
  const [data, setData] = useState<BedData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !bedId) return;
    setLoading(true);
    fetch(`/api/beds/${bedId}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, bedId]);

  return (
    <EntityPanel
      open={open}
      onClose={onClose}
      title={data ? `Leito ${data.number}` : 'Leito'}
      subtitle={data?.ward}
      href={`/beds`}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          Carregando...
        </div>
      ) : !data ? (
        <div className="text-sm text-neutral-500">Leito nao encontrado.</div>
      ) : (
        <>
          <PanelSection title="Informacoes do leito">
            <DataRow label="Numero" value={data.number} />
            <DataRow label="Ala" value={data.ward} />
            <DataRow label="Andar" value={data.floor} />
            <DataRow label="Status" value={<Badge variant="default">{data.status}</Badge>} />
            <DataRow label="Isolamento" value={data.isolation ? 'Sim' : 'Nao'} />
          </PanelSection>

          {data.patient && (
            <PanelSection title="Paciente atual">
              <DataRow
                label="Paciente"
                value={
                  data.patientId ? (
                    <Link href={`/patients/${data.patientId}`} className="text-neutral-900 underline hover:text-neutral-700">
                      {data.patient}
                    </Link>
                  ) : data.patient
                }
              />
            </PanelSection>
          )}

          {data.lastCleaned && (
            <PanelSection title="Higienizacao">
              <DataRow label="Ultima limpeza" value={data.lastCleaned} />
            </PanelSection>
          )}

          {data.equipment.length > 0 && (
            <PanelSection title="Equipamentos">
              <div className="flex flex-wrap gap-1">
                {data.equipment.map((e) => (
                  <Badge key={e} variant="default">{e}</Badge>
                ))}
              </div>
            </PanelSection>
          )}

          <PanelSection title="Acesso rapido">
            <div className="flex flex-wrap gap-2">
              <Link href="/beds" className="text-xs font-medium text-neutral-700 underline hover:text-neutral-900">
                Mapa de leitos
              </Link>
              <Link href="/cleaning/tasks" className="text-xs font-medium text-neutral-700 underline hover:text-neutral-900">
                Higienizacao
              </Link>
            </div>
          </PanelSection>
        </>
      )}
    </EntityPanel>
  );
}
