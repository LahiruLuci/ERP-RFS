alter table public.worker_deductions
  add column if not exists client_operation_id text;

create unique index if not exists worker_deductions_client_operation_id_key
  on public.worker_deductions (client_operation_id)
  where client_operation_id is not null;

drop function if exists public.save_worker_deduction(
  uuid,
  uuid,
  public.worker_deduction_type,
  numeric,
  date,
  text
);

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
         raise exception 'Found existing deduction with same operation ID but different contents' using errcode = '23514';
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
      
      return v_deduction_id;
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
        return v_deduction_id;
      else
        -- A different unique constraint broke, pass it through.
        raise;
      end if;
    end;
  end if;

  -- Update path logic
  select status, payroll_record_id
  into v_status, v_payroll_record_id
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

notify pgrst, 'reload schema';
