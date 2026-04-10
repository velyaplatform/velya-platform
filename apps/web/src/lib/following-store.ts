/** Following store — file-backed per-user subscriptions. Storage: VELYA_FOLLOWING_PATH or /data/velya-following/following.json */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { randomBytes } from 'crypto';
import { audit } from './audit-logger';

const STORAGE_PATH =
  process.env.VELYA_FOLLOWING_PATH || '/data/velya-following/following.json';
const MAX_SUBSCRIPTIONS_PER_USER = 100;
const MAX_NOTIFICATIONS_PER_USER = 200;

export interface Subscription {
  id: string;
  scope: string;
  label: string;
  href?: string;
  subscribedAt: string;
}

export interface Notification {
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

interface UserBucket {
  subscriptions: Subscription[];
  notifications: Notification[];
}

interface StoreShape {
  users: Record<string, UserBucket>;
}

function ensureStorage(): void {
  const dir = dirname(STORAGE_PATH);
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // first write will retry
    }
  }
  if (!existsSync(STORAGE_PATH)) {
    try {
      writeFileSync(STORAGE_PATH, JSON.stringify({ users: {} }, null, 2));
    } catch {
      // ignore
    }
  }
}

function readStore(): StoreShape {
  ensureStorage();
  try {
    const raw = readFileSync(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as StoreShape;
    if (!parsed.users || typeof parsed.users !== 'object') {
      return { users: {} };
    }
    return parsed;
  } catch {
    return { users: {} };
  }
}

function writeStore(store: StoreShape): void {
  ensureStorage();
  try {
    writeFileSync(STORAGE_PATH, JSON.stringify(store, null, 2));
  } catch {
    // best effort
  }
}

function ensureUser(store: StoreShape, userId: string): UserBucket {
  if (!store.users[userId]) {
    store.users[userId] = { subscriptions: [], notifications: [] };
  }
  const bucket = store.users[userId];
  if (!Array.isArray(bucket.subscriptions)) bucket.subscriptions = [];
  if (!Array.isArray(bucket.notifications)) bucket.notifications = [];
  return bucket;
}

export function subscribe(
  userId: string,
  userName: string,
  sub: Omit<Subscription, 'subscribedAt'>,
): Subscription[] {
  const store = readStore();
  const bucket = ensureUser(store, userId);

  // Dedupe — if already there, move to top and refresh timestamp
  const filtered = bucket.subscriptions.filter(
    (s) => !(s.scope === sub.scope && s.id === sub.id),
  );
  const next: Subscription = { ...sub, subscribedAt: new Date().toISOString() };
  bucket.subscriptions = [next, ...filtered].slice(0, MAX_SUBSCRIPTIONS_PER_USER);
  writeStore(store);

  audit({
    category: 'api',
    action: 'following.subscribed',
    description: `Passou a acompanhar ${sub.scope}/${sub.id}`,
    actor: userName,
    resource: `${sub.scope}:${sub.id}`,
    result: 'success',
    details: { scope: sub.scope, label: sub.label, href: sub.href },
  });

  return bucket.subscriptions;
}

export function unsubscribe(
  userId: string,
  userName: string,
  scope: string,
  entityId: string,
): Subscription[] {
  const store = readStore();
  const bucket = ensureUser(store, userId);
  bucket.subscriptions = bucket.subscriptions.filter(
    (s) => !(s.scope === scope && s.id === entityId),
  );
  writeStore(store);

  audit({
    category: 'api',
    action: 'following.unsubscribed',
    description: `Deixou de acompanhar ${scope}/${entityId}`,
    actor: userName,
    resource: `${scope}:${entityId}`,
    result: 'success',
    details: { scope },
  });

  return bucket.subscriptions;
}

export function isSubscribed(userId: string, scope: string, entityId: string): boolean {
  const store = readStore();
  const bucket = store.users[userId];
  if (!bucket) return false;
  return (bucket.subscriptions ?? []).some(
    (s) => s.scope === scope && s.id === entityId,
  );
}

export function listSubscriptions(userId: string): Subscription[] {
  const store = readStore();
  return store.users[userId]?.subscriptions ?? [];
}

export interface PushNotificationInput {
  scope: string;
  entityId: string;
  entityLabel: string;
  action: string;
  summary?: string;
  href?: string;
}

export function pushNotification(opts: PushNotificationInput): void {
  const store = readStore();
  const recipients: string[] = [];
  for (const [userId, bucket] of Object.entries(store.users)) {
    const subs = bucket.subscriptions ?? [];
    const match = subs.some((s) => s.scope === opts.scope && s.id === opts.entityId);
    if (!match) continue;
    const notification: Notification = {
      id: `NOTIF-${Date.now()}-${randomBytes(4).toString('hex')}`,
      scope: opts.scope,
      entityId: opts.entityId,
      entityLabel: opts.entityLabel,
      action: opts.action,
      summary: opts.summary,
      at: new Date().toISOString(),
      read: false,
      href: opts.href,
    };
    const existing = bucket.notifications ?? [];
    bucket.notifications = [notification, ...existing].slice(0, MAX_NOTIFICATIONS_PER_USER);
    recipients.push(userId);
  }

  if (recipients.length > 0) {
    writeStore(store);
    audit({
      category: 'api',
      action: 'following.notification-sent',
      description: `Notificou ${recipients.length} usuário(s) sobre ${opts.scope}/${opts.entityId}`,
      actor: 'system',
      resource: `${opts.scope}:${opts.entityId}`,
      result: 'success',
      details: {
        scope: opts.scope,
        action: opts.action,
        summary: opts.summary,
        recipients: recipients.length,
      },
    });
  }
}

export function listNotifications(
  userId: string,
  opts?: { unreadOnly?: boolean; limit?: number },
): Notification[] {
  const store = readStore();
  let items = store.users[userId]?.notifications ?? [];
  if (opts?.unreadOnly) {
    items = items.filter((n) => !n.read);
  }
  if (opts?.limit !== undefined && opts.limit >= 0) {
    items = items.slice(0, opts.limit);
  }
  return items;
}

export function markRead(userId: string, notificationId: string): void {
  const store = readStore();
  const bucket = store.users[userId];
  if (!bucket) return;
  const items = bucket.notifications ?? [];
  for (const n of items) {
    if (n.id === notificationId) {
      n.read = true;
    }
  }
  writeStore(store);
}

export function markAllRead(userId: string): void {
  const store = readStore();
  const bucket = store.users[userId];
  if (!bucket) return;
  const items = bucket.notifications ?? [];
  for (const n of items) {
    n.read = true;
  }
  writeStore(store);
}

export function unreadCount(userId: string): number {
  const store = readStore();
  const items = store.users[userId]?.notifications ?? [];
  return items.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);
}
