'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../../components/app-shell';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { FavoriteButton } from '../../../components/favorite-button';
import { FollowButton } from '../../../components/follow-button';
import { RelatedItems } from '../../../components/related-items';
import {
  getModuleById,
  type ColumnDef,
  type FieldInputType,
  type ModuleDef,
} from '../../../../lib/module-manifest';

interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

interface HistoryEntry {
  at: string;
  actor: string;
  actorId: string;
  fieldChanges: FieldChange[];
  note?: string;
}

interface ResolvedRecord {
  id: string;
  data: Record<string, unknown>;
  isNew: boolean;
  hasOverride: boolean;
  deleted: boolean;
  updatedAt?: string;
}

interface RecordResponse {
  moduleId: string;
  recordId: string;
  record: ResolvedRecord;
  history: HistoryEntry[];
  canEdit: boolean;
}

/**
 * Generic edit page. Renders an auto-generated form from the manifest's
 * column definitions, fetches the live record (fixture + overrides), and
 * PATCHes the API on save. Works for ALL 21+ modules without any per-module
 * code — adding a new module to the manifest gives you free edit support.
 */
export default function GenericEditPage() {
  const params = useParams<{ moduleId: string; recordId: string }>();
  const router = useRouter();
  const moduleId = params.moduleId;
  const recordId = params.recordId;
  const module = useMemo<ModuleDef | undefined>(() => getModuleById(moduleId), [moduleId]);

  const [record, setRecord] = useState<ResolvedRecord | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!moduleId || !recordId) return;
    setLoading(true);
    fetch(`/api/entities/${moduleId}/${recordId}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (res.status === 404) {
          setError('Registro não encontrado.');
          return;
        }
        if (!res.ok) {
          setError(`Erro ${res.status} ao carregar o registro.`);
          return;
        }
        const data = (await res.json()) as RecordResponse;
        setRecord(data.record);
        setHistory(data.history);
        setCanEdit(data.canEdit);
        setDraft({ ...data.record.data });
        setError(null);
      })
      .catch(() => setError('Erro de rede.'))
      .finally(() => setLoading(false));
  }, [moduleId, recordId]);

  if (!module) {
    return (
      <AppShell pageTitle="Módulo desconhecido">
        <div role="alert" className="bg-red-950/40 border border-red-700 text-red-800 rounded-md px-4 py-3">
          Módulo <strong>{moduleId}</strong> não está registrado em <code>module-manifest.ts</code>.
        </div>
      </AppShell>
    );
  }
  // After the early return, alias to a non-null local so closures (handleSave,
  // handleDelete) get a narrowed type without TS losing the narrowing.
  const mod: ModuleDef = module;

  if (loading) {
    return (
      <AppShell pageTitle={`Editar ${mod.title}`}>
        <p className="text-slate-600">Carregando...</p>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell pageTitle={`Editar ${mod.title}`}>
        <div role="alert" className="bg-red-950/40 border border-red-700 text-red-800 rounded-md px-4 py-3 mb-4">
          {error}
        </div>
        <Link
          href={mod.route}
          className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          ← Voltar a {mod.title}
        </Link>
      </AppShell>
    );
  }

  if (!record) return null;

  // Compute the diff between draft and current data so we PATCH only changed fields
  const computePatch = (): Record<string, unknown> => {
    const patch: Record<string, unknown> = {};
    for (const col of mod.columns) {
      if (col.key === 'id' || col.editable === false) continue;
      const before = record.data[col.key];
      const after = draft[col.key];
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        patch[col.key] = after;
      }
    }
    return patch;
  };

  const patch = computePatch();
  const hasChanges = Object.keys(patch).length > 0;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!hasChanges) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/entities/${moduleId}/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ patch, note: note || undefined }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Erro ${res.status}`);
        return;
      }
      const data = (await res.json()) as { record: { data: Record<string, unknown> } };
      setRecord((prev) => (prev ? { ...prev, data: data.record.data, hasOverride: true } : prev));
      setDraft({ ...data.record.data });
      setNote('');
      setSuccess(`Salvo com ${Object.keys(patch).length} alteração(ões).`);
      // Reload history
      fetch(`/api/entities/${moduleId}/${recordId}`, { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((d: RecordResponse) => setHistory(d.history))
        .catch(() => undefined);
    } catch {
      setError('Erro de rede.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Remover registro ${recordId}? A ação fica registrada na auditoria.`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/entities/${moduleId}/${recordId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Erro ${res.status}`);
        return;
      }
      router.push(mod.route);
    } catch {
      setError('Erro de rede.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell pageTitle={`Editar ${mod.title}`}>
      <Breadcrumbs module={mod} recordLabel={recordId} />
      <div className="page-header">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="page-title">
              <span aria-hidden="true">{mod.icon}</span> Editar {mod.title}
            </h1>
            <p className="page-subtitle">
              Registro <span className="font-mono text-blue-700">{recordId}</span>
              {record.hasOverride && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-800 border border-amber-700/60">
                  Editado
                </span>
              )}
              {record.isNew && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-800 border border-green-700/60">
                  Novo
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FavoriteButton
              scope={mod.id}
              entry={{
                id: recordId,
                label:
                  (record.data.name as string | undefined) ??
                  (record.data.title as string | undefined) ??
                  recordId,
                href: `/edit/${mod.id}/${recordId}`,
              }}
            />
            <FollowButton
              scope={mod.id}
              entry={{
                id: recordId,
                label:
                  (record.data.name as string | undefined) ??
                  (record.data.title as string | undefined) ??
                  recordId,
                href: `/edit/${mod.id}/${recordId}`,
              }}
            />
            <Link
              href={`/compare/${mod.id}?ids=${recordId}`}
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-slate-50 border border-slate-300 text-slate-900 hover:bg-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
              aria-label="Comparar este registro com outro"
            >
              Comparar com outro
            </Link>
            <Link
              href={mod.route}
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-slate-50 border border-slate-300 text-slate-900 hover:bg-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              ← Voltar à lista
            </Link>
          </div>
        </div>
      </div>

      {!canEdit && (
        <div
          role="alert"
          className="bg-amber-950/40 border border-amber-700 text-amber-800 text-sm rounded-md px-4 py-3 mb-4"
        >
          ⚠ Sua função tem permissão apenas de leitura para este módulo. Os campos abaixo são
          mostrados em modo somente-leitura.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5"
        >
          {error && (
            <div role="alert" className="mb-4 bg-red-950/40 border border-red-700 text-red-800 text-sm rounded-md px-4 py-3">
              {error}
            </div>
          )}
          {success && (
            <div role="status" className="mb-4 bg-green-950/40 border border-green-700 text-green-800 text-sm rounded-md px-4 py-3">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {mod.columns.map((col) => {
              if (col.key === 'id') {
                return (
                  <FieldRow key={col.key} label={col.label} fullWidth={false}>
                    <input
                      type="text"
                      value={String(record.data.id ?? recordId)}
                      readOnly
                      className="w-full min-h-[44px] bg-slate-50/60 border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-600 cursor-not-allowed font-mono"
                    />
                  </FieldRow>
                );
              }
              const isFullWidth = col.inputType === 'textarea' || col.inputType === 'tags';
              return (
                <FieldRow key={col.key} label={col.label} fullWidth={isFullWidth} required={col.required}>
                  <FieldInput
                    column={col}
                    value={draft[col.key]}
                    onChange={(value) => setDraft((d) => ({ ...d, [col.key]: value }))}
                    disabled={!canEdit || col.editable === false}
                  />
                  {col.help && <p className="text-xs text-slate-500 mt-1">{col.help}</p>}
                </FieldRow>
              );
            })}
          </div>

          {canEdit && (
            <>
              <div className="mt-6 flex flex-col gap-1.5">
                <label htmlFor="change-note" className="text-sm font-medium text-slate-700">
                  Comentário da alteração (opcional)
                </label>
                <input
                  id="change-note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex: Atualizado conforme orientação do médico assistente"
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="flex items-center justify-between gap-3 mt-6 flex-wrap">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-slate-50 border border-red-700 text-red-800 hover:bg-red-900/40 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-60"
                >
                  Remover registro
                </button>
                <div className="flex gap-3 ml-auto">
                  <Link
                    href={mod.route}
                    className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-slate-50 border border-slate-300 text-slate-900 hover:bg-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    Cancelar
                  </Link>
                  <button
                    type="submit"
                    disabled={!hasChanges || saving}
                    className="min-h-[44px] inline-flex items-center px-5 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Salvando...' : `Salvar ${hasChanges ? Object.keys(patch).length : 0} alteração(ões)`}
                  </button>
                </div>
              </div>
            </>
          )}
        </form>

        {/* History timeline */}
        <aside
          aria-labelledby="history-heading"
          className="bg-white border border-slate-200 rounded-xl p-5"
        >
          <h2 id="history-heading" className="text-xs uppercase tracking-wider font-semibold text-slate-600 mb-4">
            Histórico auditado
          </h2>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma alteração registrada ainda.</p>
          ) : (
            <ol className="border-l border-slate-200 ml-2 space-y-4">
              {[...history].reverse().map((entry, idx) => (
                <li key={idx} className="pl-4 relative">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-900"
                  />
                  <div className="text-xs text-slate-500 font-mono">
                    {new Date(entry.at).toLocaleString('pt-BR')}
                  </div>
                  <div className="text-sm text-slate-900 font-semibold mt-0.5">
                    {entry.actor}
                  </div>
                  {entry.note && (
                    <div className="text-xs text-slate-600 italic mt-1">"{entry.note}"</div>
                  )}
                  {entry.fieldChanges.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {entry.fieldChanges.map((change, i) => (
                        <li key={i} className="text-xs text-slate-600">
                          <span className="text-slate-500 font-mono">{change.field}:</span>{' '}
                          <span className="text-red-700 line-through">
                            {formatValue(change.from)}
                          </span>{' '}
                          → <span className="text-green-700">{formatValue(change.to)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>

      {/* Related entities — auto-derived from the module relation map */}
      {(() => {
        const entityType = MODULE_TO_ENTITY_TYPE[mod.id];
        if (!entityType) return null;
        return (
          <div className="mt-5">
            <RelatedItems entityType={entityType} entityId={recordId} />
          </div>
        );
      })()}
    </AppShell>
  );
}

/**
 * Maps moduleId → entityType for RelatedItems lookups. Only modules whose
 * records are referenced FROM other modules need an entry here. The set
 * matches the keys in /api/related/[type]/[id]/route.ts.
 */
const MODULE_TO_ENTITY_TYPE: Record<string, string> = {
  patients: 'patient',
  employees: 'employee',
  assets: 'asset',
  suppliers: 'supplier',
  claims: 'claim',
  'lab-orders': 'lab-order',
  'imaging-orders': 'imaging-order',
};

function FieldRow({
  label,
  fullWidth,
  required,
  children,
}: {
  label: string;
  fullWidth?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? 'sm:col-span-2' : ''}`}>
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span aria-hidden="true" className="text-red-400 ml-0.5">
            *
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function FieldInput({
  column,
  value,
  onChange,
  disabled,
}: {
  column: ColumnDef;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  const inputType: FieldInputType = column.inputType ?? inferInputType(value);
  const baseClass =
    'w-full min-h-[44px] bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed';

  switch (inputType) {
    case 'textarea':
      return (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          disabled={disabled}
          className={`${baseClass} min-h-[88px]`}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          value={value == null ? '' : Number(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          disabled={disabled}
          className={baseClass}
        />
      );
    case 'date':
      return (
        <input
          type="date"
          value={String(value ?? '').slice(0, 10)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={baseClass}
        />
      );
    case 'datetime':
      return (
        <input
          type="datetime-local"
          value={String(value ?? '').slice(0, 16)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={baseClass}
        />
      );
    case 'select':
      return (
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${baseClass} cursor-pointer`}
        >
          <option value="">— selecione —</option>
          {(column.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label ?? opt.value}
            </option>
          ))}
        </select>
      );
    case 'boolean':
      return (
        <label className="inline-flex items-center gap-2 min-h-[44px]">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="w-5 h-5 cursor-pointer"
          />
          <span className="text-sm text-slate-700">{value ? 'Sim' : 'Não'}</span>
        </label>
      );
    case 'tags':
      return (
        <input
          type="text"
          value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            )
          }
          disabled={disabled}
          placeholder="Separe por vírgulas"
          className={baseClass}
        />
      );
    case 'text':
    default:
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={baseClass}
        />
      );
  }
}

function inferInputType(value: unknown): FieldInputType {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'tags';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return 'datetime';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
    if (value.length > 80) return 'textarea';
  }
  return 'text';
}

function formatValue(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
