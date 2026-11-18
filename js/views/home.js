// Home: greeting, clock, Pomodoro timer, today's progress, goal flower, to-do preview.

import * as store from '../store.js';
import * as timer from '../timer.js';
import * as S from '../stats.js';
import { icon, bunnySit, flowerGlyph, growingFlower } from '../art.js';
import { greeting, DAILY, NO_TASKS, ALL_DONE } from '../messages.js';
import { escapeHtml, fmtClock, fmtDuration, pickDaily, dayKey, pad } from '../util.js';
import { confirmDialog, openModal, toast } from '../ui.js';
import { taskItem, bindTaskList, sortTasks, openTaskPicker, openTaskEditor } from './task-ui.js';
import { openGoalEditor } from './goal.js';

const R = 88;
const CIRC = 2 * Math.PI * R;
const MODE_LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' };

function todayData() {
  const s = store.getSettings();
  const days = S.byDay(store.listSessions(), { countPartial: s.countPartial });
  const key = dayKey();
  const today = days.get(key) || S.emptyDay();
  const streak = S.streaks(days, key);
  const tasksDone = S.tasksCompletedOn(store.listTasks(), key).length;
  return { s, days, key, today, streak, tasksDone };
}

function sessionLine(t, s, today) {
  if (t.mode === 'focus') {
    return `Session ${Math.min(t.cycleCount + 1, s.longEvery)} of ${s.longEvery} · Pomodoro #${today.pomodoros + 1} today`;
  }
  if (t.mode === 'short') return 'Stretch, sip some water, look outside';
  return 'A proper rest – you’ve earned it';
}

function taskPillText(t) {
  if (t.taskId) {
    const task = store.getTask(t.taskId);
    if (task) return { label: 'Studying', text: task.subject ? `${task.subject} – ${task.title}` : task.title };
  }
  if (t.label) return { label: 'Studying', text: t.label };
  return { label: 'Studying', text: 'Choose a task (optional)' };
}

