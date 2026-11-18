// Shared UI pieces: modal / bottom sheet, confirm, toast, tooltip, celebration.

import { icon, flowerGlyph } from './art.js';
import { escapeHtml } from './util.js';

let openCount = 0;

export function openModal({ title, body, onMount, label }) {
  const prevFocus = document.activeElement;
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(label || title || 'Dialog')}">
      ${title ? `<div class="panel-title" style="margin-bottom:6px"><h2 style="margin:0">${escapeHtml(title)}</h2><button class="icon-btn sm plain" data-close aria-label="Close">${icon('close')}</button></div>` : ''}
      <div class="modal-body">${body}</div></div>`;
  document.body.appendChild(back);
  openCount++;
  const modal = back.querySelector('.modal');
  const close = () => {
    if (!back.isConnected) return;
    back.remove();
    openCount--;
    document.removeEventListener('keydown', onKey);
    if (prevFocus && prevFocus.focus) prevFocus.focus();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = [...modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault();
        f[0].focus();
      }
    }
  };
  document.addEventListener('keydown', onKey);
  back.addEventListener('mousedown', (e) => {
    if (e.target === back) close();
  });
  back.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  if (onMount) onMount(modal, close);
  const first = modal.querySelector('[autofocus], input, select, textarea, .btn-primary');
  if (first && window.matchMedia('(pointer: fine)').matches) first.focus();
  else modal.querySelector('[data-close]')?.focus();
  return close;
}

export function isModalOpen() {
  return openCount > 0;
}

export function confirmDialog({ title, message, confirm = 'OK', cancel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const close = openModal({
      title,
      body: `<p class="muted" style="line-height:1.55">${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button class="btn" data-no>${escapeHtml(cancel)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${escapeHtml(confirm)}</button>
        </div>`,
      onMount(m, close) {
        m.querySelector('[data-no]').onclick = () => {
          answered = true;
          resolve(false);
          close();
        };
        m.querySelector('[data-yes]').onclick = () => {
          answered = true;
          resolve(true);
          close();
        };
      },
    });
    // resolve false if closed by Esc / backdrop
    const obs = new MutationObserver(() => {
      if (!document.querySelector('.modal-backdrop') && !answered) {
        answered = true;
        resolve(false);
      }
      if (answered) obs.disconnect();
    });
    obs.observe(document.body, { childList: true });
    void close;
  });
}

let toastHost = null;
export function toast(message, { icon: ic = 'flower', action, timeout = 4200 } = {}) {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toasts';
    toastHost.setAttribute('role', 'status');
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  const glyph = ic === 'flower' ? flowerGlyph('#f2c6cf', '#f6d77a', 22) : icon(ic);
  t.innerHTML = `${glyph}<span>${escapeHtml(message)}</span>${action ? `<button class="btn btn-sm">${escapeHtml(action.label)}</button>` : ''}`;
  if (action) t.querySelector('button').onclick = () => {
    action.onClick();
    dismiss();
  };
  toastHost.appendChild(t);
  while (toastHost.children.length > 3) toastHost.firstChild.remove();
  function dismiss() {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }
  setTimeout(dismiss, timeout);
}

// ---------- tooltip for charts ----------
let tip = null;
export function showTip(html, x, y) {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
  }
  tip.innerHTML = html;
  tip.style.left = Math.min(window.innerWidth - 80, Math.max(80, x)) + 'px';
  tip.style.top = Math.max(50, y) + 'px';
  tip.classList.add('show');
}
export function hideTip() {
  tip?.classList.remove('show');
}

/** Hover/tap tooltips for any element with data-tip inside root */
export function bindTips(root) {
  root.querySelectorAll('[data-tip]').forEach((el) => {
    const show = () => {
      const r = el.getBoundingClientRect();
      showTip(el.dataset.tip, r.left + r.width / 2, r.top);
    };
    el.addEventListener('mouseenter', show);
    el.addEventListener('focus', show);
    el.addEventListener('mouseleave', hideTip);
    el.addEventListener('blur', hideTip);
  });
}

// ---------- celebration ----------
export function celebrate(title, message, reduced) {
  const host = document.createElement('div');
  host.className = 'celebrate';
  host.setAttribute('aria-live', 'assertive');
  const colors = ['#f2c6cf', '#f6e3a1', '#fffdf8', '#d9cdee', '#b9d6ea', '#cfe4c4'];
  let petals = '';
  if (!reduced) {
    for (let i = 0; i < 46; i++) {
      petals += `<i class="petal" style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};--fd:${3 + Math.random() * 2.5}s;--fdl:${Math.random() * 1.2}s;--dx:${Math.random() * 160 - 80}px;--rot:${360 + Math.random() * 540}deg"></i>`;
    }
  }
  host.innerHTML = `${petals}<div class="celebrate-card">${flowerGlyph('#f2c6cf', '#f6d77a', 70)}<h2>${escapeHtml(title)}</h2><p class="muted" style="margin-top:6px">${escapeHtml(message)}</p></div>`;
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 5400);
}
