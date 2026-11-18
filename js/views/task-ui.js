// Task editor + list item rendering shared by Home and Tasks.

import * as store from '../store.js';
import * as timer from '../timer.js';
import { icon } from '../art.js';
import { openModal, toast, confirmDialog } from '../ui.js';
import { escapeHtml, fmtDuration, dayKey, fmtShortDate, daysBetween } from '../util.js';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export function sortTasks(list) {
  return [...list].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.completed) return (b.completed_at || '').localeCompare(a.completed_at || '');
    const pa = PRIORITY_ORDER[a.priority] ?? 1;
    const pb = PRIORITY_ORDER[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date !== b.due_date) return a.due_date ? -1 : 1;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });
}

export function dueChip(task) {
  if (!task.due_date) return '';
  const today = dayKey();
  const diff = daysBetween(today, task.due_date);
  let text = fmtShortDate(task.due_date);
  if (diff === 0) text = 'Due today';
  else if (diff === 1) text = 'Due tomorrow';
  else if (diff < 0) text = `Overdue · ${fmtShortDate(task.due_date)}`;
  const cls = diff < 0 && !task.completed ? 'overdue' : '';
  return `<span class="chip ${cls}">${icon('calendar', 'width="13" height="13"')}${escapeHtml(text)}</span>`;
}

export function taskItem(task, stats, { compact = false } = {}) {
  const t = timer.get();
  const isCurrent = t && t.taskId === task.id;
  const st = stats[task.id];
  const meta = [
    task.subject ? `<span class="chip">${escapeHtml(task.subject)}</span>` : '',
    `<span class="chip ${task.priority}">${task.priority[0].toUpperCase() + task.priority.slice(1)}</span>`,
    dueChip(task),
    st && (st.pomodoros || st.seconds)
      ? `<span title="Pomodoros and focused time on this task">${icon('leaf', 'width="13" height="13" style="vertical-align:-2px"')} ${st.pomodoros} · ${fmtDuration(st.seconds)}</span>`
      : '',
    isCurrent ? `<span class="chip" style="background:var(--accent-soft);color:var(--sage-deep)">Studying now</span>` : '',
  ].join('');
  return `<li class="todo-item ${task.completed ? 'done' : ''} ${isCurrent ? 'is-current' : ''}" data-id="${task.id}">
    <input type="checkbox" class="check" data-act="toggle" ${task.completed ? 'checked' : ''} aria-label="Mark “${escapeHtml(task.title)}” as ${task.completed ? 'not done' : 'done'}">
    <div class="todo-body" data-act="edit" role="button" tabindex="0" aria-label="Edit ${escapeHtml(task.title)}">
      <div class="todo-title">${escapeHtml(task.title)}</div>
      ${!compact && task.notes ? `<div class="todo-notes">${escapeHtml(task.notes)}</div>` : ''}
      <div class="todo-meta">${meta}</div>
    </div>
    ${
      compact
        ? ''
        : `<div class="todo-actions">
      ${!task.completed ? `<button class="icon-btn sm plain" data-act="focus" aria-label="Study this now" title="Study this now">${icon('play')}</button>` : ''}
      <button class="icon-btn sm plain" data-act="delete" aria-label="Delete task" title="Delete">${icon('trash')}</button>
    </div>`
    }
  </li>`;
}

/** Event delegation for a list of taskItem()s */
export function bindTaskList(root, { onFocus } = {}) {
  root.addEventListener('click', async (e) => {
    const actEl = e.target.closest('[data-act]');
    if (!actEl) return;
    const li = actEl.closest('[data-id]');
    if (!li) return;
    const id = li.dataset.id;
    const act = actEl.dataset.act;
    const task = store.getTask(id);
    if (!task) return;
    if (act === 'toggle') {
      store.updateTask(id, { completed: actEl.checked });
      if (actEl.checked) {
        toast(`“${task.title}” done – lovely!`, {
          action: { label: 'Undo', onClick: () => store.updateTask(id, { completed: false }) },
        });
        if (timer.get().taskId === id) timer.setTask(null);
      }
    } else if (act === 'edit') {
      openTaskEditor(task);
    } else if (act === 'focus') {
      timer.setTask(id);
      toast(`Now studying: ${task.title}`, { icon: 'book' });
      onFocus && onFocus(id);
    } else if (act === 'delete') {
      const ok = await confirmDialog({
        title: 'Delete this task?',
        message: `“${task.title}” will be removed. Study time already recorded stays in your statistics.`,
        confirm: 'Delete',
        danger: true,
      });
      if (ok) {
        store.deleteTask(id);
        if (timer.get().taskId === id) timer.setTask(null);
        toast('Task deleted', { icon: 'trash' });
      }
    }
  });
  root.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.todo-body')) {
      e.preventDefault();
      e.target.click();
    }
  });
}

