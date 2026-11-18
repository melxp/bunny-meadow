// Small hand-built SVG charts (no library): bar chart, calendar heatmap,
// horizontal subject bars. All charts get hover/tap tooltips and click-through.

import * as store from '../store.js';
import { escapeHtml, fmtDuration, addDays, weekdayMon, keyToDate, dayKey, fmtLongDate } from '../util.js';
import { heatLevel } from '../stats.js';
import { showTip, hideTip } from '../ui.js';

// Categorical palette for subjects – validated for colour-blind separation
// (fixed order; the 7th+ subject folds into neutral "other").
const SUBJECT_LIGHT = ['#5c9b62', '#4c8fcc', '#d0698b', '#b8921c', '#8c6fcf', '#cf7a35'];
const SUBJECT_DARK = ['#5fa267', '#5592cf', '#d0708f', '#a98a26', '#9480d6', '#c47738'];
const OTHER = '#a3ab9e';

export function subjectColor(name) {
  if (!name || name === 'No subject') return OTHER;
  const list = store.listSubjects().map((s) => s.toLowerCase());
  const i = list.indexOf(name.toLowerCase());
  const dark = document.documentElement.dataset.theme === 'moonlit';
  const pal = dark ? SUBJECT_DARK : SUBJECT_LIGHT;
  return i >= 0 && i < pal.length ? pal[i] : OTHER;
}

function niceStep(maxSec) {
  const h = maxSec / 3600;
  if (h <= 1) return 900; // 15m
  if (h <= 2) return 1800;
  if (h <= 5) return 3600;
  if (h <= 10) return 7200;
  if (h <= 40) return 3600 * 10;
  return 3600 * 25;
}

function axisLabel(sec) {
  return sec % 3600 === 0 ? `${sec / 3600}h` : `${Math.round(sec / 60)}m`;
}

/**
 * items: [{ key, label, value (seconds), tip (html), today }]
 * opts: { width, height, goal (seconds or null), onClick(key) }
 */
