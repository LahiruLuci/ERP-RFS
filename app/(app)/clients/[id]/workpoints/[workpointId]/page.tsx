import Link from "next/link";
import { notFound } from "next/navigation";

import { formatLkr } from "@/lib/format/currency";
import {
  ClientConnectionError,
  getCurrentUserRole,
  getWorkpointPayrollWorkspace,
} from "@/lib/clients/data";
import { createClient } from "@/lib/supabase/server";
import { OfflineCacheHydrator } from "@/lib/offline/cache-hydrator";
import { workerStatusLabels } from "@/lib/workers/types";

import {
  createTemporaryWorkerAction,
  deleteWorkpointPayrollEntryAction,
  saveWorkpointPayrollEntryAction,
} from "../../../actions";
import {
  InlineWorkpointEntryForm,
  PendingWorkpointEntries,
  WorkpointEntryForm,
} from "../../../client-forms";
import { CachedWorkpointPayrollView } from "../../../cached-workpoint-payroll-view";
import {
  WorkerStatusBadge,
  WorkerTypeBadge,
} from "../../../../workers/worker-status-badge";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type WorkpointPageProps = {
  params: Promise<{ id: string; workpointId: string }>;
  searchParams?: Promise<{ month?: string; q?: string; selectedWorkerId?: string; year?: string }>;
};

