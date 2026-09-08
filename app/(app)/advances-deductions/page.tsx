import Link from "next/link";

import {
  DeductionDatabaseSetupError,
  DeductionPermissionError,
  getWorkerDeductionPeriodData,
  searchDeductionWorkers,
} from "@/lib/deductions/data";
import {
  workerDeductionStatusLabels,
  workerDeductionStatuses,
  workerDeductionTypeLabels,
  workerDeductionTypes,
  type WorkerDeductionStatus,
  type WorkerDeductionType,
} from "@/lib/deductions/types";
import { formatLkr } from "@/lib/format/currency";
import { workerStatusLabels, type WorkerStatus } from "@/lib/workers/types";

import { cancelDeductionAction, saveDeductionAction } from "./actions";
import { DeductionTotals } from "./deduction-totals";
import { DeductionForm } from "./deduction-form";
import { PendingDeductions } from "./pending-deductions";

type AdvancesPageProps = {
  searchParams?: Promise<{
    edit?: string;
    month?: string;
    q?: string;
    status?: string;
    type?: string;
    workerId?: string;
    year?: string;
  }>;
};

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function readPeriod(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : fallback;
}

function isDeductionType(value: string): value is WorkerDeductionType {
  return workerDeductionTypes.includes(value as WorkerDeductionType);
}

function isDeductionStatus(value: string): value is WorkerDeductionStatus {
  return workerDeductionStatuses.includes(value as WorkerDeductionStatus);
}

function getPeriod(searchParams: Awaited<AdvancesPageProps["searchParams"]>) {
  const now = new Date();
  const year = readPeriod(searchParams?.year, now.getFullYear());
  const month = readPeriod(searchParams?.month, now.getMonth() + 1);

  return {
    month: month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: year >= 2000 && year <= 2100 ? year : now.getFullYear(),
  };
}

