// Hand-drawn SVG art: bunnies, flowers, icons. All original drawings.

export const BUNNY_COATS = {
  white: { body: '#fffdf8', shade: '#ebe3d6', ear: '#f6c9cf' },
  cream: { body: '#f7ebd3', shade: '#e6d4b4', ear: '#f2c1c6' },
  brown: { body: '#d8b896', shade: '#c19d7a', ear: '#efbcbf' },
};

const OUTLINE = 'rgba(110, 90, 70, 0.28)';

/** Side-view hopping bunny, facing right. */
export function bunnyHop(coat = 'white') {
  const c = BUNNY_COATS[coat] || BUNNY_COATS.white;
  return `<svg viewBox="0 0 64 50" aria-hidden="true">
  <ellipse cx="30" cy="47.5" rx="20" ry="2.4" fill="rgba(60,80,50,.16)"/>
  <circle cx="9.5" cy="30" r="5.2" fill="#fff" stroke="${OUTLINE}" stroke-width=".8"/>
  <ellipse cx="25" cy="32" rx="16" ry="12.5" fill="${c.body}" stroke="${OUTLINE}" stroke-width=".8"/>
  <ellipse cx="18" cy="41" rx="9" ry="4.2" fill="${c.shade}"/>
  <ellipse cx="22" cy="36" rx="9" ry="5" fill="${c.body}" opacity=".7"/>
  <g class="ear-twitch">
    <ellipse cx="38" cy="10" rx="3.8" ry="10.5" transform="rotate(-18 38 10)" fill="${c.body}" stroke="${OUTLINE}" stroke-width=".8"/>
    <ellipse cx="38" cy="11" rx="1.7" ry="7.5" transform="rotate(-18 38 11)" fill="${c.ear}"/>
  </g>
  <ellipse cx="43.5" cy="10" rx="3.6" ry="10" transform="rotate(4 43.5 10)" fill="${c.body}" stroke="${OUTLINE}" stroke-width=".8"/>
  <ellipse cx="43.6" cy="11" rx="1.6" ry="7" transform="rotate(4 43.6 11)" fill="${c.ear}"/>
  <ellipse cx="43" cy="25" rx="11" ry="9.5" fill="${c.body}" stroke="${OUTLINE}" stroke-width=".8"/>
  <ellipse cx="38" cy="43" rx="4.6" ry="2.6" fill="${c.body}" stroke="${OUTLINE}" stroke-width=".7"/>
  <g class="blink"><ellipse cx="47" cy="23" rx="1.5" ry="1.8" fill="#3d3530"/></g>
  <circle cx="47.6" cy="22.4" r=".45" fill="#fff"/>
  <ellipse cx="46.5" cy="28" rx="2.4" ry="1.3" fill="#f2b8c0" opacity=".55"/>
  <ellipse cx="53.4" cy="25.4" rx="1.3" ry="1" fill="#e89aa6"/>
</svg>`;
}

