-- Run once in the Supabase SQL editor. Auth: enable Email provider (OTP code, "Confirm email" on).
create table if not exists daily_runs (
  user_id uuid not null,
  day date not null default (now() at time zone 'utc')::date,
  used int not null default 0,
  primary key (user_id, day)
);
alter table daily_runs enable row level security; -- no policies: only the service role touches it

-- Atomic: returns the new count, or no row when the limit is already reached.
create or replace function consume_daily_run(uid uuid, lim int) returns int
language sql security definer as $$
  insert into daily_runs as d (user_id, day, used)
  values (uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set used = d.used + 1 where d.used < lim
  returning used;
$$;

create or replace function refund_daily_run(uid uuid) returns void
language sql security definer as $$
  update daily_runs set used = greatest(used - 1, 0)
  where user_id = uid and day = (now() at time zone 'utc')::date;
$$;

create or replace function peek_daily_run(uid uuid) returns int
language sql security definer as $$
  select coalesce((select used from daily_runs where user_id = uid and day = (now() at time zone 'utc')::date), 0);
$$;

revoke all on function consume_daily_run, refund_daily_run, peek_daily_run from public, anon, authenticated;
grant execute on function consume_daily_run, refund_daily_run, peek_daily_run to service_role;
