// Settings: timer, goal, sounds, notifications, appearance, account & sync, data.

import * as store from '../store.js';
import * as sync from '../sync.js';
import * as audio from '../audio.js';
import { icon } from '../art.js';
import { escapeHtml, fmtDuration, debounce } from '../util.js';
import { toast, confirmDialog } from '../ui.js';
import { openGoalEditor } from './goal.js';

const THEMES = [
  { id: 'meadow', name: 'Sunny Meadow', sky: '#cfe6f3', sun: '#ffe7a3', hill: '#9fc78e' },
  { id: 'golden', name: 'Golden Hour', sky: '#f6d8b8', sun: '#ffd38c', hill: '#b0c88a' },
  { id: 'blossom', name: 'Spring Blossom', sky: '#e6dcf0', sun: '#fff0bd', hill: '#aed0a0' },
  { id: 'moonlit', name: 'Moonlit Meadow', sky: '#2c3b5f', sun: '#f4f0dc', hill: '#2f4a3f' },
];

const LIMITS = { focusMin: [1, 120], shortMin: [1, 60], longMin: [1, 90], longEvery: [1, 12] };

function stepper(key, value, label) {
  return `<div class="stepper" data-stepper="${key}">
    <button type="button" data-d="-1" aria-label="Decrease ${label}">−</button>
    <input type="number" inputmode="numeric" value="${value}" min="${LIMITS[key][0]}" max="${LIMITS[key][1]}" aria-label="${label}">
    <button type="button" data-d="1" aria-label="Increase ${label}">+</button></div>`;
}

function toggle(key, checked, label) {
  return `<label class="switch"><input type="checkbox" data-toggle="${key}" ${checked ? 'checked' : ''} aria-label="${label}"><span></span></label>`;
}

