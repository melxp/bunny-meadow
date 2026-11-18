// Supabase authentication + two-way sync, using Supabase's REST APIs directly
// (GoTrue for auth, PostgREST for data) so the app needs no build step or SDK.
//
// Sync model
//  - Local store is the source of truth for the UI; it works fully offline.
//  - Push: dirty rows are upserted (Prefer: resolution=merge-duplicates).
//    A database trigger keeps the newer `updated_at` if two devices collide.
//  - Pull: rows whose `server_updated_at` is newer than our cursor are merged
//    (last-write-wins on `updated_at`).
//  - Runs after local changes (debounced), on reconnect, when the app regains
//    focus and every 45 s while open.

import * as store from './store.js';
import { debounce } from './util.js';

const AUTH_KEY = 'bm:auth';
const CFG_KEY = 'bm:supabase';
const GUEST_KEY = 'bm:guest';

let status = 'idle'; // idle | offline | syncing | synced | error | local
let lastError = null;
let lastSyncedAt = null;
const listeners = new Set();
let running = null;
let interval = null;

export function onStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setStatus(s, err = null) {
  status = s;
  lastError = err;
  if (s === 'synced') lastSyncedAt = Date.now();
  for (const fn of listeners) fn({ status, lastError, lastSyncedAt });
}

export function getStatus() {
  return { status, lastError, lastSyncedAt };
}

// ---------- configuration ----------
export function getConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    if (saved && saved.url && saved.anonKey) return { ...saved, source: 'settings' };
  } catch {}
  const c = (typeof window !== 'undefined' && window.BUNNY_MEADOW_CONFIG) || {};
  if (c.supabaseUrl && c.supabaseAnonKey && !c.supabaseUrl.includes('YOUR-PROJECT')) {
    return { url: c.supabaseUrl.replace(/\/$/, ''), anonKey: c.supabaseAnonKey, source: 'config' };
  }
  return null;
}

export function saveConfig(url, anonKey) {
  if (!url) {
    localStorage.removeItem(CFG_KEY);
    return;
  }
  const clean = url.trim().replace(/\/$/, '');
  if (!/^https?:\/\/[^\s]+$/.test(clean)) throw new Error('That URL does not look right.');
  localStorage.setItem(CFG_KEY, JSON.stringify({ url: clean, anonKey: anonKey.trim() }));
}

export function isConfigured() {
  return !!getConfig();
}

// ---------- auth session ----------
function readSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeSession(s) {
  if (s) localStorage.setItem(AUTH_KEY, JSON.stringify(s));
  else localStorage.removeItem(AUTH_KEY);
}

export function getUser() {
  const s = readSession();
  return s ? s.user : null;
}

export function isGuest() {
  return localStorage.getItem(GUEST_KEY) === '1';
}

export function continueAsGuest() {
  localStorage.setItem(GUEST_KEY, '1');
}

function sessionFromToken(body) {
  const expiresAt = body.expires_at ? body.expires_at * 1000 : Date.now() + (body.expires_in || 3600) * 1000;
  return { access_token: body.access_token, refresh_token: body.refresh_token, expires_at: expiresAt, user: body.user };
}

