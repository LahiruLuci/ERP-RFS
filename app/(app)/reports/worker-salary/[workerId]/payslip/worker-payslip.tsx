import Image from "next/image";

import { formatLkr } from "@/lib/format/currency";

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

export type PayslipCustomization = {
  authorizedByName: string;
  companyName: string;
  documentTitle: string;
  employerSignatureName: string;
  footerNote: string;
  hideZeroDeductions: boolean;
  payslipNote: string;
};

export type WorkerPayslipDocumentData = {
  record: {
    advance: number;
    epf: number;
    grossSalary: number;
    id: string;
    meals: number;
    netSalary: number;
    otherDeduction: number;
    otherNote: string | null;
    totalDeductions: number;
    uniform: number;
    workEntries: {
      amount: number;
      id: string;
      rate: number;
      shifts: number;
      workplaceName: string;
    }[];
  };
  run: {
    month: number;
    status: string;
    year: number;
  };
  totals: {
    totalShifts: number;
  };
  worker: {
    employee_no: string | null;
    etf_no: string | null;
    full_name: string | null;
    nic: string | null;
    status: string | null;
    worker_type: string | null;
  };
};

type WorkerPayslipProps = {
  customization: PayslipCustomization;
  consistencyWarnings: string[];
  data: WorkerPayslipDocumentData;
  isEdited: boolean;
};

function formatLabel(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ") : "N/A";
}