export function render(main, ctx) {
  const s = store.getSettings();
  main.innerHTML = `<div class="view-enter">
    <div class="page-head"><div><h1>Settings</h1><p>Make the meadow yours. Changes save automatically${sync.getUser() ? ' and sync to your other devices' : ''}.</p></div></div>
    <div class="settings-grid">
      <div style="display:flex;flex-direction:column;gap:20px">
        <section class="panel" aria-labelledby="h-timer">
          <div class="panel-title"><h2 id="h-timer">Timer</h2></div>
          <div class="set-row"><div><div class="lbl">Focus session</div><div class="hint">minutes</div></div>${stepper('focusMin', s.focusMin, 'Focus minutes')}</div>
          <div class="set-row"><div><div class="lbl">Short break</div><div class="hint">minutes</div></div>${stepper('shortMin', s.shortMin, 'Short break minutes')}</div>
          <div class="set-row"><div><div class="lbl">Long break</div><div class="hint">minutes</div></div>${stepper('longMin', s.longMin, 'Long break minutes')}</div>
          <div class="set-row"><div><div class="lbl">Sessions before a long break</div></div>${stepper('longEvery', s.longEvery, 'Sessions before long break')}</div>
          <div class="set-row"><div><div class="lbl">Start breaks automatically</div><div class="hint">When a focus session ends, the break begins on its own.</div></div>${toggle('autoBreaks', s.autoBreaks, 'Start breaks automatically')}</div>
          <div class="set-row"><div><div class="lbl">Start focus automatically</div><div class="hint">When a break ends, the next focus session begins on its own.</div></div>${toggle('autoFocus', s.autoFocus, 'Start focus automatically')}</div>
          <div class="set-row"><div><div class="lbl">Count unfinished sessions</div><div class="hint">Also count focus time from sessions you skipped or reset (after at least a minute).</div></div>${toggle('countPartial', s.countPartial, 'Count unfinished sessions')}</div>
          <div class="row" style="margin-top:10px"><button class="btn btn-sm btn-ghost" data-defaults>${icon('reset')} Restore 25 / 5 / 15 / 4</button></div>
        </section>

        <section class="panel" aria-labelledby="h-goal">
          <div class="panel-title"><h2 id="h-goal">Daily study goal</h2><button class="btn btn-sm" data-goal>${icon('edit')} Change</button></div>
          <p class="muted">Currently <b style="color:var(--ink)" data-goal-val>${fmtDuration(s.goalMin * 60)}</b> of focused study a day. Your goal flower grows as you get closer.</p>
        </section>

        <section class="panel" aria-labelledby="h-sound">
          <div class="panel-title"><h2 id="h-sound">Sounds</h2></div>
          <div class="vol-row"><div><div class="lbl" style="font-weight:700">Bell when a pomodoro ends</div></div>
            <input type="range" min="0" max="1" step="0.05" value="${s.bellVol}" data-vol="bellVol" aria-label="Bell volume">
            <div class="row" style="gap:6px"><button class="icon-btn sm" data-test="bell" aria-label="Play bell">${icon('bell')}</button>${toggle('bellOn', s.bellOn, 'Bell on')}</div></div>
          <div class="vol-row"><div><div class="lbl" style="font-weight:700">Chime when a break ends</div></div>
            <input type="range" min="0" max="1" step="0.05" value="${s.chimeVol}" data-vol="chimeVol" aria-label="Chime volume">
            <div class="row" style="gap:6px"><button class="icon-btn sm" data-test="chime" aria-label="Play chime">${icon('bell')}</button>${toggle('chimeOn', s.chimeOn, 'Chime on')}</div></div>
          <h3 style="font-size:1rem;margin:18px 0 4px">Meadow ambience</h3>
          <p class="hint muted" style="font-size:.85rem">Gentle birdsong and breeze. Only plays when you press play.</p>
          <div class="vol-row"><div class="lbl" style="font-weight:700">${icon('bird', 'width="17" height="17" style="vertical-align:-3px"')} Birds</div>
            <input type="range" min="0" max="1" step="0.05" value="${s.birdsVol}" data-vol="birdsVol" aria-label="Birds volume"><span></span></div>
          <div class="vol-row"><div class="lbl" style="font-weight:700">${icon('cloud', 'width="17" height="17" style="vertical-align:-3px"')} Breeze</div>
            <input type="range" min="0" max="1" step="0.05" value="${s.breezeVol}" data-vol="breezeVol" aria-label="Breeze volume"><span></span></div>
          <button class="btn" data-amb style="margin-top:12px"></button>
        </section>
      </div>

      <div style="display:flex;flex-direction:column;gap:20px">
        <section class="panel" aria-labelledby="h-look">
          <div class="panel-title"><h2 id="h-look">Appearance</h2></div>
          <div class="theme-options" role="group" aria-label="Meadow theme">
            ${THEMES.map(
              (t) => `<button class="theme-opt" data-theme-opt="${t.id}" aria-pressed="${s.theme === t.id}">
                <div class="pv" style="background:${t.sky};--s:${t.sun};--h:${t.hill}"><i></i></div><div class="nm">${t.name}${t.id === 'meadow' ? ' <span class="faint">(default)</span>' : ''}</div></button>`
            ).join('')}
          </div>
          <div class="set-row" style="margin-top:8px"><div style="flex:1"><div class="lbl">Scene brightness</div>
            <input type="range" min="-2" max="2" step="1" value="${s.brightness}" data-bright aria-label="Scene brightness" style="margin-top:6px"></div></div>
          <div class="set-row"><div><div class="lbl">Reduce motion</div><div class="hint">Pause the hopping, drifting and swaying.</div></div>${toggle('reduceMotion', s.reduceMotion, 'Reduce motion')}</div>
          <label class="field" style="margin:12px 0 0"><span>Your name (for greetings)</span>
            <input class="input" data-name maxlength="40" placeholder="little bunny" value="${escapeHtml(s.name)}"></label>
        </section>

        <section class="panel" aria-labelledby="h-notif">
          <div class="panel-title"><h2 id="h-notif">Notifications</h2></div>
          <div class="set-row"><div><div class="lbl">Notify me when a session ends</div><div class="hint" data-notif-hint></div></div>${toggle('notifications', s.notifications, 'Browser notifications')}</div>
        </section>

        <section class="panel" aria-labelledby="h-acc" data-account></section>

        <section class="panel" aria-labelledby="h-data">
          <div class="panel-title"><h2 id="h-data">Your data</h2></div>
          <p class="muted" style="font-size:.9rem;margin-bottom:12px">Download a backup of everything (tasks, sessions, settings) or restore one.</p>
          <div class="row wrap"><button class="btn" data-export>${icon('download')} Export backup</button>
            <label class="btn" style="cursor:pointer">${icon('upload')} Import backup<input type="file" accept="application/json,.json" data-import hidden></label></div>
        </section>
      </div>
    </div></div>`;

  const q = (sel) => main.querySelector(sel);

  // --- steppers
  main.querySelectorAll('[data-stepper]').forEach((el) => {
    const key = el.dataset.stepper;
    const input = el.querySelector('input');
    const [lo, hi] = LIMITS[key];
    const commit = (v) => {
      const n = Math.max(lo, Math.min(hi, Math.round(Number(v) || lo)));
      input.value = n;
      if (store.getSettings()[key] !== n) store.updateSettings({ [key]: n });
    };
    el.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => commit(Number(input.value) + Number(b.dataset.d))));
    input.addEventListener('change', () => commit(input.value));
  });

  // --- toggles
  main.querySelectorAll('[data-toggle]').forEach((el) =>
    el.addEventListener('change', async () => {
      const key = el.dataset.toggle;
      if (key === 'notifications' && el.checked) {
        const ok = await requestNotifications();
        if (!ok) {
          el.checked = false;
          paintNotif();
          return;
        }
      }
      store.updateSettings({ [key]: el.checked });
      if (key === 'reduceMotion') ctx.applyAppearance();
      paintNotif();
    })
  );

  q('[data-defaults]').addEventListener('click', () => {
    store.updateSettings({ focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4 });
    main.querySelectorAll('[data-stepper]').forEach((el) => (el.querySelector('input').value = store.getSettings()[el.dataset.stepper]));
    toast('Timer lengths restored', { icon: 'check' });
  });
  q('[data-goal]').addEventListener('click', openGoalEditor);

  // --- sounds
  const saveVol = debounce((key, v) => store.updateSettings({ [key]: v }), 250);
  main.querySelectorAll('[data-vol]').forEach((el) =>
    el.addEventListener('input', () => {
      const v = Number(el.value);
      saveVol(el.dataset.vol, v);
      if (el.dataset.vol === 'birdsVol' || el.dataset.vol === 'breezeVol') {
        const cur = { ...store.getSettings(), [el.dataset.vol]: v };
        audio.setAmbienceVolumes(cur.birdsVol, cur.breezeVol);
      }
    })
  );
  main.querySelectorAll('[data-test]').forEach((b) =>
    b.addEventListener('click', () => {
      const st = store.getSettings();
      const vol = Number(main.querySelector(`[data-vol="${b.dataset.test}Vol"]`).value);
      if (b.dataset.test === 'bell') audio.playBell(vol || st.bellVol);
      else audio.playChime(vol || st.chimeVol);
    })
  );
  function paintAmb() {
    const on = audio.ambiencePlaying();
    q('[data-amb]').innerHTML = on ? `${icon('pause')} Stop ambience` : `${icon('play')} Play ambience`;
    q('[data-amb]').setAttribute('aria-pressed', on);
  }
  q('[data-amb]').addEventListener('click', () => {
    if (audio.ambiencePlaying()) audio.stopAmbience();
    else {
      const st = store.getSettings();
      audio.startAmbience(st.birdsVol, st.breezeVol);
    }
    paintAmb();
    ctx.onAmbience && ctx.onAmbience();
  });
  paintAmb();

  // --- appearance
  main.querySelectorAll('[data-theme-opt]').forEach((b) =>
    b.addEventListener('click', () => {
      store.updateSettings({ theme: b.dataset.themeOpt });
      main.querySelectorAll('[data-theme-opt]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      ctx.applyAppearance();
    })
  );
  q('[data-bright]').addEventListener('input', (e) => {
    store.updateSettings({ brightness: Number(e.target.value) });
    ctx.applyAppearance();
  });
  q('[data-name]').addEventListener(
    'input',
    debounce((e) => store.updateSettings({ name: e.target.value.trim().slice(0, 40) }), 400)
  );

  // --- notifications
  async function requestNotifications() {
    if (typeof Notification === 'undefined') {
      toast('This browser does not support notifications.', { icon: 'bell' });
      return false;
    }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') {
      toast('Notifications are blocked – allow them in your browser’s site settings.', { icon: 'bell', timeout: 6000 });
      return false;
    }
    const p = await Notification.requestPermission();
    return p === 'granted';
  }
  function paintNotif() {
    const hint = q('[data-notif-hint]');
    if (typeof Notification === 'undefined') hint.textContent = 'Not supported in this browser. On iPhone, add the app to your Home Screen first.';
    else if (Notification.permission === 'denied') hint.textContent = 'Blocked in your browser settings.';
    else if (store.getSettings().notifications && Notification.permission === 'granted') hint.textContent = 'On – you’ll get a gentle notice when the app is in the background.';
    else hint.textContent = 'A gentle notice when a focus session or break finishes.';
  }
  paintNotif();

  // --- account
  function paintAccount() {
    const cfg = sync.getConfig();
    const user = sync.getUser();
    const st = sync.getStatus();
    const el = q('[data-account]');
    const statusText = {
      synced: `Synced${st.lastSyncedAt ? ' at ' + new Date(st.lastSyncedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''}`,
      syncing: 'Syncing…',
      offline: 'Offline – changes are saved on this device and will sync when you reconnect',
      error: 'Sync problem: ' + (st.lastError || 'unknown error'),
      local: 'Saved on this device only',
      idle: 'Waiting to sync',
    }[st.status];
    if (user) {
      el.innerHTML = `<div class="panel-title"><h2 id="h-acc">Account & sync</h2><span class="sync-badge" data-s="${st.status}"><i></i>${st.status === 'synced' ? 'Synced' : st.status}</span></div>
        <p style="font-weight:700">${icon('user', 'width="17" height="17" style="vertical-align:-3px"')} ${escapeHtml(user.email || '')}</p>
        <p class="muted" style="font-size:.88rem;margin:6px 0 14px">${escapeHtml(statusText)}</p>
        <div class="row wrap"><button class="btn" data-sync>${icon('sync')} Sync now</button><button class="btn btn-ghost" data-signout>Sign out</button></div>`;
      q('[data-sync]').onclick = () => sync.syncNow();
      q('[data-signout]').onclick = async () => {
        const ok = await confirmDialog({
          title: 'Sign out?',
          message: 'Your data stays safe in your account. This device’s copy will be cleared until you sign in again.',
          confirm: 'Sign out',
        });
        if (ok) {
          await sync.signOut();
          ctx.goAuth();
        }
      };
    } else if (cfg) {
      el.innerHTML = `<div class="panel-title"><h2 id="h-acc">Account & sync</h2><span class="sync-badge" data-s="local"><i></i>This device only</span></div>
        <p class="muted" style="font-size:.9rem;margin-bottom:14px">Sign in to keep your laptop and phone in sync. Everything you’ve done here so far will be added to your account.</p>
        <button class="btn btn-primary" data-signin>${icon('user')} Sign in or create account</button>
        <details style="margin-top:14px"><summary class="faint" style="cursor:pointer;font-size:.85rem">Server settings</summary>${configForm(cfg)}</details>`;
      q('[data-signin]').onclick = () => ctx.goAuth();
      bindConfigForm();
    } else {
      el.innerHTML = `<div class="panel-title"><h2 id="h-acc">Account & sync</h2><span class="sync-badge" data-s="local"><i></i>This device only</span></div>
        <p class="note">Your study data is saved on this device. To sync between your laptop and phone, connect a free Supabase project (see the README for the 5-minute setup) and paste its details here – or put them in <code>config.js</code> when you deploy.</p>
        ${configForm(null)}`;
      bindConfigForm();
    }
  }
  function configForm(cfg) {
    return `<form data-cfg style="margin-top:14px">
      <label class="field"><span>Supabase project URL</span><input class="input" name="url" placeholder="https://abcd1234.supabase.co" value="${escapeHtml(cfg?.url || '')}" autocomplete="off"></label>
      <label class="field"><span>Supabase anon (public) key</span><input class="input" name="key" placeholder="eyJhbGciOi…" value="${escapeHtml(cfg?.anonKey || '')}" autocomplete="off"></label>
      <div class="row wrap"><button class="btn btn-primary btn-sm" type="submit">Save</button>${cfg && cfg.source === 'settings' ? '<button class="btn btn-sm btn-ghost" type="button" data-cfg-clear>Remove</button>' : ''}</div>
    </form>`;
  }
  function bindConfigForm() {
    const f = q('[data-cfg]');
    if (!f) return;
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        if (!f.url.value.trim() || !f.key.value.trim()) throw new Error('Please fill in both fields.');
        sync.saveConfig(f.url.value, f.key.value);
        toast('Sync server saved', { icon: 'check' });
        ctx.goAuth();
      } catch (err) {
        toast(err.message, { icon: 'close' });
      }
    });
    q('[data-cfg-clear]')?.addEventListener('click', () => {
      sync.saveConfig(null);
      paintAccount();
    });
  }
  paintAccount();
  const unsubSync = sync.onStatus(() => {
    if (q('[data-account]')) paintAccount();
  });

  // --- data
  q('[data-export]').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(store.exportAll(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bunny-meadow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  q('[data-import]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const n = store.importAll(JSON.parse(await file.text()));
      toast(`Restored ${n} item${n === 1 ? '' : 's'} from backup`, { icon: 'check' });
    } catch (err) {
      toast(err.message || 'Could not read that file.', { icon: 'close' });
    }
    e.target.value = '';
  });

  return {
    refresh(topic, detail) {
      // Don't redraw under the person's fingers – only redraw for changes from other devices.
      if ((topic === 'settings' && detail && detail.remote) || topic === 'reset') return 'remount';
      if (topic === 'settings') q('[data-goal-val]') && (q('[data-goal-val]').textContent = fmtDuration(store.getSettings().goalMin * 60));
    },
    destroy() {
      unsubSync();
    },
  };
}
