"use client";

import { useState, type FormEvent } from "react";

import { useOnlineStatus } from "@/lib/connection/online-status";
import { hasPendingPayrollMutations } from "@/lib/offline/work-entry-outbox";

type ApprovalFormProps = {
  action: () => void | Promise<void>;
  month: number;
  year: number;
};

export function ApprovalForm({ action, month, year }: ApprovalFormProps) {
  const { isOnline, userId } = useOnlineStatus();
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setMessage(null);

    if (!isOnline) {
      event.preventDefault();
      setMessage("Internet connection is required to approve payroll.");
      return;
    }

    const hasPendingChanges = await hasPendingPayrollMutations({
      month,
      userId,
      year,
    });

    if (hasPendingChanges) {
      event.preventDefault();
      setMessage("Sync all pending changes before approving this payroll.");
    }
  }

  return (
    <form action={action} className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <button
        className="app-focus btn-primary flex min-h-10 w-full items-center justify-center rounded-md px-4 text-sm font-bold transition"
        type="submit"
      >
        Approve Payroll
      </button>
      {message ? (
        <p className="max-w-xs text-xs font-semibold text-amber-700" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