export function render(main) {
  const t = timer.get();
  const d = todayData();
  main.innerHTML = `<div class="home view-enter">
    <section class="panel hello a-hello" aria-label="Today">
      <div>
        <p class="eyebrow" data-date></p>
        <h1 data-greet></h1>
      </div>
      <div class="clock" data-clock aria-live="off"></div>
      <p class="motto">${escapeHtml(pickDaily(DAILY, d.key))}</p>
    </section>

    <section class="panel timer-card a-timer" data-mode="${t.mode}" aria-label="Pomodoro timer">
      <div class="segmented" role="group" aria-label="Timer mode">
        ${['focus', 'short', 'long'].map((m) => `<button data-mode-btn="${m}" aria-pressed="${t.mode === m}">${MODE_LABEL[m]}</button>`).join('')}
      </div>
      <div class="ring-wrap">
        <svg class="ring" viewBox="0 0 200 200" aria-hidden="true">
          <g class="dots">${Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return `<circle cx="${100 + Math.cos(a) * 99}" cy="${100 + Math.sin(a) * 99}" r="1.2"/>`;
          }).join('')}</g>
          <circle class="track" cx="100" cy="100" r="${R}" fill="none" stroke-width="9"/>
          <circle class="progress" cx="100" cy="100" r="${R}" fill="none" stroke-width="9" stroke-linecap="round"
            stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"/>
        </svg>
        <div class="ring-inner">
          <div class="ring-mode" data-mode-label></div>
          <div class="ring-time" data-time role="timer" aria-live="off"></div>
          <div class="ring-sub" data-sub></div>
        </div>
        <div class="timer-bunny" data-bunny></div>
      </div>
      <div class="timer-controls">
        <button class="icon-btn" data-reset aria-label="Reset timer" title="Reset">${icon('reset')}</button>
        <button class="play-btn" data-toggle aria-label="Start"></button>
        <button class="icon-btn" data-skip aria-label="Skip to next session" title="Skip">${icon('skip')}</button>
      </div>
      <button class="task-pill" data-pick>
        <span class="dot">${icon('book')}</span>
        <span style="min-width:0"><span class="t1" data-pill-label></span><br><span class="t2" data-pill-text></span></span>
        <span class="chev">${icon('chevDown', 'width="18" height="18"')}</span>
      </button>
      <p class="complete-msg" data-msg aria-live="polite"></p>
    </section>

    <section class="panel a-today" aria-label="Today's progress" data-today></section>
    <section class="panel a-goal" aria-label="Daily goal" data-goal></section>
    <section class="panel a-todo" aria-label="To-do" data-todo></section>
  </div>`;

  const q = (sel) => main.querySelector(sel);
  const card = q('.timer-card');
  let lastMode = t.mode;

  function paintClock() {
    const now = new Date();
    q('[data-greet]').textContent = greeting(now, store.getSettings().name);
    q('[data-date]').textContent = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    q('[data-clock]').innerHTML = `${pad(now.getHours())}:${pad(now.getMinutes())}<small>${pad(now.getSeconds())}</small>`;
  }

  function paintTimer() {
    const t = timer.get();
    const s = store.getSettings();
    const rem = timer.remainingMs();
    const prog = Math.min(1, Math.max(0, timer.progress()));
    q('.progress').style.strokeDashoffset = String(CIRC * (1 - prog));
    q('[data-time]').textContent = fmtClock(rem);
    q('[data-time]').setAttribute('aria-label', `${Math.ceil(rem / 60000)} minutes remaining`);
    q('[data-mode-label]').textContent = MODE_LABEL[t.mode] + (t.status === 'paused' ? ' · paused' : '');
    const btn = q('[data-toggle]');
    const running = t.status === 'running';
    if (btn.dataset.running !== String(running)) {
      btn.dataset.running = String(running);
      btn.innerHTML = icon(running ? 'pause' : 'play');
      btn.setAttribute('aria-label', running ? 'Pause' : t.status === 'paused' ? 'Resume' : 'Start');
    }
    if (card.dataset.mode !== t.mode) card.dataset.mode = t.mode;
    main.querySelectorAll('[data-mode-btn]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.modeBtn === t.mode));
    if (lastMode !== t.mode) {
      lastMode = t.mode;
      const ring = q('.ring-wrap');
      ring.classList.remove('mode-anim');
      void ring.offsetWidth;
      ring.classList.add('mode-anim');
    }
    const bunnyState = t.status === 'running' ? (t.mode === 'focus' ? 'study' : 'rest') : 'awake';
    const b = q('[data-bunny]');
    if (b.dataset.state !== bunnyState) {
      b.dataset.state = bunnyState;
      b.innerHTML = bunnySit('white', bunnyState);
    }
    q('[data-sub]').textContent = sessionLine(t, s, { pomodoros: todayPomos });
    const pill = taskPillText(t);
    q('[data-pill-label]').textContent = pill.label;
    q('[data-pill-text]').textContent = pill.text;
  }

  let todayPomos = d.today.pomodoros;
  function paintToday() {
    const d = todayData();
    todayPomos = d.today.pomodoros;
    const dots = [];
    const shown = Math.max(d.s.longEvery, d.today.pomodoros);
    for (let i = 0; i < Math.min(shown, 16); i++) {
      dots.push(`<span class="${i < d.today.pomodoros ? '' : 'empty'}" title="${i < d.today.pomodoros ? 'Completed pomodoro' : ''}">${flowerGlyph(i < d.today.pomodoros ? '#f2c6cf' : '#c9d6c2', i < d.today.pomodoros ? '#f6d77a' : '#e3e8dc')}</span>`);
    }
    const more = d.today.pomodoros > 16 ? `<span class="muted" style="align-self:center;font-weight:700">+${d.today.pomodoros - 16}</span>` : '';
    q('[data-today]').innerHTML = `
      <div class="panel-title"><h2>Today</h2><a href="#stats" class="btn btn-sm btn-ghost">Stats ${icon('chevRight', 'width="15" height="15"')}</a></div>
      <div class="stat-row">
        <div class="stat"><div class="v">${fmtDuration(d.today.seconds)}</div><div class="l">Study time</div></div>
        <div class="stat"><div class="v">${d.today.pomodoros}</div><div class="l">Pomodoros</div></div>
        <div class="stat"><div class="v">${d.tasksDone}</div><div class="l">Tasks done</div></div>
        <div class="stat"><div class="v">${d.today.breaks}</div><div class="l">Breaks taken</div></div>
      </div>
      <div class="pomo-dots" aria-label="${d.today.pomodoros} pomodoros completed today">${dots.join('')}${more}</div>
      <div class="streak">${icon('flame', 'style="color:var(--butter-deep)"')}
        <span>${
          d.streak.current
            ? `${d.streak.current}-day study streak${d.streak.studiedToday ? '' : ' – study today to keep it going!'}`
            : 'Start a streak today – one pomodoro is enough.'
        }</span></div>`;
  }

  function paintGoal() {
    const d = todayData();
    const goal = d.s.goalMin * 60;
    const p = goal ? d.today.seconds / goal : 0;
    const pct = Math.min(100, Math.round(p * 100));
    const left = Math.max(0, goal - d.today.seconds);
    q('[data-goal]').innerHTML = `
      <div class="panel-title"><h2>Daily goal</h2><button class="btn btn-sm btn-ghost" data-edit-goal>${icon('edit')} Edit</button></div>
      <div class="goal-wrap">
        <div class="goal-flower">${growingFlower(p)}</div>
        <div>
          <div class="goal-num">${fmtDuration(d.today.seconds)} <small>of ${fmtDuration(goal)}</small></div>
          <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Daily goal progress"><div style="width:${pct}%"></div></div>
          <p class="muted" style="font-size:.9rem">${
            p >= 1 ? 'Goal reached – your flower is in full bloom!' : p > 0 ? `${fmtDuration(left)} to go. Your flower is ${pct < 50 ? 'sprouting' : 'budding'}.` : 'Your seed is planted. Start a pomodoro to help it grow.'
          }</p>
        </div>
      </div>`;
    q('[data-edit-goal]').onclick = openGoalEditor;
  }

  function paintTodo() {
    const refocus = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-quick]');
    const all = store.listTasks();
    const open = sortTasks(all.filter((x) => !x.completed));
    const stats = S.perTask(store.listSessions(), { countPartial: store.getSettings().countPartial });
    const list = open.slice(0, 5);
    q('[data-todo]').innerHTML = `
      <div class="panel-title"><h2>To-do</h2><a href="#tasks" class="btn btn-sm btn-ghost">All tasks ${icon('chevRight', 'width="15" height="15"')}</a></div>
      <form class="quick-add" data-quick>
        <input class="input" name="title" maxlength="300" placeholder="Add a task…" aria-label="New task title">
        <button class="icon-btn" type="submit" aria-label="Add task" style="flex:none">${icon('plus')}</button>
      </form>
      ${
        list.length
          ? `<ul class="todo-list">${list.map((x) => taskItem(x, stats, { compact: true })).join('')}</ul>
             ${open.length > 5 ? `<p class="faint" style="margin-top:10px;font-size:.88rem;text-align:center">+ ${open.length - 5} more</p>` : ''}`
          : `<div class="empty-state">${bunnySit('cream', 'awake')}<h3>${all.length ? ALL_DONE : pickDaily(NO_TASKS, dayKey())}</h3></div>`
      }`;
    const es = q('[data-todo] .empty-state svg');
    if (es) es.setAttribute('style', 'width:70px;height:70px');
    if (refocus) q('[data-quick] input').focus();
    q('[data-quick]').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = e.target.title.value.trim();
      if (!title) return;
      store.addTask({ title });
      toast('Task added', { icon: 'check' });
    });
  }

  bindTaskList(q('[data-todo]'));

  async function guardFocus(actionName) {
    const t = timer.get();
    const ms = timer.focusElapsedMs();
    if (t.status === 'idle' || t.mode !== 'focus' || ms < 60_000) return true;
    return confirmDialog({
      title: `${actionName}?`,
      message: `You’ve focused for ${fmtDuration(ms / 1000)} in this session. It will be saved as an unfinished session (it only counts as study time if you allow partial sessions in Settings).`,
      confirm: actionName,
    });
  }

  q('[data-toggle]').addEventListener('click', () => timer.toggle());
  q('[data-reset]').addEventListener('click', async () => {
    if (await guardFocus('Reset')) timer.reset();
  });
  q('[data-skip]').addEventListener('click', async () => {
    if (await guardFocus('Skip')) timer.skip();
  });
  main.querySelectorAll('[data-mode-btn]').forEach((b) =>
    b.addEventListener('click', async () => {
      const m = b.dataset.modeBtn;
      if (m === timer.get().mode) return;
      if (await guardFocus('Switch')) timer.switchMode(m);
    })
  );
  q('[data-pick]').addEventListener('click', openTaskPicker);

  paintClock();
  paintTimer();
  paintToday();
  paintGoal();
  paintTodo();
  q('[data-msg]').textContent = timer.lastCompletionMessage();

  let clockTimer = setInterval(paintClock, 1000);
  const unsubTimer = timer.subscribe((type, detail) => {
    if (type === 'tick' || type === 'state') paintTimer();
    if (type === 'complete') {
      q('[data-msg]').textContent = detail.message;
    }
  });

  return {
    refresh(topic) {
      if (topic === 'tasks' || topic === 'reset') {
        paintTodo();
        paintToday();
        paintTimer();
      }
      if (topic === 'sessions' || topic === 'reset') {
        paintToday();
        paintGoal();
        paintTodo();
      }
      if (topic === 'settings') {
        paintGoal();
        paintToday();
        paintTimer();
        paintClock();
      }
    },
    destroy() {
      clearInterval(clockTimer);
      unsubTimer();
    },
  };
}

export { openTaskEditor };
