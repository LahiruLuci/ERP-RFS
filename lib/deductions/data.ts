import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Worker } from "@/lib/workers/types";

import type {
  WorkerDeduction,
  WorkerDeductionSaveInput,
  WorkerDeductionStatus,
  WorkerDeductionSummary,
  WorkerDeductionType,
} from "./types";

const deductionSelect = `
  id,
  worker_id,
  type,
  amount,
  transaction_date,
  note,
  status,
  payroll_record_id,
  created_by,
  cancellation_reason,
  cancelled_at,
  created_at,
  created_by_profile:profiles!worker_deductions_created_by_fkey(full_name)
`;

const workerSelect = `
  id,
  employee_no,
  worker_type,
  full_name,
  nic,
  etf_no,
  phone,
  status,
  default_shift_rate
`;

export class DeductionAuthenticationError extends Error {
  constructor() {
    super("Current user is not authenticated.");
    this.name = "DeductionAuthenticationError";
  }
}

export class DeductionPermissionError extends Error {
  constructor() {
    super("Current user is not allowed to manage deductions.");
    this.name = "DeductionPermissionError";
  }
}

export class DeductionValidationError extends Error {
  constructor(message = "Deduction transaction is invalid.") {
    super(message);
    this.name = "DeductionValidationError";
  }
}

export class DeductionApprovedPayrollError extends Error {
  constructor() {
    super("Approved payroll already exists for this period.");
    this.name = "DeductionApprovedPayrollError";
  }
}

export class DeductionDatabaseSetupError extends Error {
  constructor() {
    super("Deduction database migration is required.");
    this.name = "DeductionDatabaseSetupError";
  }
}

function logDeductionError(
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

  console.error("[deductions] Supabase operation failed", {
    operation,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

function handleDeductionError(
  operation: string,
  error: {
    code?: string;
    details?: string;
    hint?: string;
    message?: string;
  },
): never {
  logDeductionError(operation, error);

  if (
    error.code === "PGRST205" ||
    error.code === "PGRST202" ||
    error.message?.includes("worker_deductions") ||
    error.message?.includes("save_worker_deduction")
  ) {
    throw new DeductionDatabaseSetupError();
  }

  if (
    error.code === "42501" ||
    error.message?.includes("row-level security") ||
    error.message?.includes("financially authorized")
  ) {
    if (
      error.message?.includes("Approved payroll already exists") ||
      error.message?.includes("approved payroll")
    ) {
      throw new DeductionApprovedPayrollError();
    }

    throw new DeductionPermissionError();
  }

  if (
    error.code === "23514" ||
    error.code === "22P02" ||
    error.message?.includes("required") ||
    error.message?.includes("greater than zero")
  ) {
    throw new DeductionValidationError(error.message);
  }

  throw new Error("Unable to complete deduction operation.");
}

function getPeriodBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month, 1));
  const end = `${endDate.getUTCFullYear()}-${String(
    endDate.getUTCMonth() + 1,
  ).padStart(2, "0")}-01`;

  return { end, start };
}

function sanitizeSearchTerm(search: string) {
  return search.replace(/[%,()]/g, " ").trim();
}

function emptySummary(): WorkerDeductionSummary {
  return {
    advance: 0,
    meals: 0,
    other: 0,
    total: 0,
    uniform: 0,
  };
}

export function summarizeDeductions(
  deductions: Pick<WorkerDeduction, "amount" | "status" | "type">[],
) {
  const summary = emptySummary();

  for (const deduction of deductions) {
    if (deduction.status !== "active") {
      continue;
    }

    const amount = Number(deduction.amount ?? 0);

    if (!Number.isFinite(amount)) {
      continue;
    }

    summary[deduction.type] += amount;
  }

  summary.total =
    summary.advance + summary.meals + summary.uniform + summary.other;

  return summary;
}

async function assertDeductionAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    logDeductionError("auth.getUser", userError);
    throw new DeductionAuthenticationError();
  }

  if (!user) {
    throw new DeductionAuthenticationError();
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    handleDeductionError("profiles.select", profileError);
  }

  if (
    !profile ||
    profile.is_active !== true ||
    !["owner", "admin", "accounts"].includes(String(profile.role))
  ) {
    throw new DeductionPermissionError();
  }
}

