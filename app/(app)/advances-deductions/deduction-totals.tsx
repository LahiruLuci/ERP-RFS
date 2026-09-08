"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

import { formatLkr } from "@/lib/format/currency";
import { useOnlineStatus } from "@/lib/connection/online-status";
import { offlineQueueChangedEvent } from "@/lib/offline/work-entry-outbox";
import { getOfflineRecords } from "@/lib/offline/database";
import type { CachedWorkerDeduction } from "@/lib/offline/types";
import type { WorkerDeductionSummary } from "@/lib/deductions/types";

export function DeductionTotals({
    month,
    serverSummary,
    workerId,
    year,
}: {
    month: number;
    serverSummary: WorkerDeductionSummary;
    workerId: string;
    year: number;
}) {
    const router = useRouter();
    const { userId } = useOnlineStatus();
    const [offlineAdvances, setOfflineAdvances] = useState(0);
    const [offlineMeals, setOfflineMeals] = useState(0);
    const [offlineUniform, setOfflineUniform] = useState(0);
    const [offlineOther, setOfflineOther] = useState(0);
    const [offlineTotal, setOfflineTotal] = useState(0);
    const offlineTotalRef = useRef(0);

    useEffect(() => {
        let isMounted = true;

        async function loadTotals() {
            if (!userId) return;

            const cachedDeductions = await getOfflineRecords<CachedWorkerDeduction>("workerDeductions");

            if (isMounted) {
                const pending = cachedDeductions.filter(
                    (d) =>
                        d.local_only &&
                        d.user_id === userId &&
                        d.month === month &&
                        d.year === year &&
                        d.worker_id === workerId &&
                        (d.sync_status === "pending" || d.sync_status === "syncing" || d.sync_status === "failed")
                );

                let adv = 0;
                let mls = 0;
                let uni = 0;
                let oth = 0;
                let tot = 0;

                for (const d of pending) {
                    const amt = Number(d.amount);
                    if (!Number.isFinite(amt)) continue;

                    tot += amt;
                    if (d.type === "advance") adv += amt;
                    if (d.type === "meals") mls += amt;
                    if (d.type === "uniform") uni += amt;
                    if (d.type === "other") oth += amt;
                }

                const oldPendingTotal = offlineTotalRef.current;
                offlineTotalRef.current = tot;

                setOfflineAdvances(adv);
                setOfflineMeals(mls);
                setOfflineUniform(uni);
                setOfflineOther(oth);
                setOfflineTotal(tot);

                // If the total pending amount DECREASED, it means something synced or was cancelled.
                // We tell React Server Components to refresh the canonical server data!
                if (tot < oldPendingTotal) {
                    router.refresh();
                }
            }
        }

        void loadTotals();

        function handleQueueChanged() {
            void loadTotals();
        }

        window.addEventListener(offlineQueueChangedEvent, handleQueueChanged);

        return () => {
            isMounted = false;
            window.removeEventListener(offlineQueueChangedEvent, handleQueueChanged);
        };
    }, [month, userId, workerId, year, router]);

    return (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
                ["Advances", serverSummary.advance, offlineAdvances],
                ["Meals", serverSummary.meals, offlineMeals],
                ["Uniform", serverSummary.uniform, offlineUniform],
                ["Other", serverSummary.other, offlineOther],
                ["Total Deductions", serverSummary.total, offlineTotal],
            ].map(([label, serverValue, offlineValue]) => {
                const title = String(label);
                const serverNum = Number(serverValue);
                const offlineNum = Number(offlineValue);
                const totalNum = serverNum + offlineNum;

                return (
                    <div className="app-surface rounded-lg p-4" key={title}>
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                            {title}
                        </p>
                        <p className="mt-2 text-xl font-black tabular-nums text-[var(--text-primary)]">
                            {formatLkr(totalNum)}
                        </p>
                        {offlineNum > 0 ? (
                            <p className="mt-1 text-xs font-semibold text-amber-600">
                                {formatLkr(offlineNum)} pending
                            </p>
                        ) : null}
                    </div>
                );
            })}
        </section>
    );
}
