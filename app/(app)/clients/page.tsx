import Link from "next/link";

import {
  ClientConnectionError,
  ClientDatabaseSetupError,
  getClients,
} from "@/lib/clients/data";
import { OfflineCacheHydrator } from "@/lib/offline/cache-hydrator";
import { clientStatusLabels, type ClientStatus } from "@/lib/clients/types";

import { createClientAction } from "./actions";
import { AddClientForm } from "./client-forms";
import { CachedClientsView } from "./cached-clients-view";

type ClientsPageProps = {
  searchParams?: Promise<{ q?: string }>;
};

function StatusBadge({ status }: { status: ClientStatus }) {
  const className =
    status === "active"
      ? "border-green-200 bg-green-50 text-green-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}
    >
      {clientStatusLabels[status]}
    </span>
  );
}

function ClientSetupMessage() {
  return (
    <section className="app-surface rounded-lg p-6">
      <p className="brand-kicker">Database Setup</p>
      <h1 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
        Client setup is not complete
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
        Run the client/workpoint Supabase migrations, then refresh this page.
        This is required before Clients and Workpoints can load.
      </p>
      <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm font-semibold text-[var(--text-primary)]">
        supabase/migrations/20260825080000_clients_workpoints_schema.sql
        <br />
        supabase/migrations/20260827090000_workpoint_payroll_entry.sql
      </div>
    </section>
  );
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const resolvedSearchParams = await searchParams;
  const search = resolvedSearchParams?.q?.trim() ?? "";
  let clients: Awaited<ReturnType<typeof getClients>> = [];

  try {
    clients = await getClients(search);
  } catch (error) {
    if (error instanceof ClientConnectionError) {
      return <CachedClientsView search={search} />;
    }

    if (error instanceof ClientDatabaseSetupError) {
      return <ClientSetupMessage />;
    }

    throw error;
  }

  return (
    <div className="flex flex-col gap-5 pt-4">
      {!search ? <OfflineCacheHydrator clients={clients} /> : null}
      <section className="app-surface overflow-hidden rounded-lg">
        <div className="flex flex-col gap-4 border-l-4 border-[var(--brand-accent)] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="brand-kicker">Clients</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              Clients & Workpoints
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Manage Royal Force client locations before entering monthly
              workpoint payroll shifts.
            </p>
          </div>
          <Link
            className="app-focus btn-secondary flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-bold transition"
            href="/payroll/by-client"
          >
            Payroll By Client
          </Link>
        </div>
      </section>

      <section className="app-surface rounded-lg p-4 sm:p-5">
        <details>
          <summary className="cursor-pointer text-sm font-bold text-[var(--brand-primary)]">
            Add Client
          </summary>
          <div className="mt-5">
            <AddClientForm action={createClientAction} />
          </div>
        </details>
      </section>

      <section className="app-surface rounded-lg p-3 sm:p-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
              Search Clients
            </span>
            <input
              className="field-control min-h-10 rounded-md px-3 text-sm transition"
              defaultValue={search}
              name="q"
              placeholder="Search by client name, code or contact person"
              type="search"
            />
          </label>
          <div className="flex items-end">
            <button
              className="app-focus btn-primary min-h-10 w-full rounded-md px-4 text-sm font-bold transition"
              type="submit"
            >
              Search
            </button>
          </div>
        </form>
      </section>

      {clients.length === 0 ? (
        <section className="app-surface rounded-lg p-8 text-center">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {search ? "No clients found" : "No clients yet"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            {search
              ? "Try another client name, code, or contact person."
              : "Add your first client to start organizing workpoints."}
          </p>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <article
              className="app-surface flex min-w-0 flex-col rounded-lg p-5"
              key={client.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="brand-kicker">{client.client_code}</p>
                  <h2 className="mt-1 break-words text-xl font-bold text-[var(--text-primary)]">
                    {client.name}
                  </h2>
                </div>
                <StatusBadge status={client.status} />
              </div>
              <dl className="mt-4 grid gap-3 text-sm text-[var(--text-secondary)]">
                <div>
                  <dt className="font-medium">Workpoints</dt>
                  <dd className="mt-1 font-bold text-[var(--text-primary)]">
                    {client.workpointCount}
                  </dd>
                </div>
                {client.contact_person ? (
                  <div>
                    <dt className="font-medium">Primary Contact</dt>
                    <dd className="mt-1 break-words font-semibold text-[var(--text-primary)]">
                      {client.contact_person}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <Link
                className="app-focus btn-primary mt-5 flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-bold transition"
                href={`/clients/${client.id}`}
              >
                View Client
              </Link>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
