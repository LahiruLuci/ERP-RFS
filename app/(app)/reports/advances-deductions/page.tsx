import Link from "next/link";

import {
  workerDeductionStatusLabels,
  workerDeductionTypeLabels,
  workerDeductionTypes,
  type WorkerDeductionType,
} from "@/lib/deductions/types";
import { formatLkr } from "@/lib/format/currency";
import {
  getAdvancesDeductionsReport,
  ReportPermissionError,
} from "@/lib/reports/data";

type AdvancesDeductionsReportProps = {
  searchParams?: Promise<{
    month?: string;
    q?: string;
    status?: string;
    type?: string;
    year?: string;
  }>;
};

type StatusFilter = "active" | "cancelled" | "all";

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

const statusOptions = [
  { label: "Active Only", value: "active" },
  { label: "Cancelled Only", value: "cancelled" },
  { label: "All", value: "all" },
] as const;

function readPeriod(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : fallback;
}

function getPeriod(
  searchParams: Awaited<AdvancesDeductionsReportProps["searchParams"]>,
) {
  const now = new Date();
  const year = readPeriod(searchParams?.year, now.getFullYear());
  const month = readPeriod(searchParams?.month, now.getMonth() + 1);

  return {
    month: month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: year >= 2000 && year <= 2100 ? year : now.getFullYear(),
  };
}

function isDeductionType(value: string): value is WorkerDeductionType {
  return workerDeductionTypes.includes(value as WorkerDeductionType);
}

