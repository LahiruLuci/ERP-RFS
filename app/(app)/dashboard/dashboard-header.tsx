import { DashboardOfflineStatus } from "./dashboard-offline-status";

type DashboardHeaderProps = {
  month: number;
  year: number;
};

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function DashboardHeader({ month, year }: DashboardHeaderProps) {
  return (
    <section className="app-surface overflow-hidden rounded-lg">
      <div className="flex flex-col gap-3 border-l-4 border-[var(--brand-accent)] p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">
            Dashboard
          </h1>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            {months[month - 1]} {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form className="flex items-center gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Month
              </span>
              <select
                className="field-control min-h-8 rounded-md px-2 text-xs font-semibold"
                defaultValue={String(month)}
                name="month"
              >
                {months.map((monthName, index) => (
                  <option key={monthName} value={index + 1}>
                    {monthName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Year
              </span>
              <input
                className="field-control min-h-8 w-16 rounded-md px-2 text-xs font-semibold"
                defaultValue={String(year)}
                name="year"
                type="number"
              />
            </label>
            <div className="flex items-end">
              <button
                className="app-focus btn-primary min-h-8 rounded-md px-3 text-xs font-bold"
                type="submit"
              >
                View
              </button>
            </div>
          </form>
          <DashboardOfflineStatus />
        </div>
      </div>
    </section>
  );
}
