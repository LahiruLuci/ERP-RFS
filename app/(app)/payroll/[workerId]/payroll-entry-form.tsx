"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  calculateGrossSalary,
  calculateLineGross,
  calculateNetSalary,
  calculateTotalDeductions,
} from "@/lib/payroll/calculations";
import type {
  PayrollRecord,
  PayrollWorker,
  WorkplaceOption,
} from "@/lib/payroll/types";
import {
  workerDeductionTypeLabels,
  type WorkerDeduction,
  type WorkerDeductionSummary,
  type WorkerDeductionType,
} from "@/lib/deductions/types";
import { formatLkr } from "@/lib/format/currency";

import type { PayrollFormState } from "../actions";

type EditableEntry = {
  id: string;
  shiftRate: string;
  shifts: string;
  workplaceId: string;
};

type PayrollEntryFormProps = {
  action: (
    state: PayrollFormState,
    formData: FormData,
  ) => Promise<PayrollFormState>;
  cancelHref: string;
  deductions: WorkerDeduction[];
  deductionSummary: WorkerDeductionSummary;
  isApproved: boolean;
  record: PayrollRecord | null;
  worker: PayrollWorker;
  workplaces: WorkplaceOption[];
};

const initialState: PayrollFormState = {};

function toNumber(value: string) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toCents(value: number) {
  return Math.round(value * 100);
}

function valuesDiffer(value: string, sourceValue: number) {
  return toCents(toNumber(value)) !== toCents(sourceValue);
}

function createDefaultEntry(worker: PayrollWorker): EditableEntry {
  return {
    id: crypto.randomUUID(),
    shiftRate: String(worker.default_shift_rate ?? 0),
    shifts: "0",
    workplaceId: "",
  };
}

function createEntries(
  record: PayrollRecord | null,
  worker: PayrollWorker,
): EditableEntry[] {
  const entries = record?.payroll_work_entries ?? [];

  if (entries.length === 0) {
    return [createDefaultEntry(worker)];
  }

  return entries.map((entry) => ({
    id: entry.id ?? crypto.randomUUID(),
    shiftRate: String(entry.shift_rate ?? 0),
    shifts: String(entry.shifts ?? 0),
    workplaceId: entry.workplace_id ?? "",
  }));
}

function initialDraftDeductionValue({
  isApproved,
  recordOverride,
  recordValue,
  summaryValue,
}: {
  isApproved: boolean;
  recordOverride?: boolean;
  recordValue: number | string | undefined;
  summaryValue: number;
}) {
  if (isApproved || recordOverride) {
    return String(recordValue ?? 0);
  }

  return String(summaryValue ?? 0);
}

function activeTransactionCount(
  deductions: WorkerDeduction[],
  type: WorkerDeductionType,
) {
  return deductions.filter(
    (deduction) => deduction.status === "active" && deduction.type === type,
  ).length;
}

function Field({
  disabled = false,
  label,
  name,
  onChange,
  placeholder,
  required = false,
  value,
}: {
  disabled?: boolean;
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
        {label}
      </span>
      <input
        className="field-control min-h-10 rounded-md px-3 text-sm transition"
        disabled={disabled}
        min="0"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        step="0.01"
        type="number"
        value={value}
      />
    </label>
  );
}

