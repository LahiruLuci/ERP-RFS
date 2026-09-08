"use client";

import { useActionState, useMemo, useState } from "react";

import { formatLkr } from "@/lib/format/currency";
import {
  workerDeductionTypeLabels,
  workerDeductionTypes,
  type WorkerDeduction,
  type WorkerDeductionType,
} from "@/lib/deductions/types";
import { useOnlineStatus } from "@/lib/connection/online-status";
import { queueOfflineWorkerDeduction } from "@/lib/offline/work-entry-outbox";

import type { DeductionFormState } from "./actions";

type DeductionFormProps = {
  action: (
    state: DeductionFormState,
    formData: FormData,
  ) => Promise<DeductionFormState>;
  defaultDate: string;
  editTransaction?: WorkerDeduction | null;
  month: number;
  worker: {
    employee_no: string;
    full_name: string;
    id: string;
  };
  year: number;
};

const initialState: DeductionFormState = {};

export function DeductionForm({
  action,
  defaultDate,
  editTransaction,
  month,
  worker,
  year,
}: DeductionFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [type, setType] = useState<WorkerDeductionType>(
    editTransaction?.type ?? "advance",
  );
  const [amount, setAmount] = useState(String(editTransaction?.amount ?? ""));
  const amountPreview = useMemo(() => formatLkr(amount), [amount]);

  const { isOnline, userId } = useOnlineStatus();
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (isOnline) {
      return; // Fallback to server action
    }

    event.preventDefault();
    setOfflineMessage(null);

    if (editTransaction) {
      setOfflineMessage("Editing existing server transactions requires an internet connection.");
      return;
    }

    if (!userId) {
      setOfflineMessage("Sign in again to save offline transactions.");
      return;
    }

    try {
      await queueOfflineWorkerDeduction({
        amount: Number(amount),
        month,
        note: event.currentTarget.note?.value || null,
        transactionDate: event.currentTarget.transaction_date?.value,
        type,
        userId,
        worker: {
          default_shift_rate: 0,
          employee_no: worker.employee_no,
          full_name: worker.full_name,
          id: worker.id,
          joined_date: null,
          local_only: false,
          nic: null,
          operation_id: null,
          phone: null,
          status: "active",
          sync_status: "synced",
          updated_at: null,
          user_id: null,
          worker_type: "permanent",
        },
        workerId: worker.id,
        year,
      });
      event.currentTarget.reset();
      setAmount("");
      setOfflineMessage("Saved on this device. Waiting to sync.");
    } catch (error) {
      setOfflineMessage(
        error instanceof Error ? error.message : "Unable to save this transaction offline."
      );
    }
  }

  return (
    <form action={formAction} className="app-surface rounded-lg p-5 sm:p-6" onSubmit={handleSubmit}>
      <input name="worker_id" type="hidden" value={worker.id} />
      <input name="month" type="hidden" value={month} />
      <input name="year" type="hidden" value={year} />
      {editTransaction ? (
        <input name="deduction_id" type="hidden" value={editTransaction.id} />
      ) : null}

      <div className="flex flex-col gap-1">
        <p className="brand-kicker">
          {editTransaction ? "Edit Transaction" : "Add Transaction"}
        </p>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          {worker.employee_no} - {worker.full_name}
        </h2>
      </div>

      {state.error ? (
        <p
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      {offlineMessage ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800" role="status">
          {offlineMessage}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
            Type
          </span>
          <select
            className="field-control min-h-10 rounded-md px-3 text-sm transition"
            disabled={isPending}
            name="type"
            onChange={(event) =>
              setType(event.target.value as WorkerDeductionType)
            }
            value={type}
          >
            {workerDeductionTypes.map((deductionType) => (
              <option key={deductionType} value={deductionType}>
                {workerDeductionTypeLabels[deductionType]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
            Date
          </span>
          <input
            className="field-control min-h-10 rounded-md px-3 text-sm transition"
            defaultValue={editTransaction?.transaction_date ?? defaultDate}
            disabled={isPending}
            name="transaction_date"
            required
            type="date"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
            Amount (LKR)
          </span>
          <input
            className="field-control min-h-10 rounded-md px-3 text-sm transition"
            disabled={isPending}
            min="0.01"
            name="amount"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Rs. 0.00"
            required
            step="0.01"
            type="number"
            value={amount}
          />
          <span className="text-xs font-semibold text-[var(--text-secondary)]">
            {amountPreview}
          </span>
        </label>

        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
            {type === "other" ? "Reason / Note *" : "Note / Reason"}
          </span>
          <textarea
            className="field-control min-h-20 rounded-md px-3 py-2 text-sm transition"
            defaultValue={editTransaction?.note ?? ""}
            disabled={isPending}
            name="note"
            required={type === "other"}
          />
        </label>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          className="app-focus btn-primary min-h-10 rounded-md px-4 text-sm font-bold transition disabled:cursor-wait disabled:bg-slate-400"
          disabled={isPending}
          type="submit"
        >
          {isPending
            ? "Saving..."
            : editTransaction
              ? "Save Changes"
              : "Save Transaction"}
        </button>
      </div>
    </form>
  );
}