export async function searchDeductionWorkers(search: string) {
  const supabase = await createClient();
  await assertDeductionAccess(supabase);
  const searchTerm = sanitizeSearchTerm(search);
  let query = supabase
    .from("workers")
    .select(workerSelect)
    .eq("status", "active")
    .eq("worker_type", "permanent")
    .order("employee_no", { ascending: true })
    .limit(25);

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

  const { data, error } = await query;

  if (error) {
    handleDeductionError("workers.search", error);
  }

  return (data ?? []) as Pick<
    Worker,
    | "default_shift_rate"
    | "employee_no"
    | "full_name"
    | "id"
    | "nic"
    | "phone"
    | "status"
    | "worker_type"
  >[];
}

export async function getWorkerDeductionPeriodData({
  month,
  status,
  type,
  workerId,
  year,
}: {
  month: number;
  status?: WorkerDeductionStatus | "";
  type?: WorkerDeductionType | "";
  workerId: string;
  year: number;
}) {
  const supabase = await createClient();
  await assertDeductionAccess(supabase);
  const { start, end } = getPeriodBounds(year, month);

  const { data: worker, error: workerError } = await supabase
    .from("workers")
    .select(workerSelect)
    .eq("id", workerId)
    .eq("status", "active")
    .eq("worker_type", "permanent")
    .maybeSingle();

  if (workerError) {
    handleDeductionError("workers.selectOne", workerError);
  }

  let deductionsQuery = supabase
    .from("worker_deductions")
    .select(deductionSelect)
    .eq("worker_id", workerId)
    .gte("transaction_date", start)
    .lt("transaction_date", end)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (type) {
    deductionsQuery = deductionsQuery.eq("type", type);
  }

  if (status) {
    deductionsQuery = deductionsQuery.eq("status", status);
  }

  const { data: deductionsData, error: deductionsError } = await deductionsQuery;

  if (deductionsError) {
    handleDeductionError("worker_deductions.select", deductionsError);
  }

  const deductions = ((deductionsData ?? []) as unknown as WorkerDeduction[]).map(
    (deduction) => {
      const profile = Array.isArray(deduction.created_by_profile)
        ? deduction.created_by_profile[0]
        : deduction.created_by_profile;

      return {
        ...deduction,
        created_by_profile: profile ?? null,
      };
    },
  );

  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .select("id, status")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (runError) {
    handleDeductionError("payroll_runs.select", runError);
  }

  return {
    deductions,
    isPayrollApproved: run?.status === "approved",
    summary: summarizeDeductions(deductions),
    worker: worker as typeof worker | null,
  };
}

export async function getWorkerMonthlyDeductionSummary({
  month,
  workerId,
  year,
}: {
  month: number;
  workerId: string;
  year: number;
}) {
  const supabase = await createClient();
  const { start, end } = getPeriodBounds(year, month);

  const { data, error } = await supabase
    .from("worker_deductions")
    .select("type, amount, status")
    .eq("worker_id", workerId)
    .eq("status", "active")
    .gte("transaction_date", start)
    .lt("transaction_date", end);

  if (error) {
    handleDeductionError("worker_deductions.summary", error);
  }

  return summarizeDeductions((data ?? []) as WorkerDeduction[]);
}

export async function saveWorkerDeduction(input: WorkerDeductionSaveInput) {
  const supabase = await createClient();
  await assertDeductionAccess(supabase);

  const { data, error } = await supabase.rpc("save_worker_deduction", {
    p_amount: input.amount,
    p_deduction_id: input.id ?? null,
    p_note: input.note,
    p_transaction_date: input.transaction_date,
    p_type: input.type,
    p_worker_id: input.worker_id,
  });

  if (error) {
    handleDeductionError("save_worker_deduction", error);
  }

  return data as string;
}

export async function cancelWorkerDeduction(
  deductionId: string,
  cancellationReason: string,
) {
  const supabase = await createClient();
  await assertDeductionAccess(supabase);

  const { data, error } = await supabase.rpc("cancel_worker_deduction", {
    p_cancellation_reason: cancellationReason,
    p_deduction_id: deductionId,
  });

  if (error) {
    handleDeductionError("cancel_worker_deduction", error);
  }

  return data as string;
}
