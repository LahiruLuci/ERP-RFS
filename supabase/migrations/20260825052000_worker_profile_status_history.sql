do $$
begin
  create type public.worker_status as enum (
    'active',
    'inactive',
    'resigned',
    'terminated'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workers'
      and column_name = 'status'
      and udt_name <> 'worker_status'
  ) then
    alter table public.workers alter column status drop default;
    alter table public.workers
      alter column status type public.worker_status
      using status::public.worker_status;
    alter table public.workers
      alter column status set default 'active'::public.worker_status;
  end if;
end $$;

alter table public.workers
  add column if not exists date_of_birth date,
  add column if not exists gender text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_relationship text,
  add column if not exists emergency_contact_phone text,
  add column if not exists previous_occupation text,
  add column if not exists previous_employer text;

do $$
begin
  alter table public.workers
    add constraint workers_gender_check
    check (
      gender is null
      or gender in ('Male', 'Female', 'Other')
    );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.worker_status_history (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null
    references public.workers(id)
    on delete restrict,
  previous_status public.worker_status,
  new_status public.worker_status not null,
  effective_date date not null,
  reason text,
  note text,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists worker_status_history_worker_id_idx
  on public.worker_status_history(worker_id);

create index if not exists worker_status_history_new_status_idx
  on public.worker_status_history(new_status);

create index if not exists worker_status_history_effective_date_idx
  on public.worker_status_history(effective_date desc);

alter table public.worker_status_history enable row level security;

grant select, insert on table public.worker_status_history to authenticated;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles as p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.can_manage_workers()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_is_active boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  execute
    'select role, coalesce(is_active, false) from public.profiles where id = $1 limit 1'
    into v_role, v_is_active
    using auth.uid();

  return coalesce(v_is_active, false) and v_role in ('owner', 'admin');
end;
$$;

grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.can_manage_workers() to authenticated;

do $$
begin
  create policy "worker status history select for authenticated worker viewers"
    on public.worker_status_history
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.workers
        where workers.id = worker_status_history.worker_id
      )
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "worker status history insert for worker managers"
    on public.worker_status_history
    for insert
    to authenticated
    with check (
      public.can_manage_workers()
      and changed_by = auth.uid()
    );
exception
  when duplicate_object then null;
end $$;

