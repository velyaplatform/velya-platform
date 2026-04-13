'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Filter, Users, ClipboardList } from 'lucide-react';
import { AppShell } from '../components/app-shell';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { VelyaCombobox } from '../components/ui/combobox';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { VelyaStatusDot } from '../components/velya/velya-status-dot';
import { MOCK_PATIENTS, type Patient } from '../../lib/fixtures/patients-list';
import { cn } from '../../lib/utils';

const STATUS_LABELS: Record<Patient['dischargeStatus'], string> = {
  'on-track': 'No Prazo',
  'at-risk': 'Em Risco',
  blocked: 'Bloqueado',
  discharged: 'Alta',
};

const RISK_LABELS: Record<Patient['riskLevel'], string> = {
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
};

const STATUS_VARIANT: Record<Patient['dischargeStatus'], 'success' | 'warning' | 'critical' | 'default'> = {
  'on-track': 'success',
  'at-risk': 'warning',
  blocked: 'critical',
  discharged: 'default',
};

const RISK_VARIANT: Record<Patient['riskLevel'], 'critical' | 'warning' | 'success'> = {
  high: 'critical',
  medium: 'warning',
  low: 'success',
};

/** Cor estável gerada a partir do hash do nome — usada no avatar fallback */
function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const palette = [
    'from-neutral-500 to-neutral-700',
    'from-neutral-400 to-neutral-600',
    'from-neutral-600 to-neutral-800',
    'from-neutral-500 to-neutral-700',
    'from-neutral-400 to-neutral-600',
    'from-neutral-500 to-neutral-700',
  ];
  return palette[Math.abs(hash) % palette.length];
}

