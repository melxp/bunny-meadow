// What happened on one day: totals, timeline of sessions, completed tasks.

import * as store from '../store.js';
import * as S from '../stats.js';
import { icon, flowerGlyph } from '../art.js';
import { escapeHtml, fmtDuration, fmtLongDate, fmtTime, dayKey } from '../util.js';
import { openModal } from '../ui.js';
import { subjectColor } from './charts.js';

export function dayDetailHtml(key) {
  const s = store.getSettings();
  const sessions = store.listSessions();
  const days = S.byDay(sessions, { countPartial: s.countPartial });
  const d = days.get(key) || S.emptyDay();
  const done = S.tasksCompletedOn(store.listTasks(), key);
  const tasks = store.tasksById();
  const goal = s.goalMin * 60;
  const subjects = Object.entries(d.subjects).sort((a, b) => b[1] - a[1]);
  const max = subjects.length ? subjects[0][1] : 1;
  const isToday = key === dayKey();

  const timeline = d.sessions
    .map((x) => {
      const task = x.task_id ? tasks[x.task_id] : null;
      const what =
        x.mode === 'focus'
          ? escapeHtml(task ? task.title + (task.deleted ? ' (deleted task)' : '') : x.label || 'Free study session')
          : x.mode === 'short'
          ? 'Short break'
          : 'Long break';
      const cls = x.mode === 'focus' ? (x.completed ? 'focus' : 'partial') : x.mode;
      const ic = x.mode === 'focus' ? 'book' : 'cup';
      const extra = x.mode === 'focus' && !x.completed ? ' · unfinished' : '';
      const subj = x.mode === 'focus' && x.subject ? `<span class="chip" style="margin-left:6px">${escapeHtml(x.subject)}</span>` : '';
      return `<li><span class="badge ${cls}">${icon(ic)}</span>
        <span style="min-width:0"><b style="font-weight:700">${what}</b>${subj}<br><span class="faint" style="font-size:.8rem">${fmtDuration(x.actual_seconds)}${extra}</span></span>
        <span class="when">${fmtTime(x.started_at)}<br>– ${fmtTime(x.ended_at)}</span></li>`;
    })
    .join('');

  return `
    <div class="tiles" style="grid-template-columns:repeat(2,1fr)">
      <div class="tile"><div class="v">${fmtDuration(d.seconds)}</div><div class="l">Study time ${goal ? `· ${Math.round((d.seconds / goal) * 100)}% of goal` : ''}</div></div>
      <div class="tile"><div class="v">${d.pomodoros}</div><div class="l">Pomodoros</div></div>
      <div class="tile"><div class="v">${done.length}</div><div class="l">Tasks completed</div></div>
      <div class="tile"><div class="v">${d.breaks}</div><div class="l">Breaks taken</div></div>
    </div>
    ${
      subjects.length
        ? `<h3 style="font-size:1rem;margin:20px 0 10px">By subject</h3><div class="hbar-list">${subjects
            .map(
              ([sub, sec]) => `<div class="hbar"><div class="top"><span><i class="swatch" style="background:${subjectColor(sub)}"></i>${escapeHtml(sub)}</span><span>${fmtDuration(sec)}</span></div>
              <div class="track"><div class="fill" style="width:${(sec / max) * 100}%;background:${subjectColor(sub)}"></div></div></div>`
            )
            .join('')}</div>`
        : ''
    }
    <h3 style="font-size:1rem;margin:20px 0 10px">Sessions</h3>
    ${
      timeline
        ? `<ul class="timeline">${timeline}</ul>`
        : `<p class="muted" style="font-size:.92rem">${isToday ? 'No sessions yet today – the meadow is waiting.' : 'No study recorded on this day. Rest days count too.'}</p>`
    }
    <h3 style="font-size:1rem;margin:20px 0 10px">Tasks completed</h3>
    ${
      done.length
        ? `<ul class="timeline">${done
            .map((t) => `<li><span class="badge focus">${icon('check')}</span><span style="min-width:0"><b style="font-weight:700">${escapeHtml(t.title)}</b>${t.subject ? `<span class="chip" style="margin-left:6px">${escapeHtml(t.subject)}</span>` : ''}</span><span class="when">${fmtTime(t.completed_at)}</span></li>`)
            .join('')}</ul>`
        : `<p class="muted" style="font-size:.92rem">No tasks ticked off on this day.</p>`
    }`;
}

export function openDayDetail(key) {
  openModal({
    title: fmtLongDate(key),
    label: `Study details for ${fmtLongDate(key)}`,
    body: dayDetailHtml(key),
  });
}

export { flowerGlyph };