/** Front-facing sitting bunny. state: 'awake' | 'study' | 'rest' | 'sleep' */
export function bunnySit(coat = 'white', state = 'awake') {
  const c = BUNNY_COATS[coat] || BUNNY_COATS.white;
  const closed = state === 'sleep' || state === 'rest';
  const eyes = closed
    ? `<path d="M23 31.5q2.2 1.8 4.4 0M36.6 31.5q2.2 1.8 4.4 0" stroke="#3d3530" stroke-width="1.3" fill="none" stroke-linecap="round"/>`
    : `<g class="blink"><ellipse cx="25.2" cy="31" rx="1.7" ry="2"/><ellipse cx="38.8" cy="31" rx="1.7" ry="2"/></g>
       <circle cx="25.8" cy="30.3" r=".5" fill="#fff"/><circle cx="39.4" cy="30.3" r=".5" fill="#fff"/>`;
  const extra =
    state === 'study'
      ? `<g transform="translate(20 46)">
           <path d="M0 2 L12 0 L24 2 L24 12 L12 10 L0 12 Z" fill="#fbf3dc" stroke="${OUTLINE}" stroke-width=".8"/>
           <path d="M12 0 V10" stroke="${OUTLINE}" stroke-width=".8"/>
           <path d="M3 4.5h6M3 7h5M15 4.5h6M15 7h5" stroke="#c8b99a" stroke-width=".8"/>
         </g>`
      : state === 'rest'
      ? `<g transform="translate(40 44) rotate(25)"><path d="M0 0 L3 14 L6 0 Z" fill="#f2a65a"/><path d="M1 0 q2 -5 4 0" stroke="#7fae6e" stroke-width="1.6" fill="none"/></g>`
      : state === 'sleep'
      ? `<text x="46" y="14" font-size="8" fill="currentColor" opacity=".6" font-family="Georgia">z</text><text x="51" y="8" font-size="6" fill="currentColor" opacity=".45" font-family="Georgia">z</text>`
      : '';
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
  <ellipse cx="32" cy="61" rx="20" ry="2.6" fill="rgba(60,80,50,.15)"/>
  <ellipse cx="32" cy="47" rx="17" ry="14" fill="${c.body}" stroke="${OUTLINE}" stroke-width=".8"/>
  <ellipse cx="20" cy="57" rx="7" ry="4" fill="${c.shade}"/>
  <ellipse cx="44" cy="57" rx="7" ry="4" fill="${c.shade}"/>
  <g class="ear-twitch">
    <ellipse cx="25" cy="13" rx="4.2" ry="12" transform="rotate(-10 25 13)" fill="${c.body}" stroke="${OUTLINE}" stroke-width=".8"/>
    <ellipse cx="25" cy="14" rx="1.9" ry="8.5" transform="rotate(-10 25 14)" fill="${c.ear}"/>
  </g>
  <ellipse cx="39" cy="13" rx="4.2" ry="12" transform="rotate(10 39 13)" fill="${c.body}" stroke="${OUTLINE}" stroke-width=".8"/>
  <ellipse cx="39" cy="14" rx="1.9" ry="8.5" transform="rotate(10 39 14)" fill="${c.ear}"/>
  <ellipse cx="32" cy="31" rx="13.5" ry="12" fill="${c.body}" stroke="${OUTLINE}" stroke-width=".8"/>
  <g fill="#3d3530">${eyes}</g>
  <ellipse cx="21.5" cy="35.5" rx="2.6" ry="1.5" fill="#f2b8c0" opacity=".6"/>
  <ellipse cx="42.5" cy="35.5" rx="2.6" ry="1.5" fill="#f2b8c0" opacity=".6"/>
  <path d="M30.6 34.3 h2.8 l-1.4 1.6 z" fill="#e89aa6"/>
  <path d="M32 36 q-1.6 1.8 -3 .6 M32 36 q1.6 1.8 3 .6" stroke="#b7867d" stroke-width=".7" fill="none" stroke-linecap="round"/>
  <ellipse cx="26" cy="52" rx="3.6" ry="2.6" fill="${c.body}" stroke="${OUTLINE}" stroke-width=".7"/>
  <ellipse cx="38" cy="52" rx="3.6" ry="2.6" fill="${c.body}" stroke="${OUTLINE}" stroke-width=".7"/>
  ${extra}
</svg>`;
}

/** Five-petal meadow flower glyph (used for pomodoro dots, streaks etc.) */
export function flowerGlyph(petal = '#f2c6cf', center = '#f6d77a', size = 24) {
  const petals = [0, 72, 144, 216, 288]
    .map((a) => `<ellipse cx="12" cy="6.4" rx="3.6" ry="4.6" transform="rotate(${a} 12 12)" fill="${petal}"/>`)
    .join('');
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${petals}<circle cx="12" cy="12" r="3.2" fill="${center}"/></svg>`;
}

