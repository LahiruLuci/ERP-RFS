"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { formatLkr } from "@/lib/format/currency";
import {
  readCachedClients,
  readCachedWorkpoints,
} from "@/lib/offline/cache";
import type { CachedClient, CachedWorkpoint } from "@/lib/offline/types";

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "active"
      ? "border-green-200 bg-green-50 text-green-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}>
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );
}

export function CachedClientsView({ search }: { search: string }) {
  const [clients, setClients] = useState<CachedClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadClients() {
      try {
        const cachedClients = await readCachedClients(search);

        if (isMounted) {
          setClients(cachedClients);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadClients();

    return () => {
      isMounted = false;
    };
  }, [search]);

  return (
    <section className="app-surface rounded-lg p-5">
      <p className="brand-kicker">Offline Cache</p>
      <h2 className="mt-2 text-xl font-bold text-[var(--text-primary)]">
        Cached Clients
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        Supabase is not reachable, so this page is showing previously cached
        client reference data. Offline saving is not available yet.
      </p>

      {isLoading ? (
        <p className="mt-5 text-sm font-semibold text-[var(--text-secondary)]">
          Loading cached clients...
        </p>
      ) : clients.length === 0 ? (
        <p className="mt-5 text-sm font-semibold text-[var(--text-secondary)]">
          No cached clients found on this device.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <article className="rounded-lg border border-[var(--border)] bg-white p-4" key={client.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="brand-kicker">{client.client_code}</p>
                  <h3 className="mt-1 break-words text-base font-bold text-[var(--text-primary)]">
                    {client.name}
                  </h3>
                </div>
                <StatusBadge status={client.status} />
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                Workpoints: {client.workpointCount ?? 0}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function CachedClientDetailView({
  clientId,
  month,
  year,
}: {
  clientId: string;
  month: number;
  year: number;
}) {
  const [client, setClient] = useState<CachedClient | null>(null);
  const [workpoints, setWorkpoints] = useState<CachedWorkpoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadClientDetail() {
      try {
        const [cachedClients, cachedWorkpoints] = await Promise.all([
          readCachedClients(),
          readCachedWorkpoints(clientId),
        ]);

        if (isMounted) {
          setClient(cachedClients.find((item) => item.id === clientId) ?? null);
          setWorkpoints(cachedWorkpoints);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadClientDetail();

    return () => {
      isMounted = false;
    };
  }, [clientId]);

  return (
    <section className="app-surface rounded-lg p-5">
      <p className="brand-kicker">Offline Cache</p>
      <h2 className="mt-2 text-xl font-bold text-[var(--text-primary)]">
        {client?.name ?? "Cached Client"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        Supabase is not reachable. Previously cached workpoint reference data is
        available for viewing only.
      </p>

      {isLoading ? (
        <p className="mt-5 text-sm font-semibold text-[var(--text-secondary)]">
          Loading cached workpoints...
        </p>
      ) : workpoints.length === 0 ? (
        <p className="mt-5 text-sm font-semibold text-[var(--text-secondary)]">
          No cached workpoints found for this client on this device.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workpoints.map((workpoint) => (
            <article className="rounded-lg border border-[var(--border)] bg-white p-4" key={workpoint.id}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="break-words text-base font-bold text-[var(--text-primary)]">
                  {workpoint.name}
                </h3>
                <StatusBadge status={workpoint.status} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-[var(--text-secondary)]">Day Rate</dt>
                  <dd className="font-bold tabular-nums">
                    {formatLkr(workpoint.default_day_rate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-secondary)]">Night Rate</dt>
                  <dd className="font-bold tabular-nums">
                    {formatLkr(workpoint.default_night_rate)}
                  </dd>
                </div>
              </dl>
              <Link
                className="app-focus btn-secondary mt-5 flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-bold transition"
                href={`/clients/${clientId}/workpoints/${workpoint.id}?year=${year}&month=${month}`}
              >
                View Workpoint
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
