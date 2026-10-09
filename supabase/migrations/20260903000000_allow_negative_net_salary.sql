do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.payroll_records'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%net_salary >= 0%'
  loop
    execute format('alter table public.payroll_records drop constraint %I', v_constraint.conname);
  end loop;
end $$;

create or replace function public.save_payroll_record(
  p_year integer,
  p_month integer,
  p_worker_id uuid,
  p_work_entries jsonb,
  p_advance numeric,
  p_advance_override boolean,
  p_epf numeric,
  p_meals numeric,
  p_meals_override boolean,
  p_uniform numeric,
  p_uniform_override boolean,
  p_other_deduction numeric,
  p_other_deduction_override boolean,
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
  v_advance_input numeric := round(coalesce(p_advance, 0), 2);
  v_advance numeric := 0;
  v_epf numeric := round(coalesce(p_epf, 0), 2);
  v_meals_input numeric := round(coalesce(p_meals, 0), 2);
  v_meals numeric := 0;
  v_uniform_input numeric := round(coalesce(p_uniform, 0), 2);
  v_uniform numeric := 0;
  v_other_deduction_input numeric := round(coalesce(p_other_deduction, 0), 2);
  v_other_deduction numeric := 0;
  v_other_note text := nullif(trim(coalesce(p_other_note, '')), '');
  v_total_deductions numeric;
  v_net_salary numeric;
  v_period_start date;
  v_period_end date;
  v_advance_transaction_total numeric := 0;
  v_meals_transaction_total numeric := 0;
  v_uniform_transaction_total numeric := 0;
  v_other_transaction_total numeric := 0;
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

  if v_advance_input < 0 or v_epf < 0 or v_meals_input < 0 or v_uniform_input < 0 or v_other_deduction_input < 0 then
    raise exception 'Deductions must be zero or more' using errcode = '23514';
  end if;

  if coalesce(p_other_deduction_override, false) and v_other_deduction_input > 0 and v_other_note is null then
    raise exception 'Other deduction note is required' using errcode = '23514';
  end if;

  v_period_start := public.deduction_period_start(p_year, p_month);
  v_period_end := public.deduction_period_end(p_year, p_month);

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

  select
    round(coalesce(sum(amount) filter (where type = 'advance'::public.worker_deduction_type), 0), 2),
    round(coalesce(sum(amount) filter (where type = 'meals'::public.worker_deduction_type), 0), 2),
    round(coalesce(sum(amount) filter (where type = 'uniform'::public.worker_deduction_type), 0), 2),
    round(coalesce(sum(amount) filter (where type = 'other'::public.worker_deduction_type), 0), 2)
  into
    v_advance_transaction_total,
    v_meals_transaction_total,
    v_uniform_transaction_total,
    v_other_transaction_total
  from public.worker_deductions
  where worker_id = p_worker_id
    and status = 'active'::public.worker_deduction_status
    and transaction_date >= v_period_start
    and transaction_date < v_period_end
    and payroll_record_id is null;

  v_advance := case when coalesce(p_advance_override, false) then v_advance_input else v_advance_transaction_total end;
  v_meals := case when coalesce(p_meals_override, false) then v_meals_input else v_meals_transaction_total end;
  v_uniform := case when coalesce(p_uniform_override, false) then v_uniform_input else v_uniform_transaction_total end;
  v_other_deduction := case when coalesce(p_other_deduction_override, false) then v_other_deduction_input else v_other_transaction_total end;

  v_total_deductions := round(v_advance + v_epf + v_meals + v_uniform + v_other_deduction, 2);
  v_net_salary := round(v_gross_salary - v_total_deductions, 2);

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
      advance_override,
      epf,
      meals,
      meals_override,
      uniform,
      uniform_override,
      other_deduction,
      other_deduction_override,
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
      coalesce(p_advance_override, false),
      v_epf,
      v_meals,
      coalesce(p_meals_override, false),
      v_uniform,
      coalesce(p_uniform_override, false),
      v_other_deduction,
      coalesce(p_other_deduction_override, false),
      v_other_note,
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
      advance_override = coalesce(p_advance_override, false),
      epf = v_epf,
      meals = v_meals,
      meals_override = coalesce(p_meals_override, false),
      uniform = v_uniform,
      uniform_override = coalesce(p_uniform_override, false),
      other_deduction = v_other_deduction,
      other_deduction_override = coalesce(p_other_deduction_override, false),
      other_note = v_other_note,
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
  boolean,
  numeric,
  numeric,
  boolean,
  numeric,
  boolean,
  numeric,
  boolean,
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
  v_record record;
  v_period_start date;
  v_period_end date;
  v_advance numeric;
  v_meals numeric;
  v_uniform numeric;
  v_other_deduction numeric;
  v_total_deductions numeric;
  v_net_salary numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_approve_payroll() then
    raise exception 'Only owner or admin users can approve payroll'
      using errcode = '42501';
  end if;

  select id
  into v_run_id
  from public.payroll_runs
  where year = p_year
    and month = p_month
  for update;

  if v_run_id is null then
    raise exception 'Payroll run not found' using errcode = '23503';
  end if;

  v_period_start := public.deduction_period_start(p_year, p_month);
  v_period_end := public.deduction_period_end(p_year, p_month);

  for v_record in
    select *
    from public.payroll_records
    where payroll_run_id = v_run_id
    for update
  loop
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

    v_total_deductions := round(v_advance + v_record.epf + v_meals + v_uniform + v_other_deduction, 2);
    v_net_salary := round(v_record.gross_salary - v_total_deductions, 2);

    update public.payroll_records
    set
      advance = v_advance,
      meals = v_meals,
      uniform = v_uniform,
      other_deduction = v_other_deduction,
      total_deductions = v_total_deductions,
      net_salary = v_net_salary,
      updated_by = auth.uid(),
      updated_at = now()
    where id = v_record.id;

    update public.worker_deductions
    set
      payroll_record_id = v_record.id,
      updated_by = auth.uid(),
      updated_at = now()
    where worker_id = v_record.worker_id
      and status = 'active'::public.worker_deduction_status
      and transaction_date >= v_period_start
      and transaction_date < v_period_end
      and payroll_record_id is null;
  end loop;

  update public.payroll_runs
  set
    status = 'approved',
    updated_by = auth.uid(),
    updated_at = now()
  where id = v_run_id;

  return v_run_id;
end;
$$;

grant execute on function public.approve_payroll_run(integer, integer) to authenticated;

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

grant execute on function public.recalculate_payroll_record_totals(uuid, integer, integer) to authenticated;

notify pgrst, 'reload schema';
