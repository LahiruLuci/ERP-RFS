do $$
begin
  create type public.worker_type as enum ('permanent', 'temporary');
exception
  when duplicate_object then null;
end $$;

alter table public.workers
  add column if not exists worker_type public.worker_type not null default 'permanent'::public.worker_type;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workers'
      and column_name = 'worker_type'
      and udt_name <> 'worker_type'
  ) then
    alter table public.workers alter column worker_type drop default;
    alter table public.workers
      alter column worker_type type public.worker_type
      using coalesce(worker_type::text, 'permanent')::public.worker_type;
    alter table public.workers
      alter column worker_type set default 'permanent'::public.worker_type;
  end if;
end $$;

update public.workers
set worker_type = 'permanent'::public.worker_type
where worker_type is null;

create index if not exists workers_worker_type_idx
  on public.workers (worker_type);

create or replace function public.next_temporary_worker_no()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select 'TMP-' || lpad(
    (
      coalesce(
        max(nullif(substring(employee_no from '^TMP-([0-9]+)$'), '')::integer),
        0
      ) + 1
    )::text,
    4,
    '0'
  )
  from public.workers
  where employee_no ~ '^TMP-[0-9]+$';
$$;

create or replace function public.can_manage_temporary_workers()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_workers() or public.can_manage_payroll();
$$;

grant execute on function public.can_manage_temporary_workers() to authenticated;

