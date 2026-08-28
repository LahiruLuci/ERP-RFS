"use client";

import { useActionState } from "react";

import type { PayrollWorker } from "@/lib/payroll/types";
import { formatLkr } from "@/lib/format/currency";
import { workerTypeLabels } from "@/lib/workers/types";

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
  defaultRate,
  selectedWorkerId,
  temporaryWorkerAction,
  workers,
}: {
  action: (state: ClientActionState, formData: FormData) => Promise<ClientActionState>;
  defaultRate: number | string;
  selectedWorkerId?: string;
  temporaryWorkerAction?: (state: ClientActionState, formData: FormData) => Promise<ClientActionState>;
  workers: PayrollWorker[];
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [temporaryWorkerState, temporaryWorkerFormAction, isTemporaryWorkerPending] =
    useActionState(temporaryWorkerAction ?? action, initialState);

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
        <form action={formAction} className="flex flex-col gap-3">
          <ErrorMessage message={state.error} />
          <div className="grid gap-3 lg:grid-cols-[1.7fr_0.7fr_0.8fr_auto]">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">Worker</span>
              <select className="field-control min-h-10 rounded-md px-3 text-sm transition" defaultValue={selectedWorkerId ?? ""} name="worker_id" required>
                <option value="">Select worker</option>
                {workers.map((worker) => (
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
            <form action={temporaryWorkerFormAction} className="mt-4 grid gap-3 md:grid-cols-2">
              <input name="default_shift_rate" type="hidden" value={String(defaultRate ?? 0)} />
              <ErrorMessage message={temporaryWorkerState.error} />
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

  return (
    <form action={formAction} className="flex flex-col gap-2">
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
    </form>
  );
}
