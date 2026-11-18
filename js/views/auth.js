// Welcome / sign in / sign up / password reset screens.

import * as sync from '../sync.js';
import { logo } from '../art.js';
import { escapeHtml } from '../util.js';

export function renderAuth(host, { onDone, mode: startMode = 'signin', recovery = false }) {
  let mode = recovery ? 'newpass' : startMode;
  let info = '';

  function paint(err = '') {
    const titles = {
      signin: ['Welcome back', 'Sign in to sync your meadow across devices.'],
      signup: ['Create your meadow', 'One account for your laptop and your phone.'],
      reset: ['Forgot your password?', 'We’ll email you a link to choose a new one.'],
      newpass: ['Choose a new password', 'Almost there.'],
    };
    const [title, sub] = titles[mode];
    host.innerHTML = `<div class="auth-wrap"><section class="panel auth-card view-enter" aria-labelledby="auth-title">
      <span class="logo">${logo(74)}</span>
      <h1 id="auth-title">${title}</h1>
      <p class="sub">${sub}</p>
      ${info ? `<p class="note" style="margin-bottom:14px">${escapeHtml(info)}</p>` : ''}
      <form data-form novalidate>
        ${mode !== 'newpass' ? `<label class="field"><span>Email</span><input class="input" type="email" name="email" autocomplete="email" required placeholder="you@example.com"></label>` : ''}
        ${mode !== 'reset' ? `<label class="field"><span>${mode === 'newpass' ? 'New password' : 'Password'}</span><input class="input" type="password" name="password" minlength="6" required autocomplete="${mode === 'signin' ? 'current-password' : 'new-password'}" placeholder="At least 6 characters"></label>` : ''}
        <p class="auth-err" role="alert">${escapeHtml(err)}</p>
        <button class="btn btn-primary" type="submit">${{ signin: 'Sign in', signup: 'Create account', reset: 'Send reset link', newpass: 'Save password' }[mode]}</button>
      </form>
      <div style="text-align:center;margin-top:14px;font-size:.92rem">
        ${mode === 'signin' ? `New here? <button class="linkish" data-go="signup">Create an account</button><br><button class="linkish" data-go="reset" style="font-weight:600;font-size:.85rem">Forgot password?</button>` : ''}
        ${mode === 'signup' || mode === 'reset' ? `Already have an account? <button class="linkish" data-go="signin">Sign in</button>` : ''}
      </div>
      ${mode !== 'newpass' ? `<div class="divider">or</div><button class="btn" data-guest>Continue on this device only</button>
      <p class="faint" style="font-size:.8rem;text-align:center;margin-top:10px">You can sign in later from Settings – anything you do now will be kept.</p>` : ''}
    </section></div>`;

    host.querySelectorAll('[data-go]').forEach((b) =>
      b.addEventListener('click', () => {
        mode = b.dataset.go;
        info = '';
        paint();
      })
    );
    host.querySelector('[data-guest]')?.addEventListener('click', () => {
      sync.continueAsGuest();
      onDone();
    });
    const form = host.querySelector('[data-form]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      const email = form.email?.value.trim();
      const password = form.password?.value || '';
      if (mode !== 'newpass' && !/^\S+@\S+\.\S+$/.test(email || '')) return paint('Please enter a valid email address.');
      if (mode !== 'reset' && password.length < 6) return showErr('Please use at least 6 characters for your password.');
      btn.disabled = true;
      btn.textContent = 'One moment…';
      try {
        if (mode === 'signin') {
          await sync.signIn(email, password);
          onDone();
        } else if (mode === 'signup') {
          const r = await sync.signUp(email, password);
          if (r.signedIn) onDone();
          else {
            mode = 'signin';
            info = 'Check your inbox to confirm your email, then sign in here.';
            paint();
          }
        } else if (mode === 'reset') {
          await sync.sendPasswordReset(email);
          mode = 'signin';
          info = 'If that email has an account, a reset link is on its way.';
          paint();
        } else if (mode === 'newpass') {
          await sync.updatePassword(password);
          onDone();
        }
      } catch (err) {
        showErr(err.message);
      }
      function showErr(m) {
        btn.disabled = false;
        btn.textContent = { signin: 'Sign in', signup: 'Create account', reset: 'Send reset link', newpass: 'Save password' }[mode];
        host.querySelector('.auth-err').textContent = m;
      }
    });
    const first = host.querySelector('input');
    if (first && window.matchMedia('(pointer: fine)').matches) first.focus();
  }
  paint();
}
