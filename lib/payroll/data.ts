import "server-only";

import type {
  WorkerDeduction,
  WorkerDeductionSummary,
} from "@/lib/deductions/types";
import { createClient } from "@/lib/supabase/server";
import type { WorkerStatus } from "@/lib/workers/types";

import type {
  PayrollEmploymentEnd,
  PayrollRecord,
  PayrollRow,
  PayrollRun,
  PayrollSaveInput,
  PayrollWorker,
  WorkplaceOption,
} from "./types";

const payrollWorkerSelect = `
  id,
  employee_no,
  worker_type,
  full_name,
  default_shift_rate,
  joined_date,
  status
`;

const payrollRecordSelect = `
  id,
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
  created_at,
  payroll_work_entries (
    id,
    payroll_record_id,
    workplace_id,
    workplace_name,
    shifts,
    shift_rate,
    line_gross
  )
`;

export class PayrollAuthenticationError extends Error {
  constructor() {
    super("Current user is not authenticated.");
    this.name = "PayrollAuthenticationError";
  }
}

export class PayrollPermissionError extends Error {
  constructor() {
    super("Current user is not allowed to manage payroll.");
    this.name = "PayrollPermissionError";
  }
}

export class PayrollValidationError extends Error {
  constructor(message = "Payroll values are invalid.") {
    super(message);
    this.name = "PayrollValidationError";
  }
}

export class PayrollApprovedError extends Error {
  constructor() {
    super("Approved payroll cannot be edited.");
    this.name = "PayrollApprovedError";
  }
}

function sanitizeSearchTerm(search: string) {
  return search.replace(/[%,()]/g, " ").trim();
}

function getEmptyDeductionSummary(): WorkerDeductionSummary {
  return {
    advance: 0,
    meals: 0,
    other: 0,
    total: 0,
    uniform: 0,
  };
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getPayrollPeriod(year: number, month: number) {
  const periodStartDate = new Date(Date.UTC(year, month - 1, 1));
  const periodEndExclusiveDate = new Date(Date.UTC(year, month, 1));
  const periodEndDate = new Date(periodEndExclusiveDate);
  periodEndDate.setUTCDate(periodEndDate.getUTCDate() - 1);
  const processingDate = new Date(Date.UTC(year, month, 10));

  return {
    periodEnd: formatIsoDate(periodEndDate),
    periodEndExclusive: formatIsoDate(periodEndExclusiveDate),
    periodStart: formatIsoDate(periodStartDate),
    processingDate: formatIsoDate(processingDate),
  };
}

function getPeriodBounds(year: number, month: number) {
  const period = getPayrollPeriod(year, month);

  return { end: period.periodEndExclusive, start: period.periodStart };
}

function isMissingDeductionSetup(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    error.message?.includes("worker_deductions")
  );
}
async function getDeductionSummariesForWorkers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workerIds: string[],
  year: number,
  month: number,
) {
  const summaries = new Map<string, WorkerDeductionSummary>();

  if (workerIds.length === 0) {
    return summaries;
  }

  const { start, end } = getPeriodBounds(year, month);
  const { data, error } = await supabase
    .from("worker_deductions")
    .select("worker_id, type, amount, status")
    .in("worker_id", workerIds)
    .eq("status", "active")
    .gte("transaction_date", start)
    .lt("transaction_date", end);

  if (error) {
    if (isMissingDeductionSetup(error)) {
      for (const workerId of workerIds) {
        summaries.set(workerId, getEmptyDeductionSummary());
      }

      return summaries;
    }

    handlePayrollError("worker_deductions.summary", error);
  }

  for (const workerId of workerIds) {
    summaries.set(workerId, getEmptyDeductionSummary());
  }

  for (const deduction of (data ?? []) as WorkerDeduction[]) {
    const current = summaries.get(deduction.worker_id) ?? getEmptyDeductionSummary();
    const amount = Number(deduction.amount ?? 0);

    if (Number.isFinite(amount)) {
      current[deduction.type] += amount;
      current.total += amount;
    }

    summaries.set(deduction.worker_id, current);
  }

  return summaries;
}

type EmploymentEndEvent = {
  effective_date: string;
  new_status: Extract<WorkerStatus, "resigned" | "terminated">;
  worker_id: string;
};

function isEmploymentEndStatus(
  status: WorkerStatus,
): status is Extract<WorkerStatus, "resigned" | "terminated"> {
  return status === "resigned" || status === "terminated";
}

