import Link from "next/link";

import { formatLkr } from "@/lib/format/currency";
import {
  getClientCostReport,
  getClientsForReportSelect,
  getWorkpointsForReportSelect,
  ReportPermissionError,
} from "@/lib/reports/data";

type ClientCostProps = {
  searchParams?: Promise<{
    clientId?: string;
    month?: string;
    workpointId?: string;
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

function getPeriod(searchParams: Awaited<ClientCostProps["searchParams"]>) {
  const now = new Date();
  const year = readPeriod(searchParams?.year, now.getFullYear());
  const month = readPeriod(searchParams?.month, now.getMonth() + 1);

  return {
    month: month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: year >= 2000 && year <= 2100 ? year : now.getFullYear(),
  };
}

function formatRateList(rates: number[]) {
  if (rates.length === 0) {
    return formatLkr(0);
  }

  return rates.map((rate) => formatLkr(rate)).join(", ");
}

export default async function ClientCostReportPage({
  searchParams,
}: ClientCostProps) {
  const resolvedSearchParams = await searchParams;
  const { month, year } = getPeriod(resolvedSearchParams);
  const clientId = resolvedSearchParams?.clientId ?? "all";
  const workpointId = resolvedSearchParams?.workpointId ?? "all";

  let error: string | null = null;
  let reportData;
  let clientOptions: Awaited<ReturnType<typeof getClientsForReportSelect>> = [];
  let workpointOptions: Awaited<
    ReturnType<typeof getWorkpointsForReportSelect>
  > = [];
  let effectiveWorkpointId = workpointId;

  try {
    [clientOptions, workpointOptions] = await Promise.all([
      getClientsForReportSelect(),
      getWorkpointsForReportSelect({ clientId }),
    ]);

    if (
      effectiveWorkpointId !== "all" &&
      !workpointOptions.some((workpoint) => workpoint.id === effectiveWorkpointId)
    ) {
      effectiveWorkpointId = "all";
    }

    reportData = await getClientCostReport({
      clientId,
      month,
      workpointId: effectiveWorkpointId,
      year,
    });
  } catch (loadError) {
    error =
      loadError instanceof ReportPermissionError
        ? "You do not have permission to view payroll reports."
        : "Unable to load the report. Please try again.";
  }

  const runStatus = reportData?.run?.status;

  return (
    <div className="flex flex-col gap-4 pt-4 pb-12">
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <Link
          className="app-focus hover:text-[var(--text-primary)] hover:underline"
          href="/reports"
        >
          Reports
        </Link>
        <span>&rsaquo;</span>
        <span className="font-semibold text-[var(--text-primary)]">
          Client & Workpoint Cost
        </span>
      </div>

      <section className="app-surface mt-2 rounded-lg p-3 sm:p-4">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_11rem_9rem_auto]">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
              Client
            </span>
            <select
              className="field-control min-h-10 rounded-md px-3 text-sm transition"
              defaultValue={clientId}
              name="clientId"
            >
              <option value="all">All Clients</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
              Workpoint
            </span>
            <select
              className="field-control min-h-10 rounded-md px-3 text-sm transition"
              defaultValue={effectiveWorkpointId}
              name="workpointId"
            >
              <option value="all">All Workpoints</option>
              {workpointOptions.map((workpoint) => (
                <option key={workpoint.id} value={workpoint.id}>
                  {workpoint.name}
                </option>
              ))}
            </select>
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
      ) : reportData?.totals ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                Clients in Report
              </p>
              <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                {reportData.totals.clients}
              </p>
              {runStatus ? (
                <span
                  className={`mt-2 inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-bold ${
                    runStatus === "approved"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {runStatus === "approved" ? "Approved Payroll" : "Draft Payroll"}
                </span>
              ) : (
                <span className="mt-2 inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-700">
                  No records
                </span>
              )}
            </div>

            <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Workpoints Used
              </p>
              <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                {reportData.totals.workpoints}
              </p>
            </div>

            <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Unique Workers
              </p>
              <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                {reportData.totals.workers}
              </p>
            </div>

            <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Total Shifts
              </p>
              <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                {reportData.totals.shifts}
              </p>
            </div>

            <div className="app-surface flex flex-col gap-1 rounded-lg border-l-4 border-[var(--brand-accent)] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                Total Labour Cost
              </p>
              <p className="mt-1 text-2xl font-black text-[var(--brand-primary)]">
                {formatLkr(reportData.totals.cost)}
              </p>
            </div>
          </section>

          {reportData.clients.length === 0 ? (
            <section className="app-surface mt-2 rounded-lg p-8 text-center">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                No client work activity was found for this month.
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Try another month, year, client, or workpoint filter.
              </p>
            </section>
          ) : (
            <div className="mt-2 flex flex-col gap-5">
              {reportData.clients.map((client) => (
                <details
                  className="app-surface overflow-hidden rounded-lg"
                  key={client.id}
                >
                  <summary className="flex cursor-pointer select-none flex-col justify-between gap-4 p-5 transition hover:bg-[var(--surface-muted)] sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary-soft)]">
                        {client.code}
                      </p>
                      <h2 className="mt-1 break-words text-lg font-bold text-[var(--text-primary)]">
                        {client.name}
                      </h2>
                    </div>
                    <dl className="grid grid-cols-2 gap-4 text-sm sm:flex sm:flex-nowrap sm:gap-6">
                      <div className="flex flex-col sm:items-end">
                        <dt className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                          Workpoints
                        </dt>
                        <dd className="font-bold tabular-nums text-[var(--text-primary)]">
                          {client.workpoints.length}
                        </dd>
                      </div>
                      <div className="flex flex-col sm:items-end">
                        <dt className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                          Workers
                        </dt>
                        <dd className="font-bold tabular-nums text-[var(--text-primary)]">
                          {client.uniqueWorkers}
                        </dd>
                      </div>
                      <div className="flex flex-col sm:items-end">
                        <dt className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                          Shifts
                        </dt>
                        <dd className="font-bold tabular-nums text-[var(--text-primary)]">
                          {client.shifts}
                        </dd>
                      </div>
                      <div className="flex min-w-24 flex-col sm:items-end">
                        <dt className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                          Labour Cost
                        </dt>
                        <dd className="font-bold tabular-nums text-[var(--brand-primary)]">
                          {formatLkr(client.cost)}
                        </dd>
                      </div>
                    </dl>
                  </summary>

                  <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                    {client.workpoints.map((workpoint) => (
                      <details
                        className="overflow-hidden rounded-md border border-slate-200 bg-white"
                        key={workpoint.id}
                      >
                        <summary className="flex cursor-pointer select-none flex-col justify-between gap-4 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center">
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              {workpoint.code}
                            </p>
                            <h3 className="mt-1 break-words text-base font-bold text-[var(--text-primary)]">
                              {workpoint.name}
                            </h3>
                          </div>
                          <dl className="grid grid-cols-3 gap-4 text-sm">
                            <div className="flex flex-col sm:items-end">
                              <dt className="text-xs font-semibold uppercase text-slate-500">
                                Workers
                              </dt>
                              <dd className="font-bold tabular-nums text-slate-700">
                                {workpoint.uniqueWorkers}
                              </dd>
                            </div>
                            <div className="flex flex-col sm:items-end">
                              <dt className="text-xs font-semibold uppercase text-slate-500">
                                Shifts
                              </dt>
                              <dd className="font-bold tabular-nums text-slate-700">
                                {workpoint.shifts}
                              </dd>
                            </div>
                            <div className="flex min-w-24 flex-col sm:items-end">
                              <dt className="text-xs font-semibold uppercase text-slate-500">
                                Cost
                              </dt>
                              <dd className="font-bold tabular-nums text-[var(--text-primary)]">
                                {formatLkr(workpoint.cost)}
                              </dd>
                            </div>
                          </dl>
                        </summary>

                        <div className="border-t border-slate-200 bg-slate-50 p-4">
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[44rem] text-left text-sm">
                              <thead className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                                <tr>
                                  <th className="px-3 py-2">Worker No</th>
                                  <th className="px-3 py-2">Worker</th>
                                  <th className="px-3 py-2">Type</th>
                                  <th className="px-3 py-2 text-right">Shifts</th>
                                  <th className="px-3 py-2 text-right">
                                    Rate / Rates
                                  </th>
                                  <th className="px-3 py-2 text-right">
                                    Labour Cost
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {workpoint.workerContributions.map((worker) => (
                                  <tr
                                    className="transition hover:bg-slate-100/50"
                                    key={worker.workerId}
                                  >
                                    <td className="px-3 py-2.5 font-semibold text-slate-700">
                                      {worker.employeeNo}
                                    </td>
                                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                                      {worker.name}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      {worker.type === "temporary" ? (
                                        <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-orange-700">
                                          Temporary
                                        </span>
                                      ) : (
                                        <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-blue-700">
                                          Permanent
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">
                                      {worker.shifts}
                                    </td>
                                    <td className="max-w-48 px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">
                                      {formatRateList(worker.rates)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[var(--text-primary)]">
                                      {formatLkr(worker.cost)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