async function authRequest(path, body, { token, method = 'POST' } = {}) {
  const cfg = getConfig();
  if (!cfg) throw new Error('Sync is not set up yet.');
  let res;
  try {
    res = await fetch(`${cfg.url}/auth/v1/${path}`, {
      method,
      headers: {
        apikey: cfg.anonKey,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('Could not reach the server. Check your connection.');
  }
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {}
  if (!res.ok) {
    const msg = json.error_description || json.msg || json.message || json.error || `Request failed (${res.status})`;
    throw new Error(friendlyAuthError(msg));
  }
  return json;
}

function friendlyAuthError(msg) {
  const m = String(msg);
  if (/invalid login credentials/i.test(m)) return 'That email and password do not match.';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email first – check your inbox.';
  if (/already registered|already exists/i.test(m)) return 'An account with that email already exists. Try signing in.';
  if (/password should be at least/i.test(m)) return 'Please choose a password of at least 6 characters.';
  return m;
}

async function afterSignIn(sess) {
  writeSession(sess);
  localStorage.removeItem(GUEST_KEY);
  store.attachUser(sess.user.id);
  startAutoSync();
  await syncNow();
}

export async function signUp(email, password) {
  const redirect = location.origin + location.pathname;
  const body = await authRequest(`signup?redirect_to=${encodeURIComponent(redirect)}`, { email, password });
  if (body.access_token) {
    await afterSignIn(sessionFromToken(body));
    return { signedIn: true };
  }
  return { signedIn: false, needsConfirmation: true };
}

export async function signIn(email, password) {
  const body = await authRequest('token?grant_type=password', { email, password });
  await afterSignIn(sessionFromToken(body));
}

export async function sendPasswordReset(email) {
  const redirect = location.origin + location.pathname;
  await authRequest(`recover?redirect_to=${encodeURIComponent(redirect)}`, { email });
}

export async function updatePassword(password) {
  const token = await getAccessToken();
  await authRequest('user', { password }, { token, method: 'PUT' });
}

/** Handle the #access_token=… fragment that Supabase email links redirect back with. */
export async function handleAuthRedirect() {
  if (!location.hash.includes('access_token=')) return null;
  const params = new URLSearchParams(location.hash.slice(1));
  const access = params.get('access_token');
  const refresh = params.get('refresh_token');
  const type = params.get('type');
  history.replaceState(null, '', location.pathname + '#home');
  try {
    const user = await authRequest('user', null, { token: access, method: 'GET' });
    await afterSignIn({
      access_token: access,
      refresh_token: refresh,
      expires_at: Date.now() + Number(params.get('expires_in') || 3600) * 1000,
      user,
    });
    return type; // 'recovery' means: ask for a new password
  } catch (e) {
    console.warn('Could not complete sign-in from link', e);
    return null;
  }
}

export async function signOut() {
  // try to upload anything pending before clearing this device
  try {
    await syncNow();
  } catch {}
  const s = readSession();
  if (s) authRequest('logout', {}, { token: s.access_token }).catch(() => {});
  writeSession(null);
  stopAutoSync();
  store.clearLocal();
  setStatus('idle');
}

let refreshing = null;
async function getAccessToken() {
  const s = readSession();
  if (!s) throw new Error('Not signed in');
  if (s.expires_at - Date.now() > 60_000) return s.access_token;
  if (!refreshing) {
    refreshing = authRequest('token?grant_type=refresh_token', { refresh_token: s.refresh_token })
      .then((body) => {
        const next = sessionFromToken(body);
        next.user = body.user || s.user;
        writeSession(next);
        return next.access_token;
      })
      .finally(() => (refreshing = null));
  }
  return refreshing;
}

// ---------- data API ----------
async function rest(path, { method = 'GET', body, prefer } = {}) {
  const cfg = getConfig();
  const token = await getAccessToken();
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    // token rejected – force refresh next time
    const s = readSession();
    if (s) writeSession({ ...s, expires_at: 0 });
    throw new Error('Your sign-in expired. Retrying…');
  }
  if (!res.ok) {
    let msg = `Server error (${res.status})`;
    try {
      const j = await res.json();
      msg = j.message || msg;
      if (j.code === '42P01' || /relation .* does not exist/i.test(msg)) {
        msg = 'The database tables are missing. Run supabase/schema.sql in your Supabase project.';
      }
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const TASK_COLS = ['id', 'title', 'notes', 'subject', 'priority', 'due_date', 'completed', 'completed_at', 'created_at', 'updated_at', 'deleted'];
const SESSION_COLS = ['id', 'mode', 'task_id', 'label', 'subject', 'started_at', 'ended_at', 'planned_seconds', 'actual_seconds', 'completed', 'local_date', 'created_at', 'updated_at', 'deleted'];

function pick(row, cols, userId) {
  const o = { user_id: userId };
  for (const c of cols) o[c] = row[c] ?? null;
  return o;
}

async function push(userId) {
  const dirty = store.getDirty();
  for (const [table, cols] of [
    ['tasks', TASK_COLS],
    ['sessions', SESSION_COLS],
  ]) {
    const rows = dirty[table];
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const saved = await rest(`${table}?on_conflict=id&select=*`, {
        method: 'POST',
        body: chunk.map((r) => pick(r, cols, userId)),
        prefer: 'resolution=merge-duplicates,return=representation',
      });
      store.markPushed(table, chunk, saved || []);
    }
  }
  if (dirty.settings) {
    const saved = await rest('user_settings?on_conflict=user_id&select=*', {
      method: 'POST',
      body: [{ user_id: userId, data: dirty.settings.data, updated_at: dirty.settings.updated_at }],
      prefer: 'resolution=merge-duplicates,return=representation',
    });
    store.markPushed('settings', dirty.settings, saved || []);
  }
}

const OVERLAP_MS = 5000; // re-read a few seconds back to cover concurrent commits

async function pullTable(table) {
  let cursor = store.getCursor(table);
  for (let page = 0; page < 50; page++) {
    const since = cursor ? new Date(new Date(cursor).getTime() - OVERLAP_MS).toISOString() : null;
    const q = `${table}?select=*&order=server_updated_at.asc&limit=1000` + (since ? `&server_updated_at=gte.${encodeURIComponent(since)}` : '');
    const rows = await rest(q);
    if (!rows || !rows.length) break;
    if (table === 'user_settings') store.mergeRemoteSettings(rows[rows.length - 1]);
    else store.mergeRemote(table, rows);
    const newest = rows[rows.length - 1].server_updated_at;
    const advanced = !cursor || newest > cursor;
    cursor = newest;
    store.setCursor(table, cursor);
    if (rows.length < 1000 || !advanced) break;
  }
}

async function pull() {
  await pullTable('tasks');
  await pullTable('sessions');
  await pullTable('user_settings');
}

export async function syncNow() {
  const cfg = getConfig();
  const user = getUser();
  if (!cfg || !user) {
    setStatus('local');
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setStatus('offline');
    return;
  }
  if (running) return running;
  setStatus('syncing');
  running = (async () => {
    try {
      await push(user.id);
      await pull();
      // anything changed locally while we were pulling? push again
      if (store.hasDirty()) await push(user.id);
      setStatus('synced');
    } catch (e) {
      console.warn('Sync failed', e);
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      setStatus(offline ? 'offline' : 'error', e.message);
      if (/expired/.test(e.message)) setTimeout(() => syncNow(), 1500);
    } finally {
      running = null;
    }
  })();
  return running;
}

const queueSync = debounce(() => syncNow(), 1500);

let unsubStore = null;
export function startAutoSync() {
  if (!getUser() || !getConfig()) {
    setStatus('local');
    return;
  }
  if (!unsubStore) {
    unsubStore = store.subscribe((topic) => {
      if (topic === 'local-change') queueSync();
    });
  }
  if (!interval) {
    interval = setInterval(() => {
      if (document.visibilityState === 'visible') syncNow();
    }, 45_000);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
  }
}

function stopAutoSync() {
  if (unsubStore) unsubStore();
  unsubStore = null;
  clearInterval(interval);
  interval = null;
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
  document.removeEventListener('visibilitychange', onVisible);
}

function onOnline() {
  syncNow();
}
function onOffline() {
  setStatus('offline');
}
function onVisible() {
  if (document.visibilityState === 'visible') syncNow();
}