export function WorkerPayslip({
  customization,
  consistencyWarnings,
  data,
  isEdited,
}: WorkerPayslipProps) {
  const { record, run, totals, worker } = data;
  const isDraft = run.status !== "approved";
  const periodLabel = `${months[run.month - 1]} ${run.year}`;
  const workerTypeLabel =
    worker.worker_type === "temporary" ? "Temporary Worker" : "Permanent Worker";
  const deductionRows = [
    ["Advance", record.advance],
    ["EPF", record.epf],
    ["Meals", record.meals],
    ["Uniform", record.uniform],
    ["Other Deductions", record.otherDeduction],
  ].filter(([, amount]) => !customization.hideZeroDeductions || Number(amount) !== 0);

  return (
    <article className="payslip-document relative mx-auto w-full max-w-[52rem] overflow-hidden rounded-lg border border-slate-300 bg-white text-slate-950 shadow-sm print:max-w-none print:rounded-none print:border-slate-400 print:shadow-none">
      {isDraft ? (
        <div className="absolute right-4 top-4 rounded border border-slate-300 px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.18em] text-slate-500">
          Draft
        </div>
      ) : null}
      {isEdited ? (
        <div className="absolute right-4 top-11 rounded border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.14em] text-amber-800 print:top-10">
          Edited Preview
        </div>
      ) : null}

      <header className="border-b-4 border-[var(--brand-accent)] px-5 py-4 print:px-4 print:py-3">
        <div className="flex items-center gap-3 pr-32">
          <Image
            alt="Royal Force Security Services"
            className="size-14 shrink-0 object-contain print:size-12"
            height={56}
            priority
            src="/royal-force-logo.png"
            width={56}
          />
          <div className="min-w-0">
            <p className="text-lg font-black uppercase tracking-wide text-[var(--brand-primary)] print:text-base">
              {customization.companyName}
            </p>
            <h1 className="mt-0.5 text-xl font-black uppercase tracking-wide text-slate-950 print:text-lg">
              {isDraft ? `Draft ${customization.documentTitle}` : customization.documentTitle}
            </h1>
            <p className="mt-0.5 text-xs font-semibold text-slate-600">
              Payroll Month: {periodLabel}
            </p>
          </div>
        </div>
      </header>

      <div className="px-5 py-4 print:px-4 print:py-3">
        {consistencyWarnings.length > 0 ? (
          <section className="payslip-avoid-break mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs font-semibold text-amber-900 print:border-amber-400">
            <p>Review required before issuing this payslip.</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {consistencyWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="border-b border-slate-300 pb-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            Employee Information
          </h2>
          <dl className="mt-2 grid gap-x-8 gap-y-1 text-xs sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
              <dt className="text-slate-500">Employee No</dt>
              <dd className="font-bold text-slate-950">{worker.employee_no}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
              <dt className="text-slate-500">Worker Type</dt>
              <dd className="font-bold text-slate-950">{workerTypeLabel}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 py-1 sm:col-span-2">
              <dt className="text-slate-500">Employee Name</dt>
              <dd className="text-right font-bold text-slate-950">
                {worker.full_name}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
              <dt className="text-slate-500">NIC</dt>
              <dd className="font-bold text-slate-950">{worker.nic ?? "N/A"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
              <dt className="text-slate-500">ETF No</dt>
              <dd className="font-bold text-slate-950">{worker.etf_no ?? "N/A"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
              <dt className="text-slate-500">Worker Status</dt>
              <dd className="font-bold capitalize text-slate-950">
                {formatLabel(worker.status)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
              <dt className="text-slate-500">Payroll Status</dt>
              <dd className="font-bold capitalize text-slate-950">
                {formatLabel(run.status)}
              </dd>
            </div>
          </dl>
        </section>

        {customization.payslipNote.trim() ? (
          <section className="payslip-avoid-break mt-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
            <p className="font-bold text-slate-700">Payslip Note</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-slate-600">
              {customization.payslipNote}
            </p>
          </section>
        ) : null}

        <section className="payslip-avoid-break mt-4">
          <h2 className="border-b border-slate-300 pb-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            Earnings
          </h2>
          <div className="mt-2 overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-600">
                <tr>
                  <th className="px-2.5 py-1.5">Workpoint</th>
                  <th className="px-2.5 py-1.5 text-right">Shifts</th>
                  <th className="px-2.5 py-1.5 text-right">Rate</th>
                  <th className="px-2.5 py-1.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {record.workEntries.length > 0 ? (
                  record.workEntries.map((entry) => (
                    <tr className="payslip-table-row" key={entry.id}>
                      <td className="px-2.5 py-1.5 font-semibold text-slate-900">
                        {entry.workplaceName}
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">
                        {entry.shifts}
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">
                        {formatLkr(entry.rate)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                        {formatLkr(entry.amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      className="px-2.5 py-3 text-center text-xs text-slate-500"
                      colSpan={4}
                    >
                      No work entries were found for this payroll record.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-black">
                <tr>
                  <td className="px-2.5 py-1.5 uppercase">Gross Salary</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">
                    {totals.totalShifts}
                  </td>
                  <td className="px-2.5 py-1.5" />
                  <td className="px-2.5 py-1.5 text-right tabular-nums">
                    {formatLkr(record.grossSalary)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="payslip-avoid-break mt-4">
          <h2 className="border-b border-slate-300 pb-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            Deductions
          </h2>
          <dl className="mt-2 grid gap-1 text-xs">
            {deductionRows.map(([label, amount]) => (
              <div
                className="flex justify-between gap-4 border-b border-slate-100 py-1"
                key={label}
              >
                <dt className="font-semibold text-slate-600">{label}</dt>
                <dd className="font-semibold tabular-nums text-slate-950">
                  {formatLkr(amount)}
                </dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between gap-4 border-t-2 border-slate-300 py-1.5">
              <dt className="font-black uppercase text-slate-950">
                Total Deductions
              </dt>
              <dd className="font-black tabular-nums text-slate-950">
                {formatLkr(record.totalDeductions)}
              </dd>
            </div>
          </dl>

          {record.otherNote ? (
            <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
              <p className="font-bold text-slate-700">Other Deduction Note</p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-slate-600">
                {record.otherNote}
              </p>
            </div>
          ) : null}
        </section>

        <section className="payslip-avoid-break mt-4 rounded-md border-2 border-[var(--brand-primary)] bg-slate-50 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
              Net Salary
            </p>
            <p className="text-2xl font-black tabular-nums text-[var(--brand-primary)] print:text-xl">
              {formatLkr(record.netSalary)}
            </p>
          </div>
        </section>

        <footer className="payslip-avoid-break mt-5 grid gap-4 text-xs sm:grid-cols-2">
          <div>
            <div className="border-b border-slate-400 pb-5" />
            <p className="mt-2 font-semibold text-slate-600">
              Employer Signature
            </p>
            {customization.employerSignatureName.trim() ? (
              <p className="mt-0.5 font-bold text-slate-900">
                {customization.employerSignatureName}
              </p>
            ) : null}
          </div>
          <div>
            <div className="border-b border-slate-400 pb-5" />
            <p className="mt-2 font-semibold text-slate-600">Authorized By</p>
            {customization.authorizedByName.trim() ? (
              <p className="mt-0.5 font-bold text-slate-900">
                {customization.authorizedByName}
              </p>
            ) : null}
          </div>
          {customization.footerNote.trim() ? (
            <p className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 sm:col-span-2">
              {customization.footerNote}
            </p>
          ) : null}
          <p className="text-xs text-slate-500 sm:col-span-2">
            Payroll Period: {periodLabel} | Employee No: {worker.employee_no}
          </p>
        </footer>
      </div>
    </article>
  );
}
