import Link from "next/link";

import { formatLkr } from "@/lib/format/currency";
import {
    getWorkerSalaryReport,
    getWorkerSalaryReportWorkers,
    ReportPermissionError,
} from "@/lib/reports/data";

type WorkerSalaryProps = {
    searchParams?: Promise<{
        month?: string;
        q?: string;
        workerId?: string;
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

function getPeriod(searchParams: Awaited<WorkerSalaryProps["searchParams"]>) {
    const now = new Date();
    const year = readPeriod(searchParams?.year, now.getFullYear());
    const month = readPeriod(searchParams?.month, now.getMonth() + 1);

    return {
        month: month >= 1 && month <= 12 ? month : now.getMonth() + 1,
        year: year >= 2000 && year <= 2100 ? year : now.getFullYear(),
    };
}

export default async function WorkerSalaryReportPage({
    searchParams,
}: WorkerSalaryProps) {
    const resolvedSearchParams = await searchParams;
    const { month, year } = getPeriod(resolvedSearchParams);
    const search = resolvedSearchParams?.q?.trim() ?? "";
    const workerId = resolvedSearchParams?.workerId ?? "";

    let error: string | null = null;
    let workerOptions: Awaited<ReturnType<typeof getWorkerSalaryReportWorkers>> = [];
    let reportData: Awaited<ReturnType<typeof getWorkerSalaryReport>> | undefined;

    try {
        if (workerId) {
            reportData = await getWorkerSalaryReport({
                workerId,
                startMonth: month,
                startYear: year,
                endMonth: month,
                endYear: year,
            });
        } else {
            workerOptions = await getWorkerSalaryReportWorkers({
                month,
                search,
                year,
            });
        }
    } catch (loadError) {
        error =
            loadError instanceof ReportPermissionError
                ? "You do not have permission to view payroll reports."
                : "Unable to load the report. Please try again.";
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Link
                    className="app-focus hover:text-[var(--text-primary)] hover:underline"
                    href="/reports"
                >
                    Reports
                </Link>
                <span>&rsaquo;</span>
                <span className="font-semibold text-[var(--text-primary)]">
                    Worker Salary Report
                </span>
            </div>

            <section className="app-surface mt-2 rounded-lg p-3 sm:p-4">
        <div className="flex flex-col gap-4 pt-4">
                    <form className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                                Search Worker
                            </span>
                            <div className="flex gap-2">
                                <input
                                    className="field-control min-h-10 flex-1 rounded-md px-3 text-sm transition"
                                    defaultValue={search}
                                    name="q"
                                    placeholder="Employee no, name, NIC or ETF no"
                                    type="search"
                                />
                                <input name="month" type="hidden" value={month} />
                                <input name="year" type="hidden" value={year} />
                                <button
                                    className="app-focus btn-primary min-h-10 rounded-md px-4 text-sm font-bold transition"
                                    type="submit"
                                >
                                    Search
                                </button>
                            </div>
                        </label>
                    </form>

                    <hr className="mb-0 mt-1 border-t border-slate-100" />

                    <form className="grid gap-3 md:grid-cols-[11rem_9rem_auto]">
                        <input name="q" type="hidden" value={search} />
                        {workerId ? (
                            <input name="workerId" type="hidden" value={workerId} />
                        ) : null}

                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
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
                            <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
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
                                className="app-focus btn-secondary min-h-10 w-full rounded-md px-4 text-sm font-bold transition"
                                type="submit"
                            >
                                Apply Filter
                            </button>
                        </div>
                    </form>
                </div>
            </section>

            {error ? (
                <section
                    className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700"
                    role="alert"
                >
                    {error}
                </section>
            ) : !workerId ? (
                <section className="app-surface rounded-lg p-5">
                    <h2 className="mb-1 text-lg font-bold text-[var(--text-primary)]">
                        Select a Worker
                    </h2>
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">
                        Workers shown here are relevant to {months[month - 1]} {year}.
                    </p>

                    {workerOptions.length === 0 ? (
                        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
                            <h3 className="text-base font-bold text-[var(--text-primary)]">
                                No workers found
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                                {search
                                    ? `No worker matched the search "${search}" for this payroll month.`
                                    : "No relevant workers were found for the selected payroll month."}
                            </p>
                        </div>
                    ) : (
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                            {workerOptions.map((worker) => (
                                <Link
                                    className="group rounded-lg border border-slate-200 p-4 transition hover:border-[var(--brand-accent)] hover:shadow-sm"
                                    href={`?workerId=${worker.id}&month=${month}&year=${year}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
                                    key={worker.id}
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold uppercase text-[var(--brand-primary)]">
                                                {worker.employee_no}
                                            </p>
                                            <p className="mt-1 break-words text-lg font-bold text-[var(--text-primary)] transition group-hover:text-[var(--brand-primary)]">
                                                {worker.full_name}
                                            </p>
                                            <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                                {worker.payrollStatus}
                                            </p>
                                        </div>
                                        <div className="shrink-0">
                                            {worker.worker_type === "temporary" ? (
                                                <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                                                    Temporary
                                                </span>
                                            ) : (
                                                <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                                    Permanent
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-sm">
                                        <div>
                                            <dt className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                                                Shifts
                                            </dt>
                                            <dd className="font-bold tabular-nums text-[var(--text-primary)]">
                                                {worker.shifts}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                                                Gross
                                            </dt>
                                            <dd className="font-bold tabular-nums text-[var(--text-primary)]">
                                                {formatLkr(worker.gross)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                                                Net
                                            </dt>
                                            <dd className={`font-bold tabular-nums ${worker.net < 0 ? "text-red-700" : "text-[var(--brand-primary)]"}`}>
                                                {formatLkr(worker.net)}
                                            </dd>
                                        </div>
                                    </dl>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            ) : reportData ? (
                <>
                    <section className="app-surface mt-2 flex flex-col justify-between gap-4 rounded-lg border-l-4 border-[var(--brand-accent)] p-5 lg:flex-row lg:items-start">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary-soft)]">
                                {reportData.worker.employee_no}
                            </p>
                            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                                {reportData.worker.full_name}
                            </h2>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--text-secondary)]">
                                {reportData.worker.nic ? (
                                    <span>
                                        NIC:{" "}
                                        <strong className="font-semibold">
                                            {reportData.worker.nic}
                                        </strong>
                                    </span>
                                ) : null}
                                {reportData.worker.etf_no ? (
                                    <span>
                                        ETF:{" "}
                                        <strong className="font-semibold">
                                            {reportData.worker.etf_no}
                                        </strong>
                                    </span>
                                ) : null}
                                <span>
                                    Status:{" "}
                                    <strong className="font-semibold capitalize">
                                        {reportData.worker.status}
                                    </strong>
                                </span>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center">
                            {reportData.worker.worker_type === "temporary" ? (
                                <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-700">
                                    Temporary Worker
                                </span>
                            ) : (
                                <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                                    Permanent Worker
                                </span>
                            )}
                        </div>
                    </section>

                    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                                Payroll Period
                            </p>
                            <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                                {months[month - 1]} {year}
                            </p>
                        </div>

                        <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                                Total Shifts
                            </p>
                            <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                                {reportData.totals.shifts}
                            </p>
                        </div>

                        <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                                Total Gross
                            </p>
                            <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                                {formatLkr(reportData.totals.gross)}
                            </p>
                        </div>

                        <div className="app-surface flex flex-col gap-1 rounded-lg p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                                Total Deductions
                            </p>
                            <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                                {formatLkr(reportData.totals.deductions)}
                            </p>
                        </div>

                        <div className="app-surface flex flex-col gap-1 rounded-lg border-l-4 border-[var(--brand-accent)] p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                                Total Net Salary
                            </p>
                            <p className={`mt-1 text-2xl font-black ${(reportData.totals.net ?? 0) < 0 ? "text-red-700" : "text-[var(--brand-primary)]"}`}>
                                {formatLkr(reportData.totals.net)}
                            </p>
                        </div>
                    </section>

                    {reportData.rows.length === 0 ? (
                        <section className="app-surface mt-2 rounded-lg p-8 text-center">
                            <h2 className="text-lg font-bold text-[var(--text-primary)]">
                                No salary history found
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                                No payroll record was found for this worker in the selected
                                payroll month.
                            </p>
                        </section>
                    ) : (
                        <>
                            <section className="app-surface mt-2 hidden overflow-hidden rounded-lg lg:block">
                                <div className="max-h-[calc(100dvh-26rem)] min-h-[22rem] overflow-auto">
                                    <table className="w-full min-w-[60rem] divide-y divide-zinc-200 text-sm">
                                        <thead className="table-head-brand sticky top-0 z-10 text-left text-xs font-bold uppercase tracking-wide">
                                            <tr>
                                                <th className="px-4 py-3">Payroll Month</th>
                                                <th className="px-4 py-3 text-right">Total Shifts</th>
                                                <th className="px-4 py-3 text-right">Gross Salary</th>
                                                <th className="px-4 py-3 text-right">Total Deductions</th>
                                                <th className="px-4 py-3 text-right">Net Salary</th>
                                                <th className="px-4 py-3 text-center">Status</th>
                                                <th className="px-4 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-200">
                                            {reportData.rows.map(({ record, run, shifts }) => (
                                                <tr className="table-row-brand" key={record.id}>
                                                    <td className="whitespace-nowrap px-4 py-4 font-bold text-[var(--text-primary)]">
                                                        {months[run.month - 1]} {run.year}
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
                                                    <td className="whitespace-nowrap px-4 py-4 text-center">
                                                        {run.status === "approved" ? (
                                                            <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-green-700">
                                                                Approved
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-slate-700">
                                                                Draft
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-4 text-right">
                                                        <div className="inline-flex gap-2">
                                                        <Link
                                                            className="app-focus btn-secondary inline-flex min-h-8 items-center justify-center rounded-md px-3 text-xs font-bold transition"
                                                            href={`/payroll/${reportData.worker.id}?year=${run.year}&month=${run.month}`}
                                                            target="_blank"
                                                        >
                                                            Details
                                                        </Link>
                                                        <Link
                                                            className="app-focus btn-primary inline-flex min-h-8 items-center justify-center rounded-md px-3 text-xs font-bold transition"
                                                            href={`/reports/worker-salary/${reportData.worker.id}/payslip?year=${run.year}&month=${run.month}`}
                                                        >
                                                            View Payslip
                                                        </Link>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <section className="mt-2 grid gap-4 lg:hidden">
                                {reportData.rows.map(({ record, run, shifts }) => (
                                    <article
                                        className="app-surface flex flex-col gap-3 rounded-lg p-5"
                                        key={record.id}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                                                    {months[run.month - 1]} {run.year}
                                                </h2>
                                            </div>
                                            <div className="flex shrink-0 items-center">
                                                {run.status === "approved" ? (
                                                    <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-green-700">
                                                        Approved
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-slate-700">
                                                        Draft
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <dl className="grid grid-cols-2 gap-3 text-sm">
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
                                                <dd className={`font-bold tabular-nums ${record.net < 0 ? "text-red-700" : "text-[var(--brand-primary)]"}`}>
                                                    {formatLkr(record.net)}
                                                </dd>
                                            </div>
                                        </dl>

                                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                            <Link
                                                className="app-focus btn-secondary flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-bold transition"
                                                href={`/payroll/${reportData.worker.id}?year=${run.year}&month=${run.month}`}
                                            >
                                                View Details
                                            </Link>
                                            <Link
                                                className="app-focus btn-primary flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-bold transition"
                                                href={`/reports/worker-salary/${reportData.worker.id}/payslip?year=${run.year}&month=${run.month}`}
                                            >
                                                View Payslip
                                            </Link>
                                        </div>
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
