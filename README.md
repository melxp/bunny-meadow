# 🐰 Bunny Meadow — study & Pomodoro sanctuary

A calm, bunny-meadow study app: Pomodoro timer, tasks and to-dos, detailed study statistics,
a study calendar and daily goals. Works on laptop and phone, installs as an app (PWA), works
offline and syncs between devices through Supabase.

---

## 1. Quick start (5–10 minutes)

### a) Create the database (free)
1. Go to <https://supabase.com>, sign up and create a **New project** (any name, e.g. `bunny-meadow`; pick the region closest to you).
2. In the project, open **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and press **Run**.
   This creates the `tasks`, `sessions` and `user_settings` tables with Row Level Security, so each account can only ever read its own rows.
3. Open **Project Settings → API** (or **Connect**) and copy the **Project URL** and the **anon / publishable key**.
4. Open **Authentication → URL Configuration** and set **Site URL** to the address where you'll host the app (step b), e.g. `https://bunny-meadow.netlify.app`.
   *Optional:* under **Authentication → Providers → Email** you can turn off “Confirm email” if you want to sign in immediately without clicking a confirmation link.

### b) Put your keys in `config.js`
```js
window.BUNNY_MEADOW_CONFIG = {
  supabaseUrl: 'https://abcd1234.supabase.co',
  supabaseAnonKey: 'eyJhbGciOi…',
};
```
The anon key is designed to be public; your data is protected by Row Level Security and your password.
(You can also paste these into **Settings → Account & sync** inside the app instead of editing the file.)

### c) Host it (any static host, HTTPS required for install + notifications)
There is **no build step** – upload the folder as it is.

- **Netlify (easiest):** go to <https://app.netlify.com/drop> and drag the `bunny-meadow` folder onto the page.
- **Vercel:** `npx vercel` inside the folder, or import the folder from GitHub.
- **GitHub Pages:** push the folder to a repo → Settings → Pages → deploy from branch.
- **Cloudflare Pages:** create a project → upload assets.

### d) Install on your phone
Open the site on your phone and sign in with the same account as on your laptop.
- **iPhone (Safari):** Share → *Add to Home Screen*. (Notifications on iOS only work for the installed app, iOS 16.4+.)
- **Android (Chrome):** menu ⋮ → *Install app*.

### Running it locally
```bash
cd bunny-meadow
python3 -m http.server 8080      # then open http://localhost:8080
```
Without Supabase keys the app runs in **this-device-only** mode (everything is saved in the browser). When you add keys and sign in later, everything you did is uploaded into your account.

---

## 2. What's inside

| Area | Highlights |
|---|---|
| **Home** | Live clock & date, time-of-day greeting, daily message, big circular timer with a little bunny who reads while you focus and nibbles a carrot on breaks, current task picker, today's study time / pomodoros / tasks / breaks, streak, growing goal flower, to-do preview with quick add |
| **Timer** | Custom focus/short/long lengths and sessions-before-long-break, start/pause/resume/reset/skip, manual mode switching, automatic transitions (separately for breaks and focus), long break after N sessions, bell + break chime, browser notifications, time shown in the tab title |
| **Tasks** | Create/edit/delete, subject, priority, optional due date, notes, complete/undo, to-do vs completed tabs, filter by subject, sort, search, per-task pomodoros and real focus time, “study this now”, sessions without a task (optional free label) |
| **Statistics** | Today (study time, pomodoros, tasks, breaks, goal %), weekly bar chart with week navigation, monthly day-by-day chart, monthly totals, weekly totals, GitHub-style heatmap (green = more study, darkest = goal met), subject breakdown (week/month/all), current & longest streak, daily averages, most productive weekday. Tap any bar/day for that day's full details. “Table” buttons show the numbers as tables. |
| **Calendar** | Month grid shaded by study time with a flower on goal-met days, month totals, and a detail panel per day: sessions timeline, subjects, tasks completed |
| **Settings** | Timer, goal, sounds (bell/chime volume + on/off + test, birdsong & breeze ambience with separate volumes), notifications, 4 meadow themes (Sunny Meadow default, Golden Hour, Spring Blossom, Moonlit Meadow), scene brightness, reduce motion, your name, account & sync status, backup export/import |

