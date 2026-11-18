// Statistics: daily numbers, weekly/monthly charts, heatmap, subjects, streaks.

import * as store from '../store.js';
import * as S from '../stats.js';
import { icon, flowerGlyph } from '../art.js';
import { escapeHtml, fmtDuration, addDays, dayKey, keyToDate, fmtShortDate, debounce, startOfWeek, fmtLongDate } from '../util.js';
import { barChartSvg, bindChart, heatmapSvg, heatLegend, subjectBars } from './charts.js';
import { openDayDetail } from './day-detail.js';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const state = { weekOffset: 0, monthOffset: 0, range: 'week', tables: {} };

function monthOf(offset) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function render(main) {
  main.innerHTML = `<div class="view-enter">
    <div class="page-head"><div><h1>Statistics</h1><p>Every number here comes from the sessions you actually recorded. Breaks never count as study time.</p></div></div>
    <div class="stats-grid">
      <section class="panel span-12" data-today aria-label="Today"></section>
      <section class="panel span-8" data-week aria-label="This week"></section>
      <section class="panel span-4" data-streaks aria-label="Streaks and averages"></section>
      <section class="panel span-12" data-heat aria-label="Study activity heatmap"></section>
      <section class="panel span-8" data-month aria-label="Monthly overview"></section>
      <section class="panel span-4" data-subjects aria-label="Study time by subject"></section>
      <section class="panel span-6" data-weeks aria-label="Weekly totals"></section>
      <section class="panel span-6" data-weekday aria-label="Study by weekday"></section>
    </div></div>`;
  const q = (s) => main.querySelector(s);

  function data() {
    const s = store.getSettings();
    const days = S.byDay(store.listSessions(), { countPartial: s.countPartial });
    return { s, days, today: dayKey() };
  }

  function tableToggle(id) {
    return `<button class="btn btn-sm btn-ghost table-toggle" data-table="${id}" aria-expanded="${!!state.tables[id]}">${state.tables[id] ? 'Hide table' : 'Table'}</button>`;
  }

  function table(rows, head) {
    return `<table class="data-table"><thead><tr><th>${head[0]}</th><th>${head[1]}</th></tr></thead><tbody>${rows
      .map((r) => `<tr><td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1])}</td></tr>`)
      .join('')}</tbody></table>`;
  }

  function paintToday({ s, days, today }) {
    const d = days.get(today) || S.emptyDay();
    const done = S.tasksCompletedOn(store.listTasks(), today).length;
    const goal = s.goalMin * 60;
    const pct = Math.round((d.seconds / goal) * 100);
    q('[data-today]').innerHTML = `
      <div class="panel-title"><h2>Today</h2><button class="btn btn-sm btn-ghost" data-open-today>Details ${icon('chevRight', 'width="15" height="15"')}</button></div>
      <div class="tiles">
        <div class="tile"><div class="v">${fmtDuration(d.seconds)}</div><div class="l">Focused study time</div></div>
        <div class="tile"><div class="v">${d.pomodoros}</div><div class="l">Pomodoros completed</div></div>
        <div class="tile"><div class="v">${done}</div><div class="l">Tasks completed</div></div>
        <div class="tile"><div class="v">${d.breaks}</div><div class="l">Breaks taken</div></div>
        <div class="tile"><div class="v">${Math.min(pct, 999)}%</div><div class="l">of ${fmtDuration(goal)} goal</div>
          <div class="progress" style="margin:8px 0 0;height:8px"><div style="width:${Math.min(100, pct)}%"></div></div></div>
      </div>`;
    q('[data-open-today]').onclick = () => openDayDetail(today);
  }

  function paintWeek({ s, days, today }) {
    const anchor = addDays(today, state.weekOffset * 7);
    const series = S.weekSeries(days, anchor);
    const total = series.reduce((a, b) => a + b.seconds, 0);
    const prevTotal = S.weekSeries(days, addDays(anchor, -7)).reduce((a, b) => a + b.seconds, 0);
    const start = series[0].key;
    const diff = total - prevTotal;
    const host = q('[data-week]');
    host.innerHTML = `
      <div class="panel-title"><h2>Week</h2>
        <div class="week-nav"><button class="icon-btn sm" data-wk="-1" aria-label="Previous week">${icon('chevLeft')}</button>
        <span>${state.weekOffset === 0 ? 'This week' : `${fmtShortDate(start)} – ${fmtShortDate(addDays(start, 6))}`}</span>
        <button class="icon-btn sm" data-wk="1" aria-label="Next week" ${state.weekOffset >= 0 ? 'disabled' : ''}>${icon('chevRight')}</button>${tableToggle('week')}</div></div>
      <p class="muted" style="margin:-6px 0 10px;font-size:.92rem"><b style="color:var(--ink)">${fmtDuration(total)}</b> studied
        ${prevTotal || total ? `· ${diff >= 0 ? '+' : '−'}${fmtDuration(Math.abs(diff))} vs previous week` : ''}</p>
      <div class="chart-host" data-host></div>
      ${state.tables.week ? table(series.map((x) => [fmtLongDate(x.key), fmtDuration(x.seconds)]), ['Day', 'Study time']) : ''}`;
    const width = host.querySelector('[data-host]').clientWidth;
    host.querySelector('[data-host]').innerHTML = barChartSvg(
      series.map((x) => ({
        key: x.key,
        label: keyToDate(x.key).toLocaleDateString(undefined, { weekday: 'short' }),
        value: x.seconds,
        today: x.key === today,
        tip: `<b>${fmtDuration(x.seconds)}</b><br>${fmtLongDate(x.key)}`,
      })),
      { width, height: 220, goal: s.goalMin * 60 }
    );
    bindChart(host, openDayDetail);
    host.querySelectorAll('[data-wk]').forEach((b) =>
      b.addEventListener('click', () => {
        state.weekOffset = Math.min(0, state.weekOffset + Number(b.dataset.wk));
        paintWeek(data());
      })
    );
  }

  function paintStreaks({ s, days, today }) {
    const st = S.streaks(days, today);
    const avg = S.dailyAverage(days, today);
    const wd = S.weekdayProfile(days);
    const glyphs = Array.from({ length: Math.min(7, st.current) }, () => flowerGlyph('#f6e3a1', '#e7b84d', 20)).join('');
    q('[data-streaks]').innerHTML = `
      <div class="panel-title"><h2>Streaks & habits</h2></div>
      <div class="tiles" style="grid-template-columns:1fr 1fr">
        <div class="tile"><div class="v">${st.current}<small style="font-size:.5em"> day${st.current === 1 ? '' : 's'}</small></div><div class="l">Current streak</div></div>
        <div class="tile"><div class="v">${st.longest}<small style="font-size:.5em"> day${st.longest === 1 ? '' : 's'}</small></div><div class="l">Longest streak</div></div>
        <div class="tile"><div class="v">${fmtDuration(avg.perDay)}</div><div class="l">Daily average${avg.span ? ` (last ${avg.span} day${avg.span === 1 ? '' : 's'})` : ''}</div></div>
        <div class="tile"><div class="v" style="font-size:1.25rem;padding:4px 0">${wd.best >= 0 ? WEEKDAYS[wd.best] : '—'}</div><div class="l">Most productive day</div></div>
      </div>
      <div style="margin-top:14px;display:flex;gap:4px;align-items:center;min-height:22px">${glyphs}
        <span class="muted" style="font-size:.88rem;margin-left:6px">${
          st.current ? (st.studiedToday ? 'Streak safe for today.' : 'Study today to keep your streak!') : 'One pomodoro starts a streak.'
        }</span></div>
      ${avg.activeDays ? `<p class="faint" style="font-size:.82rem;margin-top:8px">${fmtDuration(avg.perStudyDay)} on an average study day · ${avg.activeDays} study day${avg.activeDays === 1 ? '' : 's'} in total</p>` : ''}`;
  }

  function paintHeat({ s, days, today }) {
    const host = q('[data-heat]');
    const total = S.dailyAverage(days, today).total || 0;
    host.innerHTML = `<div class="panel-title"><h2>Your study meadow</h2><span class="muted" style="font-size:.9rem">${fmtDuration(total)} in total · tap a day for details</span></div>
      <div class="heatmap-scroll" data-scroll></div>${heatLegend(s.goalMin)}`;
    const sc = host.querySelector('[data-scroll]');
    sc.innerHTML = heatmapSvg(days, today, s.goalMin, 53, sc.clientWidth);
    sc.scrollLeft = sc.scrollWidth;
    bindChart(host, openDayDetail);
  }

  function paintMonth({ s, days, today }) {
    const month = monthOf(state.monthOffset);
    const list = S.monthDays(days, month);
    const total = list.reduce((a, b) => a + b.seconds, 0);
    const active = list.filter((x) => x.seconds > 0).length;
    const name = keyToDate(month + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const months = S.monthlyTotals(days, today, 6);
    const host = q('[data-month]');
    host.innerHTML = `
      <div class="panel-title"><h2>Month</h2>
        <div class="week-nav"><button class="icon-btn sm" data-mo="-1" aria-label="Previous month">${icon('chevLeft')}</button>
        <span>${name}</span>
        <button class="icon-btn sm" data-mo="1" aria-label="Next month" ${state.monthOffset >= 0 ? 'disabled' : ''}>${icon('chevRight')}</button>${tableToggle('month')}</div></div>
      <p class="muted" style="margin:-6px 0 10px;font-size:.92rem"><b style="color:var(--ink)">${fmtDuration(total)}</b> studied · ${active} study day${active === 1 ? '' : 's'}${active ? ` · ${fmtDuration(total / active)} per study day` : ''}</p>
      <div data-host></div>
      <h3 style="font-size:1rem;margin:18px 0 6px">Monthly totals</h3>
      <div data-host2></div>
      ${state.tables.month ? table(months.map((m) => [keyToDate(m.month + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), fmtDuration(m.seconds)]), ['Month', 'Study time']) : ''}`;
    const w = host.querySelector('[data-host]').clientWidth;
    host.querySelector('[data-host]').innerHTML = barChartSvg(
      list.map((x) => ({
        key: x.key,
        label: String(Number(x.key.slice(8))),
        value: x.seconds,
        today: x.key === today,
        tip: `<b>${fmtDuration(x.seconds)}</b><br>${fmtLongDate(x.key)}`,
      })),
      { width: w, height: 190, goal: s.goalMin * 60, labelEvery: w < 500 ? 7 : 3 }
    );
    host.querySelector('[data-host2]').innerHTML = barChartSvg(
      months.map((m) => ({
        key: '',
        label: keyToDate(m.month + '-01').toLocaleDateString(undefined, { month: 'short' }),
        value: m.seconds,
        today: m.month === today.slice(0, 7),
        tip: `<b>${fmtDuration(m.seconds)}</b><br>${keyToDate(m.month + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} · ${m.activeDays} study days`,
      })),
      { width: w, height: 150 }
    );
    bindChart(host.querySelector('[data-host]'), openDayDetail);
    bindChart(host.querySelector('[data-host2]'));
    host.querySelectorAll('[data-mo]').forEach((b) =>
      b.addEventListener('click', () => {
        state.monthOffset = Math.min(0, state.monthOffset + Number(b.dataset.mo));
        paintMonth(data());
      })
    );
  }

  function paintSubjects({ days, today }) {
    const from = state.range === 'week' ? startOfWeek(today) : state.range === 'month' ? today.slice(0, 8) + '01' : null;
    const list = S.subjectBreakdown(days, from, today);
    q('[data-subjects]').innerHTML = `<div class="panel-title"><h2>By subject</h2></div>
      <div class="segmented" role="group" aria-label="Period" style="margin-bottom:16px">
        ${[
          ['week', 'This week'],
          ['month', 'This month'],
          ['all', 'All time'],
        ]
          .map(([k, l]) => `<button data-range="${k}" aria-pressed="${state.range === k}">${l}</button>`)
          .join('')}
      </div>${subjectBars(list)}`;
    q('[data-subjects]').querySelectorAll('[data-range]').forEach((b) =>
      b.addEventListener('click', () => {
        state.range = b.dataset.range;
        paintSubjects(data());
      })
    );
  }

  function paintWeeks({ days, today }) {
    const weeks = S.weeklyTotals(days, today, 8);
    const host = q('[data-weeks]');
    host.innerHTML = `<div class="panel-title"><h2>Weekly totals</h2>${tableToggle('weeks')}</div><div data-host></div>
      ${state.tables.weeks ? table(weeks.map((w) => [`Week of ${fmtShortDate(w.start)}`, fmtDuration(w.seconds)]), ['Week', 'Study time']) : ''}`;
    const w = host.querySelector('[data-host]').clientWidth;
    host.querySelector('[data-host]').innerHTML = barChartSvg(
      weeks.map((x, i) => ({
        key: '',
        label: fmtShortDate(x.start),
        value: x.seconds,
        today: i === weeks.length - 1,
        tip: `<b>${fmtDuration(x.seconds)}</b><br>Week of ${fmtShortDate(x.start)}`,
      })),
      { width: w, height: 180, labelEvery: w < 420 ? 2 : 1 }
    );
    bindChart(host);
  }

  function paintWeekday({ days }) {
    const wd = S.weekdayProfile(days);
    const host = q('[data-weekday]');
    host.innerHTML = `<div class="panel-title"><h2>By day of the week</h2></div><div data-host></div>`;
    const w = host.querySelector('[data-host]').clientWidth;
    host.querySelector('[data-host]').innerHTML = barChartSvg(
      wd.totals.map((sec, i) => ({
        key: '',
        label: WEEKDAYS[i].slice(0, 3),
        value: sec,
        today: i === wd.best,
        tip: `<b>${fmtDuration(sec)}</b><br>All ${WEEKDAYS[i]}s`,
      })),
      { width: w, height: 180 }
    );
    bindChart(host);
  }

  function paintAll() {
    const d = data();
    paintToday(d);
    paintWeek(d);
    paintStreaks(d);
    paintHeat(d);
    paintMonth(d);
    paintSubjects(d);
    paintWeeks(d);
    paintWeekday(d);
  }

  main.addEventListener('click', (e) => {
    const b = e.target.closest('[data-table]');
    if (!b) return;
    state.tables[b.dataset.table] = !state.tables[b.dataset.table];
    paintAll();
  });

  paintAll();
  const onResize = debounce(paintAll, 200);
  window.addEventListener('resize', onResize);
  return {
    refresh: paintAll,
    destroy() {
      window.removeEventListener('resize', onResize);
    },
  };
}
