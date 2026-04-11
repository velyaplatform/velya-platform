'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BEDS, type Bed, type BedStatus, type RiskLevel } from '../../lib/fixtures/beds';
import { AppShell } from '../components/app-shell';

const STATUS_CONFIG: Record<
  BedStatus,
  { label: string; icon: string; border: string; bg: string; text: string; badge: string }
> = {
  available: {
    label: 'Disponível',
    icon: '🟢',
    border: 'border-emerald-500/60',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700',
    badge: 'bg-emerald-500/20 text-emerald-700 border border-emerald-500/40',
  },
  occupied: {
    label: 'Ocupado',
    icon: '🔴',
    border: 'border-red-500/60',
    bg: 'bg-red-500/10',
    text: 'text-red-700',
    badge: 'bg-red-500/20 text-red-700 border border-red-500/40',
  },
  cleaning: {
    label: 'Higienização',
    icon: '🟡',
    border: 'border-amber-400/60',
    bg: 'bg-amber-400/10',
    text: 'text-amber-800',
    badge: 'bg-amber-400/20 text-amber-800 border border-amber-400/40',
  },
  maintenance: {
    label: 'Manutenção',
    icon: '🟠',
    border: 'border-orange-500/60',
    bg: 'bg-orange-500/10',
    text: 'text-orange-300',
    badge: 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
  },
  reserved: {
    label: 'Reservado',
    icon: '🔵',
    border: 'border-blue-500/60',
    bg: 'bg-blue-500/10',
    text: 'text-blue-700',
    badge: 'bg-blue-500/20 text-blue-700 border border-blue-500/40',
  },
  blocked: {
    label: 'Bloqueado',
    icon: '⚫',
    border: 'border-slate-500/60',
    bg: 'bg-slate-100/30',
    text: 'text-slate-600',
    badge: 'bg-slate-100/40 text-slate-600 border border-slate-500/40',
  },
};

const RISK_CONFIG: Record<RiskLevel, { label: string; classes: string; pulse: boolean }> = {
  low: { label: 'Baixo', classes: 'bg-emerald-500/20 text-emerald-800', pulse: false },
  medium: { label: 'Médio', classes: 'bg-amber-400/20 text-amber-800', pulse: false },
  high: { label: 'Alto', classes: 'bg-orange-500/25 text-orange-200', pulse: false },
  critical: { label: 'Crítico', classes: 'bg-red-500/30 text-red-800', pulse: true },
};

