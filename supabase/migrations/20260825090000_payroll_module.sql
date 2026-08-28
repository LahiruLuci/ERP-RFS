do $$
begin
  create type public.payroll_run_status as enum ('draft', 'approved');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2000 and 2100),
  month integer not null check (month between 1 and 12),
  status public.payroll_run_status not null default 'draft',
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month)
);

create table if not exists public.payroll_records (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete restrict,
  gross_salary numeric not null default 0 check (gross_salary >= 0),
  advance numeric not null default 0 check (advance >= 0),
  advance_override boolean not null default false,
  epf numeric not null default 0 check (epf >= 0),
  meals numeric not null default 0 check (meals >= 0),
  meals_override boolean not null default false,
  uniform numeric not null default 0 check (uniform >= 0),
  uniform_override boolean not null default false,
  other_deduction numeric not null default 0 check (other_deduction >= 0),
  other_deduction_override boolean not null default false,
  other_note text,
  total_deductions numeric not null default 0 check (total_deductions >= 0),
  net_salary numeric not null default 0 check (net_salary >= 0),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_run_id, worker_id),
  check (
    not other_deduction_override
    or other_deduction = 0
    or nullif(trim(coalesce(other_note, '')), '') is not null
  )
);

create table if not exists public.payroll_work_entries (
  id uuid primary key default gen_random_uuid(),
  payroll_record_id uuid not null references public.payroll_records(id) on delete cascade,
  workplace_id uuid references public.workplaces(id) on delete set null,
  workplace_name text not null default 'General / Unassigned',
  shifts numeric not null default 0 check (shifts >= 0),
  shift_rate numeric not null default 0 check (shift_rate >= 0),
  line_gross numeric not null default 0 check (line_gross >= 0),
  created_at timestamptz not null default now()
);

create index if not exists payroll_runs_period_idx
  on public.payroll_runs (year, month);

create index if not exists payroll_runs_status_idx
  on public.payroll_runs (status);

create index if not exists payroll_records_run_idx
  on public.payroll_records (payroll_run_id);

create index if not exists payroll_records_worker_idx
  on public.payroll_records (worker_id);

create index if not exists payroll_work_entries_record_idx
  on public.payroll_work_entries (payroll_record_id);

create index if not exists payroll_work_entries_workplace_idx
  on public.payroll_work_entries (workplace_id);

drop trigger if exists set_payroll_runs_updated_at on public.payroll_runs;
create trigger set_payroll_runs_updated_at
  before update on public.payroll_runs
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_payroll_records_updated_at on public.payroll_records;
create trigger set_payroll_records_updated_at
  before update on public.payroll_records
  for each row
  execute function public.set_updated_at();

alter table public.payroll_runs enable row level security;
alter table public.payroll_records enable row level security;
alter table public.payroll_work_entries enable row level security;

create or replace function public.can_manage_payroll()
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

create or replace function public.can_approve_payroll()
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

grant execute on function public.can_manage_payroll() to authenticated;
grant execute on function public.can_approve_payroll() to authenticated;

drop policy if exists "payroll runs select for payroll roles" on public.payroll_runs;
create policy "payroll runs select for payroll roles"
  on public.payroll_runs
  for select
  to authenticated
  using (public.can_manage_payroll());

drop policy if exists "payroll runs insert for payroll roles" on public.payroll_runs;
create policy "payroll runs insert for payroll roles"
  on public.payroll_runs
  for insert
  to authenticated
  with check (public.can_manage_payroll() and created_by = auth.uid());

drop policy if exists "payroll runs update draft for payroll roles" on public.payroll_runs;
create policy "payroll runs update draft for payroll roles"
  on public.payroll_runs
  for update
  to authenticated
  using (
    public.can_manage_payroll()
    and (
      status = 'draft'::public.payroll_run_status
      or public.can_approve_payroll()
    )
  )
  with check (
    public.can_manage_payroll()
    and updated_by = auth.uid()
  );

drop policy if exists "payroll records select for payroll roles" on public.payroll_records;
create policy "payroll records select for payroll roles"
  on public.payroll_records
  for select
  to authenticated
  using (public.can_manage_payroll());

drop policy if exists "payroll records insert for payroll roles" on public.payroll_records;
create policy "payroll records insert for payroll roles"
  on public.payroll_records
  for insert
  to authenticated
  with check (
    public.can_manage_payroll()
    and created_by = auth.uid()
    and exists (
      select 1
      from public.payroll_runs pr
      where pr.id = payroll_run_id
        and pr.status = 'draft'::public.payroll_run_status
    )
  );

