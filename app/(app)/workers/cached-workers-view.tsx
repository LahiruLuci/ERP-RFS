"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { readCachedWorkers } from "@/lib/offline/cache";
import type { CachedWorker } from "@/lib/offline/types";

import { WorkerStatusBadge, WorkerTypeBadge } from "./worker-status-badge";

export function CachedWorkersView({ search }: { search: string }) {
  const [workers, setWorkers] = useState<CachedWorker[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadWorkers() {
      try {
        const cachedWorkers = await readCachedWorkers(search);

        if (isMounted) {
          setWorkers(cachedWorkers);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadWorkers();

    return () => {
      isMounted = false;
    };
  }, [search]);

  return (
    <section className="app-surface rounded-lg p-5">
      <p className="brand-kicker">Offline Cache</p>
      <h2 className="mt-2 text-xl font-bold text-[var(--text-primary)]">
        Cached Workers
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        Supabase is not reachable, so this page is showing previously cached
        worker reference data. Saving changes offline is not available yet.
      </p>

      {isLoading ? (
        <p className="mt-5 text-sm font-semibold text-[var(--text-secondary)]">
          Loading cached workers...
        </p>
      ) : workers.length === 0 ? (
        <p className="mt-5 text-sm font-semibold text-[var(--text-secondary)]">
          No cached workers found on this device.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {workers.map((worker) => (
            <article
              className="rounded-lg border border-[var(--border)] bg-white p-4"
              key={worker.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="brand-kicker">{worker.employee_no}</p>
                  <h3 className="mt-1 break-words text-base font-bold text-[var(--text-primary)]">
                    {worker.full_name}
                  </h3>
                </div>
                <WorkerTypeBadge type={worker.worker_type} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <WorkerStatusBadge status={worker.status} />
                {worker.local_only ? (
                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                    {worker.sync_status === "failed"
                      ? "Needs Attention"
                      : worker.sync_status === "syncing"
                        ? "Syncing"
                        : "Pending Sync"}
                  </span>
                ) : null}
              </div>
              <dl className="mt-4 grid gap-2 text-sm">
                <div>
                  <dt className="text-[var(--text-secondary)]">NIC</dt>
                  <dd className="font-semibold text-[var(--text-primary)]">
                    {worker.nic || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-secondary)]">Phone</dt>
                  <dd className="font-semibold text-[var(--text-primary)]">
                    {worker.phone || "-"}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}

      <Link
        className="app-focus btn-secondary mt-5 inline-flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-bold transition"
        href="/workers"
      >
        Try Online Reload
      </Link>
    </section>
  );
}
