import Link from "next/link";

import { formatLkr } from "@/lib/format/currency";

type ClientActivityProps = {
  clientsWorkpoints: {
    activeClients: number;
    totalClients: number;
    totalWorkpoints: number;
    activeWorkpoints: number;
    workpointsUsed: number;
    workpointsWithZeroActivity: number;
    unauthorized: boolean;
  };
  month: number;
  topClients: Array<{
    clientCode: string;
    clientId: string;
    clientName: string;
    contribution: number;
    shifts: number;
    uniqueWorkers: number;
    workpointsUsed: number;
  }>;
  year: number;
};

export function ClientActivity({ clientsWorkpoints, topClients, month, year }: ClientActivityProps) {
  if (clientsWorkpoints.unauthorized) {
    return (
      <section className="app-surface rounded-lg border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-bold text-slate-500">Client & Workplace Activity</h2>
        <p className="mt-2 text-sm text-slate-500">
          Your role does not have access to client data.
        </p>
      </section>
    );
  }

  const displayClients = topClients.slice(0, 5);
  const isEmpty = displayClients.length === 0;

  return (
    <section className="app-surface rounded-lg p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Client & Workplace Activity</h2>
        <Link
          className="app-focus text-xs font-semibold text-[var(--brand-primary)] hover:underline"
          href={`/payroll/by-client?year=${year}&month=${month}`}
        >
          View Payroll by Client
        </Link>
      </div>

      {!isEmpty ? (
        <div className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="pb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Client</th>
                  <th className="pb-2 text-right text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Workers</th>
                  <th className="pb-2 text-right text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Shifts</th>
                  <th className="pb-2 text-right text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Labour Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {displayClients.map((client) => (
                  <tr key={client.clientId}>
                    <td className="py-2.5">
                      <p className="font-bold text-[var(--text-primary)]">{client.clientName}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{client.clientCode}</p>
                    </td>
                    <td className="py-2.5 text-right font-bold tabular-nums text-[var(--text-primary)]">{client.uniqueWorkers}</td>
                    <td className="py-2.5 text-right font-bold tabular-nums text-[var(--text-primary)]">{client.shifts}</td>
                    <td className="py-2.5 text-right font-bold tabular-nums text-[var(--brand-primary)]">{formatLkr(client.contribution)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 text-center">
          <p className="text-sm font-semibold text-[var(--text-secondary)]">
            No client payroll activity recorded for {new Date(year, month - 1).toLocaleString('default', { month: 'long' })} {year}.
          </p>
        </div>
      )}
    </section>
  );
}
