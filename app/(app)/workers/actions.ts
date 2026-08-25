"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createWorker,
  getWorker,
  updateWorker,
  WorkerAuthenticationError,
  WorkerConstraintError,
  WorkerDatabaseSetupError,
  WorkerDuplicateEmployeeNoError,
  WorkerDuplicateEpfNoError,
  WorkerDuplicateEtfNoError,
  WorkerDuplicateNicError,
  WorkerPermissionError,
  WorkerProfileError,
} from "@/lib/workers/data";
import {
  validateWorkerForm,
  type WorkerFormState,
} from "@/lib/workers/validation";

function getWorkerSaveErrorMessage(error: unknown) {
  if (error instanceof WorkerDatabaseSetupError) {
    return "Worker database setup is not complete. Run the worker profile status-history SQL migration in Supabase, then try again.";
  }

  if (error instanceof WorkerAuthenticationError) {
    return "Your login session has expired. Please sign in again.";
  }

  if (error instanceof WorkerProfileError) {
    return "Your account profile is missing or inactive. Ask an owner/admin to activate your profile before saving workers.";
  }

  if (error instanceof WorkerPermissionError) {
    return "You do not have permission to save worker records.";
  }

  if (error instanceof WorkerDuplicateEmployeeNoError) {
    return "A worker with this employee number already exists.";
  }

  if (error instanceof WorkerDuplicateNicError) {
    return "A worker with this NIC already exists.";
  }

  if (error instanceof WorkerDuplicateEtfNoError) {
    return "A worker with this ETF number already exists.";
  }

  if (error instanceof WorkerDuplicateEpfNoError) {
    return "A worker with this EPF number already exists.";
  }

  if (error instanceof WorkerConstraintError) {
    return "Please review the worker details and try again.";
  }

  return "Unable to save the worker right now. Please try again.";
}

export async function createWorkerAction(
  _previousState: WorkerFormState,
  formData: FormData,
): Promise<WorkerFormState> {
  const result = validateWorkerForm(formData, { isCreate: true });

  if (!result.ok) {
    return result.state;
  }

  let workerId: string;

  try {
    workerId = await createWorker(result.data);
  } catch (error) {
    return {
      error: getWorkerSaveErrorMessage(error),
    };
  }

  revalidatePath("/workers");
  redirect(`/workers/${workerId}`);
}

export async function updateWorkerAction(
  workerId: string,
  _previousState: WorkerFormState,
  formData: FormData,
): Promise<WorkerFormState> {
  let worker;

  try {
    worker = await getWorker(workerId);
  } catch (error) {
    return {
      error:
        error instanceof WorkerDatabaseSetupError
          ? "Worker database setup is not complete. Run the worker profile status-history SQL migration in Supabase, then try again."
          : error instanceof WorkerPermissionError
            ? "Your account is not allowed to manage workers. Set your profile role to owner or admin in Supabase, then try again."
          : "Unable to load this worker. Check your permissions and try again.",
    };
  }

  if (!worker) {
    return {
      error: "Worker could not be found.",
    };
  }

  const result = validateWorkerForm(formData, {
    previousStatus: worker.status,
  });

  if (!result.ok) {
    return result.state;
  }

  try {
    await updateWorker(workerId, result.data);
  } catch (error) {
    return {
      error: getWorkerSaveErrorMessage(error),
    };
  }

  revalidatePath("/workers");
  revalidatePath(`/workers/${workerId}`);
  redirect(`/workers/${workerId}`);
}
