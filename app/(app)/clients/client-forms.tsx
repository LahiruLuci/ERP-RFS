"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";

import type { PayrollWorker } from "@/lib/payroll/types";
import { formatLkr } from "@/lib/format/currency";
import { workerTypeLabels } from "@/lib/workers/types";
import { useOnlineStatus } from "@/lib/connection/online-status";
import {
  cancelPendingWorkEntry,
  offlineQueueChangedEvent,
  queueOfflineTemporaryWorker,
  queueOfflineWorkEntry,
} from "@/lib/offline/work-entry-outbox";
import { readCachedPayrollWorkEntries } from "@/lib/offline/cache";
import type {
  CachedPayrollWorkEntry,
  CachedWorker,
} from "@/lib/offline/types";

import type { ClientActionState } from "./actions";

const initialState: ClientActionState = {};

function ErrorMessage({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">
      {message}
    </p>
  );
}

function TextField({
  label,
  name,
  placeholder,
  required = false,
  type = "text",
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
        {label}
      </span>
      <input
        className="field-control min-h-10 rounded-md px-3 text-sm transition"
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

export function AddClientForm({
  action,
}: {
  action: (state: ClientActionState, formData: FormData) => Promise<ClientActionState>;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-2">
      <ErrorMessage message={state.error} />
      <TextField label="Client Code" name="client_code" placeholder="DAMRO" required />
      <TextField label="Client Name" name="name" placeholder="Damro" required />
      <TextField label="Contact Person" name="contact_person" />
      <TextField label="Phone" name="phone" type="tel" />
      <TextField label="Email" name="email" type="email" />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
          Status
        </span>
        <select className="field-control min-h-10 rounded-md px-3 text-sm transition" name="status" defaultValue="active">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5 lg:col-span-2">
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
          Billing Address
        </span>
        <textarea className="field-control min-h-20 rounded-md px-3 py-2 text-sm transition" name="billing_address" rows={3} />
      </label>
      <label className="flex flex-col gap-1.5 lg:col-span-2">
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
          Notes
        </span>
        <textarea className="field-control min-h-20 rounded-md px-3 py-2 text-sm transition" name="notes" rows={3} />
      </label>
      <div className="lg:col-span-2">
        <button className="app-focus btn-primary min-h-11 w-full rounded-md px-4 text-sm font-bold transition disabled:cursor-wait disabled:opacity-70 sm:w-auto" disabled={isPending} type="submit">
          {isPending ? "Adding..." : "Add Client"}
        </button>
      </div>
    </form>
  );
}

export function AddWorkpointForm({
  action,
}: {
  action: (state: ClientActionState, formData: FormData) => Promise<ClientActionState>;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-2">
      <ErrorMessage message={state.error} />
      <TextField label="Workpoint Code" name="workplace_code" placeholder="KDY-01" required />
      <TextField label="Workpoint Name" name="name" placeholder="Kandy Branch" required />
      <TextField label="Contact Person" name="contact_person" />
      <TextField label="Contact Phone" name="contact_phone" type="tel" />
      <TextField label="Default Day Rate" name="default_day_rate" placeholder="1500" type="number" />
      <TextField label="Default Night Rate" name="default_night_rate" placeholder="1800" type="number" />
      <TextField label="Required Guards" name="required_guards" placeholder="0" type="number" />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">Status</span>
        <select className="field-control min-h-10 rounded-md px-3 text-sm transition" name="status" defaultValue="active">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5 lg:col-span-2">
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">Address</span>
        <textarea className="field-control min-h-20 rounded-md px-3 py-2 text-sm transition" name="address" rows={3} />
      </label>
      <label className="flex flex-col gap-1.5 lg:col-span-2">
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">Notes</span>
        <textarea className="field-control min-h-20 rounded-md px-3 py-2 text-sm transition" name="notes" rows={3} />
      </label>
      <div className="lg:col-span-2">
        <button className="app-focus btn-primary min-h-11 w-full rounded-md px-4 text-sm font-bold transition disabled:cursor-wait disabled:opacity-70 sm:w-auto" disabled={isPending} type="submit">
          {isPending ? "Adding..." : "Add Workpoint"}
        </button>
      </div>
    </form>
  );
}

export function WorkpointEntryForm({
  action,
  clientId,
  defaultRate,
  month,
  selectedWorkerId,
  temporaryWorkerAction,
  workers,
  workpointId,
  year,
}: {
  action: (state: ClientActionState, formData: FormData) => Promise<ClientActionState>;
  clientId: string;
  defaultRate: number | string;
  month: number;
  selectedWorkerId?: string;
  temporaryWorkerAction?: (state: ClientActionState, formData: FormData) => Promise<ClientActionState>;
  workers: PayrollWorker[];
  workpointId: string;
  year: number;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [temporaryWorkerState, temporaryWorkerFormAction, isTemporaryWorkerPending] =
    useActionState(temporaryWorkerAction ?? action, initialState);
  const { isOnline, userId } = useOnlineStatus();
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const [temporaryWorkerMessage, setTemporaryWorkerMessage] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState(selectedWorkerId ?? "");
  const [localWorkers, setLocalWorkers] = useState<CachedWorker[]>([]);
  const availableWorkers = [
    ...workers,
    ...localWorkers.map((worker) => ({
      default_shift_rate: worker.default_shift_rate,
      employee_no: worker.employee_no,
      full_name: worker.full_name,
      id: worker.id,
      joined_date: worker.joined_date,
      status: worker.status,
      worker_type: worker.worker_type,
    })),
  ];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isOnline) {
      return;
    }

    event.preventDefault();
    setOfflineMessage(null);

    if (!userId) {
      setOfflineMessage("Sign in again to save offline work entries.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const workerId = String(formData.get("worker_id") ?? "");
    const shifts = Number(formData.get("shifts") ?? 0);
    const shiftRate = Number(formData.get("shift_rate") ?? 0);
    const worker = availableWorkers.find((item) => item.id === workerId);
    const cachedWorker =
      localWorkers.find((item) => item.id === workerId) ??
      ({
        default_shift_rate: Number(worker?.default_shift_rate ?? 0),
        employee_no: worker?.employee_no ?? "",
        full_name: worker?.full_name ?? "",
        id: worker?.id ?? "",
        joined_date: worker?.joined_date ?? null,
        local_only: false,
        nic: null,
        operation_id: null,
        phone: null,
        status: worker?.status ?? "active",
        sync_status: "synced",
        updated_at: null,
        user_id: null,
        worker_type: worker?.worker_type ?? "permanent",
      } satisfies CachedWorker);

    if (!worker) {
      setOfflineMessage(
        "Worker not available offline. Connect to the internet to add or load this worker.",
      );
      return;
    }

    try {
      await queueOfflineWorkEntry({
        clientId,
        employeeNo: worker.employee_no,
        fullName: worker.full_name,
        month,
        shiftRate,
        shifts,
        userId,
        worker: cachedWorker,
        workerId,
        workplaceId: workpointId,
        year,
      });
      event.currentTarget.reset();
      setOfflineMessage(
        "Work entry saved on this device. Waiting for internet connection.",
      );
    } catch (error) {
      setOfflineMessage(
        error instanceof Error
          ? error.message
          : "Unable to save this work entry offline.",
      );
    }
  }

  async function handleTemporaryWorkerSubmit(event: FormEvent<HTMLFormElement>) {
    if (isOnline) {
      return;
    }

    event.preventDefault();
    setTemporaryWorkerMessage(null);

    if (!userId) {
      setTemporaryWorkerMessage("Sign in again to sync pending changes.");
      return;
    }

    const formData = new FormData(event.currentTarget);

    try {
      const worker = await queueOfflineTemporaryWorker({
        address: String(formData.get("address") ?? "").trim() || null,
        defaultShiftRate: Number(formData.get("default_shift_rate") ?? 0),
        fullName: String(formData.get("full_name") ?? "").trim(),
        nic: String(formData.get("nic") ?? "").trim(),
        notes: String(formData.get("notes") ?? "").trim() || null,
        phone: String(formData.get("phone") ?? "").trim(),
        userId,
      });

      setLocalWorkers((currentWorkers) => [...currentWorkers, worker]);
      setSelectedWorker(worker.id);
      event.currentTarget.reset();
      setTemporaryWorkerMessage(
        "Temporary worker saved on this device. Waiting for internet connection.",
      );
    } catch (error) {
      setTemporaryWorkerMessage(
        error instanceof Error
          ? error.message
          : "Unable to save this temporary worker offline.",
      );
    }
  }

  return (
    <div className="app-surface rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        <div>
          <p className="brand-kicker">Add Work Entry</p>
          <h2 className="mt-1 text-lg font-bold text-[var(--text-primary)]">Worker shifts at this workpoint</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            Temporary workers can be added here without changing their permanent assignment.
          </p>
        </div>
        <form action={formAction} className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <ErrorMessage message={state.error} />
          {offlineMessage ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800" role="status">
              {offlineMessage}
            </p>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-[1.7fr_0.7fr_0.8fr_auto]">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">Worker</span>
              <select
                className="field-control min-h-10 rounded-md px-3 text-sm transition"
                name="worker_id"
                onChange={(event) => setSelectedWorker(event.target.value)}
                required
                value={selectedWorker}
              >
                <option value="">Select worker</option>
                {availableWorkers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.employee_no} - {worker.full_name}
                    {worker.worker_type === "temporary" ? " - Temporary" : ""} ({formatLkr(worker.default_shift_rate)})
                  </option>
                ))}
              </select>
            </label>
            <TextField label="Shifts" name="shifts" placeholder="0" required type="number" />
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">Rate (LKR)</span>
              <input className="field-control min-h-10 rounded-md px-3 text-sm transition" defaultValue={String(defaultRate ?? 0)} min="0" name="shift_rate" required step="0.01" type="number" />
            </label>
            <div className="flex items-end">
              <button className="app-focus btn-primary min-h-10 w-full rounded-md px-4 text-sm font-bold transition disabled:cursor-wait disabled:opacity-70" disabled={isPending} type="submit">
                {isPending ? "Saving..." : "Save Entry"}
              </button>
            </div>
          </div>
        </form>
        {temporaryWorkerAction ? (
          <details className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3">
            <summary className="cursor-pointer text-sm font-bold text-[var(--brand-primary)]">
              Worker not found? Add Temporary Worker
            </summary>
            <form
              action={temporaryWorkerFormAction}
              className="mt-4 grid gap-3 md:grid-cols-2"
              onSubmit={handleTemporaryWorkerSubmit}
            >
              <input name="default_shift_rate" type="hidden" value={String(defaultRate ?? 0)} />
              <ErrorMessage message={temporaryWorkerState.error} />
              {temporaryWorkerMessage ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 md:col-span-2" role="status">
                  {temporaryWorkerMessage}
                </p>
              ) : null}
              <TextField label="Full Name" name="full_name" required />
              <TextField label="NIC" name="nic" required />
              <TextField label="Mobile Number" name="phone" required type="tel" />
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                  Worker Type
                </span>
                <div className="field-control flex min-h-10 items-center rounded-md px-3 text-sm font-semibold text-[var(--text-primary)]">
                  {workerTypeLabels.temporary}
                </div>
              </label>
              <label className="flex flex-col gap-1.5 md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">Address</span>
                <textarea className="field-control min-h-20 rounded-md px-3 py-2 text-sm transition" name="address" rows={3} />
              </label>
              <label className="flex flex-col gap-1.5 md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">Note</span>
                <textarea className="field-control min-h-20 rounded-md px-3 py-2 text-sm transition" name="notes" rows={3} />
              </label>
              <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row sm:justify-end">
                <button className="app-focus btn-primary min-h-10 rounded-md px-4 text-sm font-bold transition disabled:cursor-wait disabled:opacity-70" disabled={isTemporaryWorkerPending} type="submit">
                  {isTemporaryWorkerPending ? "Adding..." : "Add Temporary Worker"}
                </button>
              </div>
            </form>
          </details>
        ) : null}
      </div>
    </div>
  );
}

