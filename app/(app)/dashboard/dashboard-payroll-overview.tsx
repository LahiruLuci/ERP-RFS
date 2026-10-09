import Link from "next/link";

import { formatLkr } from "@/lib/format/currency";

type PayrollOverviewProps = {
  month: number;
  payroll: {
    exists: boolean;
    grossSalary: number;
    netSalary: number;
    runId: string | null;
    status: "draft" | "approved" | null;
    totalDeductions: number;
    totalShifts: number;
    unauthorized: boolean;
    workerCount: number;
  };
  year: number;
};

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function PayrollOverview({ payroll, month, year }: PayrollOverviewProps) {
  if (payroll.unauthorized) {
    return (
      <section className="app-surface rounded-lg border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-bold text-slate-500">
          {months[month - 1]} Payroll
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Your role does not have access to payroll data.
        </p>
      </section>
    );
  }

  const periodLabel = `${months[month - 1]} ${year}`;

  return (
    <section className="app-surface rounded-lg border-l-4 border-l-[var(--brand-accent)] p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
          {periodLabel} Payroll
        </h2>
        {payroll.exists ? (
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${
              payroll.status === "approved"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-yellow-200 bg-yellow-50 text-yellow-700"
            }`}
          >
            {payroll.status === "approved" ? "Approved" : "Draft"}
          </span>
        ) : null}
      </div>

      {!payroll.exists ? (
        <div className="mt-5">
          <p className="text-sm font-semibold text-[var(--text-secondary)]">
            Payroll has not been started for {periodLabel}.
          </p>
          <Link
            className="app-focus btn-primary mt-4 inline-flex min-h-10 items-center rounded-md px-5 text-sm font-bold"
            href={`/payroll?year=${year}&month=${month}`}
          >
            Open Payroll
          </Link>
        </div>
      ) : (
        <>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center justify-between rounded-md bg-[var(--surface-muted)] px-4 py-3">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Workers</dt>
                <dd className="mt-0.5 text-lg font-black text-[var(--text-primary)]">{payroll.workerCount}</dd>
              </div>
              <div className="text-right">
                <dt className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Total Shifts</dt>
                <dd className="mt-0.5 text-lg font-black text-[var(--text-primary)]">{payroll.totalShifts}</dd>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md px-4 py-3">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Gross Salary</dt>
                <dd className="mt-0.5 text-base font-bold tabular-nums text-[var(--text-primary)]">{formatLkr(payroll.grossSalary)}</dd>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md px-4 py-3">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Deductions</dt>
                <dd className="mt-0.5 text-base font-bold tabular-nums text-[var(--text-primary)]">{formatLkr(payroll.totalDeductions)}</dd>
              </div>
            </div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-md border border-[var(--border)] bg-white px-4 py-3">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Net Salary</dt>
                <dd className={`mt-0.5 text-xl font-black tabular-nums sm:text-2xl ${(payroll.netSalary ?? 0) < 0 ? "text-red-700" : "text-[var(--brand-primary)]"}`}>{formatLkr(payroll.netSalary)}</dd>
              </div>
              {payroll.status === "draft" && (
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Awaiting final approval</span>
              )}
            </div>
          </dl>
          <Link
            className="app-focus btn-primary mt-5 flex min-h-10 w-full items-center justify-center rounded-md px-4 text-sm font-bold transition sm:w-auto"
            href={`/payroll?year=${year}&month=${month}`}
          >
            Open Payroll
          </Link>
        </>
      )}
    </section>
  );
}
