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

alter table public.payroll_records
  add column if not exists advance_override boolean not null default false,
  add column if not exists meals_override boolean not null default false,
  add column if not exists uniform_override boolean not null default false,
  add column if not exists other_deduction_override boolean not null default false;

create or replace function public.recalculate_payroll_record_totals(
  p_record_id uuid,
  p_year integer,
  p_month integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.payroll_records%rowtype;
  v_period_start date;
  v_period_end date;
  v_gross_salary numeric := 0;
  v_advance numeric := 0;
  v_meals numeric := 0;
  v_uniform numeric := 0;
  v_other_deduction numeric := 0;
  v_other_note text;
  v_total_deductions numeric;
  v_net_salary numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_manage_payroll() then
    raise exception 'Only payroll-authorized users can manage payroll' using errcode = '42501';
  end if;

  select *
  into v_record
  from public.payroll_records
  where id = p_record_id
  for update;

  if not found then
    raise exception 'Payroll record not found' using errcode = '23503';
  end if;

  select round(coalesce(sum(line_gross), 0), 2)
  into v_gross_salary
  from public.payroll_work_entries
  where payroll_record_id = p_record_id;

  v_period_start := public.deduction_period_start(p_year, p_month);
  v_period_end := public.deduction_period_end(p_year, p_month);

  select
    round(coalesce(sum(amount) filter (where type = 'advance'::public.worker_deduction_type), 0), 2),
    round(coalesce(sum(amount) filter (where type = 'meals'::public.worker_deduction_type), 0), 2),
    round(coalesce(sum(amount) filter (where type = 'uniform'::public.worker_deduction_type), 0), 2),
    round(coalesce(sum(amount) filter (where type = 'other'::public.worker_deduction_type), 0), 2)
  into v_advance, v_meals, v_uniform, v_other_deduction
  from public.worker_deductions
  where worker_id = v_record.worker_id
    and status = 'active'::public.worker_deduction_status
    and transaction_date >= v_period_start
    and transaction_date < v_period_end
    and payroll_record_id is null;

  if coalesce(v_record.advance_override, false) then
    v_advance := round(coalesce(v_record.advance, 0), 2);
  end if;

  if coalesce(v_record.meals_override, false) then
    v_meals := round(coalesce(v_record.meals, 0), 2);
  end if;

  if coalesce(v_record.uniform_override, false) then
    v_uniform := round(coalesce(v_record.uniform, 0), 2);
  end if;

  if coalesce(v_record.other_deduction_override, false) then
    v_other_deduction := round(coalesce(v_record.other_deduction, 0), 2);
  end if;

  v_other_note := v_record.other_note;

  v_total_deductions := round(v_advance + v_record.epf + v_meals + v_uniform + v_other_deduction, 2);
  v_net_salary := round(v_gross_salary - v_total_deductions, 2);

  if v_net_salary < 0 then
    raise exception 'Total deductions exceed gross salary' using errcode = '23514';
  end if;

  update public.payroll_records
  set gross_salary = v_gross_salary,
      advance = v_advance,
      meals = v_meals,
      uniform = v_uniform,
      other_deduction = v_other_deduction,
      other_note = v_other_note,
      total_deductions = v_total_deductions,
      net_salary = v_net_salary,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_record_id;
end;
$$;

revoke all on function public.recalculate_payroll_record_totals(uuid, integer, integer) from public;
revoke all on function public.recalculate_payroll_record_totals(uuid, integer, integer) from authenticated;

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

  if not public.is_worker_payroll_eligible(p_worker_id, p_year, p_month) then
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
