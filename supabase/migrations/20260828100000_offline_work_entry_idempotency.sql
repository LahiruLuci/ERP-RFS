alter table public.payroll_work_entries
  add column if not exists client_operation_id text;

create unique index if not exists payroll_work_entries_client_operation_id_key
  on public.payroll_work_entries (client_operation_id)
  where client_operation_id is not null;

drop function if exists public.save_workpoint_payroll_entry(
  integer,
  integer,
  uuid,
  uuid,
  uuid,
  numeric,
  numeric
);

create or replace function public.save_workpoint_payroll_entry(
  p_year integer,
  p_month integer,
  p_worker_id uuid,
  p_workplace_id uuid,
  p_entry_id uuid,
  p_shifts numeric,
  p_shift_rate numeric,
  p_client_operation_id text default null
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
  v_client_operation_id text := nullif(trim(coalesce(p_client_operation_id, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_manage_payroll() then
    raise exception 'Only payroll-authorized users can manage payroll' using errcode = '42501';
  end if;

  if v_client_operation_id is not null then
    select id
    into v_entry_id
    from public.payroll_work_entries
    where client_operation_id = v_client_operation_id;

    if v_entry_id is not null then
      return v_entry_id;
    end if;
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
      payroll_record_id, workplace_id, workplace_name, shifts, shift_rate,
      line_gross, client_operation_id
    )
    values (
      v_record_id, p_workplace_id, v_workplace_name, v_shifts, v_shift_rate,
      round(v_shifts * v_shift_rate, 2), v_client_operation_id
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

grant execute on function public.save_workpoint_payroll_entry(
  integer,
  integer,
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  text
) to authenticated;

notify pgrst, 'reload schema';
