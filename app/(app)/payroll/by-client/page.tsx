import Link from "next/link";

import type { ClientWorkpointWorkerSummary } from "@/lib/clients/types";
import { formatLkr } from "@/lib/format/currency";
import { getPayrollByClientData } from "@/lib/clients/data";
import { getPayrollPeriod } from "@/lib/payroll/data";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type PayrollByClientPageProps = {
  searchParams?: Promise<{ month?: string; q?: string; year?: string }>;
};

function readPeriod(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : fallback;
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export default async function PayrollByClientPage({ searchParams }: PayrollByClientPageProps) {
  const resolvedSearchParams = await searchParams;
  const now = new Date();
  const year = readPeriod(resolvedSearchParams?.year, now.getFullYear());
  const month = readPeriod(resolvedSearchParams?.month, now.getMonth() + 1);
  const safeYear = year >= 2000 && year <= 2100 ? year : now.getFullYear();
  const safeMonth = month >= 1 && month <= 12 ? month : now.getMonth() + 1;
  const search = resolvedSearchParams?.q?.trim() ?? "";
  const payrollPeriod = getPayrollPeriod(safeYear, safeMonth);

  let data: Awaited<ReturnType<typeof getPayrollByClientData>> | null = null;
  let loadError: string | null = null;

  try {
    data = await getPayrollByClientData({ month: safeMonth, search, year: safeYear });
  } catch (caught) {
    loadError = caught instanceof Error ? caught.message : "Unable to load client payroll data.";
  }

  return (
    <div className="flex flex-col gap-5 pt-4">
      <section className="app-surface overflow-hidden rounded-lg">
        <div className="flex flex-col gap-4 border-l-4 border-[var(--brand-accent)] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="brand-kicker">Payroll By Client</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">Client Work Entry</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Select a client and workpoint to enter monthly worker shifts. Final salary remains one payroll record per worker.
            </p>
            <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
              Payroll Period: {formatDisplayDate(payrollPeriod.periodStart)} - {formatDisplayDate(payrollPeriod.periodEnd)}
            </p>
          </div>
          <Link className="app-focus btn-secondary flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-bold transition" href={`/payroll?year=${safeYear}&month=${safeMonth}`}>
            Final Payroll Summary
          </Link>
        </div>
      </section>

      {loadError ? (
        <section className="app-surface rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700" role="alert">
          {loadError}
        </section>
      ) : (
        <>
          <section className="app-surface rounded-lg p-3 sm:p-4">
            <form className="grid gap-3 md:grid-cols-[1fr_11rem_9rem_auto]">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">Search Client</span>
                <input className="field-control min-h-10 rounded-md px-3 text-sm transition" defaultValue={search} name="q" placeholder="Search by client name, code or contact" type="search" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">Month</span>
                <select className="field-control min-h-10 rounded-md px-3 text-sm transition" defaultValue={safeMonth} name="month">
                  {months.map((monthName, index) => <option key={monthName} value={index + 1}>{monthName}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">Year</span>
                <input className="field-control min-h-10 rounded-md px-3 text-sm transition" defaultValue={safeYear} max="2100" min="2000" name="year" type="number" />
              </label>
              <div className="flex items-end">
                <button className="app-focus btn-primary min-h-10 w-full rounded-md px-4 text-sm font-bold transition" type="submit">Load</button>
              </div>
            </form>
          </section>

          {!data || data.clients.length === 0 ? (
            <section className="app-surface rounded-lg p-8 text-center">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">No clients found</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">Try another client name, code, or contact person.</p>
            </section>
          ) : (
            <div className="flex flex-col gap-4">
              {data.clients.map((client) => {
                const summary = data.summaries.get(client.id);
                const safeSummary = summary ?? {
                  contribution: 0,
                  entriesCount: 0,
                  shifts: 0,
                  workersCount: 0,
                  workpointsUsed: 0,
                };
                const workpoints = data.workpointsByClient.get(client.id) ?? [];

                return (
                  <details className="app-surface overflow-hidden rounded-lg" key={client.id}>
                    <summary className="flex cursor-pointer select-none flex-col justify-between gap-4 p-5 transition hover:bg-[var(--surface-muted)] sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <p className="brand-kicker">{client.client_code}</p>
                        <h2 className="mt-1 break-words text-xl font-bold text-[var(--text-primary)]">{client.name}</h2>
                        {client.contact_person ? (
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">Contact: {client.contact_person}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:flex sm:flex-nowrap sm:gap-4">
                          <div className="flex flex-col sm:items-end">
                            <dt className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Configured Workpoints</dt>
                            <dd className="font-bold tabular-nums text-[var(--text-primary)]">{client.workpointCount}</dd>
                          </div>
                          <div className="flex flex-col sm:items-end">
                            <dt className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Workpoints Used</dt>
                            <dd className="font-bold tabular-nums text-[var(--text-primary)]">{safeSummary.workpointsUsed}</dd>
                          </div>
                          <div className="flex flex-col sm:items-end">
                            <dt className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Workers</dt>
                            <dd className="font-bold tabular-nums text-[var(--text-primary)]">{safeSummary.workersCount}</dd>
                          </div>
                          <div className="flex flex-col sm:items-end">
                            <dt className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Shifts</dt>
                            <dd className="font-bold tabular-nums text-[var(--text-primary)]">{safeSummary.shifts}</dd>
                          </div>
                          <div className="flex min-w-24 flex-col sm:items-end">
                            <dt className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Labour Contribution</dt>
                            <dd className="font-bold tabular-nums text-[var(--brand-primary)]">{formatLkr(safeSummary.contribution)}</dd>
                          </div>
                        </dl>
                        <Link className="app-focus text-xs font-semibold text-[var(--brand-primary)] hover:underline" href={`/clients/${client.id}?year=${safeYear}&month=${safeMonth}`}>
                          View Client
                        </Link>
                      </div>
                    </summary>

                    <div className="border-t border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Workpoint Breakdown</h3>
                      {workpoints.length === 0 ? (
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">No workpoints configured for this client.</p>
                      ) : (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {workpoints.map((wp) => (
                            <div className="app-surface flex flex-col rounded-md border border-slate-200 bg-white p-4" key={wp.id}>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{wp.code}</p>
                                  <h4 className="mt-1 break-words text-base font-bold text-[var(--text-primary)]">{wp.name}</h4>
                                </div>
                                {wp.status === "inactive" ? (
                                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
                                    Inactive
                                  </span>
                                ) : null}
                              </div>
                              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <dt className="text-slate-500">Workers</dt>
                                  <dd className="font-bold">{wp.workersCount}</dd>
                                </div>
                                <div>
                                  <dt className="text-slate-500">Shifts</dt>
                                  <dd className="font-bold tabular-nums">{wp.shifts}</dd>
                                </div>
                              </dl>
                              <p className="mt-2 flex items-center justify-between text-sm">
                                <span className="font-semibold text-slate-600">Labour Contribution</span>
                                <span className="font-bold text-[var(--brand-primary)]">{formatLkr(wp.contribution)}</span>
                              </p>
                              {(() => {
                                const workersByWP = data.workersByClientWorkpoint.get(client.id) ?? new Map();
                                const workers: ClientWorkpointWorkerSummary[] = workersByWP.get(wp.id) ?? [];

                                if (workers.length === 0) {
                                  return (
                                    <p className="mt-3 text-sm text-[var(--text-secondary)]">
                                      No work entries recorded for this workpoint in this period.
                                    </p>
                                  );
                                }

                                return (
                                  <details className="mt-3">
                                    <summary className="cursor-pointer select-none text-xs font-semibold uppercase text-[var(--text-secondary)]">
                                      Worker Contributions
                                    </summary>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                      {workers.map((worker) => (
                                        <div className="app-surface rounded-md border border-slate-200 bg-white p-3" key={worker.id}>
                                          <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm font-bold text-[var(--text-primary)]">{worker.name}</p>
                                            {worker.workerType === "temporary" ? (
                                              <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-orange-700">
                                                Temporary
                                              </span>
                                            ) : (
                                              <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-blue-700">
                                                Permanent
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-xs text-[var(--text-secondary)]">{worker.employeeNo}</p>
                                          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                              <dt className="text-slate-500">Shifts</dt>
                                              <dd className="font-bold tabular-nums">{worker.shifts}</dd>
                                            </div>
                                            <div>
                                              <dt className="text-slate-500">Contribution</dt>
                                              <dd className="font-bold tabular-nums text-[var(--brand-primary)]">{formatLkr(worker.contribution)}</dd>
                                            </div>
                                          </dl>
                                          {worker.rates.length > 1 ? (
                                            <p className="mt-1 text-xs text-slate-600">
                                              Rates: {worker.rates.map((rate) => formatLkr(rate)).join(" / ")}
                                            </p>
                                          ) : worker.rates.length === 1 ? (
                                            <p className="mt-1 text-xs text-slate-600">Rate: {formatLkr(worker.rates[0])}</p>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                );
                              })()}
                              <Link
                                className="app-focus btn-primary mt-4 flex min-h-10 w-full items-center justify-center rounded-md px-3 text-sm font-bold transition"
                                href={`/clients/${client.id}/workpoints/${wp.id}?year=${safeYear}&month=${safeMonth}`}
                              >
                                Manage Work Entries
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}

          {data?.unattributed.entriesCount ? (
            <section className="app-surface flex flex-col rounded-lg border border-dashed border-[var(--border)] p-5">
              <p className="brand-kicker">Unassigned</p>
              <h2 className="mt-1 break-words text-xl font-bold text-[var(--text-primary)]">Unattributed / Unassigned</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                Historical work entries whose workplace or client could not be resolved for this period.
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-[var(--text-secondary)]">Workpoints Used</dt>
                  <dd className="font-bold text-[var(--text-primary)]">0</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-secondary)]">Workers</dt>
                  <dd className="font-bold text-[var(--text-primary)]">{data.unattributed.workersCount}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-secondary)]">Shifts</dt>
                  <dd className="font-bold text-[var(--text-primary)]">{data.unattributed.shifts}</dd>
                </div>
              </dl>
              <p className="mt-3 flex items-center justify-between text-sm">
                <span className="font-semibold text-[var(--text-secondary)]">Labour Contribution</span>
                <span className="font-bold text-[var(--brand-primary)]">{formatLkr(data.unattributed.contribution)}</span>
              </p>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
