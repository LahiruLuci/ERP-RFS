import "server-only";

import { createClient } from "@/lib/supabase/server";

import type {
  Worker,
  WorkerSaveInput,
  WorkerStatus,
  WorkerStatusHistory,
  WorkerType,
  TemporaryWorkerInput,
} from "./types";

export type WorkerFilters = {
  basicSalaryMax?: number | null;
  basicSalaryMin?: number | null;
  search?: string;
  shiftRateMax?: number | null;
  shiftRateMin?: number | null;
  status?: WorkerStatus | null;
  workerType?: WorkerType | null;
};

export class WorkerDatabaseSetupError extends Error {
  constructor() {
    super("Worker database migration is required.");
    this.name = "WorkerDatabaseSetupError";
  }
}

export class WorkerPermissionError extends Error {
  constructor() {
    super("Current user is not allowed to manage workers.");
    this.name = "WorkerPermissionError";
  }
}

export class WorkerAuthenticationError extends Error {
  constructor() {
    super("Current user is not authenticated.");
    this.name = "WorkerAuthenticationError";
  }
}

export class WorkerConnectionError extends Error {
  constructor() {
    super("Unable to connect to Supabase.");
    this.name = "WorkerConnectionError";
  }
}

export class WorkerProfileError extends Error {
  constructor() {
    super("Current user profile is missing or inactive.");
    this.name = "WorkerProfileError";
  }
}

export class WorkerDuplicateEmployeeNoError extends Error {
  constructor() {
    super("Worker employee number already exists.");
    this.name = "WorkerDuplicateEmployeeNoError";
  }
}

export class WorkerDuplicateNicError extends Error {
  constructor() {
    super("Worker NIC already exists.");
    this.name = "WorkerDuplicateNicError";
  }
}

export class WorkerDuplicateEtfNoError extends Error {
  constructor() {
    super("Worker ETF number already exists.");
    this.name = "WorkerDuplicateEtfNoError";
  }
}

export class WorkerDuplicateEpfNoError extends Error {
  constructor() {
    super("Worker EPF number already exists.");
    this.name = "WorkerDuplicateEpfNoError";
  }
}

export class WorkerDuplicateIdentityError extends Error {
  constructor() {
    super("A worker with this identity already exists.");
    this.name = "WorkerDuplicateIdentityError";
  }
}

export class WorkerConstraintError extends Error {
  constructor() {
    super("Worker data violates a database constraint.");
    this.name = "WorkerConstraintError";
  }
}

const workerSelect = `
  id,
  employee_no,
  worker_type,
  full_name,
  nic,
  date_of_birth,
  gender,
  etf_no,
  epf_no,
  phone,
  secondary_phone,
  address,
  emergency_contact_name,
  emergency_contact_relationship,
  emergency_contact_phone,
  previous_occupation,
  previous_employer,
  joined_date,
  basic_salary,
  default_shift_rate,
  status,
  notes,
  created_at,
  updated_at
`;

const workerStatusHistorySelect = `
  id,
  worker_id,
  previous_status,
  new_status,
  effective_date,
  reason,
  note,
  changed_by,
  created_at,
  changed_by_profile:profiles!worker_status_history_changed_by_fkey(full_name)
`;

function sanitizeSearchTerm(search: string) {
  return search.replace(/[%,()]/g, " ").trim();
}

function isConnectionError(error: { details?: string; message?: string }) {
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();

  return (
    text.includes("fetch failed") ||
    text.includes("enotfound") ||
    text.includes("econnrefused") ||
    text.includes("networkerror")
  );
}

function isMissingWorkerDatabaseSetup(error: { code?: string; message?: string }) {
  return (
    error.code === "42703" ||
    error.code === "PGRST202" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    error.message?.includes("save_worker") ||
    error.message?.includes("worker_status_history") ||
    error.message?.includes("worker_type") ||
    error.message?.includes("create_temporary_worker") ||
    error.message?.includes("set_worker_type") ||
    error.message?.includes("date_of_birth")
  );
}

function isWorkerPermissionError(error: { code?: string; message?: string }) {
  return (
    error.code === "42501" ||
    error.message?.includes("Only owner or admin users can manage workers") ||
    error.message?.includes("violates row-level security policy")
  );
}

function isWorkerAuthenticationError(error: { message?: string }) {
  return error.message?.includes("Authentication required") ?? false;
}

function isWorkerProfileError(error: { code?: string; message?: string }) {
  return (
    error.code === "23503" ||
    error.message?.includes("violates foreign key constraint") ||
    error.message?.includes("Current user profile is missing or inactive")
  );
}

