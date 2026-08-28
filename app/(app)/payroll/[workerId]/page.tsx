import { notFound } from "next/navigation";

import { DeductionDatabaseSetupError, getWorkerDeductionPeriodData } from "@/lib/deductions/data";
import { formatLkr } from "@/lib/format/currency";
import { getPayrollEntryData } from "@/lib/payroll/data";
import { payrollRunStatusLabels } from "@/lib/payroll/types";

import { savePayrollRecordAction } from "../actions";
import { PayrollEntryForm } from "./payroll-entry-form";

type PayrollEntryPageProps = {
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

export default async function PayrollEntryPage({
  params,
  searchParams,
}: PayrollEntryPageProps) {
  const { workerId } = await params;
  const resolvedSearchParams = await searchParams;
  const now = new Date();
  const year = readPeriod(resolvedSearchParams?.year, now.getFullYear());
  const month = readPeriod(resolvedSearchParams?.month, now.getMonth() + 1);
  const safeYear = year >= 2000 && year <= 2100 ? year : now.getFullYear();
  const safeMonth = month >= 1 && month <= 12 ? month : now.getMonth() + 1;
  const data = await getPayrollEntryData({
    month: safeMonth,
    workerId,
    year: safeYear,
  });
  let deductionData;

  try {
    deductionData = await getWorkerDeductionPeriodData({
      month: safeMonth,
      workerId,
      year: safeYear,
    });
  } catch (error) {
    if (!(error instanceof DeductionDatabaseSetupError)) {
      throw error;
    }

    deductionData = {
      deductions: [],
      summary: { advance: 0, meals: 0, other: 0, total: 0, uniform: 0 },
    };
  }

  if (!data.worker) {
    notFound();
  }

  const runStatus = data.run?.status ?? "draft";
  const isApproved = runStatus === "approved";
  const action = savePayrollRecordAction.bind(
    null,
    safeYear,
    safeMonth,
    data.worker.id,
  );
  const cancelHref = `/payroll?year=${safeYear}&month=${safeMonth}`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <section className="app-surface overflow-hidden rounded-lg">
        <div className="flex flex-col gap-4 border-l-4 border-[var(--brand-accent)] p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="brand-kicker">
              {months[safeMonth - 1]} {safeYear} Payroll
            </p>
            <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              {data.worker.employee_no} - {data.worker.full_name}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Default worker shift rate: {formatLkr(data.worker.default_shift_rate)}
            </p>
          </div>

          <span
            className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-bold ${
              isApproved
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {payrollRunStatusLabels[runStatus]}
          </span>
        </div>
      </section>

      <PayrollEntryForm
        action={action}
        cancelHref={cancelHref}
        deductions={deductionData.deductions}
        deductionSummary={deductionData.summary}
        isApproved={isApproved}
        record={data.record}
        worker={data.worker}
        workplaces={data.workplaces}
      />
    </div>
  );
}

