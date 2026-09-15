type WorkerSummaryProps = {
  workforce: {
    activePermanentWorkers: number;
    inactivePermanentWorkers: number;
    periodRelevantPermanentWorkers: number;
    resignedThisMonth: number;
    terminatedThisMonth: number;
    temporaryWorkersUsed: number;
    totalPermanentWorkers: number;
    unauthorized: boolean;
  };
};

function MetricRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center justify-between rounded-md px-3 py-2">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${color ?? "text-[var(--text-primary)]"}`}>{value}</span>
    </div>
  );
}

export function WorkerSummary({ workforce }: WorkerSummaryProps) {
  if (workforce.unauthorized) {
    return (
      <section className="app-surface rounded-lg border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-bold text-slate-500">Worker Summary</h2>
        <p className="mt-2 text-sm text-slate-500">
          Your role does not have access to workforce data.
        </p>
      </section>
    );
  }

  return (
    <section className="app-surface rounded-lg p-5">
      <h2 className="text-lg font-bold text-[var(--text-primary)]">Worker Summary</h2>
      <div className="mt-4 rounded-md border border-[var(--border)]">
        <MetricRow label="Active" value={workforce.activePermanentWorkers} color="text-green-700" />
        <div className="border-t border-[var(--border)]" />
        <MetricRow label="Inactive" value={workforce.inactivePermanentWorkers} color="text-slate-500" />
        <div className="border-t border-[var(--border)]" />
        <MetricRow label="Resigned This Month" value={workforce.resignedThisMonth} color="text-orange-700" />
        <div className="border-t border-[var(--border)]" />
        <MetricRow label="Terminated This Month" value={workforce.terminatedThisMonth} color="text-red-700" />
        <div className="border-t border-[var(--border)]" />
        <MetricRow label="Temporary This Month" value={workforce.temporaryWorkersUsed} color="text-blue-700" />
      </div>
    </section>
  );
}
