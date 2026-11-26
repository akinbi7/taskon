-- Taskon · 0002 row level security
-- The Mini App never talks to Postgres directly. Every read and write goes
-- through the Edge Function using the service role, which is the only role
-- allowed past these policies. RLS is still on everywhere so a leaked anon
-- key cannot read users, points or tasks.

alter table public.users enable row level security;
alter table public.tasks enable row level security;
alter table public.user_tasks enable row level security;
alter table public.user_task_starts enable row level security;
alter table public.referrals enable row level security;
alter table public.point_ledger enable row level security;
alter table public.admin_actions enable row level security;
alter table public.rate_limit_events enable row level security;

alter table public.users force row level security;
alter table public.tasks force row level security;
alter table public.user_tasks force row level security;
alter table public.user_task_starts force row level security;
alter table public.referrals force row level security;
alter table public.point_ledger force row level security;
alter table public.admin_actions force row level security;
alter table public.rate_limit_events force row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.tasks from anon, authenticated;
revoke all on table public.user_tasks from anon, authenticated;
revoke all on table public.user_task_starts from anon, authenticated;
revoke all on table public.referrals from anon, authenticated;
revoke all on table public.point_ledger from anon, authenticated;
revoke all on table public.admin_actions from anon, authenticated;
revoke all on table public.rate_limit_events from anon, authenticated;

revoke all on all sequences in schema public from anon, authenticated;