export function PendingWorkpointEntries({
  clientId,
  month,
  workpointId,
  year,
}: {
  clientId: string;
  month: number;
  workpointId: string;
  year: number;
}) {
  const { userId } = useOnlineStatus();
  const [entries, setEntries] = useState<CachedPayrollWorkEntry[]>([]);

  async function handleCancel(entry: CachedPayrollWorkEntry) {
    if (
      !entry.operation_id ||
      !window.confirm("Remove this pending work entry?")
    ) {
      return;
    }

    await cancelPendingWorkEntry(entry.operation_id, userId);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadEntries() {
      const cachedEntries = await readCachedPayrollWorkEntries({
        clientId,
        month,
        userId,
        workpointId,
        year,
      });

      if (isMounted) {
        setEntries(cachedEntries.filter((entry) => entry.local_only));
      }
    }

    void loadEntries();

    function handleQueueChanged() {
      void loadEntries();
    }

    window.addEventListener(offlineQueueChangedEvent, handleQueueChanged);

    return () => {
      isMounted = false;
      window.removeEventListener(offlineQueueChangedEvent, handleQueueChanged);
    };
  }, [clientId, month, userId, workpointId, year]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="app-surface overflow-hidden rounded-lg">
      <div className="border-l-4 border-amber-400 p-4 sm:p-5">
        <p className="brand-kicker">Pending Sync</p>
        <h2 className="mt-1 text-lg font-bold text-[var(--text-primary)]">
          Work entries saved on this device
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          These entries are included here for review and will sync when the
          internet connection is available.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[46rem] divide-y divide-zinc-200 text-sm">
          <thead className="table-head-brand text-left text-xs font-bold uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3">Worker ID</th>
              <th className="px-4 py-3">Worker Name</th>
              <th className="px-4 py-3 text-right">Shifts</th>
              <th className="px-4 py-3 text-right">Shift Rate</th>
              <th className="px-4 py-3 text-right">Line Gross</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {entries.map((entry) => (
              <tr className="table-row-brand" key={entry.entry_id}>
                <td className="whitespace-nowrap px-4 py-4 font-bold">
                  {entry.employee_no}
                </td>
                <td className="px-4 py-4 font-semibold">{entry.full_name}</td>
                <td className="px-4 py-4 text-right tabular-nums">
                  {entry.shifts}
                </td>
                <td className="px-4 py-4 text-right tabular-nums">
                  {formatLkr(entry.shift_rate)}
                </td>
                <td className="px-4 py-4 text-right font-bold tabular-nums">
                  {formatLkr(entry.line_gross)}
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                    {entry.sync_status === "failed"
                      ? "Needs Attention"
                      : entry.sync_status === "syncing"
                        ? "Syncing"
                        : "Pending Sync"}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    className="app-focus btn-secondary min-h-9 rounded-md px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={entry.sync_status === "syncing"}
                    onClick={() => void handleCancel(entry)}
                    type="button"
                  >
                    Cancel
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function InlineWorkpointEntryForm({
  action,
  entryId,
  shiftRate,
  shifts,
  workerId,
}: {
  action: (state: ClientActionState, formData: FormData) => Promise<ClientActionState>;
  entryId: string;
  shiftRate: number | string;
  shifts: number | string;
  workerId: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const { isOnline } = useOnlineStatus();
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isOnline) {
      return;
    }

    event.preventDefault();
    setOfflineMessage("Editing existing work entries requires an internet connection.");
  }

  return (
    <form action={formAction} className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <input name="entry_id" type="hidden" value={entryId} />
      <input name="worker_id" type="hidden" value={workerId} />
      <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
        <input aria-label="Shifts" className="field-control min-h-10 w-full rounded-md px-3 text-sm transition sm:w-24" defaultValue={String(shifts)} min="0" name="shifts" required step="0.01" type="number" />
        <input aria-label="Shift rate" className="field-control min-h-10 w-full rounded-md px-3 text-sm transition sm:w-28" defaultValue={String(shiftRate)} min="0" name="shift_rate" required step="0.01" type="number" />
        <button className="app-focus btn-secondary min-h-10 rounded-md px-3 text-sm font-bold transition disabled:cursor-wait disabled:opacity-70" disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Update"}
        </button>
      </div>
      <ErrorMessage message={state.error} />
      {offlineMessage ? (
        <p className="text-xs font-semibold text-amber-700" role="alert">
          {offlineMessage}
        </p>
      ) : null}
    </form>
  );
}
