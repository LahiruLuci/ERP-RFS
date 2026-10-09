create extension if not exists pgcrypto;

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_token_hash text not null unique,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists user_sessions_user_id_idx
  on public.user_sessions (user_id);

create index if not exists user_sessions_expires_at_idx
  on public.user_sessions (expires_at);

alter table public.user_sessions enable row level security;

revoke all on table public.user_sessions from authenticated;
revoke all on table public.user_sessions from public;

create or replace function public.create_user_session()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw_token text;
  v_session_token_hash text;
  v_expires_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_expires_at := now() + interval '8 hours';
  v_raw_token := encode(gen_random_bytes(32), 'hex');
  v_session_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

  insert into public.user_sessions (user_id, session_token_hash, expires_at)
  values (auth.uid(), v_session_token_hash, v_expires_at);

  return v_raw_token;
end;
$$;

revoke execute on function public.create_user_session() from public;
revoke execute on function public.create_user_session() from authenticated;
grant execute on function public.create_user_session() to authenticated;

create or replace function public.get_session_by_token(
  p_session_token text
)
returns table (
  id uuid,
  user_id uuid,
  last_activity_at timestamptz,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_token_hash text;
begin
  if auth.uid() is null then
    return;
  end if;

  v_session_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

  return query
  select us.id, us.user_id, us.last_activity_at, us.created_at, us.expires_at
  from public.user_sessions us
  where us.session_token_hash = v_session_token_hash
    and us.user_id = auth.uid()
    and us.expires_at > now()
  limit 1;
end;
$$;

revoke execute on function public.get_session_by_token(text) from public;
revoke execute on function public.get_session_by_token(text) from authenticated;
grant execute on function public.get_session_by_token(text) to authenticated;

create or replace function public.update_session_activity_by_token(
  p_session_token text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_expires_at timestamptz;
begin
  select user_id, expires_at into v_user_id, v_expires_at
  from public.user_sessions
  where session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex');

  if v_user_id is null or auth.uid() is null or auth.uid() <> v_user_id then
    return;
  end if;

  if v_expires_at <= now() then
    return;
  end if;

  update public.user_sessions
  set last_activity_at = now()
  where session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
    and expires_at > now();
end;
$$;

revoke execute on function public.update_session_activity_by_token(text) from public;
revoke execute on function public.update_session_activity_by_token(text) from authenticated;
grant execute on function public.update_session_activity_by_token(text) to authenticated;

create or replace function public.invalidate_session_by_token(
  p_session_token text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
  from public.user_sessions
  where session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex');

  if v_user_id is null or auth.uid() is null or auth.uid() <> v_user_id then
    return;
  end if;

  delete from public.user_sessions
  where session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex');
end;
$$;

revoke execute on function public.invalidate_session_by_token(text) from public;
revoke execute on function public.invalidate_session_by_token(text) from authenticated;
grant execute on function public.invalidate_session_by_token(text) to authenticated;
