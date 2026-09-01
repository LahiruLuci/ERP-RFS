import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ClientConnectionError,
  ClientDatabaseSetupError,
  getClientDetail,
} from "@/lib/clients/data";
import { formatLkr } from "@/lib/format/currency";
import { OfflineCacheHydrator } from "@/lib/offline/cache-hydrator";

import { createWorkpointAction } from "../actions";
import { CachedClientDetailView } from "../cached-clients-view";
import { AddWorkpointForm } from "../client-forms";

type ClientDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ month?: string; year?: string }>;
};

function readPeriod(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : fallback;
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
        This creates the client fields, workpoint fields, RLS policies, and
        refreshes the Supabase schema cache.
      </p>
      <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm font-semibold text-[var(--text-primary)]">
        supabase/migrations/20260825080000_clients_workpoints_schema.sql
        <br />
        supabase/migrations/20260827090000_workpoint_payroll_entry.sql
      </div>
    </section>
  );
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: ClientDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const now = new Date();
  const year = readPeriod(resolvedSearchParams?.year, now.getFullYear());
  const month = readPeriod(resolvedSearchParams?.month, now.getMonth() + 1);
  const safeYear = year >= 2000 && year <= 2100 ? year : now.getFullYear();
  const safeMonth = month >= 1 && month <= 12 ? month : now.getMonth() + 1;
  let data: Awaited<ReturnType<typeof getClientDetail>> | null = null;

  try {
    data = await getClientDetail(id);
  } catch (error) {
    if (error instanceof ClientConnectionError) {
      return (
        <CachedClientDetailView
          clientId={id}
          month={safeMonth}
          year={safeYear}
        />
      );
    }

    if (error instanceof ClientDatabaseSetupError) {
      return <ClientSetupMessage />;
    }

    throw error;
  }

  if (!data) {
    notFound();
  }

  const action = createWorkpointAction.bind(null, data.client.id);

  return (
    <div className="flex flex-col gap-5">
      <OfflineCacheHydrator
        clients={[{ ...data.client, workpointCount: data.workpoints.length }]}
        workpoints={data.workpoints}
        workpointsClientId={data.client.id}
      />
      <section className="app-surface overflow-hidden rounded-lg">
        <div className="flex flex-col gap-4 border-l-4 border-[var(--brand-accent)] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="brand-kicker">{data.client.client_code}</p>
            <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              {data.client.name}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Workpoints and monthly client-oriented salary entry for this
              client.
            </p>
          </div>
          <Link
            className="app-focus btn-secondary flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-bold transition"
            href={`/payroll/by-client?year=${safeYear}&month=${safeMonth}`}
          >
            Payroll By Client
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="app-surface rounded-lg p-5">
          <p className="brand-kicker">Client Details</p>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-[var(--text-secondary)]">Contact</dt>
              <dd className="font-semibold text-[var(--text-primary)]">
                {data.client.contact_person || "Not entered"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-secondary)]">Phone</dt>
              <dd className="font-semibold text-[var(--text-primary)]">
                {data.client.phone || "Not entered"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-secondary)]">Email</dt>
              <dd className="break-words font-semibold text-[var(--text-primary)]">
                {data.client.email || "Not entered"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-secondary)]">Billing Address</dt>
              <dd className="break-words font-semibold text-[var(--text-primary)]">
                {data.client.billing_address || "Not entered"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="app-surface rounded-lg p-5 lg:col-span-2">
          <details>
            <summary className="cursor-pointer text-sm font-bold text-[var(--brand-primary)]">
              Add Workpoint
            </summary>
            <div className="mt-5">
              <AddWorkpointForm action={action} />
            </div>
          </details>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <p className="brand-kicker">Workpoints</p>
          <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">
            Work Locations
          </h2>
        </div>
        {data.workpoints.length === 0 ? (
          <div className="app-surface rounded-lg p-8 text-center">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              No workpoints yet
            </h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Add a workpoint before entering monthly shifts for this client.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.workpoints.map((workpoint) => (
              <article
                className="app-surface flex flex-col rounded-lg p-5"
                key={workpoint.id}
              >
                <div className="min-w-0">
                  <p className="brand-kicker">{workpoint.status}</p>
                  <h3 className="mt-1 break-words text-lg font-bold text-[var(--text-primary)]">
                    {workpoint.name}
                  </h3>
                  <p className="mt-2 break-words text-sm leading-6 text-[var(--text-secondary)]">
                    {workpoint.address || "Address not entered"}
                  </p>
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
                  <div>
                    <dt className="text-[var(--text-secondary)]">
                      Required Guards
                    </dt>
                    <dd className="font-bold tabular-nums">
                      {workpoint.required_guards}
                    </dd>
                  </div>
                </dl>
                <Link
                  className="app-focus btn-primary mt-5 flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-bold transition"
                  href={`/clients/${data.client.id}/workpoints/${workpoint.id}?year=${safeYear}&month=${safeMonth}`}
                >
                  Enter Work Shifts
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
