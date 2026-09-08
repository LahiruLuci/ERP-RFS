"use client";

import { useEffect, useState } from "react";

import { formatLkr } from "@/lib/format/currency";
import { useOnlineStatus } from "@/lib/connection/online-status";
import {
    cancelPendingWorkerDeduction,
    offlineQueueChangedEvent,
} from "@/lib/offline/work-entry-outbox";
import { getOfflineRecords } from "@/lib/offline/database";
import type { CachedWorkerDeduction } from "@/lib/offline/types";
import { workerDeductionTypeLabels } from "@/lib/deductions/types";

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(`${value}T00:00:00`));
}

export function PendingDeductions({
    month,
    year,
    workerId,
}: {
    month: number;
    year: number;
    workerId?: string;
}) {
    const { userId } = useOnlineStatus();
    const [deductions, setDeductions] = useState<CachedWorkerDeduction[]>([]);

    async function handleCancel(deduction: CachedWorkerDeduction) {
        if (
            !deduction.operation_id ||
            !window.confirm("Remove this pending transaction?")
        ) {
            return;
        }

        await cancelPendingWorkerDeduction(deduction.operation_id, userId);
    }

    useEffect(() => {
        let isMounted = true;

        async function loadDeductions() {
            if (!userId) return;

            const cachedDeductions = await getOfflineRecords<CachedWorkerDeduction>("workerDeductions");

            if (isMounted) {
                setDeductions(
                    cachedDeductions.filter(
                        (d) =>
                            d.local_only &&
                            d.user_id === userId &&
                            d.month === month &&
                            d.year === year &&
                            (!workerId || d.worker_id === workerId)
                    ).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
                );
            }
        }

        void loadDeductions();

        function handleQueueChanged() {
            void loadDeductions();
        }

        window.addEventListener(offlineQueueChangedEvent, handleQueueChanged);

        return () => {
            isMounted = false;
            window.removeEventListener(offlineQueueChangedEvent, handleQueueChanged);
        };
    }, [month, userId, workerId, year]);

    if (deductions.length === 0) {
        return null;
    }

    return (
        <section className="app-surface overflow-hidden rounded-lg mt-4">
            <div className="border-l-4 border-amber-400 p-4 sm:p-5">
                <p className="brand-kicker">Pending Sync</p>
                <h2 className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                    Transactions saved on this device
                </h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    These transactions are included here for review and will sync when the
                    internet connection is available.
                </p>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead className="table-head-brand text-left text-xs font-bold uppercase tracking-wide">
                        <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                            <th className="px-4 py-3">Note</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                        {deductions.map((deduction) => (
                            <tr className="table-row-brand" key={deduction.deduction_id}>
                                <td className="whitespace-nowrap px-4 py-4 font-semibold">
                                    {formatDate(deduction.transaction_date)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-4">
                                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                                        {workerDeductionTypeLabels[deduction.type]}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-4 text-right font-bold tabular-nums">
                                    {formatLkr(deduction.amount)}
                                </td>
                                <td className="max-w-72 px-4 py-4 text-[var(--text-secondary)]">
                                    {deduction.note || "No note"}
                                </td>
                                <td className="px-4 py-4">
                                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                                        {deduction.sync_status === "failed"
                                            ? "Needs Attention"
                                            : deduction.sync_status === "syncing"
                                                ? "Syncing"
                                                : "Pending Sync"}
                                    </span>
                                </td>
                                <td className="px-4 py-4 text-right">
                                    <button
                                        className="app-focus btn-secondary min-h-9 rounded-md px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
                                        disabled={deduction.sync_status === "syncing"}
                                        onClick={() => void handleCancel(deduction)}
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
