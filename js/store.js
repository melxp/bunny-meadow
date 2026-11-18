// Offline-first local data store.
//
// All data lives here first (in localStorage) so the app works with no connection.
// Every change stamps `updated_at` and marks the record "dirty"; the sync module
// pushes dirty records to Supabase and merges remote changes back in
// (last-write-wins on `updated_at`). Deletions are soft (`deleted: true`) so they
// can propagate to other devices.

import { uuid, dayKey } from './util.js';

const KEY = 'bm:data:v1';

export const DEFAULT_SETTINGS = {
  name: '',
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4,
  autoBreaks: true,
  autoFocus: false,
  goalMin: 120,
  countPartial: false,
  bellOn: true,
  bellVol: 0.6,
  chimeOn: true,
  chimeVol: 0.5,
  birdsVol: 0.35,
  breezeVol: 0.25,
  notifications: false,
  theme: 'meadow',
  brightness: 0, // -2 … 2: dims or lightens the scene
  reduceMotion: false,
};

function emptyData() {
  return {
    userId: null, // null = guest / not signed in
    tasks: {},
    sessions: {},
    settings: { ...DEFAULT_SETTINGS },
    settingsUpdatedAt: new Date(0).toISOString(),
    dirty: { tasks: {}, sessions: {}, settings: false },
    cursors: { tasks: null, sessions: null, settings: null },
  };
}

let data = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData();
    const d = JSON.parse(raw);
    const base = emptyData();
    return {
      ...base,
      ...d,
      settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) },
      dirty: { ...base.dirty, ...(d.dirty || {}) },
      cursors: { ...base.cursors, ...(d.cursors || {}) },
    };
  } catch (e) {
    console.warn('Could not read saved data, starting fresh', e);
    return emptyData();
  }
}

let saveFailedOnce = false;
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    if (!saveFailedOnce) {
      saveFailedOnce = true;
      emit('error', { message: 'Your browser storage is full, so offline changes may not be kept.' });
    }
  }
}

