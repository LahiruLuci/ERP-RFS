"use client";

import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { formatLkr } from "@/lib/format/currency";

type PayrollTrendProps = {
  month: number;
  year: number;
  trend: Array<{
    deductions: number;
    exists: boolean;
    gross: number;
    label: string;
    month: number;
    net: number;
    status: "draft" | "approved" | null;
    year: number;
  }>;
};

function compactLkr(value: number) {
  if (value >= 1_000_000) {
    return `Rs. ${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `Rs. ${(value / 1_000).toFixed(0)}K`;
  }

  return `Rs. ${value.toFixed(0)}`;
}

export function PayrollTrend({ trend, month, year }: PayrollTrendProps) {
  const hasData = trend.some((item) => item.exists);

  if (!hasData) {
    return (
      <section className="app-surface rounded-lg p-5">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Payroll Trend</h2>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Last 6 months</p>
        <div className="mt-4 rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 text-center">
          <p className="text-sm font-semibold text-[var(--text-secondary)]">
            Payroll history will appear here after monthly payrolls are created.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="app-surface rounded-lg p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Payroll Trend</h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Last 6 months</p>
        </div>
        <Link
          className="app-focus text-xs font-semibold text-[var(--brand-primary)] hover:underline"
          href={`/reports/monthly-payroll?year=${year}&month=${month}`}
        >
          Monthly Payroll Report
        </Link>
      </div>

      <div className="mt-4 h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={trend}
            margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#526174" }}
              axisLine={{ stroke: "#dbe4f0" }}
              tickLine={false}
              dy={8}
            />
            <YAxis
              tickFormatter={(value: number) => compactLkr(value)}
              tick={{ fontSize: 11, fill: "#526174" }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip
              formatter={(value) => [formatLkr(Number(value)), "Net Payroll"]}
              labelFormatter={(label) => label}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #dbe4f0",
                boxShadow: "0 4px 12px rgb(7 27 70 / 0.08)",
                fontSize: 12,
              }}
              labelStyle={{ color: "#0b162f", fontWeight: 700 }}
            />
            <Line
              type="monotone"
              dataKey="net"
              name="Net Payroll"
              stroke="#c99a2e"
              strokeWidth={3}
              dot={{ r: 4, fill: "#c99a2e", strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: 6, fill: "#c99a2e", strokeWidth: 2, stroke: "#fff" }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