export default function BedsPage() {
  const router = useRouter();
  const [wardFilter, setWardFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const wards = useMemo(() => Array.from(new Set(BEDS.map((b) => b.ward))).sort(), []);

  const filteredBeds = useMemo(
    () =>
      BEDS.filter((b) => {
        const wardOk = wardFilter === 'all' || b.ward === wardFilter;
        const statusOk = statusFilter === 'all' || b.status === statusFilter;
        return wardOk && statusOk;
      }),
    [wardFilter, statusFilter],
  );

  const kpis = useMemo(() => {
    const total = BEDS.length;
    const occupied = BEDS.filter((b) => b.status === 'occupied').length;
    const available = BEDS.filter((b) => b.status === 'available').length;
    const cleaning = BEDS.filter((b) => b.status === 'cleaning').length;
    const blocked = BEDS.filter((b) => b.status === 'blocked').length;
    const awaitingDischarge = BEDS.filter(
      (b) => b.status === 'occupied' && b.patient?.diagnosis.toLowerCase().includes('alta'),
    ).length;
    return {
      total,
      occupied,
      available,
      cleaning,
      blocked,
      awaitingDischarge,
      occupancyRate: Math.round((occupied / total) * 100),
    };
  }, []);

  const bedsByWard = useMemo(() => {
    const grouped: Record<string, Bed[]> = {};
    for (const bed of filteredBeds) {
      if (!grouped[bed.ward]) grouped[bed.ward] = [];
      grouped[bed.ward].push(bed);
    }
    return grouped;
  }, [filteredBeds]);

  const handleBedClick = (bed: Bed) => {
    if (bed.status === 'occupied' && bed.patient) {
      router.push(`/patients/${bed.patient.mrn}`);
    }
  };

  return (
    <AppShell pageTitle="Gestão de Leitos">
      <div className="page-header">
        <h1 className="page-title">Gestão de Leitos</h1>
        <p className="page-subtitle">
          Painel em tempo real — {BEDS.length} leitos monitorados em {wards.length} setores
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[11px] uppercase tracking-wider text-white/75 font-semibold">
            Taxa de Ocupação
          </div>
          <div className="text-3xl font-bold text-white mt-1">{kpis.occupancyRate}%</div>
          <div className="text-xs text-white/75 mt-1">
            {kpis.occupied} de {kpis.total} leitos
          </div>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <div className="text-[11px] uppercase tracking-wider text-emerald-700/80 font-semibold">
            Disponíveis
          </div>
          <div className="text-3xl font-bold text-emerald-700 mt-1">{kpis.available}</div>
          <div className="text-xs text-white/75 mt-1">Prontos para admissão</div>
        </div>
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/[0.06] p-4">
          <div className="text-[11px] uppercase tracking-wider text-amber-800/80 font-semibold">
            Higienização
          </div>
          <div className="text-3xl font-bold text-amber-800 mt-1">{kpis.cleaning}</div>
          <div className="text-xs text-white/75 mt-1">Em preparo</div>
        </div>
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/[0.06] p-4">
          <div className="text-[11px] uppercase tracking-wider text-blue-700/80 font-semibold">
            Aguardando Alta
          </div>
          <div className="text-3xl font-bold text-blue-700 mt-1">{kpis.awaitingDischarge}</div>
          <div className="text-xs text-white/75 mt-1">Liberação iminente</div>
        </div>
        <div className="rounded-lg border border-slate-500/30 bg-slate-100/20 p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-600/80 font-semibold">
            Bloqueados
          </div>
          <div className="text-3xl font-bold text-slate-700 mt-1">{kpis.blocked}</div>
          <div className="text-xs text-white/75 mt-1">Indisponíveis</div>
        </div>
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] p-4">
          <div className="text-[11px] uppercase tracking-wider text-red-700/80 font-semibold">
            Ocupados
          </div>
          <div className="text-3xl font-bold text-red-700 mt-1">{kpis.occupied}</div>
          <div className="text-xs text-white/75 mt-1">Com paciente ativo</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center mb-4 p-3 rounded-lg border border-white/10 bg-white/[0.02]">
        <select
          value={wardFilter}
          onChange={(e) => setWardFilter(e.target.value)}
          className="bg-slate-50 border border-white/15 rounded-md px-3 py-2 text-sm text-white/90 outline-none"
        >
          <option value="all">Todos os Setores</option>
          {wards.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-white/15 rounded-md px-3 py-2 text-sm text-white/90 outline-none"
        >
          <option value="all">Todos os Status</option>
          <option value="available">Disponível</option>
          <option value="occupied">Ocupado</option>
          <option value="cleaning">Higienização</option>
          <option value="maintenance">Manutenção</option>
          <option value="reserved">Reservado</option>
          <option value="blocked">Bloqueado</option>
        </select>
        <div className="ml-auto text-xs text-white/75">
          Exibindo {filteredBeds.length} de {BEDS.length} leitos
        </div>
      </div>

      {/* Beds grouped by ward */}
      <div className="flex flex-col gap-5">
        {Object.entries(bedsByWard).map(([ward, beds]) => (
          <section key={ward}>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
                {ward}
              </h2>
              <div className="text-xs text-white/70">{beds.length} leitos</div>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {beds.map((bed) => {
                const cfg = STATUS_CONFIG[bed.status];
                const clickable = bed.status === 'occupied';
                return (
                  <div
                    key={bed.number}
                    onClick={() => handleBedClick(bed)}
                    className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3 ${clickable ? 'cursor-pointer hover:brightness-125 transition' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-lg font-bold text-white">{bed.number}</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${cfg.badge}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                      {bed.patient?.risk === 'critical' && (
                        <span className="relative flex h-3 w-3 mt-1">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                      )}
                    </div>

                    {bed.patient && (
                      <div className="border-t border-white/10 pt-2 mt-2">
                        <div className="text-sm font-semibold text-white/90 truncate">
                          {bed.patient.name}
                        </div>
                        <div className="text-[11px] text-white/75">
                          {bed.patient.mrn} · {bed.patient.age} anos · {bed.patient.daysAdmitted}d
                        </div>
                        <div className="text-[11px] text-white/60 truncate mt-0.5">
                          {bed.patient.diagnosis}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${RISK_CONFIG[bed.patient.risk].classes} font-semibold`}
                          >
                            Risco {RISK_CONFIG[bed.patient.risk].label}
                          </span>
                        </div>
                      </div>
                    )}

                    {bed.status === 'cleaning' && (
                      <div className="border-t border-white/10 pt-2 mt-2 text-xs text-amber-800/80">
                        <div>ETA liberação: {bed.cleaningEta}</div>
                      </div>
                    )}
                    {bed.status === 'maintenance' && (
                      <div className="border-t border-white/10 pt-2 mt-2 text-xs text-orange-200/80">
                        {bed.maintenanceReason}
                      </div>
                    )}
                    {bed.status === 'reserved' && (
                      <div className="border-t border-white/10 pt-2 mt-2 text-xs text-blue-800/80">
                        {bed.reservedFor}
                      </div>
                    )}
                    {bed.status === 'blocked' && (
                      <div className="border-t border-white/10 pt-2 mt-2 text-xs text-slate-600/80">
                        {bed.blockedReason}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                      <span className="text-[10px] text-white/70">Última ação: {bed.lastAction}</span>
                    </div>

                    <div
                      className="flex flex-wrap gap-1 mt-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {bed.status === 'occupied' && (
                        <>
                          <button className="text-[10px] px-2 py-1 rounded bg-amber-500/20 text-amber-800 border border-amber-500/30 hover:bg-amber-500/30">
                            Marcar higienização
                          </button>
                          <button className="text-[10px] px-2 py-1 rounded bg-blue-500/20 text-blue-800 border border-blue-500/30 hover:bg-blue-500/30">
                            Transferir
                          </button>
                        </>
                      )}
                      {bed.status === 'available' && (
                        <>
                          <button className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-800 border border-emerald-500/30 hover:bg-emerald-500/30">
                            Atribuir paciente
                          </button>
                          <button className="text-[10px] px-2 py-1 rounded bg-slate-100/40 text-slate-600 border border-slate-500/30 hover:bg-slate-100/60">
                            Bloquear
                          </button>
                        </>
                      )}
                      {bed.status === 'cleaning' && (
                        <button className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-800 border border-emerald-500/30 hover:bg-emerald-500/30">
                          Liberar
                        </button>
                      )}
                      {bed.status === 'maintenance' && (
                        <button className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-800 border border-emerald-500/30 hover:bg-emerald-500/30">
                          Concluir manutenção
                        </button>
                      )}
                      {bed.status === 'reserved' && (
                        <button className="text-[10px] px-2 py-1 rounded bg-slate-100/40 text-slate-600 border border-slate-500/30 hover:bg-slate-100/60">
                          Cancelar reserva
                        </button>
                      )}
                      {bed.status === 'blocked' && (
                        <button className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-800 border border-emerald-500/30 hover:bg-emerald-500/30">
                          Desbloquear
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {filteredBeds.length === 0 && (
          <div className="text-center py-12 text-white/70">
            <div className="text-4xl mb-2">🛏️</div>
            <div>Nenhum leito corresponde aos filtros selecionados</div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
