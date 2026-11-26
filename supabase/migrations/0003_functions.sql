-- Taskon · 0003 point and admin functions
-- Every balance change lives here. The client can never send a delta.
-- Payment constants: check-in base 10, streak bonus +2/day capped at +10,
-- referral bonus 50 to the referrer and 25 to the friend, once.

-- ---------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_user_id is null or p_limit <= 0 then
    return true;
  end if;

  if random() < 0.02 then
    delete from rate_limit_events where created_at < now() - interval '2 days';
  end if;

  -- Serialise the count and insert so two simultaneous taps cannot both pass
  -- the same window. The lock is released when the RPC transaction ends.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_action, 0));

  select count(*) into v_count
  from rate_limit_events
  where user_id = p_user_id
    and action = p_action
    and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_limit then
    return false;
  end if;

  insert into rate_limit_events (user_id, action) values (p_user_id, p_action);
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Daily check-in
-- Returns the new balance, streak and the reward that was just paid.
-- ---------------------------------------------------------------------------
create or replace function public.claim_daily_checkin(p_user_id uuid)
returns table (new_points integer, new_streak integer, reward integer, bonus integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user users%rowtype;
  v_today date := (now() at time zone 'utc')::date;
  v_streak integer;
  v_bonus integer;
  v_reward integer;
begin
  select * into v_user from users where id = p_user_id for update;

  if not found then
    raise exception 'user_not_found';
  end if;
  if v_user.banned then
    raise exception 'user_banned';
  end if;
  if v_user.last_checkin = v_today then
    raise exception 'already_checked_in';
  end if;

  if v_user.last_checkin = v_today - 1 then
    v_streak := v_user.streak + 1;
  else
    v_streak := 1;
  end if;

  v_bonus := least(greatest(v_streak - 1, 0) * 2, 10);
  v_reward := 10 + v_bonus;

  update users
  set points = points + v_reward,
      streak = v_streak,
      last_checkin = v_today
  where id = p_user_id;

  insert into point_ledger (user_id, delta, kind, reason)
  values (p_user_id, v_reward, 'checkin',
          format('Daily check-in, day %s of the streak', v_streak));

  return query
    select u.points, u.streak, v_reward, v_bonus
    from users u
    where u.id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tasks
-- Starting a task starts the clock. A start cannot be reset by calling again.
-- ---------------------------------------------------------------------------
create or replace function public.start_task(p_user_id uuid, p_task_id uuid)
returns table (started_at timestamptz, timer_seconds integer, claim_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user users%rowtype;
  v_task tasks%rowtype;
  v_started timestamptz;
  v_timer integer;
begin
  select * into v_user from users where id = p_user_id for update;
  if not found then
    raise exception 'user_not_found';
  end if;
  if v_user.banned then
    raise exception 'user_banned';
  end if;

  select * into v_task from tasks where id = p_task_id;
  if not found
     or not v_task.active
     or (v_task.expires_at is not null and v_task.expires_at <= now()) then
    raise exception 'task_unavailable';
  end if;

  if exists (select 1 from user_tasks where user_id = p_user_id and task_id = p_task_id) then
    raise exception 'task_already_completed';
  end if;

  insert into user_task_starts (user_id, task_id)
  values (p_user_id, p_task_id)
  on conflict (user_id, task_id) do nothing;

  select s.started_at into v_started
  from user_task_starts s
  where s.user_id = p_user_id and s.task_id = p_task_id;

  v_timer := case when v_task.type = 'join_channel' then 0 else v_task.timer_seconds end;

  return query
    select v_started, v_timer, v_started + make_interval(secs => v_timer);
end;
$$;

-- p_verified is set by the Edge Function only after Telegram's getChatMember
-- confirms the user is in the channel. Timed tasks are checked against the
-- server-side start time instead.
create or replace function public.complete_task(
  p_user_id uuid,
  p_task_id uuid,
  p_verified boolean default false
)
returns table (new_points integer, reward integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user users%rowtype;
  v_task tasks%rowtype;
  v_started timestamptz;
  v_inserted integer;
  v_reward integer;
begin
  select * into v_user from users where id = p_user_id for update;
  if not found then
    raise exception 'user_not_found';
  end if;
  if v_user.banned then
    raise exception 'user_banned';
  end if;

  select * into v_task from tasks where id = p_task_id;
  if not found
     or not v_task.active
     or (v_task.expires_at is not null and v_task.expires_at <= now()) then
    raise exception 'task_unavailable';
  end if;

  if exists (select 1 from user_tasks where user_id = p_user_id and task_id = p_task_id) then
    raise exception 'task_already_completed';
  end if;

  select s.started_at into v_started
  from user_task_starts s
  where s.user_id = p_user_id and s.task_id = p_task_id;

  if v_started is null then
    raise exception 'task_not_started';
  end if;

  if v_task.type = 'join_channel' then
    if not p_verified then
      raise exception 'membership_not_found';
    end if;
  else
    if now() < v_started + make_interval(secs => v_task.timer_seconds) then
      raise exception 'too_soon';
    end if;
  end if;

  insert into user_tasks (user_id, task_id, reward_paid)
  values (p_user_id, p_task_id, v_task.reward)
  on conflict (user_id, task_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    raise exception 'task_already_completed';
  end if;

  v_reward := v_task.reward;

  update users set points = points + v_reward where id = p_user_id;

  insert into point_ledger (user_id, delta, kind, reason, task_id)
  values (p_user_id, v_reward, 'task', format('Task: %s', v_task.title), p_task_id);

  delete from user_task_starts
  where user_id = p_user_id and task_id = p_task_id;

  return query
    select u.points, v_reward from users u where u.id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Referrals
-- Silently ignores self-referrals, banned referrers, and repeat attribution.
-- Returns the bonus paid to the new user (0 when nothing was paid).
-- ---------------------------------------------------------------------------
create or replace function public.attach_referral(
  p_user_id uuid,
  p_referrer_telegram_id bigint
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_referrer_bonus constant integer := 50;
  v_referred_bonus constant integer := 25;
  v_user users%rowtype;
  v_referrer users%rowtype;
  v_inserted integer;
begin
  if p_referrer_telegram_id is null then
    return 0;
  end if;

  select * into v_user from users where id = p_user_id for update;
  if not found or v_user.banned then
    return 0;
  end if;
  if v_user.telegram_id = p_referrer_telegram_id or v_user.referrer_id is not null then
    return 0;
  end if;

  select * into v_referrer
  from users
  where telegram_id = p_referrer_telegram_id
  for update;

  if not found or v_referrer.banned or v_referrer.id = v_user.id then
    return 0;
  end if;

  insert into referrals (
    referrer_id, referred_id, bonus_paid,
    referrer_bonus, referred_bonus, paid_at
  )
  values (
    v_referrer.id, v_user.id, true,
    v_referrer_bonus, v_referred_bonus, now()
  )
  on conflict (referred_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 0;
  end if;

  update users set referrer_id = v_referrer.id where id = v_user.id;
  update users set points = points + v_referrer_bonus where id = v_referrer.id;
  update users set points = points + v_referred_bonus where id = v_user.id;

  insert into point_ledger (user_id, delta, kind, reason)
  values
    (v_referrer.id, v_referrer_bonus, 'referral', 'A friend joined with your link'),
    (v_user.id, v_referred_bonus, 'referral', 'Welcome bonus from a referral link');

  return v_referred_bonus;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard: top N plus the caller's own row
-- ---------------------------------------------------------------------------
create or replace function public.get_leaderboard(
  p_user_id uuid,
  p_limit integer default 100
)
returns table (
  place bigint,
  user_id uuid,
  telegram_id bigint,
  username text,
  first_name text,
  points integer,
  is_me boolean
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with ranked as (
    select
      u.id,
      u.telegram_id,
      u.username,
      u.first_name,
      u.points,
      row_number() over (order by u.points desc, u.created_at asc, u.id asc) as pos
    from users u
    where not u.banned
  )
  select
    r.pos,
    r.id,
    r.telegram_id,
    r.username,
    r.first_name,
    r.points,
    r.id = p_user_id
  from ranked r
  where r.pos <= least(greatest(coalesce(p_limit, 100), 1), 100)
     or r.id = p_user_id
  order by r.pos;
$$;

-- ---------------------------------------------------------------------------
-- Admin helpers
-- ---------------------------------------------------------------------------
create or replace function public._admin_log(
  p_admin_telegram_id bigint,
  p_action text,
  p_target_user_id uuid default null,
  p_target_task_id uuid default null,
  p_reason text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into admin_actions (
    admin_telegram_id, action, target_user_id, target_task_id, reason, details
  )
  values (
    p_admin_telegram_id, p_action, p_target_user_id, p_target_task_id, p_reason,
    coalesce(p_details, '{}'::jsonb)
  );
$$;

create or replace function public.admin_flags(p_limit integer default 50)
returns table (
  user_id uuid,
  telegram_id bigint,
  username text,
  first_name text,
  flags text[],
  refs_24h integer,
  refs_1h integer,
  same_second_claims integer,
  points integer,
  last_seen_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with ref_agg as (
    select
      r.referrer_id,
      count(*) filter (where r.created_at > now() - interval '24 hours')::integer as refs_24h,
      count(*) filter (where r.created_at > now() - interval '1 hour')::integer as refs_1h
    from referrals r
    group by r.referrer_id
  ),
  claim_bursts as (
    select s.user_id, count(*)::integer as burst_seconds
    from (
      select user_id, date_trunc('second', completed_at) as sec
      from user_tasks
      group by user_id, date_trunc('second', completed_at)
      having count(*) >= 2
    ) s
    group by s.user_id
  )
  select
    u.id,
    u.telegram_id,
    u.username,
    u.first_name,
    array_remove(array[
      case when coalesce(r.refs_1h, 0) >= 8 then 'referral_burst' else null end,
      case when coalesce(r.refs_24h, 0) >= 25 then 'referral_volume' else null end,
      case when coalesce(c.burst_seconds, 0) > 0 then 'same_second_claims' else null end
    ], null)::text[],
    coalesce(r.refs_24h, 0),
    coalesce(r.refs_1h, 0),
    coalesce(c.burst_seconds, 0),
    u.points,
    u.last_seen_at
  from users u
  left join ref_agg r on r.referrer_id = u.id
  left join claim_bursts c on c.user_id = u.id
  where coalesce(r.refs_1h, 0) >= 8
     or coalesce(r.refs_24h, 0) >= 25
     or coalesce(c.burst_seconds, 0) > 0
  order by coalesce(r.refs_24h, 0) desc, coalesce(c.burst_seconds, 0) desc, u.last_seen_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

create or replace function public.admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
begin
  return jsonb_build_object(
    'total_users', (select count(*) from users),
    'banned_users', (select count(*) from users where banned),
    'new_today', (select count(*) from users where created_at >= v_day_start),
    'active_today', (select count(*) from users where last_seen_at >= v_day_start),
    'total_points', (select coalesce(sum(points), 0) from users),
    'points_today', (
      select coalesce(sum(delta), 0) from point_ledger
      where created_at >= v_day_start and delta > 0
    ),
    'checkins_today', (
      select count(*) from point_ledger
      where kind = 'checkin' and created_at >= v_day_start
    ),
    'tasks_today', (
      select count(*) from user_tasks where completed_at >= v_day_start
    ),
    'referrals_today', (
      select count(*) from referrals where created_at >= v_day_start
    ),
    'flags_count', (select count(*) from admin_flags(200)),
    'top_referrers', coalesce((
      select jsonb_agg(row)
      from (
        select
          u.telegram_id,
          u.username,
          u.first_name,
          count(r.id)::integer as refs
        from referrals r
        join users u on u.id = r.referrer_id
        where r.bonus_paid
        group by u.id
        order by count(r.id) desc, u.created_at asc
        limit 5
      ) row
    ), '[]'::jsonb),
    'top_tasks', coalesce((
      select jsonb_agg(row)
      from (
        select t.title, t.type, count(ut.id)::integer as completions
        from user_tasks ut
        join tasks t on t.id = ut.task_id
        group by t.id
        order by count(ut.id) desc
        limit 5
      ) row
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_search_users(
  p_query text default '',
  p_limit integer default 25
)
returns table (
  user_id uuid,
  telegram_id bigint,
  username text,
  first_name text,
  points integer,
  streak integer,
  banned boolean,
  ban_reason text,
  referrals integer,
  referral_earnings integer,
  tasks_done integer,
  last_seen_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    u.id,
    u.telegram_id,
    u.username,
    u.first_name,
    u.points,
    u.streak,
    u.banned,
    u.ban_reason,
    coalesce(r.referral_count, 0)::integer,
    coalesce(r.referral_earnings, 0)::integer,
    coalesce(t.tasks_done, 0)::integer,
    u.last_seen_at,
    u.created_at
  from users u
  left join lateral (
    select
      count(*) as referral_count,
      sum(referrer_bonus) filter (where bonus_paid) as referral_earnings
    from referrals
    where referrer_id = u.id
  ) r on true
  left join lateral (
    select count(*) as tasks_done from user_tasks where user_id = u.id
  ) t on true
  where p_query is null
     or p_query = ''
     or u.telegram_id::text ilike '%' || p_query || '%'
     or u.username ilike '%' || p_query || '%'
     or coalesce(u.first_name, '') ilike '%' || p_query || '%'
  order by u.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

create or replace function public.admin_task_upsert(
  p_admin_telegram_id bigint,
  p_title text,
  p_type text,
  p_reward integer,
  p_url text,
  p_task_id uuid default null,
  p_timer_seconds integer default 20,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_before tasks%rowtype;
  v_title text := btrim(coalesce(p_title, ''));
  v_url text := btrim(coalesce(p_url, ''));
begin
  if char_length(v_title) < 3 or char_length(v_title) > 120 then
    raise exception 'invalid_title';
  end if;
  if p_type not in ('join_channel', 'visit_link', 'follow_x', 'partner') then
    raise exception 'invalid_type';
  end if;
  if p_reward is null or p_reward < 1 or p_reward > 10000 then
    raise exception 'invalid_reward';
  end if;
  if p_type = 'join_channel' then
    if v_url !~ '^@[A-Za-z0-9_]{4,32}$'
       and v_url !~ '^https://t\.me/[A-Za-z0-9_]{4,32}/?$' then
      raise exception 'invalid_url';
    end if;
  elsif v_url !~ '^https?://' then
    raise exception 'invalid_url';
  end if;
  if p_timer_seconds is null or p_timer_seconds < 5 or p_timer_seconds > 900 then
    raise exception 'invalid_timer';
  end if;

  if p_task_id is null then
    insert into tasks (title, type, reward, url, timer_seconds, expires_at, active)
    values (v_title, p_type, p_reward, v_url, p_timer_seconds, p_expires_at, true)
    returning id into v_id;

    perform _admin_log(
      p_admin_telegram_id, 'task.create', null, v_id, null,
      jsonb_build_object(
        'title', v_title, 'type', p_type, 'reward', p_reward,
        'url', v_url, 'timer_seconds', p_timer_seconds,
        'expires_at', p_expires_at
      )
    );
  else
    select * into v_before from tasks where id = p_task_id for update;
    if not found then
      raise exception 'task_not_found';
    end if;

    update tasks
    set title = v_title,
        type = p_type,
        reward = p_reward,
        url = v_url,
        timer_seconds = p_timer_seconds,
        expires_at = p_expires_at
    where id = p_task_id;

    perform _admin_log(
      p_admin_telegram_id, 'task.edit', null, p_task_id, null,
      jsonb_build_object(
        'before', jsonb_build_object(
          'title', v_before.title, 'type', v_before.type, 'reward', v_before.reward,
          'url', v_before.url, 'timer_seconds', v_before.timer_seconds,
          'expires_at', v_before.expires_at
        ),
        'after', jsonb_build_object(
          'title', v_title, 'type', p_type, 'reward', p_reward,
          'url', v_url, 'timer_seconds', p_timer_seconds,
          'expires_at', p_expires_at
        )
      )
    );
    v_id := p_task_id;
  end if;

  return v_id;
exception
  when unique_violation then
    raise exception 'duplicate_task';
end;
$$;

create or replace function public.admin_task_toggle(
  p_admin_telegram_id bigint,
  p_task_id uuid,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task tasks%rowtype;
begin
  update tasks set active = p_active where id = p_task_id returning * into v_task;
  if not found then
    raise exception 'task_not_found';
  end if;

  perform _admin_log(
    p_admin_telegram_id,
    case when p_active then 'task.enable' else 'task.disable' end,
    null, p_task_id, null,
    jsonb_build_object('title', v_task.title, 'active', p_active)
  );

  return p_active;
end;
$$;

create or replace function public.admin_task_delete(
  p_admin_telegram_id bigint,
  p_task_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task tasks%rowtype;
  v_completions integer;
begin
  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'task_not_found';
  end if;

  select count(*) into v_completions from user_tasks where task_id = p_task_id;

  perform _admin_log(
    p_admin_telegram_id, 'task.delete', null, p_task_id, null,
    jsonb_build_object(
      'task_id', p_task_id,
      'title', v_task.title,
      'type', v_task.type,
      'reward', v_task.reward,
      'url', v_task.url,
      'completions', v_completions
    )
  );

  delete from tasks where id = p_task_id;
end;
$$;

create or replace function public.admin_adjust_points(
  p_admin_telegram_id bigint,
  p_user_id uuid,
  p_delta integer,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user users%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_before integer;
  v_after integer;
  v_applied integer;
begin
  if v_reason is null or char_length(v_reason) < 3 then
    raise exception 'reason_required';
  end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 100000 then
    raise exception 'invalid_delta';
  end if;

  select * into v_user from users where id = p_user_id for update;
  if not found then
    raise exception 'user_not_found';
  end if;

  v_before := v_user.points;
  v_after := greatest(v_before + p_delta, 0);
  v_applied := v_after - v_before;

  update users set points = v_after where id = p_user_id;

  insert into point_ledger (user_id, delta, kind, reason, created_by)
  values (p_user_id, v_applied, 'admin', v_reason, p_admin_telegram_id);

  perform _admin_log(
    p_admin_telegram_id, 'user.adjust_points', p_user_id, null, v_reason,
    jsonb_build_object(
      'requested_delta', p_delta,
      'applied_delta', v_applied,
      'points_before', v_before,
      'points_after', v_after
    )
  );

  return v_after;
end;
$$;

create or replace function public.admin_set_ban(
  p_admin_telegram_id bigint,
  p_user_id uuid,
  p_banned boolean,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user users%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into v_user from users where id = p_user_id for update;
  if not found then
    raise exception 'user_not_found';
  end if;
  if p_banned and v_user.telegram_id = p_admin_telegram_id then
    raise exception 'cannot_ban_self';
  end if;

  update users
  set banned = p_banned,
      ban_reason = case when p_banned then v_reason else null end
  where id = p_user_id;

  perform _admin_log(
    p_admin_telegram_id,
    case when p_banned then 'user.ban' else 'user.unban' end,
    p_user_id, null, v_reason,
    jsonb_build_object(
      'telegram_id', v_user.telegram_id,
      'username', v_user.username,
      'banned', p_banned
    )
  );

  return p_banned;
end;
$$;

create or replace function public.admin_audit(p_limit integer default 100)
returns table (
  id bigint,
  admin_telegram_id bigint,
  action text,
  reason text,
  details jsonb,
  created_at timestamptz,
  target_username text,
  target_task_title text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    a.id,
    a.admin_telegram_id,
    a.action,
    a.reason,
    a.details,
    a.created_at,
    u.username,
    t.title
  from admin_actions a
  left join users u on u.id = a.target_user_id
  left join tasks t on t.id = a.target_task_id
  order by a.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

-- ---------------------------------------------------------------------------
-- Lock the API surface down to the service role
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end;
$$;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
