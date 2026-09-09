import { getMonthlyPayrollReport } from "@/lib/reports/data";

import { MonthlyPayrollAutoPrint } from "./monthly-payroll-auto-print";
import { MonthlyPayrollPrintDocument } from "./monthly-payroll-print-document";

type MonthlyPayrollPrintPageProps = {
    searchParams?: Promise<{
        month?: string;
        q?: string;
        year?: string;
    }>;
};

function readPeriod(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : fallback;
}

export default async function MonthlyPayrollPrintPage({
    searchParams,
}: MonthlyPayrollPrintPageProps) {
    const resolvedSearchParams = await searchParams;
    const now = new Date();
    const year = readPeriod(resolvedSearchParams?.year, now.getFullYear());
    const month = readPeriod(resolvedSearchParams?.month, now.getMonth() + 1);
    const search = resolvedSearchParams?.q?.trim() ?? "";

    const data = await getMonthlyPayrollReport({ month, search, year });

    return (
        <div className="min-h-dvh bg-white p-4">
            <style>{`
        @page {
          size: A4 landscape;
          margin: 8mm;
        }
      `}</style>
            <MonthlyPayrollAutoPrint />
            <MonthlyPayrollPrintDocument data={data} month={month} year={year} />
        </div>
    );
}
