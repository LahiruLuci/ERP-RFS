alter table public.workers
  add column if not exists client_operation_id text;

create unique index if not exists workers_client_operation_id_key
  on public.workers (client_operation_id)
  where client_operation_id is not null;

drop function if exists public.create_temporary_worker(
  text,
  text,
  text,
  text,
  text,
  numeric
);

create or replace function public.create_temporary_worker(
  p_full_name text,
  p_nic text,
  p_phone text,
  p_address text,
  p_notes text,
  p_default_shift_rate numeric,
  p_worker_id uuid default null,
  p_client_operation_id text default null
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
  v_client_operation_id text := nullif(trim(coalesce(p_client_operation_id, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_manage_temporary_workers() then
    raise exception 'Only authorized users can add temporary workers'
      using errcode = '42501';
  end if;

  if v_client_operation_id is not null then
    select id
    into v_worker_id
    from public.workers
    where client_operation_id = v_client_operation_id;

    if v_worker_id is not null then
      return v_worker_id;
    end if;
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
        id,
        client_operation_id,
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
        coalesce(p_worker_id, gen_random_uuid()),
        v_client_operation_id,
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
        if v_client_operation_id is not null then
          select id
          into v_worker_id
          from public.workers
          where client_operation_id = v_client_operation_id;

          if v_worker_id is not null then
            return v_worker_id;
          end if;
        end if;

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
  numeric,
  uuid,
  text
) to authenticated;

notify pgrst, 'reload schema';