**Rules for study time** – only *focus* time counts, breaks never do. By default only completed focus sessions count. If you skip/reset a focus session after at least a minute it is still saved (marked “unfinished”), and it only counts if you switch on *Count unfinished sessions*.

---

## 3. How it works

### Stack (and why)
- **Plain HTML/CSS + JavaScript ES modules, no build step.** Nothing to install, nothing to break, trivial to host, easy to read and change. (React/Next.js would add a build pipeline without adding anything this app needs.)
- **Supabase** for authentication (email + password, password reset) and Postgres storage, called through its REST APIs directly (`js/sync.js`), so no SDK is needed.
- **PWA:** `manifest.webmanifest` + `sw.js` (offline app shell, installable, notification clicks).
- **Charts, scene, bunnies and sounds are all hand-made** (SVG and the Web Audio API) – no external assets.

### Files
```
index.html            app shell + loading screen
config.js             your Supabase URL / anon key
css/styles.css        all styling, themes, responsive layout
js/app.js             boot, routing, nav, celebration
js/timer-engine.js    pure, timestamp-based Pomodoro logic (unit tested)
js/timer.js           timer controller: persistence, ticking, sounds, notifications
js/store.js           offline-first local store with change tracking
js/sync.js            Supabase auth + two-way sync
js/stats.js           all statistics calculations (unit tested)
js/scene.js / art.js  meadow scene, bunnies, flowers, icons
js/audio.js           synthesised bell, chime, birdsong & breeze
js/views/*.js         Home, Tasks, Stats, Calendar, Settings, Auth + shared pieces
supabase/schema.sql   tables, indexes, sync trigger, Row Level Security
tests/                unit tests, mock Supabase server, two-device end-to-end test
```

### Accurate timer
The timer never counts ticks. When you press start it stores the **end timestamp**; the display is
always `end − now`. Pausing stores the remaining milliseconds; resuming sets a new end timestamp.
If the tab sleeps, the phone locks or the laptop closes, the next time the page wakes it replays
every session that ended in the meantime **using its real end time** (so a break that started while
you were away has already been running). The timer state is saved, so it even survives a reload.

### Data & sync
- Every change is written locally first (works offline) and marked as *pending*.
- Sync pushes pending rows (upsert), then pulls rows changed on the server since the last pull
  (`server_updated_at`, set by the database). It runs after each change (debounced), on reconnect,
  when you return to the app and every 45 s.
- Conflicts resolve as *last write wins* on `updated_at`; a database trigger guarantees an older
  edit can never overwrite a newer one, and the device adopts whatever the database kept.
- Deletes are soft (`deleted = true`) so they reach your other devices.
- Signing out uploads anything pending, then clears this device's copy.

### Database
`tasks(id, user_id, title, notes, subject, priority, due_date, completed, completed_at, created_at, updated_at, deleted, server_updated_at)`
`sessions(id, user_id, mode, task_id, label, subject, started_at, ended_at, planned_seconds, actual_seconds, completed, local_date, …)`
`user_settings(user_id, data jsonb, updated_at, server_updated_at)`
All three have RLS policies `auth.uid() = user_id`.

---

## 4. Tests
```bash
node --test tests/unit.test.js     # timer engine + statistics (13 tests)
tests/run-e2e.sh                   # two-device browser test against a mock Supabase (needs Python Playwright)
```
The end-to-end test signs up on a “laptop”, creates/edits tasks, runs real Pomodoros with a fake
clock (including pause, auto-break, and a session that finishes while the tab is asleep), completes a
task, checks every statistic, then signs in on a “phone” and verifies the same numbers, settings and
tasks appear, makes changes while offline, reconnects, and checks they reach the laptop (and that
deletions sync back).

---

## 5. Good to know
- **Notifications while closed:** browsers can't run a page's timer once the tab or app is fully closed, so a notification can only appear while the app is open or in the background. The time itself is always correct when you come back.
- **The running timer is per device** (your sessions, tasks, settings and stats all sync).
- Backups: *Settings → Your data → Export backup* downloads everything as JSON.
- Fonts: Fraunces and Nunito from Google Fonts (cached for offline use after the first visit).