create or replace function public.save_worker(
  p_worker_id uuid,
  p_employee_no text,
  p_full_name text,
  p_nic text,
  p_etf_no text,
  p_epf_no text,
  p_phone text,
  p_secondary_phone text,
  p_address text,
  p_joined_date date,
  p_basic_salary numeric,
  p_default_shift_rate numeric,
  p_status public.worker_status,
  p_notes text,
  p_date_of_birth date,
  p_gender text,
  p_emergency_contact_name text,
  p_emergency_contact_relationship text,
  p_emergency_contact_phone text,
  p_previous_occupation text,
  p_previous_employer text,
  p_status_effective_date date,
  p_status_reason text,
  p_status_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker_id uuid;
  v_previous_status public.worker_status;
  v_initial_effective_date date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_manage_workers() then
    raise exception 'Only owner or admin users can manage workers';
  end if;

  if nullif(trim(p_employee_no), '') is null then
    raise exception 'Employee No is required';
  end if;

  if nullif(trim(p_full_name), '') is null then
    raise exception 'Full Name is required';
  end if;

  if p_basic_salary is null or p_basic_salary < 0 then
    raise exception 'Basic Salary must be zero or more';
  end if;

  if p_default_shift_rate is null or p_default_shift_rate < 0 then
    raise exception 'Default Shift Rate must be zero or more';
  end if;

  if p_gender is not null and p_gender not in ('Male', 'Female', 'Other') then
    raise exception 'Choose a valid gender';
  end if;

  if p_status = 'terminated' and nullif(trim(coalesce(p_status_reason, '')), '') is null then
    raise exception 'Termination reason is required';
  end if;

  if p_worker_id is null then
    if p_status in ('inactive', 'resigned', 'terminated') and p_status_effective_date is null then
      raise exception 'Status effective date is required';
    end if;

    insert into public.workers (
      employee_no,
      full_name,
      nic,
      etf_no,
      epf_no,
      phone,
      secondary_phone,
      address,
      joined_date,
      basic_salary,
      default_shift_rate,
      status,
      notes,
      date_of_birth,
      gender,
      emergency_contact_name,
      emergency_contact_relationship,
      emergency_contact_phone,
      previous_occupation,
      previous_employer,
      created_by,
      updated_by
    )
    values (
      trim(p_employee_no),
      trim(p_full_name),
      nullif(trim(coalesce(p_nic, '')), ''),
      nullif(trim(coalesce(p_etf_no, '')), ''),
      nullif(trim(coalesce(p_epf_no, '')), ''),
      nullif(trim(coalesce(p_phone, '')), ''),
      nullif(trim(coalesce(p_secondary_phone, '')), ''),
      nullif(trim(coalesce(p_address, '')), ''),
      p_joined_date,
      p_basic_salary,
      p_default_shift_rate,
      p_status,
      nullif(trim(coalesce(p_notes, '')), ''),
      p_date_of_birth,
      p_gender,
      nullif(trim(coalesce(p_emergency_contact_name, '')), ''),
      nullif(trim(coalesce(p_emergency_contact_relationship, '')), ''),
      nullif(trim(coalesce(p_emergency_contact_phone, '')), ''),
      nullif(trim(coalesce(p_previous_occupation, '')), ''),
      nullif(trim(coalesce(p_previous_employer, '')), ''),
      auth.uid(),
      auth.uid()
    )
    returning id into v_worker_id;

    v_initial_effective_date := coalesce(p_status_effective_date, p_joined_date);

    if v_initial_effective_date is not null then
      insert into public.worker_status_history (
        worker_id,
        previous_status,
        new_status,
        effective_date,
        reason,
        note,
        changed_by
      )
      values (
        v_worker_id,
        null,
        p_status,
        v_initial_effective_date,
        nullif(trim(coalesce(p_status_reason, '')), ''),
        nullif(trim(coalesce(p_status_note, '')), ''),
        auth.uid()
      );
    end if;

    return v_worker_id;
  end if;

  select status
  into v_previous_status
  from public.workers
  where id = p_worker_id
  for update;

  if not found then
    raise exception 'Worker not found';
  end if;

  if v_previous_status is distinct from p_status and p_status_effective_date is null then
    raise exception 'Status effective date is required';
  end if;

  update public.workers
  set
    employee_no = trim(p_employee_no),
    full_name = trim(p_full_name),
    nic = nullif(trim(coalesce(p_nic, '')), ''),
    etf_no = nullif(trim(coalesce(p_etf_no, '')), ''),
    epf_no = nullif(trim(coalesce(p_epf_no, '')), ''),
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    secondary_phone = nullif(trim(coalesce(p_secondary_phone, '')), ''),
    address = nullif(trim(coalesce(p_address, '')), ''),
    joined_date = p_joined_date,
    basic_salary = p_basic_salary,
    default_shift_rate = p_default_shift_rate,
    status = p_status,
    notes = nullif(trim(coalesce(p_notes, '')), ''),
    date_of_birth = p_date_of_birth,
    gender = p_gender,
    emergency_contact_name = nullif(trim(coalesce(p_emergency_contact_name, '')), ''),
    emergency_contact_relationship = nullif(trim(coalesce(p_emergency_contact_relationship, '')), ''),
    emergency_contact_phone = nullif(trim(coalesce(p_emergency_contact_phone, '')), ''),
    previous_occupation = nullif(trim(coalesce(p_previous_occupation, '')), ''),
    previous_employer = nullif(trim(coalesce(p_previous_employer, '')), ''),
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_worker_id;

  if v_previous_status is distinct from p_status then
    insert into public.worker_status_history (
      worker_id,
      previous_status,
      new_status,
      effective_date,
      reason,
      note,
      changed_by
    )
    values (
      p_worker_id,
      v_previous_status,
      p_status,
      p_status_effective_date,
      nullif(trim(coalesce(p_status_reason, '')), ''),
      nullif(trim(coalesce(p_status_note, '')), ''),
      auth.uid()
    );
  end if;

  return p_worker_id;
end;
$$;

grant execute on function public.save_worker(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  numeric,
  numeric,
  public.worker_status,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  text,
  text
) to authenticated;
