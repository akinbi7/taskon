# Taskon

A small task-and-points club inside Telegram. Check in once a day, finish a few
tasks, bring a friend, watch the board.

**Points are a score.** There is no token, no wallet, no purchase, no cash-out,
and no promise of one anywhere in the app or its copy.

## Stack

- **Frontend:** React 18 + Vite + TypeScript, Telegram WebApp SDK, deployed to Vercel
- **Backend:** Supabase Postgres + one Edge Function (`api`) with all reads/writes
- **Bot:** Python 3.11+, aiogram 3, webhook mode, hosted on Render or Railway

## What is built

1. **Telegram auth.** The Edge Function verifies the HMAC-SHA256 signature on
   `initData` with the bot token. IDs from the client are never trusted.
2. **Home.** Balance, daily check-in, streak, next tasks, rank.
3. **Tasks.** Channel joins are checked with Telegram `getChatMember`. Other
   task types use a server-side timer before a claim is accepted.
4. **Referrals.** `t.me/<bot>?startapp=ref_<telegram_id>`. Both people get the
   bonus once; self-referrals and repeats are ignored.
5. **Leaderboard.** Top 100 plus the signed-in user's own row.
6. **Admin console.** `/admin`, gated by `ADMIN_IDS` on every request. Tasks
   CRUD, user search, points adjustment with a reason, bans, stats, suspicious
   account flags, and an audit log of every admin write.
7. **Bot.** Opens the Mini App, answers `/start` and `/help`.

## Project layout

```
src/                       React Mini App
  components/              Hand-drawn SVG icons, task rows, check-in, tab bar
  screens/                 Home, Tasks, Friends, Ranks, Admin
  lib/                     API client, session, Telegram helpers, demo adapter
  styles/                  Palette, typography, layout, admin styles
supabase/
  migrations/
    0001_schema.sql        Tables and indexes
    0002_rls.sql           RLS on every table, client roles revoked
    0003_functions.sql     Point/claim/admin functions + permission lockdown
  functions/
    api/index.ts           POST router
    _shared/               Telegram signature check, auth, tasks, admin, errors
bot/
  bot.py                   aiogram webhook service
public/fonts/              Self-hosted Fraunces + Archivo (no runtime CDN)
```

## Point rules

| Action | Points |
| --- | --- |
| Daily check-in | 10 base |
| Streak bonus | +2 for each consecutive day after the first, capped at +10 |
| Task | The task's configured reward |
| Referral | 50 to the referrer, 25 to the friend, once per pair |
| Admin adjustment | Any integer, clamped so a balance can't go below zero, with a reason |

Every balance change is written to `point_ledger`. The Mini App can only call
server functions; it cannot send a point delta.

## Local frontend

```bash
npm install
cp .env.example .env      # optional for local demo
VITE_DEMO=1 npm run dev
```

Open `http://127.0.0.1:5173` and use a 360px viewport. Demo mode is a local
adapter with fixture users, tasks and admin data; it lets you exercise the UI
without Telegram. It is enabled only when `VITE_DEMO=1` **and** there is no
Telegram `initData`.

Checks:

```bash
npm run test       # initData signature + referral param tests
npm run typecheck
npm run build
```

## Database setup

Create a Supabase project, then run the three migration files **in order** in
the SQL editor. With the Supabase CLI:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Migrations create:

- `users`, `tasks`, `user_tasks`, `user_task_starts`, `referrals`,
  `point_ledger`, `admin_actions`, `rate_limit_events`
- indexes for the leaderboard, claims, referrals, ledger and rate limits
- RLS on all tables, forced, with `anon` and `authenticated` revoked
- security-definer functions for check-in, task start/claim, referrals,
  leaderboard, rate limiting and every admin write

`gen_random_uuid()` is built into Postgres 13+; no extension is required.

## Edge Function

Set secrets on the Supabase project:

```bash
supabase secrets set \
  BOT_TOKEN="123456:..." \
  BOT_USERNAME="your_bot" \
  ADMIN_IDS="111111111,222222222" \
  ALLOWED_ORIGINS="https://your-app.vercel.app"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase; never
put the service role key in the frontend or commit it.

Deploy:

```bash
supabase functions deploy api --no-verify-jwt
```

`supabase/config.toml` already sets `verify_jwt = false` because this function
uses Telegram's signature, not Supabase Auth. The `--no-verify-jwt` flag makes
that explicit and works with older CLI versions.

The endpoint is:

```
POST https://<project>.supabase.co/functions/v1/api
```

Every request has `{ action, initData, payload }`, and every response is either
`{ data }` or `{ error: { code, message } }`. There is no unsigned testing mode:
a request without a valid Telegram signature is rejected before it reaches the
database.

## Bot setup

1. In BotFather: `/newbot`, keep the token.
2. Create the Mini App (`/newapp`) or set the menu button (`/setmenubutton`)
   with the Vercel URL over HTTPS.
3. Deploy `bot/` to Render or Railway:
   - **Root directory:** `bot`
   - **Build:** `pip install -r requirements.txt`
   - **Start:** `python bot.py`
   - **Health check:** `/healthz`
4. Set the environment:

```bash
BOT_TOKEN=123456:...
PUBLIC_URL=https://your-bot.onrender.com
WEBAPP_URL=https://your-app.vercel.app
WEBHOOK_SECRET=optional-long-random-string
PORT=8080
```

On startup the bot sets its own webhook to `${PUBLIC_URL}/webhook`
(`/webhook/<secret>` is not used; the secret is sent in Telegram's
`X-Telegram-Bot-Api-Secret-Token` header). It keeps the webhook registered on
shutdown so Telegram retries can wake a sleeping free-tier service, and it
registers `/start` and `/help`.

**Channel verification:** add the bot to each channel used in a `join_channel`
task. Public `https://t.me/<channel>` links and `@channel` values work; private
invite links (`t.me/+...`) can't be resolved by `getChatMember`, so use a public
channel or verify another way. The bot must be able to see the member list.

## Vercel

1. Import the repository; the framework is Vite and the output is `dist`.
2. Add environment variables:
   - `VITE_API_URL` = `https://<project>.supabase.co/functions/v1`
   - `VITE_BOT_USERNAME` = the bot username without `@` (used by the
     "Open @bot" fallback link; real referral links are built server-side from
     the Supabase `BOT_USERNAME` secret)
   - Do **not** set `VITE_DEMO` in production.
3. Deploy, then update the BotFather Mini App/menu URL to the Vercel URL.
4. Add the Vercel origin to `ALLOWED_ORIGINS` on the function if you configured
   that secret. Leaving `ALLOWED_ORIGINS` unset allows any origin; setting it is
   recommended.
5. Redeploy the function after changing any secret that affects auth or CORS.

`vercel.json` rewrites unknown paths to `index.html`, so `/admin` works on a
direct visit. Fonts are self-hosted and cached immutably.

## Admin console

Add numeric Telegram IDs to `ADMIN_IDS` (comma-separated). The server checks the
list on every `admin.*` request; the UI gate is convenience only. Admins see a
**Console** link on the Today screen and can open `/admin`.

- **Overview:** total users, active today (UTC), tasks today, points issued,
  check-ins, referrals, flags, top referrers, most-finished tasks.
- **Tasks:** create, edit, disable/enable, delete; set title, type, reward, URL,
  timer and optional expiry.
- **People:** search by username, first name or Telegram ID; points, streak,
  referrals, tasks done; adjust points with a mandatory reason; ban/unban with a
  reason.
- **Flags:** referral bursts (8+ in an hour, 25+ in 24h) and two claims in the
  same second. Flags are patterns, not verdicts; review the account.
- **Log:** every state-changing admin action with reason and details. Admin
  reads (opening tabs) are not logged.

All admin writes run in SQL functions that also write `admin_actions`.
Task deletion is permanent and removes its claim records; the audit entry keeps
the title, URL, reward and completion count snapshot.

## Environment variables

| Where | Variable | Purpose |
| --- | --- | --- |
| Vercel | `VITE_API_URL` | Supabase function base URL, no trailing slash |
| Vercel | `VITE_BOT_USERNAME` | Bot handle for the fallback link and local demo |
| Local only | `VITE_DEMO` | `1` enables the fixture UI adapter |
| Supabase | `BOT_TOKEN` | Verifies initData and calls `getChatMember` |
| Supabase | `BOT_USERNAME` | Builds referral links |
| Supabase | `ADMIN_IDS` | Numeric Telegram IDs allowed into admin actions |
| Supabase | `ALLOWED_ORIGINS` | Optional comma-separated CORS allowlist |
| Bot host | `BOT_TOKEN` | Same bot token |
| Bot host | `PUBLIC_URL` | HTTPS URL of the bot service |
| Bot host | `WEBAPP_URL` | HTTPS URL of the Mini App |
| Bot host | `WEBHOOK_SECRET` | Optional webhook secret |
| Bot host | `PORT` | HTTP port, default 8080 |

