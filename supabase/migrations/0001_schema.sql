-- Taskon · 0001 schema
-- Run in the Supabase SQL editor, or with `supabase db push`.

-- gen_random_uuid() is built into Postgres 13+.
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  username text,
  first_name text,
  points integer not null default 0 check (points >= 0),
  streak integer not null default 0 check (streak >= 0),
  last_checkin date,
  referrer_id uuid references public.users (id) on delete set null,
  banned boolean not null default false,
  ban_reason text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  type text not null check (type in ('join_channel', 'visit_link', 'follow_x', 'partner')),
  reward integer not null check (reward > 0 and reward <= 10000),
  url text not null,
  active boolean not null default true,
  -- Only used by timed tasks. Channel joins are verified through the Bot API.
  timer_seconds integer not null default 20 check (timer_seconds between 5 and 900),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_tasks (
  id bigserial primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  completed_at timestamptz not null default now(),
  reward_paid integer not null check (reward_paid > 0),
  unique (user_id, task_id)
);

create table if not exists public.user_task_starts (
  user_id uuid not null references public.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

create table if not exists public.referrals (
  id bigserial primary key,
  referrer_id uuid not null references public.users (id) on delete cascade,
  referred_id uuid not null references public.users (id) on delete cascade,
  bonus_paid boolean not null default false,
  referrer_bonus integer not null default 0,
  referred_bonus integer not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (referred_id),
  check (referrer_id <> referred_id)
);

create table if not exists public.point_ledger (
  id bigserial primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  delta integer not null,
  kind text not null check (kind in ('checkin', 'task', 'referral', 'admin')),
  reason text not null,
  task_id uuid references public.tasks (id) on delete set null,
  created_by bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_actions (
  id bigserial primary key,
  admin_telegram_id bigint not null,
  action text not null,
  target_user_id uuid references public.users (id) on delete set null,
  target_task_id uuid references public.tasks (id) on delete set null,
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.rate_limit_events (
  id bigserial primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists users_points_idx
  on public.users (points desc, created_at asc);
create index if not exists user_tasks_completed_idx
  on public.user_tasks (completed_at desc);
create index if not exists referrals_referrer_idx
  on public.referrals (referrer_id, created_at desc);
create index if not exists ledger_user_idx
  on public.point_ledger (user_id, created_at desc);
create index if not exists rate_limit_lookup_idx
  on public.rate_limit_events (user_id, action, created_at desc);
create index if not exists admin_actions_created_idx
  on public.admin_actions (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();