/** Goal flower that grows from seed to full bloom as progress goes 0 → 1. */
export function growingFlower(p) {
  p = Math.max(0, Math.min(1, p));
  const stemH = 18 + 72 * Math.min(1, p / 0.6); // full height at 60%
  const topY = 128 - stemH;
  const leaf1 = p >= 0.15 ? Math.min(1, (p - 0.15) / 0.15) : 0;
  const leaf2 = p >= 0.35 ? Math.min(1, (p - 0.35) / 0.15) : 0;
  const bud = p >= 0.5 ? Math.min(1, (p - 0.5) / 0.15) : 0;
  const bloom = p >= 0.65 ? Math.min(1, (p - 0.65) / 0.35) : 0;
  const petals = [0, 51.4, 102.8, 154.2, 205.6, 257, 308.4]
    .map(
      (a) =>
        `<ellipse cx="60" cy="${topY - 13}" rx="7.5" ry="12" transform="rotate(${a} 60 ${topY}) " fill="url(#petalGrad)" opacity=".95"/>`
    )
    .join('');
  const sparkle =
    p >= 1
      ? `<g fill="#f6d77a" opacity=".9">
          <path d="M22 ${topY - 20} l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/>
          <path d="M98 ${topY - 6} l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5z"/>
          <path d="M90 ${topY - 36} l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2z"/></g>`
      : '';
  return `<svg viewBox="0 0 120 140" role="img" aria-label="Goal flower, ${Math.round(p * 100)} percent grown">
  <defs>
    <radialGradient id="petalGrad" cx="50%" cy="80%" r="80%"><stop offset="0" stop-color="#fbe3e8"/><stop offset="1" stop-color="#eeb2c0"/></radialGradient>
    <linearGradient id="potGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e7c9a6"/><stop offset="1" stop-color="#cfa77f"/></linearGradient>
  </defs>
  <path d="M60 128 C ${58} ${128 - stemH * 0.4}, ${63} ${128 - stemH * 0.7}, 60 ${topY}" stroke="#6f9a6c" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <g class="grow-part" style="transform-origin:60px ${128 - stemH * 0.35}px; transform: scale(${leaf1}); opacity:${leaf1}">
    <path d="M60 ${128 - stemH * 0.35} q -22 -4 -26 -18 q 18 -2 26 18z" fill="#8fbf84"/>
  </g>
  <g class="grow-part" style="transform-origin:60px ${128 - stemH * 0.6}px; transform: scale(${leaf2}); opacity:${leaf2}">
    <path d="M60 ${128 - stemH * 0.6} q 22 -4 25 -17 q -18 -1 -25 17z" fill="#9dc890"/>
  </g>
  <g class="grow-part" style="transform-origin:60px ${topY}px; transform: scale(${bloom}); opacity:${bloom}">${petals}</g>
  <g class="grow-part" style="transform-origin:60px ${topY}px; transform: scale(${Math.max(bud * (1 - bloom * 0.4), bloom ? 0.8 : 0)}); opacity:${bud}">
    <ellipse cx="60" cy="${topY - 2}" rx="7.5" ry="9" fill="${bloom ? '#f6d77a' : '#f2c6cf'}"/>
    ${bloom ? `<circle cx="57.5" cy="${topY - 4}" r="1.3" fill="#e2b94e"/><circle cx="62" cy="${topY - 1}" r="1.2" fill="#e2b94e"/><circle cx="60.5" cy="${topY - 6}" r="1" fill="#e2b94e"/>` : ''}
  </g>
  ${p < 0.05 ? `<ellipse cx="60" cy="122" rx="4" ry="3" fill="#a88a64"/>` : ''}
  <path d="M38 124 h44 l-5 16 h-34z" fill="url(#potGrad)"/>
  <rect x="35" y="119" width="50" height="8" rx="3" fill="#dcb88f"/>
  ${sparkle}
</svg>`;
}