export function barChartSvg(items, { width, height = 200, goal = null, labelEvery = 1 } = {}) {
  const padL = 34,
    padR = 6,
    padT = 18,
    padB = 24;
  const W = Math.max(240, width);
  const H = height;
  const maxVal = Math.max(goal || 0, ...items.map((i) => i.value), 1800);
  const step = niceStep(maxVal);
  const top = Math.ceil(maxVal / step) * step;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const slot = plotW / items.length;
  const bw = Math.max(4, Math.min(38, slot * 0.6));
  const y = (v) => padT + plotH - (v / top) * plotH;
  let grid = '';
  for (let v = 0; v <= top; v += step) {
    grid += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/>
      <text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${axisLabel(v)}</text>`;
  }
  const maxIdx = items.reduce((bi, it, i) => (it.value > items[bi].value ? i : bi), 0);
  let bars = '';
  items.forEach((it, i) => {
    const cx = padL + slot * i + slot / 2;
    const h = (it.value / top) * plotH;
    const x = cx - bw / 2;
    const yb = padT + plotH;
    const r = Math.min(4, bw / 2, h);
    const path =
      h > 0
        ? `M${x} ${yb} V${yb - h + r} Q${x} ${yb - h} ${x + r} ${yb - h} H${x + bw - r} Q${x + bw} ${yb - h} ${x + bw} ${yb - h + r} V${yb} Z`
        : '';
    const showLabel = i % labelEvery === 0 || it.today;
    bars += `<g class="bar-g" data-key="${it.key}" data-tip="${escapeHtml(it.tip || '')}" tabindex="0" role="button" aria-label="${escapeHtml(it.aria || it.label + ': ' + fmtDuration(it.value))}">
      <rect class="bar-hit" x="${padL + slot * i}" y="${padT}" width="${slot}" height="${plotH + padB}"/>
      ${path ? `<path class="bar ${it.today ? 'today' : ''}" d="${path}"/>` : ''}
      ${showLabel ? `<text x="${cx}" y="${H - 6}" text-anchor="middle" ${it.today ? 'style="fill:var(--ink);font-weight:800"' : ''}>${escapeHtml(it.label)}</text>` : ''}
      ${i === maxIdx && it.value > 0 ? `<text class="val" x="${cx}" y="${yb - h - 6}" text-anchor="middle">${fmtDuration(it.value, { short: true })}</text>` : ''}
    </g>`;
  });
  const goalLine =
    goal && goal <= top
      ? `<line class="goal-line" x1="${padL}" x2="${W - padR}" y1="${y(goal)}" y2="${y(goal)}"/><text x="${W - padR}" y="${y(goal) - 5}" text-anchor="end" style="fill:var(--butter-deep);font-weight:700">goal</text>`
      : '';
  return `<svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${grid}${goalLine}${bars}</svg>`;
}

/** Bind tooltips + click on bar groups / heat cells inside root */
export function bindChart(root, onClick) {
  root.querySelectorAll('[data-tip]').forEach((el) => {
    const show = () => {
      const r = el.getBoundingClientRect();
      showTip(el.dataset.tip, r.left + r.width / 2, r.top + (el.tagName === 'g' ? 10 : 0));
    };
    el.addEventListener('mouseenter', show);
    el.addEventListener('focus', show);
    el.addEventListener('mouseleave', hideTip);
    el.addEventListener('blur', hideTip);
    if (onClick && el.dataset.key) {
      el.addEventListener('click', () => {
        hideTip();
        onClick(el.dataset.key);
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          hideTip();
          onClick(el.dataset.key);
        }
      });
    }
  });
}

/** GitHub-style heatmap ending today. */
export function heatmapSvg(days, todayKey, goalMin, weeks = 53, width = 0) {
  const gap = 3,
    left = 30,
    top = 18;
  // fill the available width, but keep cells between 11px and 18px (scrolls on phones)
  const cell = Math.max(11, Math.min(18, Math.floor((width - left) / weeks) - gap || 13));
  const end = todayKey;
  const lastWeekStart = addDays(end, -weekdayMon(end));
  const start = addDays(lastWeekStart, -7 * (weeks - 1));
  let cells = '';
  let months = '';
  let lastMonth = '';
  for (let w = 0; w < weeks; w++) {
    const colKey = addDays(start, w * 7);
    const mo = keyToDate(colKey).toLocaleDateString(undefined, { month: 'short' });
    if (mo !== lastMonth && keyToDate(colKey).getDate() <= 7) {
      months += `<text x="${left + w * (cell + gap)}" y="11">${mo}</text>`;
      lastMonth = mo;
    }
    for (let d = 0; d < 7; d++) {
      const k = addDays(colKey, d);
      if (k > end) continue;
      const sec = days.get(k)?.seconds || 0;
      const lvl = heatLevel(sec, goalMin);
      const tip = `<b>${sec ? fmtDuration(sec) : 'No study'}</b><br>${escapeHtml(fmtLongDate(k))}`;
      cells += `<rect class="cell" x="${left + w * (cell + gap)}" y="${top + d * (cell + gap)}" width="${cell}" height="${cell}" rx="3"
        fill="var(--heat-${lvl})" data-key="${k}" data-tip="${escapeHtml(tip)}" tabindex="${k === end ? 0 : -1}" role="button"
        aria-label="${escapeHtml(fmtLongDate(k))}: ${sec ? fmtDuration(sec) : 'no study'}" ${k === end ? 'stroke="var(--butter-deep)" stroke-width="1.5"' : ''}/>`;
    }
  }
  const labels = ['Mon', '', 'Wed', '', 'Fri', '', '']
    .map((l, i) => (l ? `<text x="0" y="${top + i * (cell + gap) + 10}">${l}</text>` : ''))
    .join('');
  const W = left + weeks * (cell + gap);
  const H = top + 7 * (cell + gap);
  return `<svg class="chart heatmap" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="group" aria-label="Study activity heatmap">${months}${labels}${cells}</svg>`;
}

export function heatLegend(goalMin) {
  return `<div class="heat-legend"><span>Less</span>${[0, 1, 2, 3, 4].map((l) => `<i style="background:var(--heat-${l})"></i>`).join('')}<span>More</span>
    <span style="margin-left:10px">(darkest = daily goal of ${fmtDuration(goalMin * 60)} reached)</span></div>`;
}

export function subjectBars(list) {
  if (!list.length) return `<p class="muted" style="font-size:.92rem">No study time recorded in this period yet.</p>`;
  const max = list[0].seconds || 1;
  const total = list.reduce((a, b) => a + b.seconds, 0);
  return `<div class="hbar-list">${list
    .map(
      (x) => `<div class="hbar"><div class="top"><span><i class="swatch" style="background:${subjectColor(x.subject)}"></i>${escapeHtml(x.subject)}</span>
      <span>${fmtDuration(x.seconds)} · ${Math.round((x.seconds / total) * 100)}%</span></div>
      <div class="track"><div class="fill" style="width:${(x.seconds / max) * 100}%;background:${subjectColor(x.subject)}"></div></div></div>`
    )
    .join('')}</div>`;
}

export { dayKey };
