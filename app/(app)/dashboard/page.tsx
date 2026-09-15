import { getDashboardData } from "@/lib/dashboard/data";

import { AttentionPanel } from "./dashboard-attention-panel";
import { ClientActivity } from "./dashboard-client-activity";
import { DashboardHeader } from "./dashboard-header";
import { PayrollOverview } from "./dashboard-payroll-overview";
import { PayrollTrend } from "./dashboard-payroll-trend";
import { QuickActions } from "./dashboard-quick-actions";
import { RecentUpdates } from "./dashboard-recent-updates";
import { WorkerSummary } from "./dashboard-worker-summary";

type DashboardPageProps = {
  searchParams?: Promise<{ month?: string; year?: string }>;
};

function readPeriod(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : fallback;
}

function isCurrentPeriod(year: number, month: number) {
  const now = new Date();
  return year === now.getFullYear() && month === now.getMonth() + 1;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = await searchParams;
  const now = new Date();
  const year = readPeriod(resolvedSearchParams?.year, now.getFullYear());
  const month = readPeriod(resolvedSearchParams?.month, now.getMonth() + 1);

  const { data, errors } = await getDashboardData({ month, year });

  const current = isCurrentPeriod(year, month);
  const activeWorkersLabel = current ? "Active Workers" : "Workers in This Period";
  const activeWorkersValue = current
    ? data.workforce.activePermanentWorkers
    : data.workforce.periodRelevantPermanentWorkers;
  const activeWorkersSupport = current
    ? `${data.workforce.inactivePermanentWorkers} inactive`
    : `${data.workforce.totalPermanentWorkers} total`;

  const payrollStatusLabel = data.payroll.exists
    ? data.payroll.status === "approved"
      ? "Approved"
      : "Draft"
    : "Payroll Not Started";

  const quickActions = [
    { href: "/workers/new", label: "Add Worker" },
    { href: "/payroll", label: "Open Payroll" },
    { href: "/advances-deductions", label: "Add Advance / Deduction" },
    { href: "/clients", label: "Clients" },
  ];

  return (
    <div className="flex flex-col gap-5 pt-4">
      <DashboardHeader month={month} year={year} />

      {errors.length > 0 ? (
        <section className="app-surface rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700" role="alert">
          <p className="font-bold">Some dashboard sections failed to load</p>
          <ul className="mt-2 list-inside list-disc">
            {errors.map((error, index) => (
              <li key={index}>{error.section}: {error.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">{activeWorkersLabel}</p>
          <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">{activeWorkersValue}</p>
          <p className="text-xs text-[var(--text-secondary)]">{activeWorkersSupport}</p>
        </div>
        <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Active Clients</p>
          <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">{data.clientsWorkpoints.activeClients}</p>
          <p className="text-xs text-[var(--text-secondary)]">{data.clientsWorkpoints.totalClients} total clients</p>
        </div>
        <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Active Workplaces</p>
          <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">{data.clientsWorkpoints.activeWorkpoints}</p>
          <p className="text-xs text-[var(--text-secondary)]">{data.clientsWorkpoints.totalWorkpoints} configured</p>
        </div>
        <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">Payroll Status</p>
          <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">{payrollStatusLabel}</p>
          <p className="text-xs text-[var(--text-secondary)]">{data.payroll.workerCount} workers</p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PayrollOverview payroll={data.payroll} month={month} year={year} />
        </div>
        <div className="lg:col-span-2">
          <AttentionPanel alerts={data.alerts} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <WorkerSummary workforce={data.workforce} />
        <QuickActions actions={quickActions} />
      </div>

      <ClientActivity clientsWorkpoints={data.clientsWorkpoints} topClients={data.topClients} month={month} year={year} />

      <div className="grid gap-5 lg:grid-cols-2">
        <PayrollTrend month={month} trend={data.trend} year={year} />
        <RecentUpdates updates={data.recentUpdates} />
      </div>
    </div>
  );
}
