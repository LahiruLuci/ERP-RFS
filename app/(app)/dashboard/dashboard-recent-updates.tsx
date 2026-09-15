import Link from "next/link";

type RecentUpdate = {
  description: string;
  id: string;
  label: string;
  targetRoute?: string;
  timestamp: string;
  type: "payroll_run" | "worker_status_change";
};

type RecentUpdatesProps = {
  updates: RecentUpdate[];
};

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} min ago`;
    }
    return `${diffHours}h ago`;
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function RecentUpdates({ updates }: RecentUpdatesProps) {
  if (updates.length === 0) {
    return (
      <section className="app-surface rounded-lg p-5">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Recent Activity</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          No recent activity to show.
        </p>
      </section>
    );
  }

  return (
    <section className="app-surface rounded-lg p-5">
      <h2 className="text-lg font-bold text-[var(--text-primary)]">Recent Activity</h2>
      <div className="mt-4 flex flex-col gap-2">
        {updates.slice(0, 5).map((update) => (
          <div
            key={`${update.type}-${update.id}`}
            className="flex items-start justify-between gap-3 rounded-md border border-[var(--border)] p-3"
          >
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-bold text-[var(--text-primary)]">{update.label}</span>
              <p className="text-xs text-[var(--text-secondary)]">{update.description}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                {formatTimestamp(update.timestamp)}
              </span>
              {update.targetRoute ? (
                <Link
                  className="app-focus text-[11px] font-semibold text-[var(--brand-primary)] hover:underline"
                  href={update.targetRoute}
                >
                  View
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