See `.env.example` and `bot/.env.example`.

## Security notes

- **Signed sessions.** `initData` is verified with the bot token; the hash is
  checked in constant time and `auth_date` must be under 24 hours old. Client
  user IDs and points are never accepted.
- **Server-only balances.** RLS is forced on every table and `anon` /
  `authenticated` have no table or function access. The Edge Function uses the
  service role. `point_ledger` records every change.
- **One claim.** `user_tasks` has a unique `(user_id, task_id)` pair and
  `complete_task` locks the user row. Concurrent double-taps cannot pay twice.
- **Timers are server-side.** Starting a task stores `started_at`; claiming
  checks it against `now()`. Calling start again does not reset the clock.
- **Channel joins.** Only Telegram's `getChatMember` result (creator,
  administrator, member, or a restricted member) is accepted.
- **Rate limits.** SQL-backed per-user windows cover session, check-in, task
  start/claim, referrals, leaderboard and admin writes.
- **Referrals.** Self-referrals, banned referrers, repeat attribution and
  repeat payouts are ignored. `referrals.referred_id` is unique.
- **Bans.** Banned users are rejected during authentication and don't appear on
  the leaderboard.
- **Admin.** `ADMIN_IDS` is checked server-side on every admin request, not just
  when the page renders. Admin writes are audited.
- **Secrets.** Bot token and service role key stay server-side. `VITE_*` values
  are public by definition.

Known limits: timer tasks prove elapsed time, not attention; channel checks need
the bot in the channel; rate limiting is per account, not per IP; SQL cleanup of
old rate-limit rows is opportunistic.

## Manual test checklist

Before pointing real users at it:

1. Open from the bot on a phone. Check in once; the second tap is refused.
2. Check in on two consecutive days (or adjust the date in SQL) and confirm the
   streak bonus.
3. Start a timed task, try to claim immediately (refused), then claim after the
   timer. The task moves to Done and points increase once.
4. Join a test channel; verify success. Leave and confirm the claim is refused.
5. Open a referral link as a new Telegram account; confirm both balances, then
   reopen the link and confirm no second bonus is credited.
6. Check the leaderboard shows the top 100 and your own rank if outside it.
7. As a non-admin, call an `admin.*` action and confirm 403.
8. As an admin: create/edit/disable/delete a task, adjust points, ban/unban,
   inspect flags, and verify each write appears in the log.
9. Test at 360px width and in Telegram's dark theme. Check the tab bar clears
   the safe area.
10. Confirm `VITE_DEMO` is unset in production and no unsigned auth path exists.

## Design notes

- Warm paper (`#f3ecdf`) and deep warm bark (`#241f19`), with terracotta and a
  muted olive as the only accents. The dark theme uses `#1b1713`, never pure
  black. No gradients, glass, neon or emoji icons.
- **Fraunces** (display) and **Archivo** (body), self-hosted in
  `public/fonts/` and declared in `src/styles/tokens.css`.
- Custom SVG icons share a 1.7px stroke; borders and corners are deliberately
  uneven. The layout is list- and rule-based rather than a grid of identical
  cards.
- Motion is limited: spring on claim/check-in, count-up on points, a flame
  flicker, and a short screen entrance. `prefers-reduced-motion` disables all
  of it.
- Telegram theme changes, viewport changes and safe-area insets are handled in
  `src/lib/telegram.ts`; the palette has a dark variant, header background is
  set from the app, and the tab bar respects `safeAreaInset`.

## Deploy checklist

- [ ] Migrations run in order; RLS enabled
- [ ] `BOT_TOKEN`, `BOT_USERNAME`, `ADMIN_IDS` set as Supabase secrets
- [ ] `api` function deployed with Telegram auth (JWT verification off)
- [ ] Vercel env has `VITE_API_URL` and `VITE_BOT_USERNAME`
- [ ] BotFather Mini App / menu button points at the Vercel URL
- [ ] Bot service healthy at `/healthz`, webhook set, bot added to task channels
- [ ] Admin IDs tested; console visible and protected
- [ ] `VITE_DEMO` unset in production
- [ ] 360px + dark theme + one full user journey tested in Telegram