function emit(topic, detail) {
  for (const fn of listeners) {
    try {
      fn(topic, detail);
    } catch (e) {
      console.error(e);
    }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit(topic, detail) {
  save();
  emit(topic, detail);
  emit('local-change', { topic });
}

const nowIso = () => new Date().toISOString();

// ---------- settings ----------
export function getSettings() {
  return data.settings;
}

export function updateSettings(patch) {
  data.settings = { ...data.settings, ...patch };
  data.settingsUpdatedAt = nowIso();
  data.dirty.settings = true;
  commit('settings', patch);
}

// ---------- tasks ----------
export function getTask(id) {
  const t = data.tasks[id];
  return t && !t.deleted ? t : null;
}

export function getTaskIncludingDeleted(id) {
  return data.tasks[id] || null;
}

export function listTasks() {
  return Object.values(data.tasks).filter((t) => !t.deleted);
}

export function tasksById() {
  return data.tasks;
}

function cleanTask(input) {
  const title = String(input.title ?? '').trim().slice(0, 300);
  const pr = ['low', 'medium', 'high'].includes(input.priority) ? input.priority : 'medium';
  const due = input.due_date && /^\d{4}-\d{2}-\d{2}$/.test(input.due_date) ? input.due_date : null;
  return {
    title,
    notes: String(input.notes ?? '').slice(0, 5000),
    subject: String(input.subject ?? '').trim().slice(0, 60),
    priority: pr,
    due_date: due,
  };
}

export function addTask(input) {
  const clean = cleanTask(input);
  if (!clean.title) throw new Error('A task needs a title.');
  const ts = nowIso();
  const task = { id: uuid(), ...clean, completed: false, completed_at: null, created_at: ts, updated_at: ts, deleted: false };
  data.tasks[task.id] = task;
  data.dirty.tasks[task.id] = true;
  commit('tasks', { id: task.id });
  return task;
}

export function updateTask(id, patch) {
  const t = data.tasks[id];
  if (!t) return null;
  let next = { ...t };
  if ('title' in patch || 'notes' in patch || 'subject' in patch || 'priority' in patch || 'due_date' in patch) {
    const clean = cleanTask({ ...t, ...patch });
    if (!clean.title) throw new Error('A task needs a title.');
    next = { ...next, ...clean };
  }
  if ('completed' in patch) {
    next.completed = !!patch.completed;
    next.completed_at = patch.completed ? patch.completed_at || nowIso() : null;
  }
  next.updated_at = nowIso();
  data.tasks[id] = next;
  data.dirty.tasks[id] = true;
  commit('tasks', { id });
  return next;
}

export function deleteTask(id) {
  const t = data.tasks[id];
  if (!t) return;
  data.tasks[id] = { ...t, deleted: true, updated_at: nowIso() };
  data.dirty.tasks[id] = true;
  commit('tasks', { id, deleted: true });
}

export function listSubjects() {
  const set = new Map();
  for (const t of listTasks()) if (t.subject) set.set(t.subject.toLowerCase(), t.subject);
  for (const s of listSessions()) if (s.subject) set.set(s.subject.toLowerCase(), s.subject);
  return [...set.values()].sort((a, b) => a.localeCompare(b));
}

// ---------- sessions ----------
export function listSessions() {
  return Object.values(data.sessions).filter((s) => !s.deleted);
}

export function addSessions(records) {
  if (!records.length) return;
  const ts = nowIso();
  for (const r of records) {
    data.sessions[r.id] = { ...r, created_at: ts, updated_at: ts, deleted: false };
    data.dirty.sessions[r.id] = true;
  }
  commit('sessions', { ids: records.map((r) => r.id) });
}

export function deleteSession(id) {
  const s = data.sessions[id];
  if (!s) return;
  data.sessions[id] = { ...s, deleted: true, updated_at: nowIso() };
  data.dirty.sessions[id] = true;
  commit('sessions', { id, deleted: true });
}

// ---------- sync plumbing ----------
export function getUserId() {
  return data.userId;
}

export function getDirty() {
  return {
    tasks: Object.keys(data.dirty.tasks).map((id) => data.tasks[id]).filter(Boolean),
    sessions: Object.keys(data.dirty.sessions).map((id) => data.sessions[id]).filter(Boolean),
    settings: data.dirty.settings ? { data: data.settings, updated_at: data.settingsUpdatedAt } : null,
  };
}

export function hasDirty() {
  return Object.keys(data.dirty.tasks).length + Object.keys(data.dirty.sessions).length > 0 || data.dirty.settings;
}

const sameTime = (a, b) => a && b && new Date(a).getTime() === new Date(b).getTime();

/**
 * Called after a successful push: clear the dirty flag only if the record didn't change since.
 * `serverRows` is what the database actually kept. If another device had a newer edit, the
 * database keeps that one (last-write-wins) and we adopt it here so devices never diverge.
 */
export function markPushed(table, rows, serverRows = []) {
  let changed = false;
  if (table === 'settings') {
    if (rows && rows.updated_at === data.settingsUpdatedAt) {
      data.dirty.settings = false;
      const srv = serverRows[0];
      if (srv && !sameTime(srv.updated_at, rows.updated_at) && new Date(srv.updated_at) > new Date(rows.updated_at)) {
        data.settings = { ...DEFAULT_SETTINGS, ...(srv.data || {}) };
        data.settingsUpdatedAt = srv.updated_at;
        changed = true;
      }
    }
  } else {
    const byId = Object.fromEntries(serverRows.map((r) => [r.id, r]));
    for (const r of rows) {
      const cur = data[table][r.id];
      if (cur && cur.updated_at === r.updated_at) {
        delete data.dirty[table][r.id];
        const srv = byId[r.id];
        if (srv && new Date(srv.updated_at) > new Date(r.updated_at)) {
          const { user_id, server_updated_at, ...rest } = srv;
          data[table][r.id] = rest;
          changed = true;
        }
      }
    }
  }
  save();
  if (changed) emit(table === 'settings' ? 'settings' : table, { remote: true });
}

/** Merge rows pulled from the server. Returns true if anything visible changed. */
export function mergeRemote(table, rows) {
  let changed = false;
  for (const r of rows) {
    const local = data[table][r.id];
    if (!local || new Date(r.updated_at) > new Date(local.updated_at)) {
      const { user_id, server_updated_at, ...rest } = r;
      data[table][r.id] = rest;
      delete data.dirty[table][r.id];
      changed = true;
    }
  }
  if (changed) {
    save();
    emit(table, { remote: true });
  }
  return changed;
}

export function mergeRemoteSettings(row) {
  if (!row) return false;
  if (new Date(row.updated_at) > new Date(data.settingsUpdatedAt)) {
    data.settings = { ...DEFAULT_SETTINGS, ...(row.data || {}) };
    data.settingsUpdatedAt = row.updated_at;
    data.dirty.settings = false;
    save();
    emit('settings', { remote: true });
    return true;
  }
  return false;
}

export function getCursor(table) {
  return data.cursors[table];
}

export function setCursor(table, value) {
  data.cursors[table] = value;
  save();
}

/**
 * Attach the local store to a signed-in user.
 * - Guest data (userId null) is adopted into the account and marked for upload.
 * - Data from a different account is cleared first.
 */
export function attachUser(userId) {
  if (data.userId === userId) return;
  if (data.userId && data.userId !== userId) {
    data = emptyData();
  } else {
    // adopt guest data
    for (const id of Object.keys(data.tasks)) data.dirty.tasks[id] = true;
    for (const id of Object.keys(data.sessions)) data.dirty.sessions[id] = true;
    data.dirty.settings = true;
    if (data.settingsUpdatedAt === new Date(0).toISOString()) data.settingsUpdatedAt = new Date(1).toISOString();
    data.cursors = { tasks: null, sessions: null, settings: null };
  }
  data.userId = userId;
  save();
  emit('reset', {});
}

/** Signing out clears this device's copy (it is safe in the cloud). */
export function clearLocal() {
  data = emptyData();
  save();
  emit('reset', {});
}

export function exportAll() {
  return {
    exported_at: nowIso(),
    app: 'bunny-meadow',
    settings: data.settings,
    tasks: Object.values(data.tasks),
    sessions: Object.values(data.sessions),
  };
}

export function importAll(obj) {
  if (!obj || obj.app !== 'bunny-meadow') throw new Error('That file is not a Bunny Meadow backup.');
  let n = 0;
  for (const t of obj.tasks || []) {
    if (!t.id || !t.title) continue;
    const local = data.tasks[t.id];
    if (!local || new Date(t.updated_at) > new Date(local.updated_at)) {
      data.tasks[t.id] = t;
      data.dirty.tasks[t.id] = true;
      n++;
    }
  }
  for (const s of obj.sessions || []) {
    if (!s.id || !s.mode) continue;
    const local = data.sessions[s.id];
    if (!local || new Date(s.updated_at) > new Date(local.updated_at)) {
      data.sessions[s.id] = s;
      data.dirty.sessions[s.id] = true;
      n++;
    }
  }
  commit('reset', {});
  return n;
}

export function todayKey() {
  return dayKey(Date.now());
}

// Keep tabs of the same browser in step
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      data = load();
      emit('reset', { crossTab: true });
    }
  });
}
