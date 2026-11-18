// The illustrated meadow behind the app: sky, sun, drifting clouds, rolling hills,
// swaying wildflowers and a few bunnies. Pure SVG + CSS animation (GPU friendly).

import { bunnyHop, bunnySit } from './art.js';

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const PETALS = ['#f6c9d2', '#fff6dc', '#f6e3a1', '#d9cdee', '#fbd9c7', '#ffffff'];

function flower(x, y, scale, color, rnd) {
  const h = 10 + rnd() * 10;
  const petals = [0, 72, 144, 216, 288]
    .map((a) => `<ellipse cx="0" cy="-3.2" rx="2.1" ry="3" transform="rotate(${a})" fill="${color}"/>`)
    .join('');
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(2)})"><g class="flower" style="--sd:${(4 + rnd() * 3).toFixed(1)}s;--sdl:-${(rnd() * 5).toFixed(1)}s">
    <path class="stem" d="M0 0 q ${(rnd() * 4 - 2).toFixed(1)} ${(-h / 2).toFixed(1)} 0 ${-h.toFixed(1)}"/>
    <path d="M0 ${(-h * 0.4).toFixed(1)} q -4 -2 -5 -5 q 4 0 5 5z" fill="var(--grass)" opacity=".8"/>
    <g transform="translate(0 ${-h.toFixed(1)})">${petals}<circle r="1.7" fill="#f2c94c"/></g>
  </g></g>`;
}

function tuft(x, y, s) {
  // soft blades: filled slivers rather than strokes
  return `<g class="grass-tuft-g" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})">
    <path d="M-1 0 Q -3 -6 -7 -10 Q -2 -6 1 0Z"/><path d="M-1 0 Q 0 -8 2 -14 Q 2 -7 1.5 0Z"/><path d="M0 0 Q 3 -5 8 -8 Q 3 -3 2 0Z"/></g>`;
}

function meadowSvg(theme) {
  const rnd = seeded(7);
  let flowers = '';
  let tufts = '';
  // flowers on the front meadow band, denser towards the bottom
  for (let i = 0; i < 46; i++) {
    const x = rnd() * 1440;
    const y = 470 + rnd() * 125;
    const sc = 0.8 + ((y - 470) / 125) * 1.1;
    const palette = theme === 'blossom' ? ['#f6c9d2', '#f9dbe3', '#ffffff', '#f6c9d2', '#e9cdee'] : PETALS;
    flowers += flower(x, y, sc, palette[Math.floor(rnd() * palette.length)], rnd);
  }
  for (let i = 0; i < 18; i++) {
    const x = rnd() * 1440;
    const y = 420 + rnd() * 50;
    flowers += flower(x, y, 0.55, PETALS[Math.floor(rnd() * PETALS.length)], rnd);
  }
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 1440;
    const y = 450 + rnd() * 150;
    tufts += tuft(x, y, 0.8 + rnd() * 0.8);
  }
  return `<svg class="meadow-svg" viewBox="0 0 1440 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <path class="hill-far" d="M0 300 C 180 230, 360 250, 520 285 S 860 220, 1040 255 S 1320 240, 1440 270 V600 H0Z"/>
    <path class="hill-mid" d="M0 360 C 220 300, 420 330, 640 355 S 1000 300, 1200 330 S 1380 330, 1440 340 V600 H0Z"/>
    <path class="hill-near" d="M0 420 C 260 380, 520 400, 760 420 S 1180 380, 1440 405 V600 H0Z"/>
    <path class="hill-front" d="M0 470 C 300 445, 640 455, 900 470 S 1260 450, 1440 462 V600 H0Z"/>
    <g>${tufts}</g>
    <g>${flowers}</g>
  </svg>`;
}

function cloudSvg(variant) {
  const shapes = [
    'M20 50 a18 18 0 0 1 22-22 a26 26 0 0 1 48-6 a20 20 0 0 1 32 14 a16 16 0 0 1 4 32 H24 a14 14 0 0 1 -4 -18z',
    'M14 46 a16 16 0 0 1 22-18 a22 22 0 0 1 40 -4 a18 18 0 0 1 30 18 a12 12 0 0 1 0 24 H18 a12 12 0 0 1 -4 -20z',
  ];
  return `<svg class="cloud-svg" viewBox="0 0 140 80" aria-hidden="true"><path d="${shapes[variant % 2]}"/></svg>`;
}

/** Hour-of-day → position of the sun across the sky (an arc). */
function sunPosition(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  const t = Math.min(1, Math.max(0, (h - 6) / 15)); // 6:00 → 21:00
  const x = 10 + t * 80;
  const y = 30 - Math.sin(t * Math.PI) * 20; // highest at midday
  return { x, y };
}

function sitterSpot(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  const t = Math.min(1, Math.max(0, (h - 6) / 16));
  return 8 + t * 84; // % across the meadow
}

let root = null;

export function mountScene(el, theme = 'meadow') {
  root = el;
  const rnd = seeded(3);
  const clouds = [
    { top: 7, w: 230, d: 150, delay: -20, o: 0.95 },
    { top: 17, w: 160, d: 120, delay: -80, o: 0.85 },
    { top: 4, w: 120, d: 180, delay: -120, o: 0.75 },
    { top: 24, w: 200, d: 160, delay: -45, o: 0.7 },
    { top: 12, w: 140, d: 200, delay: -160, o: 0.65 },
  ]
    .map(
      (c, i) =>
        `<div class="cloud" style="top:${c.top}%;--w:${c.w}px;--d:${c.d}s;--delay:${c.delay}s;--o:${c.o}">${cloudSvg(i)}</div>`
    )
    .join('');
  let stars = '';
  for (let i = 0; i < 40; i++) {
    stars += `<i style="left:${(rnd() * 100).toFixed(1)}%;top:${(rnd() * 100).toFixed(1)}%;animation-delay:-${(rnd() * 4).toFixed(1)}s;opacity:${(0.3 + rnd() * 0.7).toFixed(2)}"></i>`;
  }
  el.innerHTML = `
    <div class="stars">${stars}</div>
    <div class="sun"></div>
    ${clouds}
    <div class="meadow-host">${meadowSvg(theme)}</div>
    <div class="bunny-layer">
      <div class="roamer" style="--l:6%;--b:16%;--size:52px;--dist:34vw;--rd:64s;--rdl:-6s"><div class="hopper">${bunnyHop('white')}</div></div>
      <div class="roamer" style="--l:52%;--b:6%;--size:62px;--dist:30vw;--rd:82s;--rdl:-40s"><div class="hopper">${bunnyHop('cream')}</div></div>
      <div class="roamer" style="--l:72%;--b:24%;--size:40px;--dist:16vw;--rd:58s;--rdl:-20s"><div class="hopper resting">${bunnyHop('brown')}</div></div>
      <div class="sitter" style="--b:3%;--size:50px"></div>
    </div>`;
  updateScene();
}

/** Move the sun and the "time-of-day" bunny; called every minute. */
export function updateScene(date = new Date()) {
  if (!root) return;
  const { x, y } = sunPosition(date);
  root.style.setProperty('--sun-x', x + '%');
  root.style.setProperty('--sun-y', y + '%');
  const sitter = root.querySelector('.sitter');
  if (sitter) {
    const h = date.getHours();
    const sleepy = h >= 22 || h < 6;
    sitter.style.setProperty('--l', sitterSpot(date) + '%');
    const state = sleepy ? 'sleep' : 'awake';
    if (sitter.dataset.state !== state) {
      sitter.dataset.state = state;
      sitter.innerHTML = bunnySit('brown', state);
    }
  }
}

export function setSceneTheme(theme) {
  if (!root) return;
  const host = root.querySelector('.meadow-host');
  if (host && host.dataset.theme !== theme) {
    host.dataset.theme = theme;
    host.innerHTML = meadowSvg(theme);
  }
}
