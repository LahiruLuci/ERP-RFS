import Link from "next/link";

import { formatLkr } from "@/lib/format/currency";
import { OfflineCacheHydrator } from "@/lib/offline/cache-hydrator";
import {
  getWorkers,
  WorkerConnectionError,
  WorkerDatabaseSetupError,
  type WorkerFilters,
} from "@/lib/workers/data";
import {
  workerStatusLabels,
  workerStatuses,
  workerTypeLabels,
  workerTypes,
  type Worker,
  type WorkerStatus,
  type WorkerType,
} from "@/lib/workers/types";

import { WorkerStatusBadge, WorkerTypeBadge } from "./worker-status-badge";
import { CachedWorkersView } from "./cached-workers-view";

type WorkersPageProps = {
  searchParams?: Promise<{
    basicMax?: string;
    basicMin?: string;
    q?: string;
    rateMax?: string;
    rateMin?: string;
    status?: string;
    type?: string;
  }>;
};

type FilterState = {
  basicMax: string;
  basicMin: string;
  rateMax: string;
  rateMin: string;
  status: WorkerStatus | "";
  workerType: WorkerType | "";
};

function isWorkerStatus(value: string): value is WorkerStatus {
  return workerStatuses.includes(value as WorkerStatus);
}

function isWorkerType(value: string): value is WorkerType {
  return workerTypes.includes(value as WorkerType);
}

function readFilterNumber(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const numberValue = Number(trimmedValue);

  return Number.isFinite(numberValue) ? numberValue : Number.NaN;
}

function validateRange(
  label: string,
  minValue: number | null,
  maxValue: number | null,
) {
  if (minValue !== null && minValue < 0) {
    return `Minimum ${label} cannot be negative.`;
  }

  if (maxValue !== null && maxValue < 0) {
    return `Maximum ${label} cannot be negative.`;
  }

  if (
    minValue !== null &&
    maxValue !== null &&
    minValue > maxValue
  ) {
    return `Minimum ${label} cannot be greater than maximum ${label}.`;
  }

  return null;
}

function getFilterState(
  searchParams: Awaited<WorkersPageProps["searchParams"]>,
) {
  const statusValue = searchParams?.status?.trim() ?? "";
  const workerTypeValue = searchParams?.type?.trim() ?? "";

  return {
    basicMax: searchParams?.basicMax?.trim() ?? "",
    basicMin: searchParams?.basicMin?.trim() ?? "",
    rateMax: searchParams?.rateMax?.trim() ?? "",
    rateMin: searchParams?.rateMin?.trim() ?? "",
    status: statusValue && isWorkerStatus(statusValue) ? statusValue : "",
    workerType:
      workerTypeValue && isWorkerType(workerTypeValue) ? workerTypeValue : "",
  } satisfies FilterState;
}

function buildWorkerFilters(search: string, filterState: FilterState) {
  const basicSalaryMin = readFilterNumber(filterState.basicMin);
  const basicSalaryMax = readFilterNumber(filterState.basicMax);
  const shiftRateMin = readFilterNumber(filterState.rateMin);
  const shiftRateMax = readFilterNumber(filterState.rateMax);
  const errors = [
    Number.isNaN(basicSalaryMin) || Number.isNaN(basicSalaryMax)
      ? "Basic Salary filters must be valid numbers."
      : validateRange("salary", basicSalaryMin, basicSalaryMax),
    Number.isNaN(shiftRateMin) || Number.isNaN(shiftRateMax)
      ? "Shift Rate filters must be valid numbers."
      : validateRange("shift rate", shiftRateMin, shiftRateMax),
  ].filter(Boolean);

  if (errors.length > 0) {
    return {
      error: errors[0] ?? "Review the selected filters.",
      filters: null,
    };
  }

  return {
    error: null,
    filters: {
      basicSalaryMax,
      basicSalaryMin,
      search,
      shiftRateMax,
      shiftRateMin,
      status: filterState.status || null,
      workerType: filterState.workerType || null,
    } satisfies WorkerFilters,
  };
}

