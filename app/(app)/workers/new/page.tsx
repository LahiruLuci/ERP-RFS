import { createWorkerAction } from "../actions";
import { WorkerForm } from "../worker-form";

export default function NewWorkerPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pt-4">
      <section className="app-surface rounded-lg border-l-4 border-l-[var(--brand-accent)] p-5 sm:p-6">
        <p className="brand-kicker">
          Workers
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Add Worker
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          Create a worker profile with employment and salary reference details.
        </p>
      </section>

      <WorkerForm action={createWorkerAction} cancelHref="/workers" />
    </div>
  );
}
