create or replace function public.save_worker_deduction(
  p_deduction_id uuid,
  p_worker_id uuid,
  p_type public.worker_deduction_type,
  p_amount numeric,
  p_transaction_date date,
  p_note text,
  p_client_operation_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deduction_id uuid;
  v_status public.worker_deduction_status;
  v_payroll_record_id uuid;
  v_client_operation_id text := nullif(trim(coalesce(p_client_operation_id, '')), '');
  
  -- variables for matching on idempotency
  v_existing_worker_id uuid;
  v_existing_type public.worker_deduction_type;
  v_existing_amount numeric;
  v_existing_transaction_date date;
  v_existing_note text;
  
  -- variables for payroll recalculation
  v_record_id uuid;
  v_run_status public.payroll_run_status;
  v_year integer;
  v_month integer;
  v_old_transaction_date date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_manage_worker_deductions() then
    raise exception 'Only financially authorized users can manage worker deductions' using errcode = '42501';
  end if;

  if not exists (select 1 from public.workers where id = p_worker_id) then
    raise exception 'Worker not found' using errcode = '23503';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '23514';
  end if;

  if p_transaction_date is null then
    raise exception 'Transaction date is required' using errcode = '23514';
  end if;

  if p_type = 'other'::public.worker_deduction_type and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'Other deduction note is required' using errcode = '23514';
  end if;

  -- End basic validation

  if p_deduction_id is null and v_client_operation_id is not null then
    select id, worker_id, type, amount, transaction_date, note, status
    into v_deduction_id, v_existing_worker_id, v_existing_type, v_existing_amount, v_existing_transaction_date, v_existing_note, v_status
    from public.worker_deductions
    where client_operation_id = v_client_operation_id
      and worker_id = p_worker_id;

    if v_deduction_id is not null then
      if v_existing_worker_id != p_worker_id
         or v_existing_type != p_type
         or v_existing_amount != round(p_amount, 2)
         or v_existing_transaction_date != p_transaction_date
         or v_existing_note is distinct from nullif(trim(coalesce(p_note, '')), '') then
         raise exception 'Found existing deduction with same operation ID but different contents' using errcode = '23514';
      end if;

      if v_status = 'active'::public.worker_deduction_status then
        select pr.id, run.status
        into v_record_id, v_run_status
        from public.payroll_records pr
        join public.payroll_runs run on run.id = pr.payroll_run_id
        where pr.worker_id = v_existing_worker_id
          and run.year = extract(year from v_existing_transaction_date)::integer
          and run.month = extract(month from v_existing_transaction_date)::integer
        for update;

        if found and v_run_status = 'draft'::public.payroll_run_status then
          perform public.recalculate_payroll_record_totals(v_record_id, extract(year from v_existing_transaction_date)::integer, extract(month from v_existing_transaction_date)::integer);
        end if;
      end if;

      return v_deduction_id;
    end if;
  end if;

  if public.has_approved_payroll_for_worker_period(p_worker_id, p_transaction_date) then
    raise exception 'Approved payroll already exists for this transaction period' using errcode = '42501';
  end if;

  if p_deduction_id is null then
    begin
      insert into public.worker_deductions (
        worker_id, type, amount, transaction_date, note, status, created_by, updated_by, client_operation_id
      ) values (
        p_worker_id, p_type, round(p_amount, 2), p_transaction_date, nullif(trim(coalesce(p_note, '')), ''), 'active', auth.uid(), auth.uid(), v_client_operation_id
      ) returning id into v_deduction_id;
    exception when unique_violation then
      -- In case of concurrent insert racing on client_operation_id
      select id, worker_id, type, amount, transaction_date, note
      into v_deduction_id, v_existing_worker_id, v_existing_type, v_existing_amount, v_existing_transaction_date, v_existing_note
      from public.worker_deductions
      where client_operation_id = v_client_operation_id
        and worker_id = p_worker_id;
      
      if v_deduction_id is not null then
        if v_existing_worker_id != p_worker_id
           or v_existing_type != p_type
           or v_existing_amount != round(p_amount, 2)
           or v_existing_transaction_date != p_transaction_date
           or v_existing_note is distinct from nullif(trim(coalesce(p_note, '')), '') then
           raise exception 'Found existing deduction with same operation ID but different contents generated during constraint race' using errcode = '23514';
        end if;
      else
        -- A different unique constraint broke, pass it through.
        raise;
      end if;
    end;
  else
    -- Update path logic
    select status, payroll_record_id, transaction_date
    into v_status, v_payroll_record_id, v_old_transaction_date
    from public.worker_deductions
    where id = p_deduction_id
      and worker_id = p_worker_id;

    if v_status is null then
      raise exception 'Deduction not found or does not belong to the specified worker' using errcode = '23503';
    end if;

    if v_status = 'cancelled'::public.worker_deduction_status or v_payroll_record_id is not null then
      raise exception 'Cannot edit processed or cancelled transaction' using errcode = '23505';
    end if;

    update public.worker_deductions
    set type = p_type,
        amount = round(p_amount, 2),
        transaction_date = p_transaction_date,
        note = nullif(trim(coalesce(p_note, '')), ''),
        updated_by = auth.uid(),
        updated_at = now()
    where id = p_deduction_id
      and worker_id = p_worker_id
      and status = 'active'
      and payroll_record_id is null
    returning id into v_deduction_id;

    if v_deduction_id is null then
      raise exception 'Deduction not found or could not be edited safely' using errcode = '23503';
    end if;
  end if;

  -- Recalculate draft payroll totals if a draft payroll record exists for this worker/period
  v_year := extract(year from p_transaction_date)::integer;
  v_month := extract(month from p_transaction_date)::integer;

  select pr.id, run.status
  into v_record_id, v_run_status
  from public.payroll_records pr
  join public.payroll_runs run on run.id = pr.payroll_run_id
  where pr.worker_id = p_worker_id
    and run.year = v_year
    and run.month = v_month
  for update;

  if found and v_run_status = 'draft'::public.payroll_run_status then
    perform public.recalculate_payroll_record_totals(v_record_id, v_year, v_month);
  end if;

  -- If the transaction date changed during an update, also recalculate the old period
  if p_deduction_id is not null and v_old_transaction_date is not null then
    if v_old_transaction_date <> p_transaction_date then
      declare
        v_old_year integer;
        v_old_month integer;
        v_old_record_id uuid;
        v_old_run_status public.payroll_run_status;
      begin
        v_old_year := extract(year from v_old_transaction_date)::integer;
        v_old_month := extract(month from v_old_transaction_date)::integer;

        select pr.id, run.status
        into v_old_record_id, v_old_run_status
        from public.payroll_records pr
        join public.payroll_runs run on run.id = pr.payroll_run_id
        where pr.worker_id = p_worker_id
          and run.year = v_old_year
          and run.month = v_old_month
        for update;

        if found and v_old_run_status = 'draft'::public.payroll_run_status then
          perform public.recalculate_payroll_record_totals(v_old_record_id, v_old_year, v_old_month);
        end if;
      end;
    end if;
  end if;

  return v_deduction_id;
end;
$$;

grant execute on function public.save_worker_deduction(
  uuid,
  uuid,
  public.worker_deduction_type,
  numeric,
  date,
  text,
  text
) to authenticated;

create or replace function public.cancel_worker_deduction(
  p_deduction_id uuid,
  p_cancellation_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deduction public.worker_deductions%rowtype;
  
  -- variables for payroll recalculation
  v_record_id uuid;
  v_run_status public.payroll_run_status;
  v_year integer;
  v_month integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_manage_worker_deductions() then
    raise exception 'Only financially authorized users can cancel worker deductions'
      using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_cancellation_reason, '')), '') is null then
    raise exception 'Cancellation reason is required' using errcode = '23514';
  end if;

  select *
  into v_deduction
  from public.worker_deductions
  where id = p_deduction_id
  for update;

  if not found then
    raise exception 'Deduction transaction not found' using errcode = '23503';
  end if;

  if v_deduction.status = 'cancelled'::public.worker_deduction_status then
    return p_deduction_id;
  end if;

  if v_deduction.payroll_record_id is not null then
    raise exception 'Transactions linked to approved payroll cannot be cancelled'
      using errcode = '42501';
  end if;

  if public.has_approved_payroll_for_worker_period(v_deduction.worker_id, v_deduction.transaction_date) then
    raise exception 'Approved payroll already exists for this transaction period'
      using errcode = '42501';
  end if;

  update public.worker_deductions
  set
    status = 'cancelled',
    cancellation_reason = trim(p_cancellation_reason),
    cancelled_by = auth.uid(),
    cancelled_at = now(),
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_deduction_id;

  -- Recalculate draft payroll totals if a draft payroll record exists for this worker/period
  v_year := extract(year from v_deduction.transaction_date)::integer;
  v_month := extract(month from v_deduction.transaction_date)::integer;

  select pr.id, run.status
  into v_record_id, v_run_status
  from public.payroll_records pr
  join public.payroll_runs run on run.id = pr.payroll_run_id
  where pr.worker_id = v_deduction.worker_id
    and run.year = v_year
    and run.month = v_month
  for update;

  if found and v_run_status = 'draft'::public.payroll_run_status then
    perform public.recalculate_payroll_record_totals(v_record_id, v_year, v_month);
  end if;

  return p_deduction_id;
end;
$$;

grant execute on function public.cancel_worker_deduction(uuid, text) to authenticated;

notify pgrst, 'reload schema';
