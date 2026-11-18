import * as store from '../store.js';
import { openModal, toast } from '../ui.js';
import { fmtDuration } from '../util.js';

export function openGoalEditor() {
  const cur = store.getSettings().goalMin;
  const presets = [60, 120, 180, 240, 300];
  openModal({
    title: 'Daily study goal',
    body: `<p class="muted" style="margin-bottom:14px">How much focused study would make today feel good?</p>
      <div class="segmented" role="group" aria-label="Goal presets" style="flex-wrap:wrap;margin-bottom:16px">
        ${presets.map((m) => `<button type="button" data-g="${m}" aria-pressed="${cur === m}">${m / 60}h</button>`).join('')}
      </div>
      <form data-form class="row">
        <label class="field grow" style="margin:0"><span>Custom (minutes)</span>
          <input class="input" type="number" name="min" min="10" max="960" step="5" value="${cur}"></label>
        <button class="btn btn-primary" type="submit" style="align-self:flex-end">Save</button>
      </form>`,
    onMount(m, close) {
      const save = (min) => {
        const v = Math.max(10, Math.min(960, Math.round(Number(min) || 0)));
        store.updateSettings({ goalMin: v });
        toast(`Daily goal set to ${fmtDuration(v * 60)}`, { icon: 'sparkle' });
        close();
      };
      m.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => save(b.dataset.g)));
      m.querySelector('[data-form]').addEventListener('submit', (e) => {
        e.preventDefault();
        save(e.target.min.value);
      });
    },
  });
}