drop policy if exists "payroll records update draft for payroll roles" on public.payroll_records;
create policy "payroll records update draft for payroll roles"
  on public.payroll_records
  for update
  to authenticated
  using (
    public.can_manage_payroll()
    and exists (
      select 1
      from public.payroll_runs pr
      where pr.id = payroll_run_id
        and pr.status = 'draft'::public.payroll_run_status
    )
  )
  with check (
    public.can_manage_payroll()
    and updated_by = auth.uid()
  );

drop policy if exists "payroll work entries select for payroll roles" on public.payroll_work_entries;
create policy "payroll work entries select for payroll roles"
  on public.payroll_work_entries
  for select
  to authenticated
  using (
    public.can_manage_payroll()
    and exists (
      select 1
      from public.payroll_records pr
      where pr.id = payroll_record_id
    )
  );

drop policy if exists "payroll work entries insert for payroll roles" on public.payroll_work_entries;
create policy "payroll work entries insert for payroll roles"
  on public.payroll_work_entries
  for insert
  to authenticated
  with check (
    public.can_manage_payroll()
    and exists (
      select 1
      from public.payroll_records pr
      join public.payroll_runs run on run.id = pr.payroll_run_id
      where pr.id = payroll_record_id
        and run.status = 'draft'::public.payroll_run_status
    )
  );

drop policy if exists "payroll work entries update draft for payroll roles" on public.payroll_work_entries;
create policy "payroll work entries update draft for payroll roles"
  on public.payroll_work_entries
  for update
  to authenticated
  using (
    public.can_manage_payroll()
    and exists (
      select 1
      from public.payroll_records pr
      join public.payroll_runs run on run.id = pr.payroll_run_id
      where pr.id = payroll_record_id
        and run.status = 'draft'::public.payroll_run_status
    )
  )
  with check (public.can_manage_payroll());

