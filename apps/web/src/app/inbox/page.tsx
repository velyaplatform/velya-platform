'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../components/app-shell';
import { Breadcrumbs } from '../components/breadcrumbs';

/**
 * Inbox page — shows notifications from records the user is following
 * plus the list of active "Acompanhando" subscriptions. Built on top of
 * /api/following and /api/following/notifications.
 */

interface Notification {
  id: string;
  scope: string;
  entityId: string;
  entityLabel: string;
  action: string;
  summary?: string;
  at: string;
  read: boolean;
  href?: string;
}

interface Subscription {
  id: string;
  scope: string;
  label: string;
  href?: string;
  subscribedAt: string;
}

type TabId = 'unread' | 'all' | 'following';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'unread', label: 'Não lidas' },
  { id: 'all', label: 'Todas' },
  { id: 'following', label: 'Acompanhando' },
];

export default function InboxPage() {
  const [tab, setTab] = useState<TabId>('unread');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [unread, setUnread] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/following/notifications?limit=200', {
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications: Notification[];
        unreadCount: number;
      };
      setNotifications(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      // best effort
    }
  }, []);

  const loadSubscriptions = useCallback(async () => {
    try {
      const res = await fetch('/api/following', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        subscriptions: Subscription[];
        unreadCount: number;
      };
      setSubscriptions(data.subscriptions ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      // best effort
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadNotifications(), loadSubscriptions()]).finally(() =>
      setLoading(false),
    );
  }, [loadNotifications, loadSubscriptions]);

  const markAllRead = useCallback(async () => {
    const res = await fetch('/api/following/notifications', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark-all-read' }),
    });
    if (res.ok) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    }
  }, []);

  const markOneRead = useCallback(async (notificationId: string) => {
    const res = await fetch('/api/following/notifications', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark-read', notificationId }),
    });
    if (res.ok) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
      setUnread((prev) => Math.max(0, prev - 1));
    }
  }, []);

  const unfollow = useCallback(async (scope: string, id: string) => {
    const url = `/api/following?scope=${encodeURIComponent(scope)}&id=${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (res.ok) {
      setSubscriptions((prev) =>
        prev.filter((s) => !(s.scope === scope && s.id === id)),
      );
    }
  }, []);

  const visibleNotifications =
    tab === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  return (
    <AppShell pageTitle="Caixa de Entrada">
      <Breadcrumbs
        crumbs={[
          { label: 'Início', href: '/' },
          { label: 'Caixa de Entrada', current: true },
        ]}
      />

      <div className="page-header">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="page-title">
              Caixa de Entrada
            </h1>
            <p className="page-subtitle">
              {unread > 0 ? (
                <>
                  <span className="text-neutral-900 font-semibold">{unread}</span>{' '}
                  notificacao(oes) nao lida(s)
                </>
              ) : (
                <span className="text-neutral-500">Tudo em dia -- nenhuma notificacao pendente.</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unread === 0}
              aria-label="Marcar todas as notificações como lidas"
              className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Marcar todas como lidas
            </button>
          </div>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Filtros da caixa de entrada"
        className="flex items-center gap-2 mb-4 border-b border-neutral-200"
      >
        {TABS.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`inbox-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`inbox-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={`min-h-[44px] px-4 py-2 text-sm font-semibold border-b-2 -mb-px focus:outline-none focus:ring-2 focus:ring-neutral-200 rounded-t-md ${
                selected
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {t.label}
              {t.id === 'unread' && unread > 0 && (
                <span className="ml-2 bg-neutral-900 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unread}
                </span>
              )}
              {t.id === 'following' && subscriptions.length > 0 && (
                <span className="ml-2 bg-neutral-100 text-neutral-900 text-xs font-bold px-2 py-0.5 rounded-full">
                  {subscriptions.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-neutral-500">Carregando...</p>
      ) : tab === 'following' ? (
        <div
          role="tabpanel"
          id="inbox-panel-following"
          aria-labelledby="inbox-tab-following"
        >
          {subscriptions.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-6 text-sm text-neutral-500">
              Voce ainda nao esta acompanhando nenhum registro. Abra qualquer
              paciente, prescricao ou ativo e toque em{' '}
              <span className="text-neutral-900 font-semibold">Acompanhar</span>{' '}
              para receber notificacoes quando houver mudancas.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {subscriptions.map((s) => (
                <li
                  key={`${s.scope}:${s.id}`}
                  className="bg-white border border-neutral-200 rounded-xl p-4 flex items-start justify-between gap-3 flex-wrap"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-mono text-neutral-700">
                      {s.scope}/{s.id}
                    </div>
                    <div className="text-sm text-neutral-900 font-semibold mt-0.5 truncate">
                      {s.label}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      Desde {new Date(s.subscribedAt).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.href && (
                      <Link
                        href={s.href}
                        className="min-h-[44px] inline-flex items-center px-3 py-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
                      >
                        Abrir
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => void unfollow(s.scope, s.id)}
                      aria-label={`Deixar de acompanhar ${s.label}`}
                      className="min-h-[44px] inline-flex items-center px-3 py-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
                    >
                      Deixar de acompanhar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`inbox-panel-${tab}`}
          aria-labelledby={`inbox-tab-${tab}`}
        >
          {visibleNotifications.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-6 text-sm text-neutral-500">
              {tab === 'unread'
                ? 'Nenhuma notificacao nao lida.'
                : 'Voce ainda nao recebeu notificacoes.'}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {visibleNotifications.map((n) => (
                <li
                  key={n.id}
                  className={`border rounded-xl p-4 flex items-start gap-3 ${
                    n.read
                      ? 'bg-white border-neutral-200'
                      : 'bg-neutral-50 border-neutral-300'
                  }`}
                >
                  <div
                    aria-hidden="true"
                    className="shrink-0 mt-0.5 text-lg"
                    title={n.read ? 'Lida' : 'Não lida'}
                  >
                    {n.read ? (
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-neutral-300" />
                    ) : (
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-neutral-900" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-neutral-900">
                      <span className="font-mono text-neutral-700">
                        {n.scope}/{n.entityId}
                      </span>{' '}
                      <span className="font-semibold">{n.entityLabel}</span>
                    </div>
                    {n.summary && (
                      <div className="text-sm text-neutral-700 mt-1">{n.summary}</div>
                    )}
                    <div className="text-xs text-neutral-500 mt-1">
                      <span className="uppercase tracking-wider">{n.action}</span>
                      {' · '}
                      {new Date(n.at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {n.href && (
                      <Link
                        href={n.href}
                        onClick={() => {
                          if (!n.read) void markOneRead(n.id);
                        }}
                        aria-label={`Abrir ${n.entityLabel}`}
                        className="min-h-[44px] inline-flex items-center px-3 py-2 rounded-md bg-neutral-900 hover:bg-neutral-700 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
                      >
                        Abrir
                      </Link>
                    )}
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => void markOneRead(n.id)}
                        aria-label={`Marcar ${n.entityLabel} como lida`}
                        className="min-h-[44px] inline-flex items-center px-3 py-2 rounded-md bg-neutral-50 border border-neutral-300 text-neutral-900 hover:bg-neutral-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200"
                      >
                        Marcar como lida
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </AppShell>
  );
}
