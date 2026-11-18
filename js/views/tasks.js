// Tasks & to-do list.

import * as store from '../store.js';
import * as timer from '../timer.js';
import * as S from '../stats.js';
import { icon, bunnySit } from '../art.js';
import { escapeHtml, fmtDuration, pickDaily, dayKey } from '../util.js';
import { NO_TASKS } from '../messages.js';
import { toast } from '../ui.js';
import { taskItem, bindTaskList, sortTasks, openTaskEditor } from './task-ui.js';

const view = { tab: 'open', subject: '', sort: 'priority', query: '' };

function sortBy(list, how) {
  if (how === 'priority') return sortTasks(list);
  if (how === 'due')
    return [...list].sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999') || a.title.localeCompare(b.title));
  if (how === 'newest') return [...list].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  if (how === 'subject') return [...list].sort((a, b) => (a.subject || '~').localeCompare(b.subject || '~') || a.title.localeCompare(b.title));
  return list;
}

export function render(main) {
  main.innerHTML = `<div class="view-enter">
    <div class="page-head">
      <div><h1>Tasks</h1><p>Plan what to study, then send it to the timer.</p></div>
      <button class="btn btn-primary" data-new>${icon('plus')} New task</button>
    </div>
    <div class="tasks-layout">
      <section class="panel" aria-label="Task list">
        <form class="quick-add" data-quick>
          <input class="input" name="title" maxlength="300" placeholder="Quick add – press Enter" aria-label="New task title">
          <button class="btn" type="submit">${icon('plus')} Add</button>
        </form>
        <div class="toolbar">
          <div class="segmented" role="tablist" aria-label="Show">
            <button role="tab" data-tab="open">To do</button>
            <button role="tab" data-tab="done">Completed</button>
          </div>
          <select class="input" data-subject aria-label="Filter by subject"></select>
          <select class="input" data-sort aria-label="Sort">
            <option value="priority">Sort: priority</option>
            <option value="due">Sort: due date</option>
            <option value="subject">Sort: subject</option>
            <option value="newest">Sort: newest</option>
          </select>
          <input class="input grow" type="search" data-search placeholder="Search…" aria-label="Search tasks" style="min-width:120px">
        </div>
        <div data-list></div>
      </section>
      <aside style="display:flex;flex-direction:column;gap:20px">
        <section class="panel" data-current aria-label="Current task"></section>
        <section class="panel" data-subjects aria-label="Subjects"></section>
      </aside>
    </div></div>`;

  const q = (s) => main.querySelector(s);
  q('[data-sort]').value = view.sort;
  q('[data-search]').value = view.query;

  function paintList() {
    const s = store.getSettings();
    const all = store.listTasks();
    const stats = S.perTask(store.listSessions(), { countPartial: s.countPartial });
    const subjects = store.listSubjects();
    const sel = q('[data-subject]');
    sel.innerHTML = `<option value="">All subjects</option>${subjects.map((x) => `<option ${x === view.subject ? 'selected' : ''}>${escapeHtml(x)}</option>`).join('')}<option value="__none" ${view.subject === '__none' ? 'selected' : ''}>No subject</option>`;
    main.querySelectorAll('[data-tab]').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.tab === view.tab);
      b.setAttribute('aria-selected', b.dataset.tab === view.tab);
    });
    const openCount = all.filter((t) => !t.completed).length;
    const doneCount = all.length - openCount;
    q('[data-tab="open"]').textContent = `To do · ${openCount}`;
    q('[data-tab="done"]').textContent = `Completed · ${doneCount}`;

    let list = all.filter((t) => (view.tab === 'open' ? !t.completed : t.completed));
    if (view.subject === '__none') list = list.filter((t) => !t.subject);
    else if (view.subject) list = list.filter((t) => t.subject.toLowerCase() === view.subject.toLowerCase());
    if (view.query) {
      const ql = view.query.toLowerCase();
      list = list.filter((t) => (t.title + ' ' + t.notes + ' ' + t.subject).toLowerCase().includes(ql));
    }
    list = view.tab === 'done' ? sortTasks(list) : sortBy(list, view.sort);

    let html;
    if (!list.length) {
      const msg =
        view.tab === 'done'
          ? 'Nothing completed yet – your first tick is coming!'
          : all.length && !view.query && !view.subject
          ? 'Everything is done! Go and enjoy the sunshine.'
          : view.query || view.subject
          ? 'No tasks match that filter.'
          : pickDaily(NO_TASKS, dayKey());
      html = `<div class="empty-state">${bunnySit('cream', view.tab === 'done' ? 'awake' : 'sleep')}<h3>${escapeHtml(msg)}</h3>
        ${view.tab === 'open' && !view.query ? `<p>Try something like “Biology – revise cell structure”.</p>` : ''}</div>`;
    } else if (view.tab === 'open' && view.sort === 'subject') {
      const groups = {};
      for (const t of list) (groups[t.subject || 'No subject'] ||= []).push(t);
      html = Object.entries(groups)
        .map(([g, items]) => `<p class="eyebrow group-label">${escapeHtml(g)}</p><ul class="todo-list">${items.map((t) => taskItem(t, stats)).join('')}</ul>`)
        .join('');
    } else {
      html = `<ul class="todo-list">${list.map((t) => taskItem(t, stats)).join('')}</ul>`;
    }
    q('[data-list]').innerHTML = html;
  }

  function paintSide() {
    const s = store.getSettings();
    const t = timer.get();
    const task = t.taskId ? store.getTask(t.taskId) : null;
    const stats = S.perTask(store.listSessions(), { countPartial: s.countPartial });
    const st = task ? stats[task.id] || { pomodoros: 0, seconds: 0 } : null;
    q('[data-current]').innerHTML = `
      <p class="eyebrow">Studying now</p>
      ${
        task
          ? `<h2 style="font-size:1.15rem;margin:6px 0 4px">${escapeHtml(task.title)}</h2>
             <p class="muted" style="font-size:.9rem">${task.subject ? escapeHtml(task.subject) + ' · ' : ''}${st.pomodoros} pomodoro${st.pomodoros === 1 ? '' : 's'} · ${fmtDuration(st.seconds)} so far</p>
             <div class="row" style="margin-top:12px"><a class="btn btn-sm btn-primary" href="#home">${icon('play')} Go to timer</a>
             <button class="btn btn-sm" data-unset>Clear</button></div>`
          : t.label
          ? `<h2 style="font-size:1.15rem;margin:6px 0 4px">${escapeHtml(t.label)}</h2><p class="muted" style="font-size:.9rem">A free study session (no task)</p>`
          : `<p class="muted" style="margin-top:6px;font-size:.92rem">Nothing chosen. Tap ${icon('play', 'width="13" height="13" style="vertical-align:-1px"')} on a task to study it, or just start the timer – sessions don’t need a task.</p>`
      }`;
    q('[data-unset]')?.addEventListener('click', () => timer.setTask(null));

    // subjects summary
    const days = S.byDay(store.listSessions(), { countPartial: s.countPartial });
    const bySubject = Object.fromEntries(S.subjectBreakdown(days).map((x) => [x.subject.toLowerCase(), x.seconds]));
    const open = store.listTasks().filter((x) => !x.completed);
    const subjects = store.listSubjects();
    q('[data-subjects]').innerHTML = `<div class="panel-title"><h2>Subjects</h2></div>
      ${
        subjects.length
          ? `<ul class="subject-list">${subjects
              .map((sub) => {
                const n = open.filter((x) => x.subject.toLowerCase() === sub.toLowerCase()).length;
                return `<li><button class="linkish" style="text-decoration:none;color:inherit;padding:0;text-align:left" data-sub="${escapeHtml(sub)}">${escapeHtml(sub)}</button>
                  <span class="muted">${n} open · ${fmtDuration(bySubject[sub.toLowerCase()] || 0)}</span></li>`;
              })
              .join('')}</ul>`
          : `<p class="muted" style="font-size:.9rem">Give tasks a subject (Maths, Biology…) to see your time per subject.</p>`
      }`;
    main.querySelectorAll('[data-sub]').forEach((b) =>
      b.addEventListener('click', () => {
        view.subject = b.dataset.sub;
        paintList();
      })
    );
  }

  bindTaskList(q('[data-list]'), { onFocus: paintSide });
  q('[data-new]').addEventListener('click', () => openTaskEditor(null, { preset: { subject: view.subject && view.subject !== '__none' ? view.subject : '' } }));
  q('[data-quick]').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = e.target.title.value.trim();
    if (!title) return;
    store.addTask({ title, subject: view.subject && view.subject !== '__none' ? view.subject : '' });
    e.target.title.value = '';
    toast('Task added', { icon: 'check' });
  });
  main.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      view.tab = b.dataset.tab;
      paintList();
    })
  );
  q('[data-subject]').addEventListener('change', (e) => {
    view.subject = e.target.value;
    paintList();
  });
  q('[data-sort]').addEventListener('change', (e) => {
    view.sort = e.target.value;
    paintList();
  });
  q('[data-search]').addEventListener('input', (e) => {
    view.query = e.target.value.trim();
    paintList();
  });

  paintList();
  paintSide();
  const unsub = timer.subscribe((type) => {
    if (type === 'state') paintSide();
  });

  return {
    refresh() {
      paintList();
      paintSide();
    },
    destroy() {
      unsub();
    },
  };
}