function getDefaultTransactionDate(year: number, month: number) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year === currentYear && month === currentMonth) {
    return `${year}-${String(month).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;
  }

  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function buildHref(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && String(value).trim()) {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();

  return queryString
    ? `/advances-deductions?${queryString}`
    : "/advances-deductions";
}

function TransactionTypeBadge({ type }: { type: WorkerDeductionType }) {
  const className = {
    advance: "border-amber-200 bg-amber-50 text-amber-800",
    meals: "border-blue-200 bg-blue-50 text-blue-800",
    other: "border-red-200 bg-red-50 text-red-800",
    uniform: "border-indigo-200 bg-indigo-50 text-indigo-800",
  }[type];

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}
    >
      {workerDeductionTypeLabels[type]}
    </span>
  );
}

function TransactionStatusBadge({ status }: { status: WorkerDeductionStatus }) {
  const className =
    status === "active"
      ? "border-green-200 bg-green-50 text-green-700"
      : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}
    >
      {workerDeductionStatusLabels[status]}
    </span>
  );
}

export default async function AdvancesDeductionsPage({
  searchParams,
}: AdvancesPageProps) {
  const resolvedSearchParams = await searchParams;
  const { month, year } = getPeriod(resolvedSearchParams);
  const search = resolvedSearchParams?.q?.trim() ?? "";
  const workerId = resolvedSearchParams?.workerId?.trim() ?? "";
  const type =
    resolvedSearchParams?.type && isDeductionType(resolvedSearchParams.type)
      ? resolvedSearchParams.type
      : "";
  const status =
    resolvedSearchParams?.status &&
      isDeductionStatus(resolvedSearchParams.status)
      ? resolvedSearchParams.status
      : "";
  const editId = resolvedSearchParams?.edit?.trim() ?? "";
  let workerResults: Awaited<ReturnType<typeof searchDeductionWorkers>> = [];
  let periodData: Awaited<ReturnType<typeof getWorkerDeductionPeriodData>> | null =
    null;
  let error: string | null = null;

  try {
    if (search || !workerId) {
      workerResults = await searchDeductionWorkers(search);
    }

    if (workerId) {
      periodData = await getWorkerDeductionPeriodData({
        month,
        status,
        type,
        workerId,
        year,
      });
    }
  } catch (loadError) {
    error =
      loadError instanceof DeductionDatabaseSetupError
        ? "Advance and deduction database setup is not complete. Run the worker deductions SQL migration in Supabase, then refresh this page."
        : loadError instanceof DeductionPermissionError
          ? "You do not have permission to view advances and deductions."
          : "Unable to load advances and deductions. Please try again.";
  }

  const selectedWorker = periodData?.worker;
  const editTransaction =
    periodData?.deductions.find(
      (deduction) =>
        deduction.id === editId &&
        deduction.status === "active" &&
        !deduction.payroll_record_id,
    ) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <section className="app-surface overflow-hidden rounded-lg">
        <div className="flex flex-col gap-3 border-l-4 border-[var(--brand-accent)] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="brand-kicker">Payroll</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              Advances & Deductions
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Record worker advances and deductions as they happen, then carry
              monthly totals into payroll automatically.
            </p>
          </div>
        </div>
      </section>

      <section className="app-surface rounded-lg p-3 sm:p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_11rem_9rem_12rem_11rem_auto]">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
              Search Worker
            </span>
            <input
              className="field-control min-h-10 rounded-md px-3 text-sm transition"
              defaultValue={search}
              name="q"
              placeholder="Employee no, name, NIC, ETF no or phone"
              type="search"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
              Month
            </span>
            <select
              className="field-control min-h-10 rounded-md px-3 text-sm transition"
              defaultValue={month}
              name="month"
            >
              {months.map((monthName, index) => (
                <option key={monthName} value={index + 1}>
                  {monthName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
              Year
            </span>
            <input
              className="field-control min-h-10 rounded-md px-3 text-sm transition"
              defaultValue={year}
              max="2100"
              min="2000"
              name="year"
              type="number"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
              Type
            </span>
            <select
              className="field-control min-h-10 rounded-md px-3 text-sm transition"
              defaultValue={type}
              name="type"
            >
              <option value="">All Types</option>
              {workerDeductionTypes.map((deductionType) => (
                <option key={deductionType} value={deductionType}>
                  {workerDeductionTypeLabels[deductionType]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
              Status
            </span>
            <select
              className="field-control min-h-10 rounded-md px-3 text-sm transition"
              defaultValue={status}
              name="status"
            >
              <option value="">All</option>
              {workerDeductionStatuses.map((deductionStatus) => (
                <option key={deductionStatus} value={deductionStatus}>
                  {workerDeductionStatusLabels[deductionStatus]}
                </option>
              ))}
            </select>
          </label>

          {workerId ? <input name="workerId" type="hidden" value={workerId} /> : null}

          <div className="flex items-end">
            <button
              className="app-focus btn-primary min-h-10 w-full rounded-md px-4 text-sm font-bold transition"
              type="submit"
            >
              Apply
            </button>
          </div>
        </form>
      </section>

      {error ? (
        <section
          className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700"
          role="alert"
        >
          {error}
        </section>
      ) : null}

      {!workerId && !error ? (
        <section className="app-surface rounded-lg p-5">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            Select Worker
          </h2>
          {workerResults.length === 0 && search ? (
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              No workers found. Try another employee number, name, NIC, ETF
              number or phone.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {workerResults.map((worker) => (
                <Link
                  className="app-focus app-muted-surface rounded-lg p-4 transition hover:border-[var(--brand-primary-soft)]"
                  href={buildHref({
                    month,
                    q: search,
                    workerId: worker.id,
                    year,
                  })}
                  key={worker.id}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary-soft)]">
                        {worker.employee_no}
                      </p>
                      <h3 className="mt-1 font-bold text-[var(--text-primary)]">
                        {worker.full_name}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {worker.phone || "No phone recorded"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {workerStatusLabels[worker.status as WorkerStatus]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {selectedWorker && periodData ? (
        <>
          <section className="app-surface rounded-lg p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="brand-kicker">
                  {months[month - 1]} {year}
                </p>
                <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                  {selectedWorker.employee_no} - {selectedWorker.full_name}
                </h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Status: {workerStatusLabels[selectedWorker.status as WorkerStatus]}
                  {selectedWorker.phone ? ` • ${selectedWorker.phone}` : ""}
                </p>
                {periodData.isPayrollApproved ? (
                  <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                    This payroll month is approved. Transactions for this
                    period are locked.
                  </p>
                ) : null}
              </div>
              <Link
                className="app-focus btn-secondary flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-bold transition"
                href={buildHref({ month, q: search, year })}
              >
                Change Worker
              </Link>
            </div>
          </section>

          <DeductionTotals
            month={month}
            serverSummary={periodData.summary}
            workerId={selectedWorker.id}
            year={year}
          />

          {!periodData.isPayrollApproved ? (
            <>
              <DeductionForm
                action={saveDeductionAction}
                defaultDate={getDefaultTransactionDate(year, month)}
                editTransaction={editTransaction}
                month={month}
                worker={selectedWorker}
                year={year}
              />
              <PendingDeductions month={month} year={year} workerId={selectedWorker.id} />
            </>
          ) : null}

          <section className="app-surface overflow-hidden rounded-lg mt-4">
            <div className="border-b border-[var(--border)] p-5">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Transaction History
              </h2>
            </div>

            {periodData.deductions.length === 0 ? (
              <div className="p-8 text-center">
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  No advances or deductions recorded for this period.
                </h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Add a transaction to start building the monthly deduction
                  record.
                </p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-auto lg:block">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead className="table-head-brand text-left text-xs font-bold uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3">Note</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Created By</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {periodData.deductions.map((deduction) => {
                        const canChange =
                          !periodData.isPayrollApproved &&
                          deduction.status === "active" &&
                          !deduction.payroll_record_id;

                        return (
                          <tr className="table-row-brand" key={deduction.id}>
                            <td className="whitespace-nowrap px-4 py-4 font-semibold">
                              {formatDate(deduction.transaction_date)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-4">
                              <TransactionTypeBadge type={deduction.type} />
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-right font-bold tabular-nums">
                              {formatLkr(deduction.amount)}
                            </td>
                            <td className="max-w-72 px-4 py-4 text-[var(--text-secondary)]">
                              {deduction.note || "-"}
                              {deduction.cancellation_reason ? (
                                <span className="block text-xs">
                                  Cancelled: {deduction.cancellation_reason}
                                </span>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-4 py-4">
                              <TransactionStatusBadge status={deduction.status} />
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-[var(--text-secondary)]">
                              {deduction.created_by_profile?.full_name ||
                                "Internal user"}
                            </td>
                            <td className="px-4 py-4 text-right">
                              {canChange ? (
                                <div className="flex justify-end gap-2">
                                  <Link
                                    className="app-focus btn-secondary rounded-md px-3 py-2 text-xs font-bold transition"
                                    href={buildHref({
                                      edit: deduction.id,
                                      month,
                                      q: search,
                                      status,
                                      type,
                                      workerId,
                                      year,
                                    })}
                                  >
                                    Edit
                                  </Link>
                                  <form
                                    action={cancelDeductionAction}
                                    className="flex gap-2"
                                  >
                                    <input
                                      name="deduction_id"
                                      type="hidden"
                                      value={deduction.id}
                                    />
                                    <input
                                      name="worker_id"
                                      type="hidden"
                                      value={workerId}
                                    />
                                    <input name="month" type="hidden" value={month} />
                                    <input name="year" type="hidden" value={year} />
                                    <input
                                      className="field-control h-9 w-44 rounded-md px-2 text-xs"
                                      name="cancellation_reason"
                                      placeholder="Cancellation reason"
                                      required
                                    />
                                    <button
                                      className="app-focus btn-secondary rounded-md px-3 py-2 text-xs font-bold transition"
                                      type="submit"
                                    >
                                      Cancel
                                    </button>
                                  </form>
                                </div>
                              ) : (
                                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                                  Locked
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 p-4 lg:hidden">
                  {periodData.deductions.map((deduction) => (
                    <article
                      className="app-muted-surface rounded-lg p-4"
                      key={deduction.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-[var(--text-primary)]">
                            {formatDate(deduction.transaction_date)}
                          </p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {deduction.note || "No note"}
                          </p>
                        </div>
                        <TransactionStatusBadge status={deduction.status} />
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <TransactionTypeBadge type={deduction.type} />
                        <p className="font-black tabular-nums text-[var(--text-primary)]">
                          {formatLkr(deduction.amount)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
