export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="app-surface rounded-lg border-l-4 border-l-[var(--brand-accent)] p-6 sm:p-8">
        <p className="brand-kicker">
          Dashboard
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
          Dashboard
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--text-secondary)]">
          Welcome to your internal management workspace. This area is ready for
          operational summaries once real workforce and payroll data is
          connected.
        </p>
      </section>

      <section className="app-surface rounded-lg border-dashed p-6 sm:p-8">
        <div className="max-w-2xl">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            Dashboard foundation
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            No dashboard metrics are shown yet. Future cards and summaries will
            appear here after the relevant modules and real data are connected.
          </p>
        </div>
      </section>
    </div>
  );
}
