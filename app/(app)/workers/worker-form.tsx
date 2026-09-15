"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { formatLkr } from "@/lib/format/currency";
import {
  emergencyContactRelationships,
  workerStatusLabels,
  workerGenders,
  workerStatuses,
  workerTypeLabels,
  workerTypes,
  type Worker,
  type WorkerStatus,
} from "@/lib/workers/types";
import type { WorkerFormState } from "@/lib/workers/validation";

type WorkerFormProps = {
  action: (
    state: WorkerFormState,
    formData: FormData,
  ) => Promise<WorkerFormState>;
  cancelHref: string;
  worker?: Worker;
};

const initialState: WorkerFormState = {};

function formatDateInput(value: string | null | undefined) {
  return value?.slice(0, 10) ?? "";
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="text-sm font-medium text-red-700" role="alert">
      {message}
    </p>
  );
}

function FormSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="app-surface rounded-lg p-5 sm:p-6">
      <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          {description}
        </p>
      ) : null}
      <div className="mt-5 grid gap-5 md:grid-cols-2">{children}</div>
    </section>
  );
}

function isWorkerStatus(value: string): value is WorkerStatus {
  return workerStatuses.includes(value as WorkerStatus);
}

export function WorkerForm({ action, cancelHref, worker }: WorkerFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [selectedStatus, setSelectedStatus] = useState<WorkerStatus>(
    worker?.status ?? "active",
  );
  const [selectedWorkerType, setSelectedWorkerType] = useState<string>(
    worker?.worker_type ?? "permanent",
  );
  const isPermanentCreate = !worker && selectedWorkerType === "permanent";
  const hasStatusTransition = worker
    ? selectedStatus !== worker.status
    : selectedStatus !== "active";
  const statusDateLabel = useMemo(() => {
    if (selectedStatus === "resigned") {
      return "Resignation Date";
    }

    if (selectedStatus === "terminated") {
      return "Termination Date";
    }

    return "Effective Date";
  }, [selectedStatus]);

  const shouldShowStatusFields =
    hasStatusTransition &&
    ["active", "inactive", "resigned", "terminated"].includes(selectedStatus);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <FormSection title="Personal Information">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Full Name *</span>
          <input
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={worker?.full_name ?? ""}
            disabled={isPending}
            name="full_name"
            required
          />
          <FieldError message={state.fieldErrors?.full_name} />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">NIC</span>
          <input
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={worker?.nic ?? ""}
            disabled={isPending}
            name="nic"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Date of Birth
          </span>
          <input
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={formatDateInput(worker?.date_of_birth)}
            disabled={isPending}
            name="date_of_birth"
            type="date"
          />
          <FieldError message={state.fieldErrors?.date_of_birth} />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Gender</span>
          <select
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={worker?.gender ?? ""}
            disabled={isPending}
            name="gender"
          >
            <option value="">Not specified</option>
            {workerGenders.map((gender) => (
              <option key={gender} value={gender}>
                {gender}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.gender} />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Mobile Number
          </span>
          <input
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={worker?.phone ?? ""}
            disabled={isPending}
            name="phone"
            type="tel"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Secondary Mobile Number
          </span>
          <input
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={worker?.secondary_phone ?? ""}
            disabled={isPending}
            name="secondary_phone"
            type="tel"
          />
        </label>

        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Address</span>
          <textarea
            className="field-control min-h-24 rounded-md px-3 py-2 text-sm transition"
            defaultValue={worker?.address ?? ""}
            disabled={isPending}
            name="address"
          />
        </label>
      </FormSection>

      <FormSection title="Emergency Contact">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Contact Name
          </span>
          <input
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={worker?.emergency_contact_name ?? ""}
            disabled={isPending}
            name="emergency_contact_name"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Relationship
          </span>
          <select
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={worker?.emergency_contact_relationship ?? ""}
            disabled={isPending}
            name="emergency_contact_relationship"
          >
            <option value="">Not specified</option>
            {emergencyContactRelationships.map((relationship) => (
              <option key={relationship} value={relationship}>
                {relationship}
              </option>
            ))}
          </select>
          <FieldError
            message={state.fieldErrors?.emergency_contact_relationship}
          />
        </label>

        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Mobile Number
          </span>
          <input
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={worker?.emergency_contact_phone ?? ""}
            disabled={isPending}
            name="emergency_contact_phone"
            type="tel"
          />
        </label>
      </FormSection>

      <FormSection title="Employment Information">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Worker Type
          </span>
          <select
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={worker?.worker_type ?? "permanent"}
            disabled={isPending}
            name="worker_type"
            onChange={(event) => {
              const nextType = event.target.value;
              setSelectedWorkerType(nextType);
            }}
          >
            {workerTypes.map((workerType) => (
              <option key={workerType} value={workerType}>
                {workerTypeLabels[workerType]}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.worker_type} />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Employee No *
          </span>
          <input
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={worker?.employee_no ?? ""}
            disabled={isPending}
            name="employee_no"
            required
          />
          <FieldError message={state.fieldErrors?.employee_no} />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">ETF No</span>
          <input
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={worker?.etf_no ?? ""}
            disabled={isPending}
            name="etf_no"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">EPF No</span>
          <input
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={worker?.epf_no ?? ""}
            disabled={isPending}
            name="epf_no"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Joined Date {isPermanentCreate ? "*" : ""}
          </span>
          <input
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={formatDateInput(worker?.joined_date)}
            disabled={isPending}
            name="joined_date"
            required={isPermanentCreate}
            type="date"
          />
          <FieldError message={state.fieldErrors?.joined_date} />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Status</span>
          <select
            className="field-control h-11 rounded-md px-3 text-sm transition"
            disabled={isPending}
            name="status"
            onChange={(event) => {
              const nextStatus = event.target.value;

              if (isWorkerStatus(nextStatus)) {
                setSelectedStatus(nextStatus);
              }
            }}
            value={selectedStatus}
          >
            {workerStatuses.map((status) => (
              <option key={status} value={status}>
                {workerStatusLabels[status]}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.status} />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Previous Occupation
          </span>
          <input
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={worker?.previous_occupation ?? ""}
            disabled={isPending}
            name="previous_occupation"
          />
        </label>

        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Previous Employer
          </span>
          <input
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={worker?.previous_employer ?? ""}
            disabled={isPending}
            name="previous_employer"
          />
        </label>

        {shouldShowStatusFields ? (
          <div className="md:col-span-2">
            <div className="app-muted-surface grid gap-5 rounded-lg p-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {statusDateLabel} *
                </span>
                <input
                  className="field-control h-11 rounded-md px-3 text-sm transition"
                  disabled={isPending}
                  name="status_effective_date"
                  required
                  type="date"
                />
                <FieldError message={state.fieldErrors?.status_effective_date} />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {selectedStatus === "terminated"
                    ? "Termination Reason *"
                    : "Reason"}
                </span>
                <input
                  className="field-control h-11 rounded-md px-3 text-sm transition"
                  disabled={isPending}
                  name="status_reason"
                  required={selectedStatus === "terminated"}
                />
                <FieldError message={state.fieldErrors?.status_reason} />
              </label>

              <label className="flex flex-col gap-2 md:col-span-2">
                <span className="text-sm font-semibold text-[var(--text-primary)]">Note</span>
                <textarea
                  className="field-control min-h-24 rounded-md px-3 py-2 text-sm transition"
                  disabled={isPending}
                  name="status_note"
                />
                <FieldError message={state.fieldErrors?.status_note} />
              </label>
            </div>
          </div>
        ) : null}
      </FormSection>

      <FormSection
        description="These values are stored on the worker profile for future payroll calculations. No payroll calculation is performed here."
        title="Salary Information"
      >
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Basic Salary
          </span>
          <input
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={String(worker?.basic_salary ?? 0)}
            disabled={isPending}
            min="0"
            name="basic_salary"
            step="0.01"
            type="number"
          />
          <FieldError message={state.fieldErrors?.basic_salary} />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Default Shift Rate
          </span>
          <input
            className="field-control h-11 rounded-md px-3 text-sm transition"
            defaultValue={String(worker?.default_shift_rate ?? 0)}
            disabled={isPending}
            min="0"
            name="default_shift_rate"
            step="0.01"
            type="number"
          />
          <FieldError message={state.fieldErrors?.default_shift_rate} />
        </label>

        <p className="text-sm text-[var(--text-secondary)] md:col-span-2">
          Current basic salary: {formatLkr(worker?.basic_salary)}
        </p>
      </FormSection>

      <section className="app-surface rounded-lg p-5 sm:p-6">
        <label className="flex flex-col gap-2">
          <span className="text-lg font-bold text-[var(--text-primary)]">
            General Notes
          </span>
          <textarea
            className="field-control min-h-28 rounded-md px-3 py-2 text-sm transition"
            defaultValue={worker?.notes ?? ""}
            disabled={isPending}
            name="notes"
          />
        </label>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          className="app-focus btn-secondary flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-bold transition"
          href={cancelHref}
        >
          Cancel
        </Link>
        <button
          className="app-focus btn-primary flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Saving..." : "Save worker"}
        </button>
      </div>
    </form>
  );
}
