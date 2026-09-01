"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatLkr } from "@/lib/format/currency";
import {
  readCachedPayrollWorkEntries,
  readCachedPayrollWorkspace,
  readCachedWorkers,
} from "@/lib/offline/cache";
import type {
  CachedPayrollWorkEntry,
  CachedPayrollWorkspace,
} from "@/lib/offline/types";
import { useOnlineStatus } from "@/lib/connection/online-status";

import type { ClientActionState } from "./actions";
import {
  PendingWorkpointEntries,
  WorkpointEntryForm,
} from "./client-forms";

type CachedWorkpointPayrollViewProps = {
  action: (
    state: ClientActionState,
    formData: FormData,
  ) => Promise<ClientActionState>;
  temporaryWorkerAction: (
    state: ClientActionState,
    formData: FormData,
  ) => Promise<ClientActionState>;
  clientId: string;
  month: number;
  search: string;
  workpointId: string;
  year: number;
};

function summarize(entries: CachedPayrollWorkEntry[]) {
  return {
    contribution: entries.reduce(
      (total, entry) => total + Number(entry.line_gross ?? 0),
      0,
    ),
    entriesCount: entries.length,
    shifts: entries.reduce((total, entry) => total + Number(entry.shifts ?? 0), 0),
    workersCount: new Set(entries.map((entry) => entry.worker_id)).size,
  };
}

export function CachedWorkpointPayrollView({
  action,
  temporaryWorkerAction,
  clientId,
  month,
  search,
  workpointId,
  year,
}: CachedWorkpointPayrollViewProps) {
  const { userId } = useOnlineStatus();
  const [workspace, setWorkspace] =
    useState<CachedPayrollWorkspace | null>(null);
  const [entries, setEntries] = useState<CachedPayrollWorkEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadCachedWorkspace() {
      try {
        const [cachedWorkspace, cachedWorkers, cachedEntries] =
          await Promise.all([
            readCachedPayrollWorkspace({ clientId, month, workpointId, year }),
            readCachedWorkers(search),
            readCachedPayrollWorkEntries({
              clientId,
              month,
              userId,
              workpointId,
              year,
            }),
          ]);

        if (!isMounted) {
          return;
        }

        if (cachedWorkspace) {
          const knownWorkerIds = new Set(
            cachedWorkspace.eligible_workers.map((worker) => worker.id),
          );
          cachedWorkspace.eligible_workers = [
            ...cachedWorkspace.eligible_workers,
            ...cachedWorkers.filter(
              (worker) =>
                worker.local_only &&
                worker.user_id === userId &&
                !knownWorkerIds.has(worker.id),
            ),
          ];
        }

        setWorkspace(cachedWorkspace);
        setEntries(cachedEntries);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCachedWorkspace();

    return () => {
      isMounted = false;
    };
  }, [clientId, month, search, userId, workpointId, year]);

  const summary = useMemo(() => summarize(entries), [entries]);
  const searchTerm = search.trim().toLowerCase();
  const workerOptions = (workspace?.eligible_workers ?? [])
    .filter((worker) => {
      if (!searchTerm) {
        return true;
      }

      return [
        worker.employee_no,
        worker.full_name,
        worker.nic,
        worker.phone,
      ].some((value) => (value ?? "").toLowerCase().includes(searchTerm));
    })
    .map((worker) => ({
      default_shift_rate: worker.default_shift_rate,
      employee_no: worker.employee_no,
      full_name: worker.full_name,
      id: worker.id,
      joined_date: worker.joined_date,
      status: worker.status,
      worker_type: worker.worker_type,
    }));

  if (isLoading) {
    return (
      <section className="app-surface rounded-lg p-5">
        <p className="text-sm font-semibold text-[var(--text-secondary)]">
          Loading cached payroll workspace...
        </p>
      </section>
    );
  }

  if (!workspace) {
    return (
      <section className="app-surface rounded-lg p-5">
        <p className="brand-kicker">Offline Cache</p>
        <h1 className="mt-2 text-xl font-bold text-[var(--text-primary)]">
          Payroll period is not available offline
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          This payroll period is not available offline yet. Connect to the
          internet first.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="app-surface overflow-hidden rounded-lg">
        <div className="flex flex-col gap-4 border-l-4 border-amber-400 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="brand-kicker">{workspace.client_name}</p>
            <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              {workspace.workpoint_name}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Supabase is not reachable. New work entries can be saved on this
              device and synced after internet returns.
            </p>
          </div>
          <Link
            className="app-focus btn-secondary flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-bold transition"
            href={`/clients/${clientId}?year=${year}&month=${month}`}
          >
            Back to Client
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="app-surface rounded-lg p-4">
          <p className="text-sm text-[var(--text-secondary)]">Entries</p>
          <p className="mt-1 text-2xl font-bold">{summary.entriesCount}</p>
        </div>
        <div className="app-surface rounded-lg p-4">
          <p className="text-sm text-[var(--text-secondary)]">Workers</p>
          <p className="mt-1 text-2xl font-bold">{summary.workersCount}</p>
        </div>
        <div className="app-surface rounded-lg p-4">
          <p className="text-sm text-[var(--text-secondary)]">Shifts</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {summary.shifts}
          </p>
        </div>
        <div className="app-surface rounded-lg p-4">
          <p className="text-sm text-[var(--text-secondary)]">Workpoint Gross</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--brand-primary)]">
            {formatLkr(summary.contribution)}
          </p>
        </div>
      </section>

      <WorkpointEntryForm
        action={action}
        clientId={clientId}
        defaultRate={workspace.workpoint_default_day_rate}
        month={month}
        temporaryWorkerAction={temporaryWorkerAction}
        workers={workerOptions}
        workpointId={workpointId}
        year={year}
      />

      <PendingWorkpointEntries
        clientId={clientId}
        month={month}
        workpointId={workpointId}
        year={year}
      />
    </div>
  );
}
