// Timer controller: wraps the pure engine with persistence, ticking, sounds,
// notifications and session recording.

import * as E from './timer-engine.js';
import * as store from './store.js';
import { playBell, playChime } from './audio.js';
import { FOCUS_DONE, BREAK_DONE } from './messages.js';
import { pickRandom, fmtClock } from './util.js';

const KEY = 'bm:timer:v1';
const listeners = new Set();
let state = null;
let tickHandle = null;
let wakeHandle = null;
let lastMessage = '';

function load() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (t && E.MODES.includes(t.mode)) return t;
  } catch {}
  return E.createTimer(store.getSettings());
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

function emit(type, detail) {
  for (const fn of listeners) fn(type, detail);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function get() {
  return state;
}

export function remainingMs() {
  return E.remaining(state, Date.now());
}

export function progress() {
  return state.durationMs ? 1 - E.remaining(state, Date.now()) / state.durationMs : 0;
}

export function lastCompletionMessage() {
  return lastMessage;
}

function commit(next, records = []) {
  state = next;
  persist();
  if (records.length) store.addSessions(records);
  scheduleWake();
  emit('state', state);
}

/** Replays anything that finished while the page was asleep. */
export function process(now = Date.now()) {
  if (!state) return;
  if (state.status !== 'running' || state.endsAt > now) return;
  const settings = store.getSettings();
  const { timer, records, events } = E.advance(state, settings, now, store.tasksById());
  commit(timer, records);
  if (events.length) onCompleted(events, now);
}

function onCompleted(events, now) {
  const settings = store.getSettings();
  const last = events[events.length - 1];
  const stale = now - last.at > 90_000; // finished a while ago (device was asleep)
  const focusDone = events.some((e) => e.mode === 'focus');
  if (last.mode === 'focus') {
    lastMessage = pickRandom(FOCUS_DONE);
    if (settings.bellOn && !stale) playBell(settings.bellVol);
  } else {
    lastMessage = pickRandom(BREAK_DONE);
    if (settings.chimeOn && !stale) playChime(settings.chimeVol);
  }
  const title = last.mode === 'focus' ? 'Pomodoro complete' : 'Break finished';
  const body =
    last.mode === 'focus'
      ? last.autoStarted
        ? `${lastMessage} Your ${last.next === 'long' ? 'long' : 'short'} break has started.`
        : `${lastMessage} Start your break when you’re ready.`
      : last.autoStarted
      ? 'Back to focus – your next session has started.'
      : 'Ready for the next pomodoro?';
  notify(title, body);
  emit('complete', { events, message: lastMessage, focusDone });
}

async function notify(title, body) {
  const s = store.getSettings();
  if (!s.notifications || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return; // the in-app message is enough
  const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'bunny-meadow-timer', renotify: true, silent: false };
  try {
    const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch (e) {
    try {
      new Notification(title, opts);
    } catch {}
  }
}

function scheduleWake() {
  clearTimeout(wakeHandle);
  if (state.status === 'running') {
    // precise wake-up at the end (tick also covers it; background tabs may delay this)
    wakeHandle = setTimeout(() => process(), Math.max(0, state.endsAt - Date.now()) + 30);
  }
}

function tick() {
  process();
  emit('tick', state);
  updateTitle();
}

let baseTitle = 'Bunny Meadow';
function updateTitle() {
  if (state.status === 'idle') {
    document.title = baseTitle;
    return;
  }
  const label = state.mode === 'focus' ? 'Focus' : state.mode === 'short' ? 'Short break' : 'Long break';
  document.title = `${fmtClock(remainingMs())} · ${label}${state.status === 'paused' ? ' (paused)' : ''}`;
}

export function init() {
  state = load();
  // settings may have changed on another device while idle
  state = E.applySettings(state, store.getSettings());
  process();
  persist();
  clearInterval(tickHandle);
  tickHandle = setInterval(tick, 250);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });
  window.addEventListener('focus', tick);
  window.addEventListener('pageshow', tick);
  scheduleWake();
  store.subscribe((topic) => {
    if (topic === 'settings') {
      const next = E.applySettings(state, store.getSettings());
      if (next !== state) commit(next);
    }
    if (topic === 'reset') {
      // signed out / switched account: keep the timer but drop a task that no longer exists
      if (state.taskId && !store.getTask(state.taskId)) commit(E.setTask(state, null));
    }
  });
  // Another tab changed the timer
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && e.newValue) {
      state = JSON.parse(e.newValue);
      scheduleWake();
      emit('state', state);
    }
  });
}

// ---------- actions ----------
export function toggle() {
  const now = Date.now();
  if (state.status === 'running') commit(E.pause(state, now));
  else commit(E.start(state, now));
}

export function reset() {
  const r = E.reset(state, store.getSettings(), Date.now(), store.tasksById());
  commit(r.timer, r.records);
  return r.records;
}

export function skip() {
  const r = E.skip(state, store.getSettings(), Date.now(), store.tasksById());
  commit(r.timer, r.records);
  emit('mode', state.mode);
  return r.records;
}

export function switchMode(mode) {
  if (mode === state.mode && state.status === 'idle') return [];
  const r = E.switchMode(state, mode, store.getSettings(), Date.now(), store.tasksById());
  commit(r.timer, r.records);
  emit('mode', state.mode);
  return r.records;
}

export function setTask(taskId, label = '') {
  commit(E.setTask(state, taskId, label));
}

export function focusElapsedMs() {
  return state.mode === 'focus' ? E.elapsed(state, Date.now()) : 0;
}
