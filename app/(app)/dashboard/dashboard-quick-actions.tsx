import Link from "next/link";

type QuickAction = {
  href: string;
  label: string;
};

type QuickActionsProps = {
  actions: QuickAction[];
};

function UserPlusIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 8v6M22 11h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12v5a2 2 0 0 0 2 2h16v-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 12a2 2 0 0 1 0 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M4 4h16v16H4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 10h16" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 10v10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 21h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 21V7l7-4 7 4v14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 21v-4h6v4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 9h.01M9 13h.01M15 9h.01M15 13h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const iconMap = {
  "/advances-deductions": <ReceiptIcon />,
  "/clients": <BuildingIcon />,
  "/payroll": <WalletIcon />,
  "/workers/new": <UserPlusIcon />,
};

export function QuickActions({ actions }: QuickActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <section className="app-surface rounded-lg p-5">
      <h2 className="text-lg font-bold text-[var(--text-primary)]">Quick Actions</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            className="app-focus group flex items-start gap-3 rounded-md border border-[var(--border)] bg-white p-3 transition hover:border-[var(--brand-primary)]"
            href={action.href}
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)] transition group-hover:border-[var(--brand-accent)] group-hover:text-[var(--brand-primary)]">
              {iconMap[action.href as keyof typeof iconMap] ?? null}
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)]">{action.label}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
