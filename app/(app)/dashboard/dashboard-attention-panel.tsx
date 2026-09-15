import Link from "next/link";

type AttentionAlert = {
  count?: number;
  description: string;
  severity: "info" | "warning" | "error";
  targetRoute?: string;
  title: string;
  type: string;
};

type AttentionPanelProps = {
  alerts: AttentionAlert[];
};

const severityConfig = {
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "!",
    label: "Critical",
    text: "text-red-800",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "i",
    label: "Information",
    text: "text-blue-800",
  },
  warning: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    icon: "▲",
    label: "Attention",
    text: "text-yellow-800",
  },
} as const;

const severityOrder = { error: 0, warning: 1, info: 2 } as const;

export function AttentionPanel({ alerts }: AttentionPanelProps) {
  const sortedAlerts = [...alerts]
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 5);

  if (sortedAlerts.length === 0) {
    return (
      <section className="app-surface rounded-lg p-5">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Needs Attention</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Everything looks up to date.
        </p>
      </section>
    );
  }

  return (
    <section className="app-surface rounded-lg p-5">
      <h2 className="text-lg font-bold text-[var(--text-primary)]">Needs Attention</h2>
      <div className="mt-4 flex flex-col gap-2">
        {sortedAlerts.map((alert) => {
          const config = severityConfig[alert.severity];

          return (
            <div
              key={alert.type}
              className={`rounded-md border p-3 text-sm ${config.border} ${config.bg} ${config.text}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold opacity-70">{config.label}</span>
                    <p className="font-bold">{alert.title}</p>
                  </div>
                  <p className="mt-0.5 text-xs opacity-90">{alert.description}</p>
                </div>
                {alert.count !== undefined ? (
                  <span className="text-xs font-bold opacity-70">{alert.count}</span>
                ) : null}
              </div>
              {alert.targetRoute ? (
                <Link
                  className="app-focus mt-2 inline-flex min-h-7 items-center rounded-md border border-current bg-white/60 px-2.5 text-xs font-bold transition hover:bg-white"
                  href={alert.targetRoute}
                >
                  View Details
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