function initials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function PatientsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [wardFilter, setWardFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  const wards = useMemo(() => Array.from(new Set(MOCK_PATIENTS.map((p) => p.ward))).sort(), []);

  const sorted = useMemo(() => {
    const filtered = MOCK_PATIENTS.filter((p) => {
      const matchesSearch =
        searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.mrn.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.dischargeStatus === statusFilter;
      const matchesWard = wardFilter === 'all' || p.ward === wardFilter;
      const matchesRisk = riskFilter === 'all' || p.riskLevel === riskFilter;
      return matchesSearch && matchesStatus && matchesWard && matchesRisk;
    });
    const order = { blocked: 0, 'at-risk': 1, 'on-track': 2, discharged: 3 };
    return [...filtered].sort((a, b) => order[a.dischargeStatus] - order[b.dischargeStatus]);
  }, [searchQuery, statusFilter, wardFilter, riskFilter]);

  const blockedCount = useMemo(
    () => MOCK_PATIENTS.filter((p) => p.dischargeStatus === 'blocked').length,
    [],
  );
  const atRiskCount = useMemo(
    () => MOCK_PATIENTS.filter((p) => p.dischargeStatus === 'at-risk').length,
    [],
  );
  const onTrackCount = useMemo(
    () => MOCK_PATIENTS.filter((p) => p.dischargeStatus === 'on-track').length,
    [],
  );

  return (
    <AppShell pageTitle="Pacientes">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-700">
            <Users className="h-3 w-3" /> Pacientes
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Lista de Pacientes
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {MOCK_PATIENTS.length} internados — {blockedCount} bloqueados, {atRiskCount} em risco,{' '}
            {onTrackCount} no prazo
          </p>
        </div>
      </div>

      {/* Status chips — filtros rápidos */}
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
            statusFilter === 'all'
              ? 'border-neutral-300 bg-neutral-100 text-neutral-900'
              : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50',
          )}
        >
          Todos <span className="font-mono tabular-nums">{MOCK_PATIENTS.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('blocked')}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
            statusFilter === 'blocked'
              ? 'border-neutral-300 bg-neutral-100 text-neutral-900 shadow-sm'
              : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100',
          )}
        >
          <VelyaStatusDot tone="critical" size="sm" />
          Bloqueados <span className="font-mono tabular-nums">{blockedCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('at-risk')}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
            statusFilter === 'at-risk'
              ? 'border-neutral-300 bg-neutral-100 text-neutral-900'
              : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100',
          )}
        >
          <VelyaStatusDot tone="warning" size="sm" />
          Em risco <span className="font-mono tabular-nums">{atRiskCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('on-track')}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
            statusFilter === 'on-track'
              ? 'border-neutral-300 bg-neutral-100 text-neutral-900'
              : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100',
          )}
        >
          <VelyaStatusDot tone="success" size="sm" />
          No prazo <span className="font-mono tabular-nums">{onTrackCount}</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[280px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <Input
            type="text"
            placeholder="Buscar por nome ou MRN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-neutral-500" />
          <div className="w-[220px]">
            <VelyaCombobox
              ariaLabel="Filtrar por ala"
              placeholder="Todas as Alas"
              searchPlaceholder="Buscar ala..."
              emptyText="Nenhuma ala encontrada."
              value={wardFilter}
              onChange={setWardFilter}
              options={[
                { value: 'all', label: 'Todas as Alas' },
                ...wards.map((w) => ({ value: w, label: w })),
              ]}
            />
          </div>
          <div className="w-[200px]">
            <VelyaCombobox
              ariaLabel="Filtrar por risco"
              placeholder="Todos os Riscos"
              searchPlaceholder="Buscar risco..."
              emptyText="Nenhum risco encontrado."
              value={riskFilter}
              onChange={setRiskFilter}
              options={[
                { value: 'all', label: 'Todos os Riscos' },
                { value: 'high', label: 'Alto Risco' },
                { value: 'medium', label: 'Médio Risco' },
                { value: 'low', label: 'Baixo Risco' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Table card */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                <th className="px-5 py-3">Paciente</th>
                <th className="px-3 py-3">Ala / Leito</th>
                <th className="px-3 py-3">Diagnóstico</th>
                <th className="px-3 py-3">Internado</th>
                <th className="px-3 py-3">Tempo de Internação</th>
                <th className="px-3 py-3">Status de Alta</th>
                <th className="px-3 py-3">Bloqueios</th>
                <th className="px-3 py-3">Médico</th>
                <th className="px-3 py-3">Risco</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="flex flex-col items-center gap-3 px-5 py-16 text-neutral-500">
                      <Search className="h-10 w-10 opacity-40" strokeWidth={1.25} />
                      <div className="text-sm font-semibold text-neutral-500">
                        Nenhum paciente corresponde aos filtros
                      </div>
                      <div className="text-xs text-neutral-500">
                        Tente limpar filtros ou ajustar a busca.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map((patient) => (
                  <tr
                    key={patient.mrn}
                    className={cn(
                      'transition-colors hover:bg-neutral-50',
                      patient.dischargeStatus === 'blocked' &&
                        'bg-neutral-50/40 hover:bg-neutral-50',
                      patient.dischargeStatus === 'at-risk' &&
                        'bg-neutral-50/40 hover:bg-neutral-50',
                    )}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback
                            className={cn('bg-gradient-to-br text-white', colorFromName(patient.name))}
                          >
                            {initials(patient.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-neutral-900">{patient.name}</div>
                          <div className="text-[11px] text-neutral-500">
                            <span className="font-mono text-neutral-700">{patient.mrn}</span>
                            <span className="mx-1.5">·</span>
                            {patient.age}a
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm text-neutral-700">{patient.ward}</div>
                      <div className="text-[11px] text-neutral-500">Leito {patient.bed}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div
                        className="max-w-[180px] truncate text-sm text-neutral-700"
                        title={patient.diagnosis}
                      >
                        {patient.diagnosis}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-neutral-700">{patient.admissionDate}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'font-mono font-semibold tabular-nums',
                          patient.los > 10
                            ? 'text-neutral-900'
                            : patient.los > 6
                              ? 'text-neutral-700'
                              : 'text-neutral-900',
                        )}
                      >
                        {patient.los}
                        <span className="text-xs text-neutral-500">d</span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        variant={STATUS_VARIANT[patient.dischargeStatus]}
                        withDot
                      >
                        {STATUS_LABELS[patient.dischargeStatus]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      {patient.blockersCount === 0 ? (
                        <span className="text-xs text-neutral-500">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {patient.blockers.map((b) => (
                            <Badge key={b} variant="critical" size="sm">
                              {b}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-neutral-700">{patient.consultant}</td>
                    <td className="px-3 py-3">
                      <Badge variant={RISK_VARIANT[patient.riskLevel]} withDot>
                        {RISK_LABELS[patient.riskLevel]}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild size="xs">
                          <Link href={`/patients/${patient.mrn}`}>Ver</Link>
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          aria-label={`Tarefas de ${patient.name}`}
                          title="Ver tarefas do paciente"
                        >
                          <ClipboardList className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-3 text-right text-xs text-neutral-500">
        Exibindo {sorted.length} de {MOCK_PATIENTS.length} pacientes
      </div>
    </AppShell>
  );
}