function getClearFiltersHref(search: string) {
  if (!search) {
    return "/workers";
  }

  const params = new URLSearchParams({ q: search });

  return `/workers?${params.toString()}`;
}

function getClearSearchHref(filterState: FilterState) {
  const params = new URLSearchParams();

  if (filterState.basicMin) {
    params.set("basicMin", filterState.basicMin);
  }

  if (filterState.basicMax) {
    params.set("basicMax", filterState.basicMax);
  }

  if (filterState.rateMin) {
    params.set("rateMin", filterState.rateMin);
  }

  if (filterState.rateMax) {
    params.set("rateMax", filterState.rateMax);
  }

  if (filterState.status) {
    params.set("status", filterState.status);
  }

  if (filterState.workerType) {
    params.set("type", filterState.workerType);
  }

  const queryString = params.toString();

  return queryString ? `/workers?${queryString}` : "/workers";
}

function formatFilterMoney(value: string) {
  const numberValue = readFilterNumber(value);

  return numberValue !== null && Number.isFinite(numberValue)
    ? formatLkr(numberValue)
    : "Any";
}
function getActiveFilterChips(filterState: FilterState) {
  const chips: string[] = [];

  if (filterState.basicMin || filterState.basicMax) {
    chips.push(
      `Basic Salary: ${formatFilterMoney(filterState.basicMin)} - ${formatFilterMoney(filterState.basicMax)}`,
    );
  }

  if (filterState.rateMin || filterState.rateMax) {
    chips.push(
      `Shift Rate: ${formatFilterMoney(filterState.rateMin)} - ${formatFilterMoney(filterState.rateMax)}`,
    );
  }

  if (filterState.status) {
    chips.push(`Status: ${workerStatusLabels[filterState.status]}`);
  }

  if (filterState.workerType) {
    chips.push(`Type: ${workerTypeLabels[filterState.workerType]}`);
  }

  return chips;
}

function EmptyState({
  hasFilters,
  hasSearch,
}: {
  hasFilters: boolean;
  hasSearch: boolean;
}) {
  const title = hasFilters
    ? "No workers match these filters"
    : hasSearch
      ? "No workers found"
      : "No workers yet";
  const description = hasFilters
      ? "Try adjusting the salary range, shift rate, worker type, or status."
    : hasSearch
      ? "Try a different name, employee number, NIC, ETF number, or phone."
      : "Add your first worker to start building the workforce records.";

  return (
    <div className="app-surface rounded-lg p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-[var(--brand-accent-soft)] text-lg font-black text-[var(--brand-primary)]">
        RF
      </div>
      <h2 className="mt-4 text-lg font-bold text-[var(--text-primary)]">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
        {description}
      </p>
      {!hasSearch && !hasFilters ? (
        <Link
          className="app-focus btn-primary mt-5 inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-bold transition"
          href="/workers/new"
        >
          Add Worker
        </Link>
      ) : null}
    </div>
  );
}

