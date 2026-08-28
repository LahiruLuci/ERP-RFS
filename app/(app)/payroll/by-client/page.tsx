import Link from "next/link";

import { getPayrollByClientData } from "@/lib/clients/data";
import { getPayrollPeriod } from "@/lib/payroll/data";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type PayrollByClientPageProps = {
  searchParams?: Promise<{ month?: string; q?: string; year?: string }>;
};

function readPeriod(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : fallback;
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export default async function PayrollByClientPage({ searchParams }: PayrollByClientPageProps) {
  const resolvedSearchParams = await searchParams;
  const now = new Date();
  const year = readPeriod(resolvedSearchParams?.year, now.getFullYear());
  const month = readPeriod(resolvedSearchParams?.month, now.getMonth() + 1);
  const safeYear = year >= 2000 && year <= 2100 ? year : now.getFullYear();
  const safeMonth = month >= 1 && month <= 12 ? month : now.getMonth() + 1;
  const search = resolvedSearchParams?.q?.trim() ?? "";
  const payrollPeriod = getPayrollPeriod(safeYear, safeMonth);
  const data = await getPayrollByClientData({ month: safeMonth, search, year: safeYear });

  return (
    <div className="flex flex-col gap-5">
      <section className="app-surface overflow-hidden rounded-lg">
        <div className="flex flex-col gap-4 border-l-4 border-[var(--brand-accent)] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="brand-kicker">Payroll By Client</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">Client Work Entry</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Select a client and workpoint to enter monthly worker shifts. Final salary remains one payroll record per worker.
            </p>
            <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
              Payroll Period: {formatDisplayDate(payrollPeriod.periodStart)} - {formatDisplayDate(payrollPeriod.periodEnd)}
            </p>
          </div>
          <Link className="app-focus btn-secondary flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-bold transition" href={`/payroll?year=${safeYear}&month=${safeMonth}`}>
            Final Payroll Summary
          </Link>
        </div>
      </section>

      <section className="app-surface rounded-lg p-3 sm:p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_11rem_9rem_auto]">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">Search Client</span>
            <input className="field-control min-h-10 rounded-md px-3 text-sm transition" defaultValue={search} name="q" placeholder="Search by client name, code or contact" type="search" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">Month</span>
            <select className="field-control min-h-10 rounded-md px-3 text-sm transition" defaultValue={safeMonth} name="month">
              {months.map((monthName, index) => <option key={monthName} value={index + 1}>{monthName}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">Year</span>
            <input className="field-control min-h-10 rounded-md px-3 text-sm transition" defaultValue={safeYear} max="2100" min="2000" name="year" type="number" />
          </label>
          <div className="flex items-end">
            <button className="app-focus btn-primary min-h-10 w-full rounded-md px-4 text-sm font-bold transition" type="submit">Load</button>
          </div>
        </form>
      </section>

      {data.clients.length === 0 ? (
        <section className="app-surface rounded-lg p-8 text-center">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">No clients found</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Try another client name, code, or contact person.</p>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.clients.map((client) => (
            <article className="app-surface flex flex-col rounded-lg p-5" key={client.id}>
              <p className="brand-kicker">{client.client_code}</p>
              <h2 className="mt-1 break-words text-xl font-bold text-[var(--text-primary)]">{client.name}</h2>
              <dl className="mt-4 grid gap-3 text-sm">
                <div><dt className="text-[var(--text-secondary)]">Workpoints</dt><dd className="font-bold text-[var(--text-primary)]">{client.workpointCount}</dd></div>
                {client.contact_person ? <div><dt className="text-[var(--text-secondary)]">Contact</dt><dd className="font-semibold text-[var(--text-primary)]">{client.contact_person}</dd></div> : null}
              </dl>
              <Link className="app-focus btn-primary mt-5 flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-bold transition" href={`/clients/${client.id}?year=${safeYear}&month=${safeMonth}`}>
                Select Client
              </Link>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}