create or replace function public.save_payroll_record(
  p_year integer,
  p_month integer,
  p_worker_id uuid,
  p_work_entries jsonb,
  p_advance numeric,
  p_epf numeric,
  p_meals numeric,
  p_uniform numeric,
  p_other_deduction numeric,
  p_other_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_run_status public.payroll_run_status;
  v_record_id uuid;
  v_entry jsonb;
  v_workplace_id uuid;
  v_workplace_name text;
  v_shifts numeric;
  v_shift_rate numeric;
  v_line_gross numeric;
  v_gross_salary numeric := 0;
  v_advance numeric := round(coalesce(p_advance, 0), 2);
  v_epf numeric := round(coalesce(p_epf, 0), 2);
  v_meals numeric := round(coalesce(p_meals, 0), 2);
  v_uniform numeric := round(coalesce(p_uniform, 0), 2);
  v_other_deduction numeric := round(coalesce(p_other_deduction, 0), 2);
  v_total_deductions numeric;
  v_net_salary numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_manage_payroll() then
    raise exception 'Only payroll-authorized users can manage payroll'
      using errcode = '42501';
  end if;

  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Choose a valid payroll year' using errcode = '23514';
  end if;

  if p_month is null or p_month < 1 or p_month > 12 then
    raise exception 'Choose a valid payroll month' using errcode = '23514';
  end if;

  if not exists (select 1 from public.workers where id = p_worker_id) then
    raise exception 'Worker not found' using errcode = '23503';
  end if;

  if jsonb_typeof(p_work_entries) is distinct from 'array'
    or jsonb_array_length(p_work_entries) = 0 then
    raise exception 'At least one work entry is required' using errcode = '23514';
  end if;

  if v_advance < 0 or v_epf < 0 or v_meals < 0 or v_uniform < 0 or v_other_deduction < 0 then
    raise exception 'Deductions must be zero or more' using errcode = '23514';
  end if;

  if v_other_deduction > 0 and nullif(trim(coalesce(p_other_note, '')), '') is null then
    raise exception 'Other deduction note is required' using errcode = '23514';
  end if;

  select id, status
  into v_run_id, v_run_status
  from public.payroll_runs
  where year = p_year and month = p_month
  for update;

  if not found then
    insert into public.payroll_runs (year, month, status, created_by, updated_by)
    values (p_year, p_month, 'draft', auth.uid(), auth.uid())
    returning id, status into v_run_id, v_run_status;
  end if;

  if v_run_status <> 'draft'::public.payroll_run_status then
    raise exception 'Approved payroll cannot be edited' using errcode = '42501';
  end if;

  for v_entry in
    select value from jsonb_array_elements(p_work_entries)
  loop
    v_workplace_id := nullif(v_entry->>'workplace_id', '')::uuid;
    v_shifts := round(coalesce(nullif(v_entry->>'shifts', '')::numeric, 0), 2);
    v_shift_rate := round(coalesce(nullif(v_entry->>'shift_rate', '')::numeric, 0), 2);

    if v_shifts < 0 or v_shift_rate < 0 then
      raise exception 'Shifts and rates must be zero or more' using errcode = '23514';
    end if;

    if v_workplace_id is not null then
      select name
      into v_workplace_name
      from public.workplaces
      where id = v_workplace_id;

      if v_workplace_name is null then
        raise exception 'Workplace not found' using errcode = '23503';
      end if;
    else
      v_workplace_name := 'General / Unassigned';
    end if;

    v_line_gross := round(v_shifts * v_shift_rate, 2);
    v_gross_salary := v_gross_salary + v_line_gross;
  end loop;

  v_gross_salary := round(v_gross_salary, 2);
  v_total_deductions := round(v_advance + v_epf + v_meals + v_uniform + v_other_deduction, 2);
  v_net_salary := round(v_gross_salary - v_total_deductions, 2);

  if v_net_salary < 0 then
    raise exception 'Total deductions exceed gross salary' using errcode = '23514';
  end if;

  select id
  into v_record_id
  from public.payroll_records
  where payroll_run_id = v_run_id
    and worker_id = p_worker_id
  for update;

  if not found then
    insert into public.payroll_records (
      payroll_run_id,
      worker_id,
      gross_salary,
      advance,
      epf,
      meals,
      uniform,
      other_deduction,
      other_note,
      total_deductions,
      net_salary,
      created_by,
      updated_by
    )
    values (
      v_run_id,
      p_worker_id,
      v_gross_salary,
      v_advance,
      v_epf,
      v_meals,
      v_uniform,
      v_other_deduction,
      nullif(trim(coalesce(p_other_note, '')), ''),
      v_total_deductions,
      v_net_salary,
      auth.uid(),
      auth.uid()
    )
    returning id into v_record_id;
  else
    update public.payroll_records
    set
      gross_salary = v_gross_salary,
      advance = v_advance,
      epf = v_epf,
      meals = v_meals,
      uniform = v_uniform,
      other_deduction = v_other_deduction,
      other_note = nullif(trim(coalesce(p_other_note, '')), ''),
      total_deductions = v_total_deductions,
      net_salary = v_net_salary,
      updated_by = auth.uid(),
      updated_at = now()
    where id = v_record_id;

    delete from public.payroll_work_entries
    where payroll_record_id = v_record_id;
  end if;

  for v_entry in
    select value from jsonb_array_elements(p_work_entries)
  loop
    v_workplace_id := nullif(v_entry->>'workplace_id', '')::uuid;
    v_shifts := round(coalesce(nullif(v_entry->>'shifts', '')::numeric, 0), 2);
    v_shift_rate := round(coalesce(nullif(v_entry->>'shift_rate', '')::numeric, 0), 2);

    if v_workplace_id is not null then
      select name
      into v_workplace_name
      from public.workplaces
      where id = v_workplace_id;
    else
      v_workplace_name := 'General / Unassigned';
    end if;

    v_line_gross := round(v_shifts * v_shift_rate, 2);

    insert into public.payroll_work_entries (
      payroll_record_id,
      workplace_id,
      workplace_name,
      shifts,
      shift_rate,
      line_gross
    )
    values (
      v_record_id,
      v_workplace_id,
      v_workplace_name,
      v_shifts,
      v_shift_rate,
      v_line_gross
    );
  end loop;

  return v_record_id;
end;
$$;

grant execute on function public.save_payroll_record(
  integer,
  integer,
  uuid,
  jsonb,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text
) to authenticated;

create or replace function public.approve_payroll_run(
  p_year integer,
  p_month integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_approve_payroll() then
    raise exception 'Only owner or admin users can approve payroll'
      using errcode = '42501';
  end if;

  update public.payroll_runs
  set
    status = 'approved',
    updated_by = auth.uid(),
    updated_at = now()
  where year = p_year
    and month = p_month
  returning id into v_run_id;

  if v_run_id is null then
    raise exception 'Payroll run not found' using errcode = '23503';
  end if;

  return v_run_id;
end;
$$;

grant execute on function public.approve_payroll_run(integer, integer) to authenticated;