async function getEmploymentEndEvents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workerIds: string[],
  periodEnd: string,
) {
  const latestEndEventByWorkerId = new Map<string, EmploymentEndEvent>();

  if (workerIds.length === 0) {
    return latestEndEventByWorkerId;
  }

  const { data, error } = await supabase
    .from("worker_status_history")
    .select("worker_id, new_status, effective_date")
    .in("worker_id", workerIds)
    .in("new_status", ["resigned", "terminated"])
    .lte("effective_date", periodEnd)
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    handlePayrollError("worker_status_history.select", error);
  }

  for (const event of (data ?? []) as EmploymentEndEvent[]) {
    if (!latestEndEventByWorkerId.has(event.worker_id)) {
      latestEndEventByWorkerId.set(event.worker_id, event);
    }
  }

  return latestEndEventByWorkerId;
}

async function getTemporaryWorkerIdsWithPayrollRecords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  year: number,
  month: number,
) {
  const workerIds = new Set<string>();
  const { data, error } = await supabase
    .from("payroll_records")
    .select("worker_id, payroll_runs!inner(year, month)")
    .eq("payroll_runs.year", year)
    .eq("payroll_runs.month", month);

  if (error) {
    handlePayrollError("payroll_records.selectTemporaryIds", error);
  }

  for (const record of (data ?? []) as { worker_id: string }[]) {
    workerIds.add(record.worker_id);
  }

  return workerIds;
}

function getWorkerPayrollEmploymentEnd(
  worker: PayrollWorker,
  latestEndEvent: EmploymentEndEvent | undefined,
  periodStart: string,
  periodEnd: string,
): PayrollEmploymentEnd | null {
  if (!isEmploymentEndStatus(worker.status) || !latestEndEvent) {
    return null;
  }

  if (
    latestEndEvent.effective_date >= periodStart &&
    latestEndEvent.effective_date <= periodEnd
  ) {
    return {
      effective_date: latestEndEvent.effective_date,
      status: latestEndEvent.new_status,
    };
  }

  return null;
}

export async function getPayrollEligibleWorkers({
  month,
  search,
  supabase,
  year,
}: {
  month: number;
  search: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  year: number;
}) {
  const searchTerm = sanitizeSearchTerm(search);
  const period = getPayrollPeriod(year, month);
  const temporaryWorkerIdsWithRecords =
    await getTemporaryWorkerIdsWithPayrollRecords(supabase, year, month);
  let workerQuery = supabase
    .from("workers")
    .select(payrollWorkerSelect)
    .order("employee_no", { ascending: true })
    .limit(100);

  if (!searchTerm) {
    workerQuery = workerQuery.or(
      [
        `and(worker_type.eq.permanent,joined_date.lte.${period.periodEnd})`,
        temporaryWorkerIdsWithRecords.size > 0
          ? `id.in.(${Array.from(temporaryWorkerIdsWithRecords).join(",")})`
          : "id.is.null",
      ].join(","),
    );
  } else {
    const pattern = `%${searchTerm}%`;
    workerQuery = workerQuery.or(
      [
        `full_name.ilike.${pattern}`,
        `employee_no.ilike.${pattern}`,
        `nic.ilike.${pattern}`,
        `etf_no.ilike.${pattern}`,
        `phone.ilike.${pattern}`,
      ].join(","),
    );
  }

  const { data, error } = await workerQuery;

  if (error) {
    handlePayrollError("workers.select", error);
  }

  const workers = (data ?? []) as PayrollWorker[];
  const latestEndEvents = await getEmploymentEndEvents(
    supabase,
    workers.map((worker) => worker.id),
    period.periodEnd,
  );

  return workers
    .filter((worker) => {
      const latestEndEvent = latestEndEvents.get(worker.id);

      if (worker.worker_type === "temporary") {
        return Boolean(searchTerm) || temporaryWorkerIdsWithRecords.has(worker.id);
      }

      if (worker.joined_date === null || worker.joined_date > period.periodEnd) {
        return false;
      }

      if (!isEmploymentEndStatus(worker.status) || !latestEndEvent) {
        return true;
      }

      return latestEndEvent.effective_date >= period.periodStart;
    })
    .map((worker) => ({
      employmentEnd: getWorkerPayrollEmploymentEnd(
        worker,
        latestEndEvents.get(worker.id),
        period.periodStart,
        period.periodEnd,
      ),
      worker,
    }));
}

