import Image from "next/image";

import { formatLkr } from "@/lib/format/currency";
import { WorkerTypeBadge } from "../../../workers/worker-status-badge";

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

type MonthlyPayrollPrintDocumentProps = {
    data: {
        run: { status: string } | null;
        rows: Array<{
            worker: {
                employee_no: string;
                full_name: string;
                worker_type: string;
            };
            record: {
                advance: number;
                epf: number;
                gross: number;
                meals: number;
                net: number;
                otherDeduction: number;
                totalDeductions: number;
                uniform: number;
            };
            shifts: number;
        }>;
        totals: {
            advance: number;
            deductions: number;
            epf: number;
            gross: number;
            meals: number;
            net: number;
            otherDeduction: number;
            shifts: number;
            uniform: number;
            workers: number;
        };
    };
    month: number;
    year: number;
};

export function MonthlyPayrollPrintDocument({
    data,
    month,
    year,
}: MonthlyPayrollPrintDocumentProps) {
    const periodLabel = `${months[month - 1]} ${year}`;
    const runStatus = data.run?.status;
    const isDraft = runStatus !== "approved";

    return (
        <article className="monthly-payroll-document mx-auto w-full max-w-none overflow-hidden rounded-none border border-slate-400 bg-white text-slate-950">
            <header className="border-b-4 border-[var(--brand-accent)] px-5 py-4">
                <div className="flex items-center gap-3">
                    <Image
                        alt="Royal Force Security Services"
                        className="size-12 shrink-0 object-contain"
                        height={48}
                        priority
                        src="/royal-force-logo.png"
                        width={48}
                    />
                    <div className="min-w-0">
                        <p className="text-base font-black uppercase tracking-wide text-[var(--brand-primary)]">
                            Royal Force Security Services
                        </p>
                        <h1 className="text-lg font-black uppercase tracking-wide text-slate-950">
                            Monthly Payroll Summary
                        </h1>
                        <p className="text-xs font-semibold text-slate-600">
                            Payroll Period: {periodLabel}
                        </p>
                    </div>
                </div>
            </header>

            <div className="px-5 py-4">
                {isDraft ? (
                    <div className="mb-3 rounded border border-slate-300 px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.18em] text-slate-500">
                        Draft
                    </div>
                ) : null}

                <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <div>
                        <p className="text-xs font-bold uppercase text-slate-500">Total Workers</p>
                        <p className="text-lg font-black text-slate-950">{data.totals.workers}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-slate-500">Total Shifts</p>
                        <p className="text-lg font-black text-slate-950">{data.totals.shifts}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-slate-500">Total Gross</p>
                        <p className="text-lg font-black text-slate-950">{formatLkr(data.totals.gross)}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-slate-500">Total Deductions</p>
                        <p className="text-lg font-black text-slate-950">{formatLkr(data.totals.deductions)}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-slate-500">Total Net Salary</p>
                        <p className={`text-lg font-black ${(data.totals.net ?? 0) < 0 ? "text-red-700" : "text-[var(--brand-primary)]"}`}>{formatLkr(data.totals.net)}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-slate-500">Status</p>
                        <p className="text-lg font-black text-slate-950">
                            {runStatus ? runStatus.charAt(0).toUpperCase() + runStatus.slice(1) : "-"}
                        </p>
                    </div>
                </section>

                <section>
                    <table className="w-full divide-y divide-slate-200 text-xs">
                        <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-600">
                            <tr>
                                <th className="px-2.5 py-2">Employee No</th>
                                <th className="px-2.5 py-2">Worker Name</th>
                                <th className="px-2.5 py-2">Type</th>
                                <th className="px-2.5 py-2 text-right">Shifts</th>
                                <th className="px-2.5 py-2 text-right">Gross</th>
                                <th className="px-2.5 py-2 text-right">Advance</th>
                                <th className="px-2.5 py-2 text-right">EPF</th>
                                <th className="px-2.5 py-2 text-right">Meals</th>
                                <th className="px-2.5 py-2 text-right">Uniform</th>
                                <th className="px-2.5 py-2 text-right">Other</th>
                                <th className="px-2.5 py-2 text-right">Total Deductions</th>
                                <th className="px-2.5 py-2 text-right">Net Salary</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.rows.length === 0 ? (
                                <tr>
                                    <td className="px-2.5 py-3 text-center text-xs text-slate-500" colSpan={12}>
                                        No payroll records found for this period.
                                    </td>
                                </tr>
                            ) : (
                                data.rows.map(({ record, shifts, worker }) => (
                                    <tr key={worker.employee_no}>
                                        <td className="px-2.5 py-2 font-semibold text-slate-700">
                                            {worker.employee_no}
                                        </td>
                                        <td className="px-2.5 py-2 font-semibold text-slate-900">
                                            {worker.full_name}
                                        </td>
                                        <td className="px-2.5 py-2">
                                            <WorkerTypeBadge type={worker.worker_type as "permanent" | "temporary"} />
                                        </td>
                                        <td className="px-2.5 py-2 text-right tabular-nums">{shifts}</td>
                                        <td className="px-2.5 py-2 text-right tabular-nums">{formatLkr(record.gross)}</td>
                                        <td className="px-2.5 py-2 text-right tabular-nums">{formatLkr(record.advance)}</td>
                                        <td className="px-2.5 py-2 text-right tabular-nums">{formatLkr(record.epf)}</td>
                                        <td className="px-2.5 py-2 text-right tabular-nums">{formatLkr(record.meals)}</td>
                                        <td className="px-2.5 py-2 text-right tabular-nums">{formatLkr(record.uniform)}</td>
                                        <td className="px-2.5 py-2 text-right tabular-nums">{formatLkr(record.otherDeduction)}</td>
                                        <td className="px-2.5 py-2 text-right font-semibold tabular-nums">{formatLkr(record.totalDeductions)}</td>
                                        <td className={`px-2.5 py-2 text-right font-bold tabular-nums ${record.net < 0 ? "text-red-700" : "text-[var(--brand-primary)]"}`}>{formatLkr(record.net)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {data.rows.length > 0 ? (
                            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-black">
                                <tr>
                                    <td className="px-2.5 py-2 uppercase" colSpan={3}>
                                        Totals
                                    </td>
                                    <td className="px-2.5 py-2 text-right tabular-nums">{data.totals.shifts}</td>
                                    <td className="px-2.5 py-2 text-right tabular-nums">{formatLkr(data.totals.gross)}</td>
                                    <td className="px-2.5 py-2 text-right tabular-nums">{formatLkr(data.totals.advance)}</td>
                                    <td className="px-2.5 py-2 text-right tabular-nums">{formatLkr(data.totals.epf)}</td>
                                    <td className="px-2.5 py-2 text-right tabular-nums">{formatLkr(data.totals.meals)}</td>
                                    <td className="px-2.5 py-2 text-right tabular-nums">{formatLkr(data.totals.uniform)}</td>
                                    <td className="px-2.5 py-2 text-right tabular-nums">{formatLkr(data.totals.otherDeduction)}</td>
                                    <td className="px-2.5 py-2 text-right tabular-nums">{formatLkr(data.totals.deductions)}</td>
                                    <td className={`px-2.5 py-2 text-right tabular-nums ${(data.totals.net ?? 0) < 0 ? "text-red-700 font-bold" : ""}`}>{formatLkr(data.totals.net)}</td>
                                </tr>
                            </tfoot>
                        ) : null}
                    </table>
                </section>
            </div>
        </article>
    );
}
