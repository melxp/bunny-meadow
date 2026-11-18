// Bunny Meadow – app bootstrap, routing and shell.

import * as store from './store.js';
import * as sync from './sync.js';
import * as timer from './timer.js';
import * as S from './stats.js';
import { mountScene, updateScene, setSceneTheme } from './scene.js';
import { unlockAudio } from './audio.js';
import { icon, logo } from './art.js';
import { celebrate, toast, isModalOpen } from './ui.js';
import { GOAL_REACHED } from './messages.js';
import { dayKey, pickRandom } from './util.js';
import { renderAuth } from './views/auth.js';
import * as Home from './views/home.js';
import * as Tasks from './views/tasks.js';
import * as Stats from './views/stats.js';
import * as Calendar from './views/calendar.js';
import * as Settings from './views/settings.js';

const ROUTES = {
  home: { view: Home, label: 'Home', icon: 'home', title: 'Home' },
  tasks: { view: Tasks, label: 'Tasks', icon: 'tasks', title: 'Tasks' },
  stats: { view: Stats, label: 'Stats', icon: 'stats', title: 'Statistics' },
  calendar: { view: Calendar, label: 'Calendar', icon: 'calendar', title: 'Calendar' },
  prefs: { view: Settings, label: 'Settings', icon: 'settings', title: 'Settings' },
};

const appRoot = document.getElementById('app');
let current = null; // { name, ctrl }
let shellMounted = false;
let lastDay = dayKey();

// ---------- appearance ----------
function applyAppearance() {
  const s = store.getSettings();
  const root = document.documentElement;
  root.dataset.theme = s.theme || 'meadow';
  root.dataset.motion = s.reduceMotion ? 'reduced' : 'full';
  const b = Number(s.brightness) || 0;
  root.style.setProperty('--scene-filter', b === 0 ? 'none' : `brightness(${1 + b * 0.07}) saturate(${1 + b * 0.04})`);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = s.theme === 'moonlit' ? '#1e2a48' : s.theme === 'golden' ? '#f2c9a4' : s.theme === 'blossom' ? '#d4d5ef' : '#b7d9ef';
  setSceneTheme(s.theme);
}

// ---------- shell ----------
function routeName() {
  let h = location.hash.replace(/^#\/?/, '').split('?')[0];
  if (h === 'settings') h = 'prefs';
  return ROUTES[h] ? h : 'home';
}

function mountShell() {
  appRoot.innerHTML = `<div class="app">
    <nav class="nav" aria-label="Main">
      <div class="nav-inner">
        <a class="nav-logo" href="#home" aria-label="Bunny Meadow home">${logo(48)}</a>
        ${Object.entries(ROUTES)
          .map(([k, r]) => `<a href="#${k}" data-route="${k}">${icon(r.icon)}<span>${r.label}</span></a>`)
          .join('')}
      </div>
      <div class="nav-sync" data-nav-sync></div>
    </nav>
    <main class="main" id="main" tabindex="-1"></main>
  </div>`;
  shellMounted = true;
  paintSyncBadge(sync.getStatus());
}

function paintSyncBadge(st) {
  const el = document.querySelector('[data-nav-sync]');
  if (!el) return;
  if (!sync.getUser()) {
    el.innerHTML = '';
    return;
  }
  const label = { synced: 'Synced', syncing: 'Syncing', offline: 'Offline', error: 'Sync issue', local: 'Local', idle: '' }[st.status] || '';
  el.innerHTML = `<a href="#prefs" class="sync-badge" data-s="${st.status}" title="${st.lastError ? st.lastError : label}" style="text-decoration:none"><i></i>${label}</a>`;
}

function navigate() {
  if (!shellMounted) return;
  const name = routeName();
  const main = document.getElementById('main');
  if (current?.ctrl?.destroy) current.ctrl.destroy();
  document.querySelectorAll('[data-route]').forEach((a) => {
    if (a.dataset.route === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const ctrl = ROUTES[name].view.render(main, viewCtx);
  current = { name, ctrl };
  window.scrollTo({ top: 0 });
}

const viewCtx = {
  applyAppearance,
  goAuth: () => showAuth(),
};

function refreshView(topic, detail) {
  if (!current?.ctrl?.refresh) return;
  const r = current.ctrl.refresh(topic, detail);
  if (r === 'remount') navigate();
}

// ---------- celebration ----------
function checkGoal() {
  const s = store.getSettings();
  const key = dayKey();
  const flag = 'bm:celebrated:' + key;
  if (localStorage.getItem(flag)) return;
  const d = S.byDay(store.listSessions(), { countPartial: s.countPartial }).get(key);
  if (d && d.seconds >= s.goalMin * 60) {
    localStorage.setItem(flag, '1');
    celebrate(pickRandom(GOAL_REACHED), 'Take a moment to feel proud of yourself.', s.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
}

// ---------- auth ----------
function showAuth(opts = {}) {
  if (current?.ctrl?.destroy) current.ctrl.destroy();
  current = null;
  shellMounted = false;
  if (!sync.isConfigured()) {
    startApp();
    return;
  }
  renderAuth(appRoot, {
    ...opts,
    onDone: () => {
      startApp();
      if (sync.getUser()) toast('Signed in – your meadow is syncing', { icon: 'cloud' });
    },
  });
}

function startApp() {
  mountShell();
  navigate();
  sync.startAutoSync();
  if (sync.getUser()) sync.syncNow();
}

// ---------- boot ----------
async function boot() {
  applyAppearance();
  mountScene(document.getElementById('scene'), store.getSettings().theme);
  timer.init();

  // first interaction unlocks audio (browsers block sound until then)
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  store.subscribe((topic, detail) => {
    if (topic === 'settings') applyAppearance();
    if (topic === 'error') toast(detail.message, { icon: 'close', timeout: 7000 });
    if (['tasks', 'sessions', 'settings', 'reset'].includes(topic)) refreshView(topic, detail);
    if (topic === 'sessions') checkGoal();
  });
  timer.subscribe((type, detail) => {
    if (type === 'complete') {
      if (current?.name !== 'home') toast(detail.message);
    }
  });
  sync.onStatus(paintSyncBadge);

  // keep the scene's sun/bunny moving with the clock; refresh views at midnight
  setInterval(() => {
    updateScene();
    const k = dayKey();
    if (k !== lastDay) {
      lastDay = k;
      if (!isModalOpen()) navigate();
    }
  }, 60_000);

  window.addEventListener('hashchange', navigate);

  const linkType = await sync.handleAuthRedirect();
  if (linkType === 'recovery') {
    showAuth({ recovery: true });
  } else if (sync.isConfigured() && !sync.getUser() && !sync.isGuest()) {
    showAuth();
  } else {
    startApp();
  }

  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.add('hide');
    setTimeout(() => loader.remove(), 700);
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !window.BUNNY_MEADOW_CONFIG?.disableServiceWorker) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.info('Service worker not registered:', e.message));
  }
}

boot().catch((e) => {
  console.error(e);
  const loader = document.getElementById('loader');
  if (loader) loader.querySelector('p').textContent = 'Something went wrong while loading. Please refresh.';
});