export default async function WorkersPage({ searchParams }: WorkersPageProps) {
  const resolvedSearchParams = await searchParams;
  const search = resolvedSearchParams?.q?.trim() ?? "";
  const filterState = getFilterState(resolvedSearchParams);
  const activeFilterChips = getActiveFilterChips(filterState);
  const hasFilters = activeFilterChips.length > 0;
  const { error: filterError, filters } = buildWorkerFilters(
    search,
    filterState,
  );
  let workers: Worker[] = [];
  let loadError: string | null = filterError;

  if (filters) {
    try {
      workers = await getWorkers(filters);
    } catch (error) {
      if (error instanceof WorkerConnectionError) {
        return <CachedWorkersView search={search} />;
      }

      loadError =
        error instanceof WorkerDatabaseSetupError
          ? "Worker database setup is not complete. Run the worker profile status-history SQL migration in Supabase, then refresh this page."
          : "Unable to load workers. Check your permissions and try again.";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!loadError && !search && !hasFilters ? (
        <OfflineCacheHydrator workers={workers} />
      ) : null}
      <section className="app-surface overflow-hidden rounded-lg">
        <div className="flex flex-col gap-3 border-l-4 border-[var(--brand-accent)] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="brand-kicker">Workforce</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              Workers
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Manage worker profiles, employment details, and salary reference
              values used by future payroll workflows.
            </p>
          </div>

          <Link
            className="app-focus btn-primary flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-bold transition"
            href="/workers/new"
          >
            Add Worker
          </Link>
        </div>
      </section>

      <section className="app-surface rounded-lg p-3 sm:p-4">
        <form className="flex flex-col gap-3" role="search">
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="sr-only" htmlFor="worker-search">
              Search workers
            </label>
            <input
              className="field-control min-h-10 flex-1 rounded-md px-3 text-sm transition"
              defaultValue={search}
              id="worker-search"
              name="q"
              placeholder="Search by name, employee no, NIC, ETF no or phone"
              type="search"
            />
            <div className="flex gap-3">
              <button
                className="app-focus btn-primary min-h-10 flex-1 rounded-md px-4 text-sm font-bold transition sm:flex-none"
                type="submit"
              >
                Apply Filters
              </button>
              {hasFilters ? (
                <Link
                  className="app-focus btn-secondary flex min-h-10 flex-1 items-center justify-center rounded-md px-4 text-sm font-bold transition sm:flex-none"
                  href={getClearFiltersHref(search)}
                >
                  Clear Filters
                </Link>
              ) : null}
              {search ? (
                <Link
                  className="app-focus btn-secondary flex min-h-10 flex-1 items-center justify-center rounded-md px-4 text-sm font-bold transition sm:flex-none"
                  href={getClearSearchHref(filterState)}
                >
                  Clear Search
                </Link>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_14rem_14rem]">
            <fieldset className="rounded-md border border-[var(--border)] px-3 pb-3 pt-2">
              <legend className="px-1 text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                Basic Salary (LKR)
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    Min Salary
                  </span>
                  <input
                    className="field-control min-h-9 rounded-md px-3 text-sm transition"
                    defaultValue={filterState.basicMin}
                    min="0"
                    name="basicMin"
                    placeholder="Rs. min"
                    step="0.01"
                    type="number"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    Max Salary
                  </span>
                  <input
                    className="field-control min-h-9 rounded-md px-3 text-sm transition"
                    defaultValue={filterState.basicMax}
                    min="0"
                    name="basicMax"
                    placeholder="Rs. max"
                    step="0.01"
                    type="number"
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="rounded-md border border-[var(--border)] px-3 pb-3 pt-2">
              <legend className="px-1 text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                Shift Rate (LKR)
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    Min Rate
                  </span>
                  <input
                    className="field-control min-h-9 rounded-md px-3 text-sm transition"
                    defaultValue={filterState.rateMin}
                    min="0"
                    name="rateMin"
                    placeholder="Rs. min"
                    step="0.01"
                    type="number"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    Max Rate
                  </span>
                  <input
                    className="field-control min-h-9 rounded-md px-3 text-sm transition"
                    defaultValue={filterState.rateMax}
                    min="0"
                    name="rateMax"
                    placeholder="Rs. max"
                    step="0.01"
                    type="number"
                  />
                </label>
              </div>
            </fieldset>

            <label className="flex flex-col gap-1.5 rounded-md border border-[var(--border)] px-3 pb-3 pt-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                Worker Type
              </span>
              <select
                className="field-control min-h-9 rounded-md px-3 text-sm transition"
                defaultValue={filterState.workerType}
                name="type"
              >
                <option value="">All Types</option>
                {workerTypes.map((workerType) => (
                  <option key={workerType} value={workerType}>
                    {workerTypeLabels[workerType]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 rounded-md border border-[var(--border)] px-3 pb-3 pt-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                Worker Status
              </span>
              <select
                className="field-control min-h-9 rounded-md px-3 text-sm transition"
                defaultValue={filterState.status}
                name="status"
              >
                <option value="">All Statuses</option>
                {workerStatuses.map((status) => (
                  <option key={status} value={status}>
                    {workerStatusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {hasFilters ? (
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
              <span>{activeFilterChips.length} filters active</span>
              {activeFilterChips.map((chip) => (
                <span
                  className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[var(--text-primary)]"
                  key={chip}
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </form>
      </section>

      {loadError ? (
        <section
          className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700"
          role="alert"
        >
          {loadError}
        </section>
      ) : workers.length === 0 ? (
        <EmptyState hasFilters={hasFilters} hasSearch={Boolean(search)} />
      ) : (
        <>
          <section className="app-surface hidden overflow-hidden rounded-lg lg:block">
            <div className="max-h-[calc(100dvh-22rem)] min-h-[18rem] overflow-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="table-head-brand sticky top-0 z-10 text-left text-xs font-bold uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Employee No</th>
                    <th className="px-4 py-3">Full Name</th>
                    <th className="px-4 py-3">NIC</th>
                    <th className="px-4 py-3">ETF No</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Basic Salary</th>
                    <th className="px-4 py-3 text-right">Shift Rate</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {workers.map((worker) => (
                    <tr className="table-row-brand" key={worker.id}>
                      <td className="whitespace-nowrap px-4 py-4 font-bold text-[var(--text-primary)]">
                        {worker.employee_no}
                      </td>
                      <td className="px-4 py-4 font-semibold text-[var(--text-primary)]">
                        {worker.full_name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[var(--text-secondary)]">
                        {worker.nic || "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[var(--text-secondary)]">
                        {worker.etf_no || "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[var(--text-secondary)]">
                        {worker.phone || "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <WorkerTypeBadge type={worker.worker_type} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right font-medium tabular-nums text-[var(--text-primary)]">
                        {formatLkr(worker.basic_salary)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right font-medium tabular-nums text-[var(--text-primary)]">
                        {formatLkr(worker.default_shift_rate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <WorkerStatusBadge status={worker.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            className="app-focus btn-secondary rounded-md px-3 py-2 text-xs font-bold transition"
                            href={`/workers/${worker.id}`}
                          >
                            View
                          </Link>
                          <Link
                            className="app-focus btn-primary rounded-md px-3 py-2 text-xs font-bold transition"
                            href={`/workers/${worker.id}/edit`}
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:hidden">
            {workers.map((worker) => (
              <article
                className="app-surface rounded-lg p-5"
                key={worker.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary-soft)]">
                      {worker.employee_no}
                    </p>
                    <h2 className="mt-1 break-words text-lg font-bold text-[var(--text-primary)]">
                      {worker.full_name}
                    </h2>
                  </div>
                  <WorkerStatusBadge status={worker.status} />
                </div>
                <div className="mt-3">
                  <WorkerTypeBadge type={worker.worker_type} />
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-[var(--text-secondary)]">NIC</dt>
                    <dd className="font-semibold text-[var(--text-primary)]">
                      {worker.nic || "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-secondary)]">Phone</dt>
                    <dd className="font-semibold text-[var(--text-primary)]">
                      {worker.phone || "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-secondary)]">Basic Salary</dt>
                    <dd className="font-semibold tabular-nums text-[var(--text-primary)]">
                      {formatLkr(worker.basic_salary)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-secondary)]">Shift Rate</dt>
                    <dd className="font-semibold tabular-nums text-[var(--text-primary)]">
                      {formatLkr(worker.default_shift_rate)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Link
                    className="app-focus btn-secondary flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-bold transition"
                    href={`/workers/${worker.id}`}
                  >
                    View
                  </Link>
                  <Link
                    className="app-focus btn-primary flex min-h-10 items-center justify-center rounded-md px-3 text-sm font-bold transition"
                    href={`/workers/${worker.id}/edit`}
                  >
                    Edit
                  </Link>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}



