"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

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

    const pendingCount = await hasPendingPayrollMutations({
      month,
      userId,
      year,
    });

    if (pendingCount > 0) {
      event.preventDefault();
      setMessage(
        `${pendingCount} offline change${pendingCount === 1 ? "" : "s"
        } still need to be synchronized or resolved before payroll can be approved from this device.`
      );
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
        message.includes("offline change") ? (
          <p className="max-w-xs text-xs font-semibold text-amber-700" role="alert">
            {message}{" "}
            <Link href="/offline-sync" className="underline hover:text-amber-800">
              Open Sync Center
            </Link>
          </p>
        ) : (
          <p className="max-w-xs text-xs font-semibold text-amber-700" role="alert">
            {message}
          </p>
        )
      ) : null}
    </form>
  );
}