export function openTaskEditor(task = null, { preset = {}, onSaved } = {}) {
  const t = task || { title: '', notes: '', subject: '', priority: 'medium', due_date: '', ...preset };
  const subjects = store.listSubjects();
  openModal({
    title: task ? 'Edit task' : 'New task',
    body: `<form class="task-form" novalidate>
      <label class="field"><span>Task</span>
        <input class="input" name="title" required maxlength="300" placeholder="e.g. Revise cell structure" value="${escapeHtml(t.title)}" autofocus></label>
      <div class="row wrap" style="align-items:flex-start">
        <label class="field grow" style="min-width:160px"><span>Subject</span>
          <input class="input" name="subject" maxlength="60" list="subject-options" placeholder="e.g. Biology" value="${escapeHtml(t.subject)}">
          <datalist id="subject-options">${subjects.map((s) => `<option value="${escapeHtml(s)}">`).join('')}</datalist></label>
        <label class="field" style="min-width:150px"><span>Due date <span class="faint">(optional)</span></span>
          <input class="input" type="date" name="due_date" value="${escapeHtml(t.due_date || '')}"></label>
      </div>
      <div class="field"><span class="field-label">Priority</span>
        <div class="segmented" role="group" aria-label="Priority">
          ${['low', 'medium', 'high'].map((p) => `<button type="button" data-p="${p}" aria-pressed="${t.priority === p}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}
        </div></div>
      <label class="field"><span>Notes</span>
        <textarea class="input" name="notes" maxlength="5000" placeholder="Pages, chapters, links, anything helpful…">${escapeHtml(t.notes)}</textarea></label>
      <p class="auth-err" data-err></p>
      <div class="modal-actions">
        ${task ? `<button type="button" class="btn btn-ghost btn-danger" data-del style="margin-right:auto">${icon('trash')} Delete</button>` : ''}
        <button type="button" class="btn" data-close>Cancel</button>
        <button type="submit" class="btn btn-primary">${task ? 'Save' : 'Add task'}</button>
      </div></form>`,
    onMount(m, close) {
      const form = m.querySelector('form');
      let priority = t.priority || 'medium';
      m.querySelectorAll('[data-p]').forEach((b) =>
        b.addEventListener('click', () => {
          priority = b.dataset.p;
          m.querySelectorAll('[data-p]').forEach((x) => x.setAttribute('aria-pressed', x === b));
        })
      );
      m.querySelector('[data-del]')?.addEventListener('click', async () => {
        close();
        const ok = await confirmDialog({ title: 'Delete this task?', message: `“${task.title}” will be removed.`, confirm: 'Delete', danger: true });
        if (ok) {
          store.deleteTask(task.id);
          if (timer.get().taskId === task.id) timer.setTask(null);
        }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const data = {
          title: fd.get('title'),
          subject: fd.get('subject'),
          due_date: fd.get('due_date') || null,
          notes: fd.get('notes'),
          priority,
        };
        try {
          const saved = task ? store.updateTask(task.id, data) : store.addTask(data);
          close();
          onSaved && onSaved(saved);
        } catch (err) {
          m.querySelector('[data-err]').textContent = err.message;
          form.title.focus();
        }
      });
    },
  });
}

/** Choose what the current session is for. */
export function openTaskPicker() {
  const t = timer.get();
  const tasks = sortTasks(store.listTasks().filter((x) => !x.completed));
  openModal({
    title: 'What are you studying?',
    body: `<ul class="pick-list">
        ${tasks
          .map(
            (task) => `<li><button data-id="${task.id}" aria-pressed="${t.taskId === task.id}">
              <span class="pt">${escapeHtml(task.title)}</span>
              ${task.subject ? `<span class="chip">${escapeHtml(task.subject)}</span>` : ''}</button></li>`
          )
          .join('')}
        ${tasks.length ? '' : `<li class="muted" style="padding:6px 4px">No open tasks yet.</li>`}
      </ul>
      <div class="divider">or just study</div>
      <form class="row" data-free>
        <input class="input grow" name="label" maxlength="200" placeholder="A quick label (optional), e.g. Flashcards" value="${escapeHtml(t.taskId ? '' : t.label || '')}">
        <button class="btn" type="submit">Use</button>
      </form>
      <div class="modal-actions">
        <button class="btn" data-new>${icon('plus')} New task</button>
        ${t.taskId || t.label ? `<button class="btn btn-ghost" data-clear>Clear</button>` : ''}
      </div>`,
    onMount(m, close) {
      m.querySelectorAll('[data-id]').forEach((b) =>
        b.addEventListener('click', () => {
          timer.setTask(b.dataset.id);
          close();
        })
      );
      m.querySelector('[data-free]').addEventListener('submit', (e) => {
        e.preventDefault();
        timer.setTask(null, e.target.label.value.trim());
        close();
      });
      m.querySelector('[data-clear]')?.addEventListener('click', () => {
        timer.setTask(null, '');
        close();
      });
      m.querySelector('[data-new]').addEventListener('click', () => {
        close();
        openTaskEditor(null, { onSaved: (task) => timer.setTask(task.id) });
      });
    },
  });
}
