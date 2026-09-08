import Link from "next/link";

import { formatLkr } from "@/lib/format/currency";
import { getMonthlyPayrollReport, ReportPermissionError } from "@/lib/reports/data";

type MonthlyPayrollProps = {
    searchParams?: Promise<{
        month?: string;
        q?: string;
        year?: string;
    }>;
};

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function readPeriod(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : fallback;
}

function getPeriod(searchParams: Awaited<MonthlyPayrollProps["searchParams"]>) {
    const now = new Date();
    const year = readPeriod(searchParams?.year, now.getFullYear());
    const month = readPeriod(searchParams?.month, now.getMonth() + 1);

    return {
        month: month >= 1 && month <= 12 ? month : now.getMonth() + 1,
        year: year >= 2000 && year <= 2100 ? year : now.getFullYear(),
    };
}

export default async function MonthlyPayrollReportPage({ searchParams }: MonthlyPayrollProps) {
    const resolvedSearchParams = await searchParams;
    const { month, year } = getPeriod(resolvedSearchParams);
    const search = resolvedSearchParams?.q?.trim() ?? "";

    let data;
    let error: string | null = null;

    try {
        data = await getMonthlyPayrollReport({ month, search, year });
    } catch (loadError) {
        error =
            loadError instanceof ReportPermissionError
                ? "You do not have permission to view payroll reports."
                : "Unable to load the report. Please try again.";
    }

    const rows = data?.rows ?? [];
    const totals = data?.totals;
    const runStatus = data?.run?.status;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Link href="/reports" className="app-focus hover:text-[var(--text-primary)] hover:underline">
                    Reports
                </Link>
                <span>&rsaquo;</span>
                <span className="font-semibold text-[var(--text-primary)]">Monthly Payroll</span>
            </div>

            <section className="app-surface rounded-lg p-3 sm:p-4 mt-2">
                <form className="grid gap-3 md:grid-cols-[1fr_11rem_9rem_auto]">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                            Search Worker
                        </span>
                        <input
                            className="field-control min-h-10 rounded-md px-3 text-sm transition"
                            defaultValue={search}
                            name="q"
                            placeholder="Employee no, name, NIC or ETF no"
                            type="search"
                        />
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                            Month
                        </span>
                        <select
                            className="field-control min-h-10 rounded-md px-3 text-sm transition"
                            defaultValue={month}
                            name="month"
                        >
                            {months.map((monthName, index) => (
                                <option key={monthName} value={index + 1}>
                                    {monthName}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                            Year
                        </span>
                        <input
                            className="field-control min-h-10 rounded-md px-3 text-sm transition"
                            defaultValue={year}
                            max="2100"
                            min="2000"
                            name="year"
                            type="number"
                        />
                    </label>

                    <div className="flex items-end">
                        <button
                            className="app-focus btn-primary min-h-10 w-full rounded-md px-4 text-sm font-bold transition"
                            type="submit"
                        >
                            Generate
                        </button>
                    </div>
                </form>
            </section>

            {error ? (
                <section
                    className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700"
                    role="alert"
                >
                    {error}
                </section>
            ) : totals ? (
                <>
                    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                                Total Workers
                            </p>
                            <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                                {totals.workers}
                            </p>
                            {runStatus ? (
                                <span className={`mt-2 inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-bold border ${runStatus === "approved" ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                                    {runStatus === "approved" ? "Approved Payroll" : "Draft Payroll"}
                                </span>
                            ) : (
                                <span className="mt-2 inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-bold border border-slate-200 bg-slate-50 text-slate-700">
                                    No records
                                </span>
                            )}
                        </div>

                        <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                                Total Shifts
                            </p>
                            <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                                {totals.shifts}
                            </p>
                        </div>

                        <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                                Total Gross
                            </p>
                            <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                                {formatLkr(totals.gross)}
                            </p>
                        </div>

                        <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                                Total Deductions
                            </p>
                            <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                                {formatLkr(totals.deductions)}
                            </p>
                        </div>

                        <div className="app-surface border-l-4 border-[var(--brand-accent)] flex flex-col gap-1 rounded-lg p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                                Total Net Salary
                            </p>
                            <p className="mt-1 text-2xl font-black text-[var(--brand-primary)]">
                                {formatLkr(totals.net)}
                            </p>
                        </div>
                    </section>

                    {rows.length === 0 ? (
                        <section className="app-surface rounded-lg p-8 text-center mt-2">
                            <h2 className="text-lg font-bold text-[var(--text-primary)]">
                                No payroll records found
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                                No payroll data matches the selected month and criteria.
                            </p>
                        </section>
                    ) : (
                        <>
                            <section className="app-surface hidden overflow-hidden rounded-lg lg:block mt-2">
                                <div className="max-h-[calc(100dvh-26rem)] min-h-[22rem] overflow-auto">
                                    <table className="min-w-[70rem] divide-y divide-zinc-200 text-sm">
                                        <thead className="table-head-brand sticky top-0 z-10 text-left text-xs font-bold uppercase tracking-wide">
                                            <tr>
                                                <th className="px-4 py-3">Worker ID</th>
                                                <th className="px-4 py-3">Worker Name</th>
                                                <th className="px-4 py-3">Type</th>
                                                <th className="px-4 py-3 text-right">Shifts</th>
                                                <th className="px-4 py-3 text-right">Gross Salary</th>
                                                <th className="px-4 py-3 text-right">Deductions</th>
                                                <th className="px-4 py-3 text-right">Net Salary</th>
                                                <th className="px-4 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-200">
                                            {rows.map(({ record, shifts, worker }) => (
                                                <tr className="table-row-brand" key={worker.id}>
                                                    <td className="whitespace-nowrap px-4 py-4 font-bold text-[var(--text-primary)]">
                                                        {worker.employee_no}
                                                    </td>
                                                    <td className="px-4 py-4 font-semibold text-[var(--text-primary)]">
                                                        {worker.full_name}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {worker.worker_type === "temporary" ? (
                                                            <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                                                                Temporary
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                                                Permanent
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                                                        {shifts}
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums text-[var(--text-primary)]">
                                                        {formatLkr(record.gross)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums text-[var(--text-secondary)]">
                                                        {formatLkr(record.deductions)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-4 text-right font-bold tabular-nums text-[var(--brand-primary)]">
                                                        {formatLkr(record.net)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-4 text-right">
                                                        <Link
                                                            className="app-focus btn-secondary inline-flex min-h-8 items-center justify-center rounded-md px-3 text-xs font-bold transition"
                                                            href={`/payroll/${worker.id}?year=${year}&month=${month}`}
                                                            target="_blank"
                                                        >
                                                            Details
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <section className="grid gap-4 mt-2 lg:hidden">
                                {rows.map(({ record, shifts, worker }) => (
                                    <article className="app-surface rounded-lg p-5" key={worker.id}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary-soft)]">
                                                    {worker.employee_no}
                                                </p>
                                                <h2 className="mt-1 break-words text-lg font-bold text-[var(--text-primary)]">
                                                    {worker.full_name}
                                                </h2>
                                            </div>
                                            <div className="shrink-0 flex flex-col items-end gap-1">
                                                {worker.worker_type === "temporary" ? (
                                                    <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[0.65rem] font-semibold text-orange-700">
                                                        Temporary
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>

                                        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <dt className="text-[var(--text-secondary)]">Shifts</dt>
                                                <dd className="font-semibold tabular-nums">{shifts}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-[var(--text-secondary)]">Gross</dt>
                                                <dd className="font-semibold tabular-nums">
                                                    {formatLkr(record.gross)}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-[var(--text-secondary)]">Deductions</dt>
                                                <dd className="font-semibold tabular-nums">
                                                    {formatLkr(record.deductions)}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-[var(--text-secondary)]">Net</dt>
                                                <dd className="font-bold tabular-nums text-[var(--brand-primary)]">
                                                    {formatLkr(record.net)}
                                                </dd>
                                            </div>
                                        </dl>

                                        <Link
                                            className="app-focus btn-secondary mt-5 flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-bold transition"
                                            href={`/payroll/${worker.id}?year=${year}&month=${month}`}
                                        >
                                            View Details
                                        </Link>
                                    </article>
                                ))}
                            </section>
                        </>
                    )}
                </>
            ) : null}
        </div>
    );
}
