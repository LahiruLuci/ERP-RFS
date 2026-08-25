import { notFound } from "next/navigation";

import { getWorker } from "@/lib/workers/data";

import { updateWorkerAction } from "../../actions";
import { WorkerForm } from "../../worker-form";

type EditWorkerPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditWorkerPage({ params }: EditWorkerPageProps) {
  const { id } = await params;
  const worker = await getWorker(id);

  if (!worker) {
    notFound();
  }

  const action = updateWorkerAction.bind(null, worker.id);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <section className="app-surface rounded-lg border-l-4 border-l-[var(--brand-accent)] p-5 sm:p-6">
        <p className="brand-kicker">
          Workers
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Edit Worker
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          Update worker profile, status, employment, and salary reference
          details.
        </p>
      </section>

      <WorkerForm
        action={action}
        cancelHref={`/workers/${worker.id}`}
        worker={worker}
      />
    </div>
  );
}
