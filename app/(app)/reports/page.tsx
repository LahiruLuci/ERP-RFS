import Link from "next/link";

const reportsList = [
    {
        title: "Monthly Payroll Summary",
        href: "/reports/monthly-payroll",
        description: "Detailed view of worker salaries, shifts, gross, and net pay for a specific month.",
        status: "active",
    },
    {
        title: "Worker Salary Report",
        href: "/reports/worker-salary",
        description: "View the comprehensive salary history and trends for an individual worker.",
        status: "active",
    },
    {
        title: "Client / Workpoint Cost",
        href: "/reports/client-cost",
        description: "Analyze payroll costs grouped by client and workpoint.",
        status: "active",
    },
    {
        title: "Advances & Deductions",
        href: "/reports/advances-deductions",
        description: "Review deduction transaction totals and worker-level breakdowns.",
        status: "active",
    },
];

export default function ReportsLandingPage() {
    return (
        <div className="flex flex-col gap-6 pt-4">
            <section className="app-surface overflow-hidden rounded-lg">
                <div className="flex flex-col gap-4 border-l-4 border-[var(--brand-accent)] p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="brand-kicker">Analytics</p>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                            Reports
                        </h1>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                            View and analyze financial summaries, worker statistics, and corporate payroll data.
                        </p>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {reportsList.map((report) => (
                    <div
                        key={report.title}
                        className="app-surface relative flex flex-col items-start gap-4 rounded-lg p-5 transition hover:shadow-md"
                    >
                        <div className="flex w-full items-start justify-between gap-3">
                            <h2 className="text-lg font-bold text-[var(--text-primary)]">
                                {report.title}
                            </h2>
                            {report.status === "coming-soon" && (
                                <span className="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[0.65rem] font-bold tracking-wide text-blue-700">
                                    SOON
                                </span>
                            )}
                        </div>
                        <p className="min-h-12 text-sm leading-relaxed text-[var(--text-secondary)]">
                            {report.description}
                        </p>

                        {report.status === "active" ? (
                            <Link
                                href={report.href}
                                className="app-focus btn-primary mt-auto flex min-h-10 w-full items-center justify-center rounded-md px-4 text-sm font-bold transition before:absolute before:inset-0"
                            >
                                View Report
                            </Link>
                        ) : (
                            <button
                                className="mt-auto flex min-h-10 w-full cursor-not-allowed items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-400"
                                disabled
                                type="button"
                            >
                                Not Available
                            </button>
                        )}
                    </div>
                ))}
            </section>
        </div>
    );
}
