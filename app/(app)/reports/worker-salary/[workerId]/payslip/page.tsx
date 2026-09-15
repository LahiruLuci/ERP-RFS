import Link from "next/link";

import {
  getWorkerPayslipReport,
  ReportPermissionError,
} from "@/lib/reports/data";

import { PayslipPreview } from "./payslip-preview";

type WorkerPayslipPageProps = {
  params: Promise<{
    workerId: string;
  }>;
  searchParams?: Promise<{
    month?: string;
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

function getPeriod(searchParams: Awaited<WorkerPayslipPageProps["searchParams"]>) {
  const now = new Date();
  const year = readPeriod(searchParams?.year, now.getFullYear());
  const month = readPeriod(searchParams?.month, now.getMonth() + 1);

  return {
    month: month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: year >= 2000 && year <= 2100 ? year : now.getFullYear(),
  };
}

export default async function WorkerPayslipPage({
  params,
  searchParams,
}: WorkerPayslipPageProps) {
  const { workerId } = await params;
  const resolvedSearchParams = await searchParams;
  const { month, year } = getPeriod(resolvedSearchParams);

  let data: Awaited<ReturnType<typeof getWorkerPayslipReport>> | undefined;
  let error: string | null = null;

  try {
    data = await getWorkerPayslipReport({ month, workerId, year });
  } catch (loadError) {
    error =
      loadError instanceof ReportPermissionError
        ? "You do not have permission to view payroll reports."
        : "Unable to load the payslip. Please try again.";
  }

  const periodLabel = `${months[month - 1]} ${year}`;
  const backHref = `/reports/worker-salary?workerId=${workerId}&month=${month}&year=${year}`;

  return (
    <div className="worker-payslip-page flex flex-col gap-4 pt-4 pb-10">
      <div className="print:hidden">
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <Link
            className="app-focus hover:text-[var(--text-primary)] hover:underline"
            href="/reports"
          >
            Reports
          </Link>
          <span>&rsaquo;</span>
          <Link
            className="app-focus hover:text-[var(--text-primary)] hover:underline"
            href={backHref}
          >
            Worker Salary Report
          </Link>
          <span>&rsaquo;</span>
          <span className="font-semibold text-[var(--text-primary)]">
            Payslip
          </span>
        </div>

        <section className="app-surface mt-4 flex flex-col gap-4 rounded-lg border-l-4 border-[var(--brand-accent)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="brand-kicker">Payslip Preview</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              {periodLabel}
            </h1>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Preview the payroll document before printing or saving as PDF.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Link
              className="app-focus btn-secondary inline-flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-bold transition"
              href={backHref}
            >
              Back
            </Link>
          </div>
        </section>
      </div>

      {error ? (
        <section
          className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700 print:hidden"
          role="alert"
        >
          {error}
        </section>
      ) : data?.issue === "worker-not-found" ? (
        <section className="app-surface rounded-lg p-8 text-center print:hidden">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            Worker not found
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            The selected worker could not be found.
          </p>
        </section>
      ) : data?.issue === "payroll-record-not-found" ? (
        <section className="app-surface rounded-lg p-8 text-center print:hidden">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            No payroll record found
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            No payroll record was found for this worker for {periodLabel}.
          </p>
        </section>
      ) : data?.record && data.worker && data.run && data.totals ? (
        <PayslipPreview
          consistencyWarnings={data.consistencyWarnings}
          data={{
            record: data.record,
            run: data.run,
            totals: data.totals,
            worker: data.worker,
          }}
        />
      ) : null}
    </div>
  );
}
