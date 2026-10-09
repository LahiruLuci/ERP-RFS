"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ClientAuthenticationError,
  ClientDatabaseSetupError,
  ClientPermissionError,
  ClientValidationError,
  createClientRecord,
  createWorkpoint,
  deleteWorkpointPayrollEntry,
  saveWorkpointPayrollEntry,
} from "@/lib/clients/data";
import type { ClientStatus } from "@/lib/clients/types";
import {
  PayrollApprovedError,
  PayrollAuthenticationError,
  PayrollPermissionError,
  PayrollValidationError,
} from "@/lib/payroll/data";
import {
  createTemporaryWorker,
  WorkerConnectionError,
  WorkerConstraintError,
  WorkerDatabaseSetupError,
  WorkerDuplicateIdentityError,
  WorkerDuplicateNicError,
  WorkerPermissionError,
  WorkerProfileError,
} from "@/lib/workers/data";

export type ClientActionState = {
  error?: string;
  success?: boolean;
};

const initialPath = "/clients";

function nullableText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();

  return value ? value : null;
}

function requiredText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function readNumber(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();

  if (!value) {
    return 0;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : Number.NaN;
}

function readStatus(formData: FormData): ClientStatus {
  return requiredText(formData, "status") === "inactive" ? "inactive" : "active";
}

function getClientErrorMessage(error: unknown) {
  if (error instanceof ClientAuthenticationError || error instanceof PayrollAuthenticationError) {
    return "Your login session has expired. Please sign in again.";
  }

  if (error instanceof ClientPermissionError) {
    return "You do not have permission to manage clients or workpoints.";
  }

  if (error instanceof PayrollPermissionError) {
    return "You do not have permission to save payroll work entries.";
  }

  if (error instanceof PayrollApprovedError) {
    return "This payroll month has already been approved. Reopen the payroll before changing work entries.";
  }

  if (error instanceof ClientDatabaseSetupError) {
    return "Client/workpoint database setup is not complete. Run the latest Supabase migrations, then try again.";
  }

  if (error instanceof ClientValidationError || error instanceof PayrollValidationError) {
    return error.message || "Please review the details and try again.";
  }

  if (
    error instanceof WorkerDuplicateNicError ||
    error instanceof WorkerDuplicateIdentityError
  ) {
    return "A worker with this NIC already exists. Use the existing worker record instead.";
  }

  if (error instanceof WorkerConnectionError) {
    return "Cannot connect to Supabase right now. Check your internet connection, Supabase project URL, and DNS/network access, then try again.";
  }

  if (error instanceof WorkerPermissionError) {
    return "You do not have permission to add temporary workers.";
  }

  if (error instanceof WorkerProfileError) {
    return "Your account profile is missing or inactive. Ask an owner/admin to activate your profile before saving workers.";
  }

  if (error instanceof WorkerDatabaseSetupError) {
    return "Temporary worker database setup is not complete. Run the latest Supabase migration, then try again.";
  }

  if (error instanceof WorkerConstraintError) {
    return "Please enter the worker's full name.";
  }

  return "Unable to save right now. Please try again.";
}

export async function createClientAction(
  _previousState: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  let clientId: string;

  try {
    clientId = await createClientRecord({
      billing_address: nullableText(formData, "billing_address"),
      client_code: requiredText(formData, "client_code"),
      contact_person: nullableText(formData, "contact_person"),
      email: nullableText(formData, "email"),
      name: requiredText(formData, "name"),
      notes: nullableText(formData, "notes"),
      phone: nullableText(formData, "phone"),
      status: readStatus(formData),
    });
  } catch (error) {
    return { error: getClientErrorMessage(error) };
  }

  revalidatePath(initialPath);
  redirect(`/clients/${clientId}`);
}

export async function createWorkpointAction(
  clientId: string,
  _previousState: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  try {
    await createWorkpoint({
      address: nullableText(formData, "address"),
      client_id: clientId,
      contact_person: nullableText(formData, "contact_person"),
      contact_phone: nullableText(formData, "contact_phone"),
      default_day_rate: readNumber(formData, "default_day_rate"),
      default_night_rate: readNumber(formData, "default_night_rate"),
      name: requiredText(formData, "name"),
      notes: nullableText(formData, "notes"),
      required_guards: readNumber(formData, "required_guards"),
      status: readStatus(formData),
      workplace_code: requiredText(formData, "workplace_code"),
    });
  } catch (error) {
    return { error: getClientErrorMessage(error) };
  }

  revalidatePath(`/clients/${clientId}`);
  return {};
}

export async function saveWorkpointPayrollEntryAction(
  clientId: string,
  workpointId: string,
  year: number,
  month: number,
  _previousState: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const workerId = requiredText(formData, "worker_id");
  const entryId = nullableText(formData, "entry_id");
  const shifts = readNumber(formData, "shifts");
  const shiftRate = readNumber(formData, "shift_rate");

  try {
    await saveWorkpointPayrollEntry({
      entry_id: entryId,
      month,
      shift_rate: shiftRate,
      shifts,
      worker_id: workerId,
      workplace_id: workpointId,
      year,
    });
  } catch (error) {
    return { error: getClientErrorMessage(error) };
  }

  revalidatePath(`/clients/${clientId}/workpoints/${workpointId}`);
  revalidatePath("/payroll");
  revalidatePath(`/payroll/${workerId}`);
  return { success: true };
}

export async function createTemporaryWorkerAction(
  clientId: string,
  workpointId: string,
  year: number,
  month: number,
  _previousState: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  let workerId: string;
  const nic = nullableText(formData, "nic");

  try {
    workerId = await createTemporaryWorker({
      address: nullableText(formData, "address"),
      default_shift_rate: readNumber(formData, "default_shift_rate"),
      full_name: requiredText(formData, "full_name"),
      nic,
      notes: nullableText(formData, "notes"),
      phone: nullableText(formData, "phone"),
    });
  } catch (error) {
    return { error: getClientErrorMessage(error) };
  }

  revalidatePath(`/clients/${clientId}/workpoints/${workpointId}`);
  redirect(
    `/clients/${clientId}/workpoints/${workpointId}?year=${year}&month=${month}&q=${encodeURIComponent(
      nic ?? "",
    )}&selectedWorkerId=${workerId}`,
  );
}

export async function deleteWorkpointPayrollEntryAction(
  clientId: string,
  workpointId: string,
  year: number,
  month: number,
  _previousState: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const entryId = String(formData.get("entry_id") ?? "").trim();

  if (!entryId) {
    return { error: "Work entry is required." };
  }

  try {
    await deleteWorkpointPayrollEntry({
      entryId,
      month,
      workplaceId: workpointId,
      year,
    });
  } catch (error) {
    return { error: getClientErrorMessage(error) };
  }

  revalidatePath(`/clients/${clientId}/workpoints/${workpointId}`);
  revalidatePath("/payroll");
  return {};
}