export function PayrollEntryForm({
  action,
  cancelHref,
  deductions,
  deductionSummary,
  isApproved,
  record,
  worker,
  workplaces,
}: PayrollEntryFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [entries, setEntries] = useState(() => createEntries(record, worker));
  const [advance, setAdvance] = useState(() =>
    initialDraftDeductionValue({
      isApproved,
      recordOverride: record?.advance_override,
      recordValue: record?.advance,
      summaryValue: deductionSummary.advance,
    }),
  );
  const [epf, setEpf] = useState(String(record?.epf ?? 0));
  const [meals, setMeals] = useState(() =>
    initialDraftDeductionValue({
      isApproved,
      recordOverride: record?.meals_override,
      recordValue: record?.meals,
      summaryValue: deductionSummary.meals,
    }),
  );
  const [uniform, setUniform] = useState(() =>
    initialDraftDeductionValue({
      isApproved,
      recordOverride: record?.uniform_override,
      recordValue: record?.uniform,
      summaryValue: deductionSummary.uniform,
    }),
  );
  const [otherDeduction, setOtherDeduction] = useState(() =>
    initialDraftDeductionValue({
      isApproved,
      recordOverride: record?.other_deduction_override,
      recordValue: record?.other_deduction,
      summaryValue: deductionSummary.other,
    }),
  );
  const [otherNote, setOtherNote] = useState(record?.other_note ?? "");
  const totals = useMemo(() => {
    const workEntries = entries.map((entry) => ({
      shiftRate: toNumber(entry.shiftRate),
      shifts: toNumber(entry.shifts),
    }));
    const grossSalary = calculateGrossSalary(workEntries);
    const totalDeductions = calculateTotalDeductions({
      advance: toNumber(advance),
      epf: toNumber(epf),
      meals: toNumber(meals),
      otherDeduction: toNumber(otherDeduction),
      uniform: toNumber(uniform),
    });

    return {
      grossSalary,
      lineGrossValues: workEntries.map(calculateLineGross),
      netSalary: calculateNetSalary(grossSalary, totalDeductions),
      totalDeductions,
    };
  }, [advance, entries, epf, meals, otherDeduction, uniform]);
  const hasNegativeNet = totals.netSalary < 0;
  const deductionOverrides = {
    advance: valuesDiffer(advance, deductionSummary.advance),
    meals: valuesDiffer(meals, deductionSummary.meals),
    other: valuesDiffer(otherDeduction, deductionSummary.other),
    uniform: valuesDiffer(uniform, deductionSummary.uniform),
  };
  const deductionSources: {
    isOverride: boolean;
    label: string;
    type: WorkerDeductionType;
    value: number;
  }[] = [
    {
      isOverride: deductionOverrides.advance,
      label: "Advance",
      type: "advance",
      value: deductionSummary.advance,
    },
    {
      isOverride: deductionOverrides.meals,
      label: "Meals",
      type: "meals",
      value: deductionSummary.meals,
    },
    {
      isOverride: deductionOverrides.uniform,
      label: "Uniform",
      type: "uniform",
      value: deductionSummary.uniform,
    },
    {
      isOverride: deductionOverrides.other,
      label: "Other",
      type: "other",
      value: deductionSummary.other,
    },
  ];

  function updateEntry(
    id: string,
    field: keyof Omit<EditableEntry, "id">,
    value: string,
  ) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry,
      ),
    );
  }

  function addEntry() {
    setEntries((currentEntries) => [
      ...currentEntries,
      createDefaultEntry(worker),
    ]);
  }

  function removeEntry(id: string) {
    setEntries((currentEntries) =>
      currentEntries.length === 1
        ? currentEntries
        : currentEntries.filter((entry) => entry.id !== id),
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      {isApproved ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          This payroll month is approved. Saved salary values are locked for
          historical accuracy.
        </p>
      ) : null}

      <section className="app-surface rounded-lg p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="brand-kicker">Work Entries</p>
            <h2 className="mt-1 text-lg font-bold text-[var(--text-primary)]">
              Workplace Shifts
            </h2>
          </div>
          {!isApproved ? (
            <button
              className="app-focus btn-secondary min-h-10 rounded-md px-3 text-sm font-bold transition"
              disabled={isPending}
              onClick={addEntry}
              type="button"
            >
              Add Workplace
            </button>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {entries.map((entry, index) => (
            <div
              className="app-muted-surface grid gap-3 rounded-lg p-3 lg:grid-cols-[1.3fr_0.7fr_0.8fr_0.8fr_auto]"
              key={entry.id}
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                  Workplace
                </span>
                <select
                  className="field-control min-h-10 rounded-md px-3 text-sm transition"
                  disabled={isApproved || isPending}
                  name="workplace_id"
                  onChange={(event) =>
                    updateEntry(entry.id, "workplaceId", event.target.value)
                  }
                  value={entry.workplaceId}
                >
                  <option value="">General / Unassigned</option>
                  {workplaces.map((workplace) => (
                    <option key={workplace.id} value={workplace.id}>
                      {workplace.name}
                    </option>
                  ))}
                </select>
              </label>

              <Field
                disabled={isApproved || isPending}
                label="Shifts"
                name="shifts"
                onChange={(value) => updateEntry(entry.id, "shifts", value)}
                required
                value={entry.shifts}
              />
              <Field
                disabled={isApproved || isPending}
                label="Rate (LKR)"
                name="shift_rate"
                onChange={(value) => updateEntry(entry.id, "shiftRate", value)}
                required
                value={entry.shiftRate}
              />

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                  Line Gross
                </p>
                <p className="mt-2 min-h-10 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold tabular-nums text-[var(--text-primary)]">
                  {formatLkr(totals.lineGrossValues[index])}
                </p>
              </div>

              <div className="flex items-end">
                {!isApproved && entries.length > 1 ? (
                  <button
                    className="app-focus btn-secondary min-h-10 w-full rounded-md px-3 text-sm font-bold transition"
                    disabled={isPending}
                    onClick={() => removeEntry(entry.id)}
                    type="button"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="app-surface rounded-lg p-5 sm:p-6">
        <p className="brand-kicker">Deductions</p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          Advances, meals, uniform, other deductions, and EPF can be adjusted
          for this payroll record. Monthly transaction records are shown below
          for reference.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field
            disabled={isApproved || isPending}
            label="Advance"
            name="advance"
            onChange={setAdvance}
            value={advance}
          />
          <input
            name="advance_override"
            type="hidden"
            value={String(deductionOverrides.advance)}
          />
          <Field
            disabled={isApproved || isPending}
            label="Meals"
            name="meals"
            onChange={setMeals}
            value={meals}
          />
          <input
            name="meals_override"
            type="hidden"
            value={String(deductionOverrides.meals)}
          />
          <Field
            disabled={isApproved || isPending}
            label="Uniform"
            name="uniform"
            onChange={setUniform}
            value={uniform}
          />
          <input
            name="uniform_override"
            type="hidden"
            value={String(deductionOverrides.uniform)}
          />
          <Field
            disabled={isApproved || isPending}
            label="Other"
            name="other_deduction"
            onChange={setOtherDeduction}
            value={otherDeduction}
          />
          <input
            name="other_deduction_override"
            type="hidden"
            value={String(deductionOverrides.other)}
          />
          <Field
            disabled={isApproved || isPending}
            label="EPF"
            name="epf"
            onChange={setEpf}
            value={epf}
          />
        </div>
        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
            Other Deduction Note
          </span>
          <textarea
            className="field-control min-h-20 rounded-md px-3 py-2 text-sm transition"
            disabled={isApproved || isPending}
            name="other_note"
            onChange={(event) => setOtherNote(event.target.value)}
            rows={3}
            value={otherNote}
          />
        </label>

        <dl className="mt-4 grid gap-3 text-xs text-[var(--text-secondary)] sm:grid-cols-2 lg:grid-cols-4">
          {deductionSources.map(({ isOverride, label, type, value }) => (
            <div
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2"
              key={type}
            >
              <dt className="font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                {label}
              </dt>
              <dd className="mt-1">
                {activeTransactionCount(deductions, type)} transaction(s) -{" "}
                {formatLkr(value)}
              </dd>
              {isOverride ? (
                <dd className="mt-1 font-semibold text-amber-700">
                  Manual override active
                </dd>
              ) : null}
            </div>
          ))}
        </dl>

        {deductions.length > 0 ? (
          <div className="mt-5 rounded-md border border-[var(--border)] bg-white">
            <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
              Transaction Details
            </div>
            <div className="divide-y divide-zinc-200">
              {deductions.map((deduction) => (
                <div
                  className="grid gap-2 px-3 py-3 text-sm sm:grid-cols-[8rem_1fr_8rem]"
                  key={deduction.id}
                >
                  <span className="font-semibold text-[var(--text-primary)]">
                    {workerDeductionTypeLabels[deduction.type]}
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {deduction.note || "No note"}
                  </span>
                  <span className="font-bold tabular-nums text-[var(--text-primary)] sm:text-right">
                    {formatLkr(deduction.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="app-surface rounded-lg p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Gross Salary
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[var(--text-primary)]">
              {formatLkr(totals.grossSalary)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Total Deductions
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[var(--text-primary)]">
              {formatLkr(totals.totalDeductions)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Net Salary
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[var(--brand-primary)]">
              {formatLkr(totals.netSalary)}
            </p>
          </div>
        </div>

        {hasNegativeNet ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            Total deductions exceed this worker&apos;s gross salary. Please
            review the deductions before saving.
          </p>
        ) : null}
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          className="app-focus btn-secondary flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-bold transition"
          href={cancelHref}
        >
          Back to Payroll
        </Link>
        {!isApproved ? (
          <button
            className="app-focus btn-primary flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={isPending || hasNegativeNet}
            type="submit"
          >
            {isPending ? "Saving..." : "Save Salary"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