create or replace function public.set_worker_type(
  p_worker_id uuid,
  p_worker_type public.worker_type
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_manage_workers() then
    raise exception 'Only active owner or admin users can manage workers'
      using errcode = '42501';
  end if;

  if p_worker_type is null then
    raise exception 'Worker type is required' using errcode = '23514';
  end if;

  update public.workers
  set
    worker_type = p_worker_type,
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_worker_id
  returning id into p_worker_id;

  if p_worker_id is null then
    raise exception 'Worker not found' using errcode = '23503';
  end if;

  return p_worker_id;
end;
$$;

grant execute on function public.set_worker_type(uuid, public.worker_type) to authenticated;

create or replace function public.create_temporary_worker(
  p_full_name text,
  p_nic text,
  p_phone text,
  p_address text,
  p_notes text,
  p_default_shift_rate numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker_id uuid;
  v_employee_no text;
  v_full_name text := nullif(trim(coalesce(p_full_name, '')), '');
  v_nic text := nullif(trim(coalesce(p_nic, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_default_shift_rate numeric := round(coalesce(p_default_shift_rate, 0), 2);
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_manage_temporary_workers() then
    raise exception 'Only authorized users can add temporary workers'
      using errcode = '42501';
  end if;

  if v_full_name is null then
    raise exception 'Full Name is required' using errcode = '23514';
  end if;

  if v_nic is null then
    raise exception 'NIC is required' using errcode = '23514';
  end if;

  if v_phone is null then
    raise exception 'Mobile number is required' using errcode = '23514';
  end if;

  if v_default_shift_rate < 0 then
    raise exception 'Default Shift Rate must be zero or more' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.workers
    where lower(coalesce(nic, '')) = lower(v_nic)
  ) then
    raise exception 'A worker with this NIC already exists'
      using errcode = '23505';
  end if;

  perform pg_advisory_xact_lock(hashtext('temporary_worker_no'));

  loop
    v_employee_no := public.next_temporary_worker_no();

    begin
      insert into public.workers (
        employee_no,
        worker_type,
        full_name,
        nic,
        phone,
        address,
        joined_date,
        basic_salary,
        default_shift_rate,
        status,
        notes,
        created_by,
        updated_by
      )
      values (
        v_employee_no,
        'temporary'::public.worker_type,
        v_full_name,
        v_nic,
        v_phone,
        nullif(trim(coalesce(p_address, '')), ''),
        current_date,
        0,
        v_default_shift_rate,
        'active'::public.worker_status,
        nullif(trim(coalesce(p_notes, '')), ''),
        auth.uid(),
        auth.uid()
      )
      returning id into v_worker_id;

      exit;
    exception
      when unique_violation then
        if exists (select 1 from public.workers where lower(coalesce(nic, '')) = lower(v_nic)) then
          raise exception 'A worker with this NIC already exists'
            using errcode = '23505';
        end if;
    end;
  end loop;

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
    'active'::public.worker_status,
    current_date,
    'Temporary worker added',
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  );

  return v_worker_id;
end;
$$;

grant execute on function public.create_temporary_worker(
  text,
  text,
  text,
  text,
  text,
  numeric
) to authenticated;

create or replace function public.is_worker_payroll_eligible(
  p_worker_id uuid,
  p_year integer,
  p_month integer
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_worker public.workers%rowtype;
  v_period_start date;
  v_period_end date;
  v_end_date date;
begin
  if p_year is null or p_year < 2000 or p_year > 2100 then
    return false;
  end if;

  if p_month is null or p_month < 1 or p_month > 12 then
    return false;
  end if;

  v_period_start := make_date(p_year, p_month, 1);
  v_period_end := (v_period_start + interval '1 month' - interval '1 day')::date;

  select * into v_worker from public.workers where id = p_worker_id;

  if not found then
    return false;
  end if;

  if coalesce(v_worker.worker_type, 'permanent'::public.worker_type) = 'temporary'::public.worker_type then
    return exists (
      select 1
      from public.payroll_records record
      join public.payroll_runs run on run.id = record.payroll_run_id
      where record.worker_id = p_worker_id
        and run.year = p_year
        and run.month = p_month
    );
  end if;

  if v_worker.joined_date is null or v_worker.joined_date > v_period_end then
    return false;
  end if;

  if v_worker.status not in ('resigned'::public.worker_status, 'terminated'::public.worker_status) then
    return true;
  end if;

  select effective_date
  into v_end_date
  from public.worker_status_history
  where worker_id = p_worker_id
    and new_status in ('resigned'::public.worker_status, 'terminated'::public.worker_status)
    and effective_date <= v_period_end
  order by effective_date desc, created_at desc
  limit 1;

  if v_end_date is null then
    return true;
  end if;

  return v_end_date >= v_period_start;
end;
$$;

revoke all on function public.is_worker_payroll_eligible(uuid, integer, integer) from public;
revoke all on function public.is_worker_payroll_eligible(uuid, integer, integer) from authenticated;

create or replace function public.save_workpoint_payroll_entry(
  p_year integer,
  p_month integer,
  p_worker_id uuid,
  p_workplace_id uuid,
  p_entry_id uuid,
  p_shifts numeric,
  p_shift_rate numeric
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
  v_entry_id uuid;
  v_workplace_name text;
  v_worker_type public.worker_type;
  v_worker_status public.worker_status;
  v_shifts numeric;
  v_shift_rate numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_manage_payroll() then
    raise exception 'Only payroll-authorized users can manage payroll' using errcode = '42501';
  end if;

  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Choose a valid payroll year' using errcode = '23514';
  end if;

  if p_month is null or p_month < 1 or p_month > 12 then
    raise exception 'Choose a valid payroll month' using errcode = '23514';
  end if;

  if p_worker_id is null then
    raise exception 'Worker is required' using errcode = '23514';
  end if;

  if p_workplace_id is null then
    raise exception 'Workpoint is required' using errcode = '23514';
  end if;

  select worker_type, status
  into v_worker_type, v_worker_status
  from public.workers
  where id = p_worker_id;

  if v_worker_type is null then
    raise exception 'Worker not found' using errcode = '23503';
  end if;

  if not public.is_worker_payroll_eligible(p_worker_id, p_year, p_month)
    and not (
      v_worker_type = 'temporary'::public.worker_type
      and v_worker_status = 'active'::public.worker_status
    ) then
    raise exception 'Worker is not eligible for this payroll period' using errcode = '23514';
  end if;

  select name into v_workplace_name from public.workplaces where id = p_workplace_id;

  if v_workplace_name is null then
    raise exception 'Workpoint not found' using errcode = '23503';
  end if;

  v_shifts := round(coalesce(p_shifts, 0), 2);
  v_shift_rate := round(coalesce(p_shift_rate, 0), 2);

  if v_shifts < 0 or v_shift_rate < 0 then
    raise exception 'Shifts and rates must be zero or more' using errcode = '23514';
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

  insert into public.payroll_records (
    payroll_run_id, worker_id, gross_salary, advance, epf, meals, uniform,
    other_deduction, total_deductions, net_salary, created_by, updated_by
  )
  values (v_run_id, p_worker_id, 0, 0, 0, 0, 0, 0, 0, 0, auth.uid(), auth.uid())
  on conflict (payroll_run_id, worker_id) do update
    set updated_by = auth.uid(), updated_at = now()
  returning id into v_record_id;

  if p_entry_id is null then
    insert into public.payroll_work_entries (
      payroll_record_id, workplace_id, workplace_name, shifts, shift_rate, line_gross
    )
    values (
      v_record_id, p_workplace_id, v_workplace_name, v_shifts, v_shift_rate,
      round(v_shifts * v_shift_rate, 2)
    )
    returning id into v_entry_id;
  else
    update public.payroll_work_entries
    set workplace_id = p_workplace_id,
        workplace_name = v_workplace_name,
        shifts = v_shifts,
        shift_rate = v_shift_rate,
        line_gross = round(v_shifts * v_shift_rate, 2)
    where id = p_entry_id
      and payroll_record_id = v_record_id
    returning id into v_entry_id;

    if v_entry_id is null then
      raise exception 'Payroll work entry not found' using errcode = '23503';
    end if;
  end if;

  perform public.recalculate_payroll_record_totals(v_record_id, p_year, p_month);

  return v_entry_id;
end;
$$;

grant execute on function public.save_workpoint_payroll_entry(integer, integer, uuid, uuid, uuid, numeric, numeric) to authenticated;

drop function if exists public.get_workpoint_payroll_entries(integer, integer, uuid);

create or replace function public.get_workpoint_payroll_entries(
  p_year integer,
  p_month integer,
  p_workplace_id uuid
)
returns table (
  entry_id uuid,
  payroll_record_id uuid,
  worker_id uuid,
  employee_no text,
  full_name text,
  worker_status public.worker_status,
  worker_type public.worker_type,
  shifts numeric,
  shift_rate numeric,
  line_gross numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_manage_payroll() then
    raise exception 'Only payroll-authorized users can view payroll' using errcode = '42501';
  end if;

  return query
  select entry.id,
         record.id,
         worker.id,
         worker.employee_no,
         worker.full_name,
         worker.status,
         worker.worker_type,
         entry.shifts,
         entry.shift_rate,
         entry.line_gross
  from public.payroll_work_entries entry
  join public.payroll_records record on record.id = entry.payroll_record_id
  join public.payroll_runs run on run.id = record.payroll_run_id
  join public.workers worker on worker.id = record.worker_id
  where run.year = p_year
    and run.month = p_month
    and entry.workplace_id = p_workplace_id
  order by worker.employee_no, worker.full_name, entry.created_at;
end;
$$;

grant execute on function public.get_workpoint_payroll_entries(integer, integer, uuid) to authenticated;

notify pgrst, 'reload schema';
