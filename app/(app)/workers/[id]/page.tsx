import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  DeductionDatabaseSetupError,
  getWorkerMonthlyDeductionSummary,
} from "@/lib/deductions/data";
import { formatLkr } from "@/lib/format/currency";
import { getWorker, getWorkerStatusHistory } from "@/lib/workers/data";

import {
  formatWorkerType,
  formatWorkerStatus,
  WorkerStatusBadge,
  WorkerTypeBadge,
} from "../worker-status-badge";

type WorkerDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-sm font-medium text-[var(--text-secondary)]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-[var(--text-primary)]">
        {value || "-"}
      </dd>
    </div>
  );
}

function DetailSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="app-surface rounded-lg p-5 sm:p-6">
      <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export default async function WorkerDetailsPage({
  params,
}: WorkerDetailsPageProps) {
  const { id } = await params;
  const worker = await getWorker(id);

  if (!worker) {
    notFound();
  }

  const statusHistory = await getWorkerStatusHistory(worker.id);
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  let deductionSummary = {
    advance: 0,
    meals: 0,
    other: 0,
    total: 0,
    uniform: 0,
  };

  try {
    deductionSummary = await getWorkerMonthlyDeductionSummary({
      month: currentMonth,
      workerId: worker.id,
      year: currentYear,
    });
  } catch (error) {
    if (!(error instanceof DeductionDatabaseSetupError)) {
      throw error;
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <section className="app-surface flex flex-col gap-4 rounded-lg border-l-4 border-l-[var(--brand-accent)] p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="brand-kicker">
            Worker Profile
          </p>
          <h1 className="mt-2 break-words text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            {worker.full_name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Employee No: {worker.employee_no}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <WorkerTypeBadge type={worker.worker_type} />
          <Link
            className="app-focus btn-secondary flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-bold transition"
            href="/workers"
          >
            Back to Workers
          </Link>
          <Link
            className="app-focus btn-primary flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-bold transition"
            href={`/workers/${worker.id}/edit`}
          >
            {worker.worker_type === "temporary"
              ? "Complete Worker Registration"
              : "Edit Worker"}
          </Link>
        </div>
      </section>

      <DetailSection title="Personal Information">
        <DetailItem label="Name" value={worker.full_name} />
        <DetailItem label="NIC" value={worker.nic} />
        <DetailItem
          label="Date of Birth"
          value={formatDisplayDate(worker.date_of_birth)}
        />
        <DetailItem label="Gender" value={worker.gender} />
        <DetailItem label="Phone" value={worker.phone} />
        <DetailItem label="Secondary Phone" value={worker.secondary_phone} />
        <DetailItem label="Address" value={worker.address} />
      </DetailSection>

      <DetailSection title="Emergency Contact">
        <DetailItem label="Name" value={worker.emergency_contact_name} />
        <DetailItem
          label="Relationship"
          value={worker.emergency_contact_relationship}
        />
        <DetailItem label="Phone" value={worker.emergency_contact_phone} />
      </DetailSection>

      <DetailSection title="Employment Information">
        <DetailItem label="Employee No" value={worker.employee_no} />
        <DetailItem label="Worker Type" value={formatWorkerType(worker.worker_type)} />
        <DetailItem label="ETF No" value={worker.etf_no} />
        <DetailItem label="EPF No" value={worker.epf_no} />
        <DetailItem
          label="Joined Date"
          value={formatDisplayDate(worker.joined_date)}
        />
        <DetailItem
          label="Current Status"
          value={formatWorkerStatus(worker.status)}
        />
        <DetailItem
          label="Previous Occupation"
          value={worker.previous_occupation}
        />
        <DetailItem label="Previous Employer" value={worker.previous_employer} />
      </DetailSection>

      <DetailSection title="Salary Information">
        <DetailItem
          label="Basic Salary"
          value={formatLkr(worker.basic_salary)}
        />
        <DetailItem
          label="Default Shift Rate"
          value={formatLkr(worker.default_shift_rate)}
        />
      </DetailSection>

      <section className="app-surface rounded-lg p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Advances & Deductions
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Current month summary for payroll deductions.
            </p>
          </div>
          <Link
            className="app-focus btn-secondary flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-bold transition"
            href={`/advances-deductions?workerId=${worker.id}&year=${currentYear}&month=${currentMonth}`}
          >
            View History
          </Link>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <DetailItem
            label="Current Month Advance"
            value={formatLkr(deductionSummary.advance)}
          />
          <DetailItem
            label="Current Month Total Deductions"
            value={formatLkr(deductionSummary.total)}
          />
        </dl>
      </section>
      <section className="app-surface rounded-lg p-5 sm:p-6">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          Employment Status History
        </h2>

        {statusHistory.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            No status history has been recorded yet.
          </p>
        ) : (
          <ol className="mt-5 space-y-4">
            {statusHistory.map((event) => (
              <li
                className="app-muted-surface rounded-lg p-4"
                key={event.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {formatDisplayDate(event.effective_date)}
                  </p>
                  <WorkerStatusBadge status={event.new_status} />
                </div>

                <div className="mt-3 space-y-1 text-sm leading-6 text-[var(--text-secondary)]">
                  {event.previous_status ? (
                    <p>
                      Changed from {formatWorkerStatus(event.previous_status)}{" "}
                      to {formatWorkerStatus(event.new_status)}
                    </p>
                  ) : (
                    <p>
                      Initial status recorded as{" "}
                      {formatWorkerStatus(event.new_status)}
                    </p>
                  )}
                  {event.reason ? <p>{event.reason}</p> : null}
                  {event.note ? <p>{event.note}</p> : null}
                  <p className="text-slate-500">
                    Changed by:{" "}
                    {event.changed_by_profile?.full_name || "Internal user"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="app-surface rounded-lg p-5 sm:p-6">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Notes</h2>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-secondary)]">
          {worker.notes || "No notes recorded."}
        </p>
      </section>
    </div>
  );
}

