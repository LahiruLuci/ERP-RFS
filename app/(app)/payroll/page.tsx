import Link from "next/link";

import { formatLkr } from "@/lib/format/currency";
import {
  calculateNetSalary,
  calculateTotalDeductions,
} from "@/lib/payroll/calculations";
import {
  getPayrollPeriod,
  getPayrollPeriodData,
  PayrollPermissionError,
} from "@/lib/payroll/data";
import { payrollRunStatusLabels, type PayrollRecord } from "@/lib/payroll/types";
import { workerStatusLabels } from "@/lib/workers/types";

import { WorkerStatusBadge } from "../workers/worker-status-badge";

import { approvePayrollRunAction } from "./actions";
import { ApprovalForm } from "./approval-form";

type PayrollPageProps = {
  searchParams?: Promise<{
    month?: string;
    q?: string;
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

function getPeriod(searchParams: Awaited<PayrollPageProps["searchParams"]>) {
  const now = new Date();
  const year = readPeriod(searchParams?.year, now.getFullYear());
  const month = readPeriod(searchParams?.month, now.getMonth() + 1);

  return {
    month: month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: year >= 2000 && year <= 2100 ? year : now.getFullYear(),
  };
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function PayrollStatusBadge({ status }: { status: "approved" | "draft" }) {
  const className =
    status === "approved"
      ? "border-green-200 bg-green-50 text-green-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}
    >
      {payrollRunStatusLabels[status]}
    </span>
  );
}

function formatWorkplaces(record: {
  payroll_work_entries?: { workplace_name: string; shifts: number | string }[];
} | null) {
  const entries = record?.payroll_work_entries ?? [];

  if (entries.length === 0) {
    return "Not entered";
  }

  return entries
    .slice(0, 2)
    .map((entry) => `${entry.workplace_name} (${entry.shifts})`)
    .join(", ");
}

function getEffectiveDeductionValues({
  deductionSummary,
  isApproved,
  record,
}: {
  deductionSummary: {
    advance: number;
    meals: number;
    other: number;
    uniform: number;
  };
  isApproved: boolean;
  record: PayrollRecord | null;
}) {
  return {
    advance:
      isApproved || record?.advance_override
        ? Number(record?.advance ?? 0)
        : deductionSummary.advance,
    meals:
      isApproved || record?.meals_override
        ? Number(record?.meals ?? 0)
        : deductionSummary.meals,
    other:
      isApproved || record?.other_deduction_override
        ? Number(record?.other_deduction ?? 0)
        : deductionSummary.other,
    uniform:
      isApproved || record?.uniform_override
        ? Number(record?.uniform ?? 0)
        : deductionSummary.uniform,
  };
}

export default async function PayrollPage({ searchParams }: PayrollPageProps) {
  const resolvedSearchParams = await searchParams;
  const { month, year } = getPeriod(resolvedSearchParams);
  const payrollPeriod = getPayrollPeriod(year, month);
  const search = resolvedSearchParams?.q?.trim() ?? "";
  let data: Awaited<ReturnType<typeof getPayrollPeriodData>> | null = null;
  let error: string | null = null;

  try {
    data = await getPayrollPeriodData({ month, search, year });
  } catch (loadError) {
    error =
      loadError instanceof PayrollPermissionError
        ? "You do not have permission to view payroll."
        : "Unable to load payroll. Please try again.";
  }

  const runStatus = data?.run?.status ?? "draft";
  const isApproved = runStatus === "approved";
  const rows = data?.rows ?? [];
  const approveAction = approvePayrollRunAction.bind(null, year, month);

  return (
    <div className="flex flex-col gap-4 pt-4">
      <section className="app-surface overflow-hidden rounded-lg">
        <div className="flex flex-col gap-4 border-l-4 border-[var(--brand-accent)] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="brand-kicker">Salary & Payroll</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              Payroll
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Prepare monthly worker salaries from shifts, shift rates, and
              deductions.
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2">
                <dt className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                  Payroll Period
                </dt>
                <dd className="mt-1 font-semibold text-[var(--text-primary)]">
                  {formatDisplayDate(payrollPeriod.periodStart)} -{" "}
                  {formatDisplayDate(payrollPeriod.periodEnd)}
                </dd>
              </div>
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2">
                <dt className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                  Scheduled Processing Date
                </dt>
                <dd className="mt-1 font-semibold text-[var(--text-primary)]">
                  {formatDisplayDate(payrollPeriod.processingDate)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <PayrollStatusBadge status={runStatus} />
            {data?.run && data.canApprove && !isApproved ? (
              <ApprovalForm action={approveAction} month={month} year={year} />
            ) : null}
          </div>
        </div>
      </section>

      <section className="app-surface rounded-lg p-3 sm:p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_11rem_9rem_auto]">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
              Search Worker
            </span>
            <input
              className="field-control min-h-10 rounded-md px-3 text-sm transition"
              defaultValue={search}
              name="q"
              placeholder="Search by employee no, name, NIC or ETF no"
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

          <div className="flex items-end">
            <button
              className="app-focus btn-primary min-h-10 w-full rounded-md px-4 text-sm font-bold transition"
              type="submit"
            >
              Load Payroll
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
      ) : rows.length === 0 ? (
        <section className="app-surface rounded-lg p-8 text-center">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            No workers found
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Try another employee number, name, NIC, or ETF number.
          </p>
        </section>
      ) : (
        <>
          <section className="app-surface hidden overflow-hidden rounded-lg lg:block">
            <div className="max-h-[calc(100dvh-19rem)] min-h-[22rem] overflow-auto">
              <table className="min-w-[82rem] divide-y divide-zinc-200 text-sm">
                <thead className="table-head-brand sticky top-0 z-10 text-left text-xs font-bold uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Worker ID</th>
                    <th className="px-4 py-3">Worker Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Workplace / Workplaces</th>
                    <th className="px-4 py-3 text-right">Shifts</th>
                    <th className="px-4 py-3 text-right">Shift Rate</th>
                    <th className="px-4 py-3 text-right">Gross Salary</th>
                    <th className="px-4 py-3 text-right">Advance</th>
                    <th className="px-4 py-3 text-right">EPF</th>
                    <th className="px-4 py-3 text-right">Meals</th>
                    <th className="px-4 py-3 text-right">Uniform</th>
                    <th className="px-4 py-3 text-right">Other</th>
                    <th className="px-4 py-3 text-right">Net Salary</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {rows.map(({ deductionSummary, employmentEnd, record, worker }) => {
                    const effectiveDeductions = getEffectiveDeductionValues({
                      deductionSummary,
                      isApproved,
                      record,
                    });
                    const totalShifts = (record?.payroll_work_entries ?? [])
                      .reduce((total, entry) => total + Number(entry.shifts ?? 0), 0);
                    const firstRate =
                      record?.payroll_work_entries?.[0]?.shift_rate ??
                      worker.default_shift_rate ??
                      0;
                    const grossSalary = Number(record?.gross_salary ?? 0);
                    const epf = Number(record?.epf ?? 0);
                    const totalDeductions = calculateTotalDeductions({
                      advance: effectiveDeductions.advance,
                      epf,
                      meals: effectiveDeductions.meals,
                      otherDeduction: effectiveDeductions.other,
                      uniform: effectiveDeductions.uniform,
                    });
                    const netSalary =
                      record && grossSalary >= totalDeductions
                        ? calculateNetSalary(grossSalary, totalDeductions)
                        : record?.net_salary ?? 0;

                    return (
                      <tr className="table-row-brand" key={worker.id}>
                        <td className="whitespace-nowrap px-4 py-4 font-bold text-[var(--text-primary)]">
                          {worker.employee_no}
                        </td>
                        <td className="px-4 py-4 font-semibold text-[var(--text-primary)]">
                          {worker.full_name}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col items-start gap-1.5">
                            <WorkerStatusBadge status={employmentEnd?.status ?? worker.status} />
                            {employmentEnd ? (
                              <span className="text-xs font-medium text-[var(--text-secondary)]">
                                {formatDisplayDate(employmentEnd.effective_date)}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="max-w-64 px-4 py-4 text-[var(--text-secondary)]">
                          {formatWorkplaces(record)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                          {totalShifts}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                          {formatLkr(firstRate)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums">
                          {formatLkr(record?.gross_salary)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                          {formatLkr(effectiveDeductions.advance)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                          {formatLkr(record?.epf)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                          {formatLkr(effectiveDeductions.meals)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                          {formatLkr(effectiveDeductions.uniform)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                          {formatLkr(effectiveDeductions.other)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-bold tabular-nums text-[var(--brand-primary)]">
                          {formatLkr(netSalary)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          <Link
                            className="app-focus btn-primary inline-flex min-h-10 items-center justify-center rounded-md px-3 text-xs font-bold transition"
                            href={`/payroll/${worker.id}?year=${year}&month=${month}`}
                          >
                            {isApproved ? "View" : "Edit Salary"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:hidden">
            {rows.map(({ deductionSummary, employmentEnd, record, worker }) => {
              const effectiveDeductions = getEffectiveDeductionValues({
                deductionSummary,
                isApproved,
                record,
              });
              const grossSalary = Number(record?.gross_salary ?? 0);
              const epf = Number(record?.epf ?? 0);
              const totalDeductions = calculateTotalDeductions({
                advance: effectiveDeductions.advance,
                epf,
                meals: effectiveDeductions.meals,
                otherDeduction: effectiveDeductions.other,
                uniform: effectiveDeductions.uniform,
              });
              const netSalary =
                record && grossSalary >= totalDeductions
                  ? calculateNetSalary(grossSalary, totalDeductions)
                  : record?.net_salary ?? 0;

              return (
                <article className="app-surface rounded-lg p-5" key={worker.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary-soft)]">
                        {worker.employee_no}
                      </p>
                      <h2 className="mt-1 break-words text-lg font-bold text-[var(--text-primary)]">
                        {worker.full_name}
                      </h2>
                    </div>
                    <WorkerStatusBadge status={employmentEnd?.status ?? worker.status} />
                  </div>
                  {employmentEnd ? (
                    <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">
                      {workerStatusLabels[employmentEnd.status]} on{" "}
                      {formatDisplayDate(employmentEnd.effective_date)}
                    </p>
                  ) : null}

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-[var(--text-secondary)]">Gross</dt>
                      <dd className="font-semibold tabular-nums">
                        {formatLkr(record?.gross_salary)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--text-secondary)]">Deductions</dt>
                      <dd className="font-semibold tabular-nums">
                        {formatLkr(totalDeductions)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--text-secondary)]">Net</dt>
                      <dd className="font-bold tabular-nums text-[var(--brand-primary)]">
                        {formatLkr(netSalary)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--text-secondary)]">Workplaces</dt>
                      <dd className="font-semibold">{formatWorkplaces(record)}</dd>
                    </div>
                  </dl>

                  <Link
                    className="app-focus btn-primary mt-5 flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-bold transition"
                    href={`/payroll/${worker.id}?year=${year}&month=${month}`}
                  >
                    {isApproved ? "View Payroll" : "Edit Salary"}
                  </Link>
                </article>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}