function readPeriod(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : fallback;
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export default async function WorkpointPayrollPage({ params, searchParams }: WorkpointPageProps) {
  const { id, workpointId } = await params;
  const resolvedSearchParams = await searchParams;
  const now = new Date();
  const year = readPeriod(resolvedSearchParams?.year, now.getFullYear());
  const month = readPeriod(resolvedSearchParams?.month, now.getMonth() + 1);
  const safeYear = year >= 2000 && year <= 2100 ? year : now.getFullYear();
  const safeMonth = month >= 1 && month <= 12 ? month : now.getMonth() + 1;
  const search = resolvedSearchParams?.q?.trim() ?? "";
  const selectedWorkerId = resolvedSearchParams?.selectedWorkerId?.trim() ?? "";
  const action = saveWorkpointPayrollEntryAction.bind(null, id, workpointId, safeYear, safeMonth);
  const deleteAction = deleteWorkpointPayrollEntryAction.bind(null, id, workpointId, safeYear, safeMonth);
  const temporaryWorkerAction = createTemporaryWorkerAction.bind(null, id, workpointId, safeYear, safeMonth);
  let data: Awaited<ReturnType<typeof getWorkpointPayrollWorkspace>> | null = null;
  let currentRole = "";

  try {
    data = await getWorkpointPayrollWorkspace({
      clientId: id,
      month: safeMonth,
      search,
      workpointId,
      year: safeYear,
    });

    const supabase = await createClient();
    currentRole = await getCurrentUserRole(supabase);
  } catch (error) {
    if (error instanceof ClientConnectionError) {
      return (
        <CachedWorkpointPayrollView
          action={action}
          clientId={id}
          month={safeMonth}
          search={search}
          selectedWorkerId={selectedWorkerId}
          temporaryWorkerAction={temporaryWorkerAction}
          workpointId={workpointId}
          year={safeYear}
        />
      );
    }

    throw error;
  }

  if (!data) {
    notFound();
  }

  const defaultRate = Number(data.workpoint.default_day_rate ?? 0) > 0 ? data.workpoint.default_day_rate : 0;

  return (
    <div className="flex flex-col gap-5 pt-4">
      <OfflineCacheHydrator
        clients={[{ ...data.client, workpointCount: 1 }]}
        payrollWorkspace={{
          clientId: data.client.id,
          clientName: data.client.name,
          entries: data.entries,
          month: safeMonth,
          periodEnd: data.period.periodEnd,
          periodStart: data.period.periodStart,
          workers: data.eligibleWorkers,
          workpointId: data.workpoint.id,
          workpointDefaultDayRate: data.workpoint.default_day_rate,
          workpointName: data.workpoint.name,
          year: safeYear,
        }}
        workpoints={[data.workpoint]}
        workpointsClientId={data.client.id}
      />
      <section className="app-surface overflow-hidden rounded-lg">
        <div className="flex flex-col gap-4 border-l-4 border-[var(--brand-accent)] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="brand-kicker">{data.client.name}</p>
            <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">{data.workpoint.name}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Enter worker shifts for this workpoint. These entries contribute to each worker&apos;s one monthly payroll record.
            </p>
            <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
              Payroll Period: {formatDisplayDate(data.period.periodStart)} - {formatDisplayDate(data.period.periodEnd)}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link className="app-focus btn-secondary flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-bold transition" href={`/clients/${id}?year=${safeYear}&month=${safeMonth}`}>Back to Client</Link>
            <Link className="app-focus btn-primary flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-bold transition" href={`/payroll?year=${safeYear}&month=${safeMonth}`}>Final Payroll</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="app-surface rounded-lg p-4"><p className="text-sm text-[var(--text-secondary)]">Entries</p><p className="mt-1 text-2xl font-bold">{data.summary.entriesCount}</p></div>
        <div className="app-surface rounded-lg p-4"><p className="text-sm text-[var(--text-secondary)]">Workers</p><p className="mt-1 text-2xl font-bold">{data.summary.workersCount}</p></div>
        <div className="app-surface rounded-lg p-4"><p className="text-sm text-[var(--text-secondary)]">Shifts</p><p className="mt-1 text-2xl font-bold tabular-nums">{data.summary.shifts}</p></div>
        <div className="app-surface rounded-lg p-4"><p className="text-sm text-[var(--text-secondary)]">Workpoint Gross</p><p className="mt-1 text-2xl font-bold tabular-nums text-[var(--brand-primary)]">{formatLkr(data.summary.contribution)}</p></div>
      </section>

      <section className="app-surface rounded-lg p-3 sm:p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_11rem_9rem_auto]">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">Search Eligible Workers</span>
            <input className="field-control min-h-10 rounded-md px-3 text-sm transition" defaultValue={search} name="q" placeholder="Search by employee no, name, NIC, ETF no or phone" type="search" />
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
          <div className="flex items-end"><button className="app-focus btn-primary min-h-10 w-full rounded-md px-4 text-sm font-bold transition" type="submit">Search</button></div>
        </form>
      </section>

      <WorkpointEntryForm
        action={action}
        clientId={id}
        defaultRate={defaultRate}
        month={safeMonth}
        search={search}
        selectedWorkerId={selectedWorkerId}
        temporaryWorkerAction={temporaryWorkerAction}
        workers={data.eligibleWorkers}
        workpointId={workpointId}
        year={safeYear}
      />

      <PendingWorkpointEntries
        clientId={id}
        month={safeMonth}
        workpointId={workpointId}
        year={safeYear}
      />

      {data.entries.length === 0 ? (
        <section className="app-surface rounded-lg p-8 text-center">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">No work entries yet</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Search for an eligible worker and save shifts for this workpoint.</p>
        </section>
      ) : (
        <>
          <section className="app-surface hidden overflow-hidden rounded-lg lg:block">
            <div className="max-h-[calc(100dvh-18rem)] overflow-auto">
              <table className="w-full divide-y divide-zinc-200 text-sm">
                <thead className="table-head-brand sticky top-0 z-10 text-left text-xs font-bold uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Worker ID</th>
                    <th className="px-4 py-3">Worker Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Shifts</th>
                    <th className="px-4 py-3 text-right">Shift Rate</th>
                    <th className="px-4 py-3 text-right">Workpoint Gross</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {data.entries.map((entry) => (
                    <tr className="table-row-brand" key={entry.entry_id}>
                      <td className="whitespace-nowrap px-4 py-4 font-bold">{entry.employee_no}</td>
                      <td className="px-4 py-4 font-semibold">{entry.full_name}</td>
                      <td className="px-4 py-4"><WorkerTypeBadge type={entry.worker_type} /></td>
                      <td className="px-4 py-4"><WorkerStatusBadge status={entry.worker_status} /></td>
                      <td className="px-4 py-4 text-right tabular-nums">{entry.shifts}</td>
                      <td className="px-4 py-4 text-right tabular-nums">{formatLkr(entry.shift_rate)}</td>
                      <td className="px-4 py-4 text-right font-bold tabular-nums">{formatLkr(entry.line_gross)}</td>
                       <td className="px-4 py-4 text-right"><InlineWorkpointEntryForm action={action} deleteAction={deleteAction} entryId={entry.entry_id} isOwner={currentRole === "owner"} shiftRate={entry.shift_rate} shifts={entry.shifts} workerId={entry.worker_id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:hidden">
            {data.entries.map((entry) => (
              <article className="app-surface rounded-lg p-5" key={entry.entry_id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="brand-kicker">{entry.employee_no}</p>
                    <h2 className="mt-1 break-words text-lg font-bold">{entry.full_name}</h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{workerStatusLabels[entry.worker_status]}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <WorkerTypeBadge type={entry.worker_type} />
                    <WorkerStatusBadge status={entry.worker_status} />
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-[var(--text-secondary)]">Shifts</dt><dd className="font-bold tabular-nums">{entry.shifts}</dd></div>
                  <div><dt className="text-[var(--text-secondary)]">Rate</dt><dd className="font-bold tabular-nums">{formatLkr(entry.shift_rate)}</dd></div>
                  <div className="col-span-2"><dt className="text-[var(--text-secondary)]">Workpoint Gross</dt><dd className="font-bold tabular-nums text-[var(--brand-primary)]">{formatLkr(entry.line_gross)}</dd></div>
                </dl>
                <div className="mt-4"><InlineWorkpointEntryForm action={action} deleteAction={deleteAction} entryId={entry.entry_id} isOwner={currentRole === "owner"} shiftRate={entry.shift_rate} shifts={entry.shifts} workerId={entry.worker_id} /></div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
