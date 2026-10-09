create or replace function public.delete_workpoint_payroll_entry(
  p_entry_id uuid,
  p_month integer,
  p_workplace_id uuid,
  p_year integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id uuid;
  v_run_status public.payroll_run_status;
  v_run_year integer;
  v_run_month integer;
  v_deleted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_edit_work_entries() then
    raise exception 'Only the owner can delete a work entry.' using errcode = '42501';
  end if;

  if p_entry_id is null then
    raise exception 'Work entry is required' using errcode = '23514';
  end if;

  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Choose a valid payroll year' using errcode = '23514';
  end if;

  if p_month is null or p_month < 1 or p_month > 12 then
    raise exception 'Choose a valid payroll month' using errcode = '23514';
  end if;

  if p_workplace_id is null then
    raise exception 'Workpoint is required' using errcode = '23514';
  end if;

  select payroll_record_id
  into v_record_id
  from public.payroll_work_entries
  where id = p_entry_id
    and workplace_id = p_workplace_id
  for update;

  if v_record_id is null then
    raise exception 'Payroll work entry not found' using errcode = '23503';
  end if;

  select run.status, run.year, run.month
  into v_run_status, v_run_year, v_run_month
  from public.payroll_records pr
  join public.payroll_runs run on run.id = pr.payroll_run_id
  where pr.id = v_record_id
  for update;

  if not found or v_run_status <> 'draft'::public.payroll_run_status then
    raise exception 'Approved payroll cannot be edited' using errcode = '42501';
  end if;

  if v_run_year <> p_year or v_run_month <> p_month then
    raise exception 'Payroll year/month does not match the selected work entry period.' using errcode = '23514';
  end if;

  delete from public.payroll_work_entries
  where id = p_entry_id
    and workplace_id = p_workplace_id;

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    raise exception 'Payroll work entry not found' using errcode = '23503';
  end if;

  perform public.recalculate_payroll_record_totals(v_record_id, v_run_year, v_run_month);
end;
$$;

grant execute on function public.delete_workpoint_payroll_entry(
  uuid,
  integer,
  uuid,
  integer
) to authenticated;

notify pgrst, 'reload schema';
