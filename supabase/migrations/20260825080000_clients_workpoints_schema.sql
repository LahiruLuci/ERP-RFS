do $$
begin
  create type public.workplace_status as enum ('active', 'inactive');
exception
  when duplicate_object then null;
end $$;
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  client_code text not null,
  name text not null,
  contact_person text,
  phone text,
  email text,
  billing_address text,
  status text not null default 'active',
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients
  add column if not exists client_code text,
  add column if not exists name text,
  add column if not exists contact_person text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists billing_address text,
  add column if not exists status text not null default 'active',
  add column if not exists notes text,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists updated_by uuid references public.profiles(id),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.clients
    add constraint clients_client_code_key unique (client_code);
exception
  when duplicate_object or duplicate_table then null;
end $$;

do $$
begin
  alter table public.clients
    add constraint clients_name_required check (nullif(trim(coalesce(name, '')), '') is not null);
exception
  when duplicate_object or duplicate_table then null;
end $$;

do $$
begin
  alter table public.clients
    add constraint clients_client_code_required check (nullif(trim(coalesce(client_code, '')), '') is not null);
exception
  when duplicate_object or duplicate_table then null;
end $$;

do $$
begin
  alter table public.clients
    add constraint clients_status_check check (status in ('active', 'inactive'));
exception
  when duplicate_object or duplicate_table then null;
end $$;

create table if not exists public.workplaces (
  id uuid primary key default gen_random_uuid(),
  workplace_code text not null,
  client_id uuid references public.clients(id) on delete restrict,
  name text not null,
  address text,
  contact_person text,
  contact_phone text,
  default_day_rate numeric not null default 0 check (default_day_rate >= 0),
  default_night_rate numeric not null default 0 check (default_night_rate >= 0),
  required_guards integer not null default 0 check (required_guards >= 0),
  status public.workplace_status not null default 'active'::public.workplace_status,
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workplaces
  add column if not exists workplace_code text,
  add column if not exists client_id uuid references public.clients(id) on delete restrict,
  add column if not exists name text,
  add column if not exists address text,
  add column if not exists contact_person text,
  add column if not exists contact_phone text,
  add column if not exists default_day_rate numeric not null default 0,
  add column if not exists default_night_rate numeric not null default 0,
  add column if not exists required_guards integer not null default 0,
  add column if not exists status public.workplace_status not null default 'active'::public.workplace_status,
  add column if not exists notes text,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists updated_by uuid references public.profiles(id),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workplaces'
      and column_name = 'status'
      and udt_name <> 'workplace_status'
  ) then
    alter table public.workplaces alter column status drop default;
    alter table public.workplaces
      alter column status type public.workplace_status
      using status::public.workplace_status;
    alter table public.workplaces
      alter column status set default 'active'::public.workplace_status;
  end if;
end $$;

do $$
begin
  alter table public.workplaces
    add constraint workplaces_workplace_code_key unique (workplace_code);
exception
  when duplicate_object or duplicate_table then null;
end $$;

do $$
begin
  alter table public.workplaces
    add constraint workplaces_workplace_code_required check (nullif(trim(coalesce(workplace_code, '')), '') is not null);
exception
  when duplicate_object or duplicate_table then null;
end $$;

do $$
begin
  alter table public.workplaces
    add constraint workplaces_name_required check (nullif(trim(coalesce(name, '')), '') is not null);
exception
  when duplicate_object or duplicate_table then null;
end $$;

do $$
begin
  alter table public.workplaces
    add constraint workplaces_rates_check check (
      default_day_rate >= 0
      and default_night_rate >= 0
      and required_guards >= 0
    );
exception
  when duplicate_object or duplicate_table then null;
end $$;

do $$
begin
  alter table public.workplaces
    add constraint workplaces_status_check check (status in ('active'::public.workplace_status, 'inactive'::public.workplace_status));
exception
  when duplicate_object or duplicate_table then null;
end $$;

create index if not exists workplaces_client_id_idx
  on public.workplaces(client_id);

create index if not exists workplaces_status_idx
  on public.workplaces(status);

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at
  before update on public.clients
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_workplaces_updated_at on public.workplaces;
create trigger set_workplaces_updated_at
  before update on public.workplaces
  for each row
  execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.workplaces enable row level security;