function getErrorText(error: {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
}) {
  return [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function logWorkerDataError(
  operation: string,
  error: {
    code?: string;
    details?: string;
    hint?: string;
    message?: string;
  },
) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.error("[workers] Supabase operation failed", {
    operation,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

function handleWorkerDataError(
  error: { code?: string; details?: string; hint?: string; message?: string },
  fallbackMessage: string,
  operation: string,
): never {
  logWorkerDataError(operation, error);

  if (isConnectionError(error)) {
    throw new WorkerConnectionError();
  }

  if (isMissingWorkerDatabaseSetup(error)) {
    throw new WorkerDatabaseSetupError();
  }

  if (isWorkerAuthenticationError(error)) {
    throw new WorkerAuthenticationError();
  }

  if (isWorkerProfileError(error)) {
    throw new WorkerProfileError();
  }

  if (isWorkerPermissionError(error)) {
    throw new WorkerPermissionError();
  }

  const errorText = getErrorText(error);

  if (error.code === "23505") {
    if (errorText.includes("employee_no")) {
      throw new WorkerDuplicateEmployeeNoError();
    }

    if (errorText.includes("nic")) {
      throw new WorkerDuplicateNicError();
    }

    if (errorText.includes("etf_no")) {
      throw new WorkerDuplicateEtfNoError();
    }

    if (errorText.includes("epf_no")) {
      throw new WorkerDuplicateEpfNoError();
    }

    if (errorText.includes("identity")) {
      throw new WorkerDuplicateIdentityError();
    }

    throw new WorkerConstraintError();
  }

  if (["23502", "23514", "22P02", "P0001"].includes(error.code ?? "")) {
    throw new WorkerConstraintError();
  }

  throw new Error(fallbackMessage);
}

async function assertWorkerMutationAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    logWorkerDataError("auth.getUser", userError);
    throw new WorkerAuthenticationError();
  }

  if (!user) {
    throw new WorkerAuthenticationError();
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    handleWorkerDataError(
      profileError,
      "Unable to confirm worker permissions.",
      "profiles.select",
    );
  }

  if (!profile || profile.is_active !== true) {
    throw new WorkerProfileError();
  }

  if (!["owner", "admin"].includes(String(profile.role))) {
    throw new WorkerPermissionError();
  }
}

export async function getWorkers(filters: WorkerFilters | string = "") {
  const supabase = await createClient();
  const normalizedFilters =
    typeof filters === "string" ? { search: filters } : filters;
  const searchTerm = sanitizeSearchTerm(normalizedFilters.search ?? "");
  let query = supabase
    .from("workers")
    .select(workerSelect)
    .order("full_name", { ascending: true })
    .limit(100);

  if (searchTerm) {
    const pattern = `%${searchTerm}%`;
    query = query.or(
      [
        `full_name.ilike.${pattern}`,
        `employee_no.ilike.${pattern}`,
        `nic.ilike.${pattern}`,
        `etf_no.ilike.${pattern}`,
        `phone.ilike.${pattern}`,
      ].join(","),
    );
  }

  if (normalizedFilters.basicSalaryMin !== null && normalizedFilters.basicSalaryMin !== undefined) {
    query = query.gte("basic_salary", normalizedFilters.basicSalaryMin);
  }

  if (normalizedFilters.basicSalaryMax !== null && normalizedFilters.basicSalaryMax !== undefined) {
    query = query.lte("basic_salary", normalizedFilters.basicSalaryMax);
  }

  if (normalizedFilters.shiftRateMin !== null && normalizedFilters.shiftRateMin !== undefined) {
    query = query.gte("default_shift_rate", normalizedFilters.shiftRateMin);
  }

  if (normalizedFilters.shiftRateMax !== null && normalizedFilters.shiftRateMax !== undefined) {
    query = query.lte("default_shift_rate", normalizedFilters.shiftRateMax);
  }

  if (normalizedFilters.status) {
    query = query.eq("status", normalizedFilters.status);
  }

  if (normalizedFilters.workerType) {
    query = query.eq("worker_type", normalizedFilters.workerType);
  }

  const { data, error } = await query;

  if (error) {
    handleWorkerDataError(error, "Unable to load workers.", "workers.select");
  }

  return (data ?? []) as Worker[];
}

export async function getWorker(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workers")
    .select(workerSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    handleWorkerDataError(error, "Unable to load worker.", "workers.selectOne");
  }

  return data as Worker | null;
}

export async function getWorkerStatusHistory(workerId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("worker_status_history")
    .select(workerStatusHistorySelect)
    .eq("worker_id", workerId)
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    handleWorkerDataError(
      error,
      "Unable to load worker status history.",
      "worker_status_history.select",
    );
  }

  return (data ?? []).map((event) => {
    const profile = Array.isArray(event.changed_by_profile)
      ? event.changed_by_profile[0]
      : event.changed_by_profile;

    return {
      ...event,
      changed_by_profile: profile ?? null,
    };
  }) as WorkerStatusHistory[];
}

function toSaveWorkerParams(input: WorkerSaveInput, workerId: string | null) {
  return {
    p_worker_id: workerId,
    p_employee_no: input.employee_no,
    p_full_name: input.full_name,
    p_nic: input.nic,
    p_etf_no: input.etf_no,
    p_epf_no: input.epf_no,
    p_phone: input.phone,
    p_secondary_phone: input.secondary_phone,
    p_address: input.address,
    p_joined_date: input.joined_date,
    p_basic_salary: input.basic_salary,
    p_default_shift_rate: input.default_shift_rate,
    p_status: input.status,
    p_notes: input.notes,
    p_date_of_birth: input.date_of_birth,
    p_gender: input.gender,
    p_emergency_contact_name: input.emergency_contact_name,
    p_emergency_contact_relationship: input.emergency_contact_relationship,
    p_emergency_contact_phone: input.emergency_contact_phone,
    p_previous_occupation: input.previous_occupation,
    p_previous_employer: input.previous_employer,
    p_status_effective_date: input.status_effective_date,
    p_status_reason: input.status_reason,
    p_status_note: input.status_note,
  };
}

async function updateWorkerType(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workerId: string,
  workerType: WorkerType,
) {
  const { error } = await supabase.rpc("set_worker_type", {
    p_worker_id: workerId,
    p_worker_type: workerType,
  });

  if (error) {
    handleWorkerDataError(error, "Unable to update worker type.", "set_worker_type");
  }
}

function validateTemporaryWorkerInput(
  input: TemporaryWorkerInput,
): TemporaryWorkerInput {
  const fullName = input.full_name.trim();
  const nic = input.nic?.trim() || null;
  const phone = input.phone?.trim() || null;

  if (!fullName) {
    throw new WorkerConstraintError();
  }

  if (!Number.isFinite(input.default_shift_rate) || input.default_shift_rate < 0) {
    throw new WorkerConstraintError();
  }

  return {
    address: input.address?.trim() || null,
    client_operation_id: input.client_operation_id?.trim() || null,
    default_shift_rate: input.default_shift_rate,
    full_name: fullName,
    nic,
    notes: input.notes?.trim() || null,
    phone,
    worker_id: input.worker_id?.trim() || null,
  };
}

export async function createTemporaryWorker(input: TemporaryWorkerInput) {
  const supabase = await createClient();
  const validated = validateTemporaryWorkerInput(input);

  const { data, error } = await supabase.rpc("create_temporary_worker", {
    p_address: validated.address,
    p_default_shift_rate: validated.default_shift_rate,
    p_full_name: validated.full_name,
    p_nic: validated.nic,
    p_notes: validated.notes,
    p_phone: validated.phone,
    p_worker_id: validated.worker_id,
    p_client_operation_id: validated.client_operation_id,
  });

  if (error) {
    handleWorkerDataError(
      error,
      "Unable to create temporary worker.",
      "create_temporary_worker",
    );
  }

  return data as string;
}

export async function createWorker(input: WorkerSaveInput) {
  const supabase = await createClient();

  await assertWorkerMutationAccess(supabase);

  const { data, error } = await supabase.rpc(
    "save_worker",
    toSaveWorkerParams(input, null),
  );

  if (error) {
    handleWorkerDataError(error, "Unable to save worker.", "save_worker.insert");
  }

  if (input.worker_type !== "permanent") {
    await updateWorkerType(supabase, data as string, input.worker_type);
  }

  return data as string;
}

export async function updateWorker(id: string, input: WorkerSaveInput) {
  const supabase = await createClient();

  await assertWorkerMutationAccess(supabase);

  const { error } = await supabase.rpc(
    "save_worker",
    toSaveWorkerParams(input, id),
  );

  if (error) {
    handleWorkerDataError(error, "Unable to update worker.", "save_worker.update");
  }

  await updateWorkerType(supabase, id, input.worker_type);
}