async function getPayrollRecordWorkers({
  month,
  records,
  search,
  supabase,
  year,
}: {
  month: number;
  records: PayrollRecord[];
  search: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  year: number;
}) {
  const recordWorkerIds = records.map((record) => record.worker_id);

  if (recordWorkerIds.length === 0) {
    return [];
  }

  const searchTerm = sanitizeSearchTerm(search);
  const period = getPayrollPeriod(year, month);
  let query = supabase
    .from("workers")
    .select(payrollWorkerSelect)
    .in("id", recordWorkerIds)
    .order("employee_no", { ascending: true });

  if (searchTerm) {
    const pattern = `%${searchTerm}%`;
    query = query.or(
      [
        `full_name.ilike.${pattern}`,
        `employee_no.ilike.${pattern}`,
        `nic.ilike.${pattern}`,
        `etf_no.ilike.${pattern}`,
      ].join(","),
    );
  }

  const { data, error } = await query;

  if (error) {
    handlePayrollError("workers.selectRecordWorkers", error);
  }

  const workers = (data ?? []) as PayrollWorker[];
  const latestEndEvents = await getEmploymentEndEvents(
    supabase,
    workers.map((worker) => worker.id),
    period.periodEnd,
  );

  return workers.map((worker) => ({
    employmentEnd: getWorkerPayrollEmploymentEnd(
      worker,
      latestEndEvents.get(worker.id),
      period.periodStart,
      period.periodEnd,
    ),
    worker,
  }));
}