create or replace function public.can_manage_clients()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(array[
    'owner'::public.user_role,
    'admin'::public.user_role
  ]);
$$;

create or replace function public.can_view_clients()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(array[
    'owner'::public.user_role,
    'admin'::public.user_role,
    'accounts'::public.user_role
  ]);
$$;

grant execute on function public.can_manage_clients() to authenticated;
grant execute on function public.can_view_clients() to authenticated;
grant select, insert, update on table public.clients to authenticated;
grant select, insert, update on table public.workplaces to authenticated;

drop policy if exists "clients select for internal roles" on public.clients;
create policy "clients select for internal roles"
  on public.clients
  for select
  to authenticated
  using (public.can_view_clients());

drop policy if exists "clients insert for managers" on public.clients;
create policy "clients insert for managers"
  on public.clients
  for insert
  to authenticated
  with check (
    public.can_manage_clients()
    and created_by = auth.uid()
    and updated_by = auth.uid()
  );

drop policy if exists "clients update for managers" on public.clients;
create policy "clients update for managers"
  on public.clients
  for update
  to authenticated
  using (public.can_manage_clients())
  with check (
    public.can_manage_clients()
    and updated_by = auth.uid()
  );

drop policy if exists "workplaces select for internal roles" on public.workplaces;
create policy "workplaces select for internal roles"
  on public.workplaces
  for select
  to authenticated
  using (public.can_view_clients());

drop policy if exists "workplaces insert for managers" on public.workplaces;
create policy "workplaces insert for managers"
  on public.workplaces
  for insert
  to authenticated
  with check (
    public.can_manage_clients()
    and created_by = auth.uid()
    and updated_by = auth.uid()
  );

drop policy if exists "workplaces update for managers" on public.workplaces;
create policy "workplaces update for managers"
  on public.workplaces
  for update
  to authenticated
  using (public.can_manage_clients())
  with check (
    public.can_manage_clients()
    and updated_by = auth.uid()
  );


drop function if exists public.save_workpoint(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  integer,
  text,
  text
);

create or replace function public.save_workpoint(
  p_client_id uuid,
  p_workplace_code text,
  p_name text,
  p_address text,
  p_contact_person text,
  p_contact_phone text,
  p_default_day_rate numeric,
  p_default_night_rate numeric,
  p_required_guards integer,
  p_status text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workpoint_id uuid;
  v_status text := coalesce(nullif(trim(coalesce(p_status, '')), ''), 'active');
  v_default_day_rate numeric := round(coalesce(p_default_day_rate, 0), 2);
  v_default_night_rate numeric := round(coalesce(p_default_night_rate, 0), 2);
  v_required_guards integer := coalesce(p_required_guards, 0);
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_manage_clients() then
    raise exception 'Only owner or admin users can manage workpoints' using errcode = '42501';
  end if;

  if p_client_id is null or not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'Client not found' using errcode = '23503';
  end if;

  if nullif(trim(coalesce(p_workplace_code, '')), '') is null then
    raise exception 'Workpoint code is required' using errcode = '23514';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Workpoint name is required' using errcode = '23514';
  end if;

  if v_status not in ('active', 'inactive') then
    raise exception 'Choose a valid workpoint status' using errcode = '23514';
  end if;

  if v_default_day_rate < 0 or v_default_night_rate < 0 or v_required_guards < 0 then
    raise exception 'Rates and required guards must be zero or more' using errcode = '23514';
  end if;

  insert into public.workplaces (
    workplace_code,
    client_id,
    name,
    address,
    contact_person,
    contact_phone,
    default_day_rate,
    default_night_rate,
    required_guards,
    status,
    notes,
    created_by,
    updated_by
  )
  values (
    trim(p_workplace_code),
    p_client_id,
    trim(p_name),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_contact_person, '')), ''),
    nullif(trim(coalesce(p_contact_phone, '')), ''),
    v_default_day_rate,
    v_default_night_rate,
    v_required_guards,
    v_status::public.workplace_status,
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid(),
    auth.uid()
  )
  returning id into v_workpoint_id;

  return v_workpoint_id;
end;
$$;

grant execute on function public.save_workpoint(
  uuid,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  integer,
  text,
  text
) to authenticated;
notify pgrst, 'reload schema';