function isStatusFilter(value: string): value is StatusFilter {
  return value === "active" || value === "cancelled" || value === "all";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
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

function TransactionStatusBadge({ status }: { status: "active" | "cancelled" }) {
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

function WorkerTypeBadge({ type }: { type: string }) {
  return type === "temporary" ? (
    <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-orange-700">
      Temporary
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-blue-700">
      Permanent
    </span>
  );
}

export default async function AdvancesDeductionsReportPage({
  searchParams,
}: AdvancesDeductionsReportProps) {
  const resolvedSearchParams = await searchParams;
  const { month, year } = getPeriod(resolvedSearchParams);
  const search = resolvedSearchParams?.q?.trim() ?? "";
  const type =
    resolvedSearchParams?.type && isDeductionType(resolvedSearchParams.type)
      ? resolvedSearchParams.type
      : "all";
  const status =
    resolvedSearchParams?.status && isStatusFilter(resolvedSearchParams.status)
      ? resolvedSearchParams.status
      : "active";

  let reportData: Awaited<ReturnType<typeof getAdvancesDeductionsReport>> | null =
    null;
  let error: string | null = null;

  try {
    reportData = await getAdvancesDeductionsReport({
      month,
      search,
      status,
      type,
      year,
    });
  } catch (loadError) {
    error =
      loadError instanceof ReportPermissionError
        ? "You do not have permission to view payroll reports."
        : "Unable to load the report. Please try again.";
  }

  const totals = reportData?.totals;
  const transactions = reportData?.transactions ?? [];
  const workerSummaries = reportData?.workerSummaries ?? [];

  return (
    <div className="flex flex-col gap-4 pb-12">
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <Link
          className="app-focus hover:text-[var(--text-primary)] hover:underline"
          href="/reports"
        >
          Reports
        </Link>
        <span>&rsaquo;</span>
        <span className="font-semibold text-[var(--text-primary)]">
          Advances & Deductions
        </span>
      </div>

      <section className="app-surface mt-2 rounded-lg p-3 sm:p-4">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_11rem_9rem_13rem_12rem_auto]">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
              Search Worker
            </span>
            <input
              className="field-control min-h-10 rounded-md px-3 text-sm transition"
              defaultValue={search}
              name="q"
              placeholder="Employee no, name, NIC or ETF no"
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
              Transaction Type
            </span>
            <select
              className="field-control min-h-10 rounded-md px-3 text-sm transition"
              defaultValue={type}
              name="type"
            >
              <option value="all">All Types</option>
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
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end md:col-span-2 xl:col-span-1">
            <button
              className="app-focus btn-primary min-h-10 w-full rounded-md px-4 text-sm font-bold transition"
              type="submit"
            >
              Generate
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
      ) : totals ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                Total Transactions
              </p>
              <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                {totals.transactions}
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">
                {totals.workers} workers
              </p>
            </div>

            <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Total Advance
              </p>
              <p className="mt-1 text-xl font-black text-[var(--text-primary)]">
                {formatLkr(totals.advance)}
              </p>
            </div>

            <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Total Meals
              </p>
              <p className="mt-1 text-xl font-black text-[var(--text-primary)]">
                {formatLkr(totals.meals)}
              </p>
            </div>

            <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Total Uniform
              </p>
              <p className="mt-1 text-xl font-black text-[var(--text-primary)]">
                {formatLkr(totals.uniform)}
              </p>
            </div>

            <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Total Other
              </p>
              <p className="mt-1 text-xl font-black text-[var(--text-primary)]">
                {formatLkr(totals.other)}
              </p>
            </div>

            <div className="app-surface flex flex-col gap-1 rounded-lg border-l-4 border-[var(--brand-accent)] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                Active Total
              </p>
              <p className="mt-1 text-xl font-black text-[var(--brand-primary)]">
                {formatLkr(totals.total)}
              </p>
              {status !== "active" && totals.cancelledAmount > 0 ? (
                <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">
                  Cancelled: {formatLkr(totals.cancelledAmount)}
                </p>
              ) : null}
            </div>
          </section>

          {transactions.length === 0 ? (
            <section className="app-surface mt-2 rounded-lg p-8 text-center">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                No advances or deductions were found for this period.
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Try another month, status, transaction type, or worker search.
              </p>
            </section>
          ) : (
            <>
              <section className="app-surface mt-2 overflow-hidden rounded-lg">
                <div className="border-b border-[var(--border)] p-5">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    Worker Summary
                  </h2>
                </div>

                <div className="hidden overflow-auto lg:block">
                  <table className="min-w-[64rem] divide-y divide-zinc-200 text-sm">
                    <thead className="table-head-brand text-left text-xs font-bold uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3">Worker No</th>
                        <th className="px-4 py-3">Worker</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Advance</th>
                        <th className="px-4 py-3 text-right">Meals</th>
                        <th className="px-4 py-3 text-right">Uniform</th>
                        <th className="px-4 py-3 text-right">Other</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {workerSummaries.map((worker) => (
                        <tr className="table-row-brand" key={worker.id}>
                          <td className="whitespace-nowrap px-4 py-4 font-bold text-[var(--text-primary)]">
                            {worker.employeeNo}
                          </td>
                          <td className="px-4 py-4">
                            <Link
                              className="app-focus font-semibold text-[var(--text-primary)] hover:underline"
                              href={`/workers/${worker.id}`}
                            >
                              {worker.name}
                            </Link>
                            <p className="mt-1 text-xs capitalize text-[var(--text-secondary)]">
                              {worker.status}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <WorkerTypeBadge type={worker.type} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                            {formatLkr(worker.totals.advance)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                            {formatLkr(worker.totals.meals)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                            {formatLkr(worker.totals.uniform)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                            {formatLkr(worker.totals.other)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right font-bold tabular-nums text-[var(--brand-primary)]">
                            {formatLkr(worker.totals.total)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                            {worker.transactionCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 p-4 lg:hidden">
                  {workerSummaries.map((worker) => (
                    <article
                      className="app-muted-surface rounded-lg p-4"
                      key={worker.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary-soft)]">
                            {worker.employeeNo}
                          </p>
                          <Link
                            className="app-focus mt-1 block font-bold text-[var(--text-primary)] hover:underline"
                            href={`/workers/${worker.id}`}
                          >
                            {worker.name}
                          </Link>
                          <p className="mt-1 text-xs capitalize text-[var(--text-secondary)]">
                            {worker.status}
                          </p>
                        </div>
                        <WorkerTypeBadge type={worker.type} />
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                            Advance
                          </dt>
                          <dd className="font-bold tabular-nums">
                            {formatLkr(worker.totals.advance)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                            Meals
                          </dt>
                          <dd className="font-bold tabular-nums">
                            {formatLkr(worker.totals.meals)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                            Uniform
                          </dt>
                          <dd className="font-bold tabular-nums">
                            {formatLkr(worker.totals.uniform)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                            Other
                          </dt>
                          <dd className="font-bold tabular-nums">
                            {formatLkr(worker.totals.other)}
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-sm">
                        <span className="font-semibold text-[var(--text-secondary)]">
                          Total
                        </span>
                        <span className="font-black tabular-nums text-[var(--brand-primary)]">
                          {formatLkr(worker.totals.total)}
                        </span>
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="app-surface overflow-hidden rounded-lg">
                <div className="border-b border-[var(--border)] p-5">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    Transaction Details
                  </h2>
                </div>

                <div className="hidden overflow-auto lg:block">
                  <table className="min-w-[76rem] divide-y divide-zinc-200 text-sm">
                    <thead className="table-head-brand text-left text-xs font-bold uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Worker</th>
                        <th className="px-4 py-3">Worker No</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3">Note / Reason</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Included</th>
                        <th className="px-4 py-3">Created By</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {transactions.map((transaction) => (
                        <tr className="table-row-brand" key={transaction.id}>
                          <td className="whitespace-nowrap px-4 py-4 font-semibold">
                            {formatDate(transaction.transactionDate)}
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-[var(--text-primary)]">
                              {transaction.worker.name}
                            </p>
                            <WorkerTypeBadge type={transaction.worker.type} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 font-bold text-[var(--text-primary)]">
                            {transaction.worker.employeeNo}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            <TransactionTypeBadge type={transaction.type} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right font-bold tabular-nums">
                            {formatLkr(transaction.amount)}
                          </td>
                          <td className="max-w-80 px-4 py-4 text-[var(--text-secondary)]">
                            <p className="break-words">
                              {transaction.note || "-"}
                            </p>
                            {transaction.cancellationReason ? (
                              <p className="mt-1 break-words text-xs">
                                Cancelled: {transaction.cancellationReason}
                              </p>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            <TransactionStatusBadge
                              status={transaction.status}
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-xs font-semibold text-[var(--text-secondary)]">
                            {transaction.status === "active"
                              ? transaction.isPayrollLinked
                                ? "Linked to payroll"
                                : "Available for payroll"
                              : "Excluded"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-[var(--text-secondary)]">
                            {transaction.createdBy}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right">
                            <Link
                              className="app-focus btn-secondary inline-flex min-h-8 items-center justify-center rounded-md px-3 text-xs font-bold transition"
                              href={`/workers/${transaction.worker.id}`}
                            >
                              View Worker
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 p-4 lg:hidden">
                  {transactions.map((transaction) => (
                    <article
                      className="app-muted-surface rounded-lg p-4"
                      key={transaction.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-[var(--text-primary)]">
                            {formatDate(transaction.transactionDate)}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                            {transaction.worker.name}
                          </p>
                          <p className="mt-1 text-xs text-[var(--text-secondary)]">
                            {transaction.worker.employeeNo}
                          </p>
                        </div>
                        <TransactionStatusBadge status={transaction.status} />
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <TransactionTypeBadge type={transaction.type} />
                        <p className="font-black tabular-nums text-[var(--text-primary)]">
                          {formatLkr(transaction.amount)}
                        </p>
                      </div>

                      {transaction.note || transaction.cancellationReason ? (
                        <div className="mt-3 text-sm text-[var(--text-secondary)]">
                          {transaction.note ? (
                            <p className="break-words">{transaction.note}</p>
                          ) : null}
                          {transaction.cancellationReason ? (
                            <p className="mt-1 break-words text-xs">
                              Cancelled: {transaction.cancellationReason}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