function logPayrollError(
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

  console.error("[payroll] Supabase operation failed", {
    operation,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

function handlePayrollError(
  operation: string,
  error: {
    code?: string;
    details?: string;
    hint?: string;
    message?: string;
  },
): never {
  logPayrollError(operation, error);

  if (
    error.code === "42501" ||
    error.message?.includes("row-level security") ||
    error.message?.includes("payroll-authorized") ||
    error.message?.includes("approve payroll")
  ) {
    if (error.message?.includes("Approved payroll cannot be edited")) {
      throw new PayrollApprovedError();
    }

    throw new PayrollPermissionError();
  }

  if (
    error.code === "23514" ||
    error.message?.includes("deductions exceed gross") ||
    error.message?.includes("Other deduction note")
  ) {
    throw new PayrollValidationError(error.message);
  }

  throw new Error("Unable to complete payroll operation.");
}

async function assertPayrollAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    logPayrollError("auth.getUser", userError);
    throw new PayrollAuthenticationError();
  }

  if (!user) {
    throw new PayrollAuthenticationError();
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    handlePayrollError("profiles.select", profileError);
  }

  if (
    !profile ||
    profile.is_active !== true ||
    !["owner", "admin", "accounts"].includes(String(profile.role))
  ) {
    throw new PayrollPermissionError();
  }

  return {
    canApprove: ["owner", "admin"].includes(String(profile.role)),
    role: String(profile.role),
    user,
  };
}

export async function getPayrollPeriodData({
  month,
  search = "",
  year,
}: {
  month: number;
  search?: string;
  year: number;
}) {
  const supabase = await createClient();
  const access = await assertPayrollAccess(supabase);

  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .select("id, year, month, status")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (runError) {
    handlePayrollError("payroll_runs.select", runError);
  }

  let records: PayrollRecord[] = [];

  if (run?.id) {
    const { data: recordsData, error: recordsError } = await supabase
      .from("payroll_records")
      .select(payrollRecordSelect)
      .eq("payroll_run_id", run.id);

    if (recordsError) {
      handlePayrollError("payroll_records.select", recordsError);
    }

    records = (recordsData ?? []) as PayrollRecord[];
  }

  const recordByWorkerId = new Map(
    records.map((record) => [record.worker_id, record]),
  );
  const payrollWorkers =
    run?.status === "approved"
      ? await getPayrollRecordWorkers({
          month,
          records,
          search,
          supabase,
          year,
        })
      : await getPayrollEligibleWorkers({
          month,
          search,
          supabase,
          year,
        });
  const deductionSummaryByWorkerId = await getDeductionSummariesForWorkers(
    supabase,
    payrollWorkers.map(({ worker }) => worker.id),
    year,
    month,
  );

  return {
    canApprove: access.canApprove,
    rows: payrollWorkers.map(({ employmentEnd, worker }) => ({
      deductionSummary:
        deductionSummaryByWorkerId.get(worker.id) ?? getEmptyDeductionSummary(),
      employmentEnd,
      record: recordByWorkerId.get(worker.id) ?? null,
      worker,
    })) satisfies PayrollRow[],
    run: (run as PayrollRun | null) ?? null,
  };
}

export async function getPayrollEntryData({
  month,
  workerId,
  year,
}: {
  month: number;
  workerId: string;
  year: number;
}) {
  const supabase = await createClient();
  const access = await assertPayrollAccess(supabase);

  const { data: worker, error: workerError } = await supabase
    .from("workers")
    .select(payrollWorkerSelect)
    .eq("id", workerId)
    .maybeSingle();

  if (workerError) {
    handlePayrollError("workers.selectOne", workerError);
  }

  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .select("id, year, month, status")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (runError) {
    handlePayrollError("payroll_runs.selectOne", runError);
  }

  let record: PayrollRecord | null = null;

  if (run?.id) {
    const { data: recordData, error: recordError } = await supabase
      .from("payroll_records")
      .select(payrollRecordSelect)
      .eq("payroll_run_id", run.id)
      .eq("worker_id", workerId)
      .maybeSingle();

    if (recordError) {
      handlePayrollError("payroll_records.selectOne", recordError);
    }

    record = (recordData as PayrollRecord | null) ?? null;
  }

  const period = getPayrollPeriod(year, month);
  let payrollWorker = (worker as PayrollWorker | null) ?? null;
  let employmentEnd: PayrollEmploymentEnd | null = null;

  if (payrollWorker) {
    const latestEndEvent = (
      await getEmploymentEndEvents(supabase, [payrollWorker.id], period.periodEnd)
    ).get(payrollWorker.id);
    const hasTemporaryPayrollRecord = Boolean(
      record && payrollWorker.worker_type === "temporary",
    );
    const isEligibleForDraft =
      payrollWorker.worker_type === "temporary"
        ? hasTemporaryPayrollRecord
        : payrollWorker.joined_date !== null &&
          payrollWorker.joined_date <= period.periodEnd &&
          (!isEmploymentEndStatus(payrollWorker.status) ||
            !latestEndEvent ||
            latestEndEvent.effective_date >= period.periodStart);

    if (run?.status === "approved") {
      if (!record) {
        payrollWorker = null;
      } else {
        employmentEnd = getWorkerPayrollEmploymentEnd(
          payrollWorker,
          latestEndEvent,
          period.periodStart,
          period.periodEnd,
        );
      }
    } else if (!isEligibleForDraft) {
      payrollWorker = null;
    } else {
      employmentEnd = getWorkerPayrollEmploymentEnd(
        payrollWorker,
        latestEndEvent,
        period.periodStart,
        period.periodEnd,
      );
    }
  }

  const { data: workplaces, error: workplacesError } = await supabase
    .from("workplaces")
    .select("id, name, status")
    .order("name", { ascending: true });

  if (workplacesError) {
    handlePayrollError("workplaces.select", workplacesError);
  }

  return {
    canApprove: access.canApprove,
    employmentEnd,
    record,
    run: (run as PayrollRun | null) ?? null,
    worker: payrollWorker,
    workplaces: (workplaces ?? []) as WorkplaceOption[],
  };
}

export async function savePayrollRecord(input: PayrollSaveInput) {
  const supabase = await createClient();
  await assertPayrollAccess(supabase);

  const { data, error } = await supabase.rpc("save_payroll_record", {
    p_advance: input.advance,
    p_advance_override: input.advance_override,
    p_epf: input.epf,
    p_meals: input.meals,
    p_meals_override: input.meals_override,
    p_month: input.month,
    p_other_deduction: input.other_deduction,
    p_other_deduction_override: input.other_deduction_override,
    p_other_note: input.other_note,
    p_uniform: input.uniform,
    p_uniform_override: input.uniform_override,
    p_work_entries: input.work_entries,
    p_worker_id: input.worker_id,
    p_year: input.year,
  });

  if (error) {
    handlePayrollError("save_payroll_record", error);
  }

  return data as string;
}

export async function approvePayrollRun(year: number, month: number) {
  const supabase = await createClient();
  await assertPayrollAccess(supabase);

  const { data, error } = await supabase.rpc("approve_payroll_run", {
    p_month: month,
    p_year: year,
  });

  if (error) {
    handlePayrollError("approve_payroll_run", error);
  }

  return data as string;
}



