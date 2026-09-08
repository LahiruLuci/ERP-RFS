"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useOnlineStatus } from "@/lib/connection/online-status";
import {
    getPendingMutationSummary,
    offlineQueueChangedEvent,
    retryPendingMutation,
    discardPendingMutation,
} from "@/lib/offline/work-entry-outbox";
import { getOfflineRecords } from "@/lib/offline/database";
import type { CachedWorker, PendingMutation } from "@/lib/offline/types";
import { formatLkr } from "@/lib/format/currency";

type EnrichedMutation = PendingMutation & {
    workerName?: string;
    uiType: string;
    isTransientError: boolean;
};

export default function SyncCenterPage() {
    const { isOnline, userId, syncNow, syncStatus } = useOnlineStatus();
    const [mutations, setMutations] = useState<EnrichedMutation[]>([]);
    const [summary, setSummary] = useState({ failed: 0, pending: 0, syncing: 0 });
    const [selectedForDiscard, setSelectedForDiscard] = useState<EnrichedMutation | null>(null);
    const [discardWarning, setDiscardWarning] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function load() {
            if (!userId) return;

            const [pendingRecords, sum, workers] = await Promise.all([
                getOfflineRecords<PendingMutation>("pendingMutations"),
                getPendingMutationSummary(userId),
                getOfflineRecords<CachedWorker>("workers"),
            ]);

            if (!isMounted) return;

            const userRecords = pendingRecords
                .filter((m) => m.user_id === userId)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            const enriched: EnrichedMutation[] = userRecords.map((m) => {
                let workerName = "Unknown Worker";
                let uiType = "Unknown Change";

                if (m.entity_type === "temporary_worker") {
                    uiType = "Temporary Worker";
                    const p = m.payload as any;
                    workerName = p.full_name || "Unknown Worker";
                } else if (m.entity_type === "payroll_work_entry") {
                    uiType = "Work Entry";
                    const p = m.payload as any;
                    const w = workers.find((w) => w.id === p.worker_id);
                    workerName = w ? w.full_name : "Unknown Worker";
                } else if (m.entity_type === "worker_deduction") {
                    const p = m.payload as any;
                    const typeLabel =
                        p.type === "advance"
                            ? "Advance"
                            : p.type === "meals"
                                ? "Meals"
                                : p.type === "uniform"
                                    ? "Uniform"
                                    : "Other Deduction";
                    uiType = typeLabel;
                    const w = workers.find((w) => w.id === p.worker_id);
                    workerName = w ? w.full_name : "Unknown Worker";
                }

                const isTransientError = Boolean(
                    m.last_error === "Network error" ||
                    m.last_error?.toLowerCase().includes("timeout") ||
                    m.last_error?.toLowerCase().includes("fetch")
                );

                return {
                    ...m,
                    workerName,
                    uiType,
                    isTransientError,
                };
            });

            setMutations(enriched);
            setSummary(sum);
        }

        void load();

        function handleQueueChange() {
            void load();
        }
        window.addEventListener(offlineQueueChangedEvent, handleQueueChange);

        return () => {
            isMounted = false;
            window.removeEventListener(offlineQueueChangedEvent, handleQueueChange);
        };
    }, [userId]);

    function handleDiscardClick(mutation: EnrichedMutation) {
        const dependents = mutations.filter((m) => m.depends_on_operation_id === mutation.operation_id);
        if (dependents.length > 0) {
            setDiscardWarning(
                `This record has ${dependents.length} unsynchronized dependent change(s). Please resolve or discard dependents first.`
            );
        } else {
            setDiscardWarning(null);
        }
        setSelectedForDiscard(mutation);
    }

    async function confirmDiscard() {
        if (!selectedForDiscard || !userId) return;
        try {
            await discardPendingMutation(selectedForDiscard.operation_id, userId);
            setSelectedForDiscard(null);
        } catch (e: any) {
            setDiscardWarning(e.message || "Could not discard.");
        }
    }

    return (
        <>
            <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-[var(--brand-primary)]">
                        Offline Sync Center
                    </h1>
                    <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">
                        Review and manage changes waiting to be synchronized with the server.
                    </p>
                </div>
                <div>
                    {isOnline ? (
                        <button
                            className="app-focus btn-primary min-h-10 rounded-md px-4 text-sm font-bold shadow-sm disabled:opacity-50"
                            disabled={syncStatus === "syncing" || (summary.pending === 0 && summary.failed === 0)}
                            onClick={syncNow}
                            type="button"
                        >
                            {syncStatus === "syncing" ? "Syncing..." : "Sync Now"}
                        </button>
                    ) : (
                        <div className="flex min-h-10 items-center justify-center rounded-md border border-amber-200 bg-amber-50 px-4 text-sm font-bold text-amber-700">
                            You are offline. Changes will sync later.
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="app-surface rounded-lg p-5">
                    <p className="text-sm font-bold uppercase tracking-wider text-blue-900/60">
                        Pending Sync
                    </p>
                    <p className="mt-2 text-3xl font-black tabular-nums text-blue-600">
                        {summary.pending}
                    </p>
                </div>
                <div className="app-surface rounded-lg p-5">
                    <p className="text-sm font-bold uppercase tracking-wider text-amber-900/60">
                        Needs Attention
                    </p>
                    <p className="mt-2 text-3xl font-black tabular-nums text-amber-600">
                        {summary.failed}
                    </p>
                </div>
            </div>

            <div className="grid gap-4">
                {mutations.length === 0 ? (
                    <div className="app-surface flex flex-col items-center justify-center rounded-lg p-8 text-center text-sm font-medium text-[var(--text-secondary)]">
                        No offline changes waiting to be synchronized.
                    </div>
                ) : null}

                {mutations.map((m) => {
                    const isFailed = m.status === "failed";
                    const isPendingDep = m.depends_on_operation_id && m.status !== "failed";
                    const payload = m.payload as any; // Safe dynamic access for UI display

                    let friendlyError = m.last_error;
                    if (friendlyError?.toLowerCase().includes("approved payroll")) {
                        friendlyError = "This payroll month has already been approved. This change cannot be added automatically.";
                    } else if (friendlyError?.toLowerCase().includes("permission")) {
                        friendlyError = "You no longer have permission to perform this action.";
                    } else if (friendlyError?.toLowerCase().includes("worker deduction type")) {
                        friendlyError = "Invalid deduction data sent to the server.";
                    }

                    return (
                        <div
                            key={m.operation_id}
                            className={`app-surface rounded-lg p-5 border-l-4 ${isFailed ? "border-amber-500" : "border-blue-500"
                                }`}
                        >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${isFailed
                                                    ? "bg-amber-100 text-amber-800"
                                                    : isPendingDep
                                                        ? "bg-indigo-100 text-indigo-700"
                                                        : "bg-blue-100 text-blue-800"
                                                }`}
                                        >
                                            {isFailed
                                                ? "Needs Attention"
                                                : isPendingDep
                                                    ? "Waiting for Dependency"
                                                    : m.status === "syncing"
                                                        ? "Syncing"
                                                        : "Pending Sync"}
                                        </span>
                                        <span className="text-sm font-medium text-[var(--text-secondary)]">
                                            Created: {new Intl.DateTimeFormat("en-GB", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            }).format(new Date(m.created_at))}
                                        </span>
                                    </div>

                                    <h3 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
                                        {m.uiType}
                                    </h3>
                                    <div className="mt-1 flex flex-col gap-1 text-sm text-[var(--text-secondary)]">
                                        <p>
                                            <strong>Worker:</strong> {m.workerName}
                                        </p>
                                        {payload.amount ? (
                                            <p>
                                                <strong>Amount:</strong>{" "}
                                                <span className="tabular-nums font-semibold">
                                                    {formatLkr(payload.amount)}
                                                </span>
                                            </p>
                                        ) : null}
                                        {payload.shift_rate ? (
                                            <p>
                                                <strong>Rate/Shifts:</strong>{" "}
                                                <span className="tabular-nums font-semibold">
                                                    {formatLkr(payload.shift_rate)} &times; {payload.shifts}
                                                </span>
                                            </p>
                                        ) : null}
                                        {payload.transaction_date ? (
                                            <p>
                                                <strong>Date:</strong>{" "}
                                                {new Intl.DateTimeFormat("en-GB", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                }).format(new Date(payload.transaction_date))}
                                            </p>
                                        ) : null}
                                        {payload.year && payload.month ? (
                                            <p>
                                                <strong>Month:</strong> {payload.year}-
                                                {payload.month.toString().padStart(2, "0")}
                                            </p>
                                        ) : null}
                                    </div>

                                    {isFailed ? (
                                        <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                                            <p className="font-bold">Failure Reason:</p>
                                            <p className="mt-1">{friendlyError}</p>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="flex flex-col gap-2 shrink-0 lg:items-end lg:w-48">
                                    {isFailed ? (
                                        <button
                                            className="app-focus btn-primary rounded-md px-4 py-2 text-sm font-bold w-full lg:w-auto"
                                            onClick={() => retryPendingMutation(m.operation_id, userId!)}
                                            type="button"
                                        >
                                            Retry Issue
                                        </button>
                                    ) : null}

                                    <button
                                        className="app-focus rounded-md px-4 py-2 text-sm font-bold border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition w-full lg:w-auto"
                                        onClick={() => handleDiscardClick(m)}
                                        type="button"
                                    >
                                        Discard Local Change
                                    </button>
                                </div>
                            </div>

                            <details className="mt-4 appearance-none outline-none group">
                                <summary className="cursor-pointer text-xs font-semibold text-blue-600 hover:underline">
                                    Technical Details
                                </summary>
                                <div className="mt-2 rounded bg-black/5 p-3 text-[0.68rem] tabular-nums leading-relaxed text-[var(--text-secondary)]">
                                    <p><strong>Operation ID:</strong> {m.operation_id}</p>
                                    <p><strong>Entity Type:</strong> {m.entity_type}</p>
                                    <p><strong>Attempt Count:</strong> {m.retry_count}</p>
                                    {m.depends_on_operation_id && (
                                        <p><strong>Depends on ID:</strong> {m.depends_on_operation_id}</p>
                                    )}
                                </div>
                            </details>
                        </div>
                    );
                })}
            </div>

            {selectedForDiscard ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--brand-primary)]/45 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">
                            Discard Local Change?
                        </h3>
                        <p className="mt-2 leading-relaxed text-sm text-[var(--text-secondary)]">
                            This removes the pending{" "}
                            <strong>{selectedForDiscard.uiType}</strong> for{" "}
                            <strong>{selectedForDiscard.workerName}</strong> from this device.
                        </p>
                        <p className="mt-2 leading-relaxed text-sm text-[var(--text-secondary)]">
                            <span className="font-semibold text-amber-700">Warning:</span> We cannot guarantee this mutation was never received by the server. Only discard if you are sure it is safe.
                        </p>

                        {discardWarning ? (
                            <p className="mt-3 rounded-md bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900 border border-amber-300">
                                {discardWarning}
                            </p>
                        ) : null}

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                className="app-focus btn-secondary rounded-md px-4 py-2 text-sm font-bold"
                                onClick={() => {
                                    setSelectedForDiscard(null);
                                    setDiscardWarning(null);
                                }}
                                type="button"
                            >
                                Cancel
                            </button>
                            <button
                                className="app-focus rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                                onClick={confirmDiscard}
                                disabled={!!discardWarning}
                                type="button"
                            >
                                Remove Local Pending Copy
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