const ICONS = {
  home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  tasks: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.3 1.3L7 5M3.5 12l1.3 1.3L7 11M3.5 18l1.3 1.3L7 17"/>',
  stats: '<path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="6.5" rx="1"/><rect x="10.5" y="6" width="3" height="11.5" rx="1"/><rect x="15.5" y="9" width="3" height="8.5" rx="1"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><circle cx="9" cy="14.5" r=".6" fill="currentColor"/><circle cx="15" cy="14.5" r=".6" fill="currentColor"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="7" y="5.5" width="3.6" height="13" rx="1.4" fill="currentColor" stroke="none"/><rect x="13.4" y="5.5" width="3.6" height="13" rx="1.4" fill="currentColor" stroke="none"/>',
  reset: '<path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M5 4.5V8h3.5"/>',
  skip: '<path d="M6 6l8 6-8 6z"/><path d="M17.5 6v12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M14.5 5.5l4 4L9 19H5v-4z"/><path d="M12.5 7.5l4 4"/>',
  trash: '<path d="M5 7h14"/><path d="M9.5 7V5h5v2"/><path d="M7 7l1 12h8l1-12"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevDown: '<path d="m7 10 5 5 5-5"/>',
  chevLeft: '<path d="m14.5 6-6 6 6 6"/>',
  chevRight: '<path d="m9.5 6 6 6-6 6"/>',
  book: '<path d="M12 7c-2-1.5-4.5-2-8-2v12c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2V5c-3.5 0-6 .5-8 2z"/><path d="M12 7v12"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19 13 11"/>',
  cup: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M9 3.5c-.8 1 .8 2 0 3M12.5 3.5c-.8 1 .8 2 0 3"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  bird: '<path d="M4 14c3 0 5-2 6-5 1-2.5 3-4 5.5-4 1.8 0 3 1 3.5 2l2 .5-2 1c0 5-4 9-10 9-3 0-5-1.5-5-3.5z"/><circle cx="16" cy="7.5" r=".6" fill="currentColor"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  sparkle: '<path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 19h14"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/>',
  flame: '<path d="M12 20c-3.5 0-6-2.3-6-5.6 0-3.6 3.2-5.3 3.6-9.4 2.7 1.4 4.3 3.7 4.6 6.1.8-.7 1.3-1.7 1.4-2.9 1.6 1.4 2.4 3.6 2.4 6.2 0 3.3-2.5 5.6-6 5.6z"/>',
  volume: '<path d="M5 10v4h3l4 3.5v-11L8 10z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M17.8 7.2a7 7 0 0 1 0 9.6"/>',
  mute: '<path d="M5 10v4h3l4 3.5v-11L8 10z"/><path d="m16 10 4 4M20 10l-4 4"/>',
  sync: '<path d="M19 12a7 7 0 0 1-12.2 4.7M5 12a7 7 0 0 1 12.2-4.7"/><path d="M17.5 3.5v4h-4M6.5 20.5v-4h4"/>',
  note: '<path d="M6 4h9l3 3v13H6z"/><path d="M9 10h6M9 14h6M9 18h3"/>',
};

export function icon(name, extra = '') {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${ICONS[name] || ''}</svg>`;
}

/** App logo: bunny face on a sage circle */
export function logo(size = 48) {
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
  <circle cx="32" cy="32" r="30" fill="#cfe4c4"/>
  <path d="M2 40 Q 32 30 62 40 L62 44 A30 30 0 0 1 2 44Z" fill="#a8cf9a"/>
  <ellipse cx="25" cy="18" rx="4.5" ry="12" transform="rotate(-10 25 18)" fill="#fffdf8"/>
  <ellipse cx="25" cy="19" rx="2" ry="8" transform="rotate(-10 25 19)" fill="#f6c9cf"/>
  <ellipse cx="39" cy="18" rx="4.5" ry="12" transform="rotate(10 39 18)" fill="#fffdf8"/>
  <ellipse cx="39" cy="19" rx="2" ry="8" transform="rotate(10 39 19)" fill="#f6c9cf"/>
  <ellipse cx="32" cy="38" rx="14" ry="12.5" fill="#fffdf8"/>
  <ellipse cx="26.5" cy="37" rx="1.7" ry="2" fill="#3d3530"/><ellipse cx="37.5" cy="37" rx="1.7" ry="2" fill="#3d3530"/>
  <ellipse cx="22.5" cy="41.5" rx="2.6" ry="1.4" fill="#f2b8c0" opacity=".7"/><ellipse cx="41.5" cy="41.5" rx="2.6" ry="1.4" fill="#f2b8c0" opacity=".7"/>
  <path d="M30.6 40.6 h2.8 l-1.4 1.6 z" fill="#e89aa6"/>
</svg>`;
}
