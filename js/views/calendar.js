// Calendar of study history: month grid shaded by study time, day details beside it.

import * as store from '../store.js';
import * as S from '../stats.js';
import { icon, flowerGlyph } from '../art.js';
import { fmtDuration, dayKey, addDays, weekdayMon, keyToDate, fmtLongDate, escapeHtml } from '../util.js';
import { dayDetailHtml } from './day-detail.js';

const state = { month: null, selected: null };

export function render(main) {
  const today = dayKey();
  state.month ||= today.slice(0, 7);
  state.selected ||= today;
  main.innerHTML = `<div class="view-enter">
    <div class="page-head"><div><h1>Calendar</h1><p>Look back on your study days. Tap any day to see what you did.</p></div></div>
    <div class="cal-layout">
      <section class="panel" data-cal aria-label="Study calendar"></section>
      <section class="panel" data-detail aria-live="polite" aria-label="Day details"></section>
    </div></div>`;
  const q = (s) => main.querySelector(s);

  function paintCal() {
    const s = store.getSettings();
    const days = S.byDay(store.listSessions(), { countPartial: s.countPartial });
    const first = state.month + '-01';
    const gridStart = addDays(first, -weekdayMon(first));
    const [y, m] = state.month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const cellCount = Math.ceil((weekdayMon(first) + daysInMonth) / 7) * 7;
    const monthName = keyToDate(first).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const monthList = S.monthDays(days, state.month);
    const total = monthList.reduce((a, b) => a + b.seconds, 0);
    const active = monthList.filter((d) => d.seconds > 0).length;
    const goalDays = monthList.filter((d) => d.seconds >= s.goalMin * 60).length;
    const dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let cells = '';
    for (let i = 0; i < cellCount; i++) {
      const k = addDays(gridStart, i);
      const d = days.get(k);
      const sec = d?.seconds || 0;
      const lvl = S.heatLevel(sec, s.goalMin);
      const out = k.slice(0, 7) !== state.month;
      const future = k > today;
      const reached = sec >= s.goalMin * 60;
      cells += `<button class="cal-day l${lvl} ${out ? 'out' : ''} ${future ? 'future' : ''} ${k === today ? 'today' : ''}" data-key="${k}"
          aria-selected="${k === state.selected}" aria-label="${escapeHtml(fmtLongDate(k))}: ${sec ? fmtDuration(sec) + ' studied' : 'no study'}${d?.pomodoros ? ', ' + d.pomodoros + ' pomodoros' : ''}${reached ? ', goal reached' : ''}">
        <span class="n">${Number(k.slice(8))}</span>
        <span class="h">${sec ? fmtDuration(sec, { short: true }) : ''}</span>
        ${reached ? `<span class="goal-mark">${flowerGlyph('#fffdf8', '#f6d77a', 14)}</span>` : ''}
      </button>`;
    }
    const isCurrent = state.month === today.slice(0, 7);
    q('[data-cal]').innerHTML = `
      <div class="cal-head">
        <button class="icon-btn" data-nav="-1" aria-label="Previous month">${icon('chevLeft')}</button>
        <div style="text-align:center"><h2>${monthName}</h2>
          <p class="muted" style="font-size:.88rem;margin-top:2px">${fmtDuration(total)} · ${active} study day${active === 1 ? '' : 's'} · goal met ${goalDays}×</p></div>
        <button class="icon-btn" data-nav="1" aria-label="Next month" ${isCurrent ? 'disabled style="opacity:.4"' : ''}>${icon('chevRight')}</button>
      </div>
      <div class="cal-grid" role="grid">${dows.map((d) => `<div class="cal-dow">${d}</div>`).join('')}${cells}</div>
      <div class="row wrap" style="justify-content:space-between;margin-top:14px">
        ${isCurrent ? '<span></span>' : `<button class="btn btn-sm" data-today>Back to today</button>`}
        <div class="heat-legend" style="margin:0"><span>Less</span>${[0, 1, 2, 3, 4].map((l) => `<i style="background:var(--heat-${l})"></i>`).join('')}<span>More</span>
        <span style="margin-left:8px;display:inline-flex;align-items:center;gap:4px">${flowerGlyph('#f2c6cf', '#f6d77a', 14)} goal reached</span></div>
      </div>`;
    q('[data-cal]').querySelectorAll('[data-key]').forEach((b) =>
      b.addEventListener('click', () => {
        state.selected = b.dataset.key;
        if (b.dataset.key.slice(0, 7) !== state.month) state.month = b.dataset.key.slice(0, 7);
        paintCal();
        paintDetail();
        if (window.matchMedia('(max-width: 1020px)').matches) q('[data-detail]').scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
    );
    q('[data-cal]').querySelectorAll('[data-nav]').forEach((b) =>
      b.addEventListener('click', () => {
        const d = keyToDate(state.month + '-01');
        d.setMonth(d.getMonth() + Number(b.dataset.nav));
        const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (next > today.slice(0, 7)) return;
        state.month = next;
        paintCal();
      })
    );
    q('[data-today]')?.addEventListener('click', () => {
      state.month = today.slice(0, 7);
      state.selected = today;
      paintCal();
      paintDetail();
    });
  }

  function paintDetail() {
    q('[data-detail]').innerHTML = `<p class="eyebrow">${state.selected === today ? 'Today' : 'Day details'}</p>
      <h2 style="font-size:1.3rem;margin:4px 0 16px">${fmtLongDate(state.selected)}</h2>${dayDetailHtml(state.selected)}`;
  }

  paintCal();
  paintDetail();
  return {
    refresh() {
      paintCal();
      paintDetail();
    },
  };
}
