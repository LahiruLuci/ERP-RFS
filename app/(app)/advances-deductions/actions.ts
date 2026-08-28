"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  cancelWorkerDeduction,
  DeductionApprovedPayrollError,
  DeductionAuthenticationError,
  DeductionDatabaseSetupError,
  DeductionPermissionError,
  DeductionValidationError,
  saveWorkerDeduction,
} from "@/lib/deductions/data";
import {
  workerDeductionTypes,
  type WorkerDeductionType,
} from "@/lib/deductions/types";

export type DeductionFormState = {
  error?: string;
};

function isDeductionType(value: string): value is WorkerDeductionType {
  return workerDeductionTypes.includes(value as WorkerDeductionType);
}

function getDeductionErrorMessage(error: unknown) {
  if (error instanceof DeductionDatabaseSetupError) {
    return "Advance and deduction database setup is not complete. Run the worker deductions SQL migration in Supabase, then try again.";
  }

  if (error instanceof DeductionAuthenticationError) {
    return "Your login session has expired. Please sign in again.";
  }

  if (error instanceof DeductionPermissionError) {
    return "You do not have permission to manage advances and deductions.";
  }

  if (error instanceof DeductionApprovedPayrollError) {
    return "This transaction belongs to an approved payroll month and cannot be changed.";
  }

  if (error instanceof DeductionValidationError) {
    if (error.message.includes("Other deduction note")) {
      return "Please add a note explaining the other deduction.";
    }

    if (error.message.includes("Cancellation reason")) {
      return "Please enter a cancellation reason.";
    }

    return "Please review the transaction details and try again.";
  }

  return "Unable to save this transaction right now. Please try again.";
}

function getRedirectHref(formData: FormData) {
  const params = new URLSearchParams();
  const workerId = String(formData.get("worker_id") ?? "").trim();
  const month = String(formData.get("month") ?? "").trim();
  const year = String(formData.get("year") ?? "").trim();

  if (workerId) {
    params.set("workerId", workerId);
  }

  if (month) {
    params.set("month", month);
  }

  if (year) {
    params.set("year", year);
  }

  const queryString = params.toString();

  return queryString
    ? `/advances-deductions?${queryString}`
    : "/advances-deductions";
}

export async function saveDeductionAction(
  _previousState: DeductionFormState,
  formData: FormData,
): Promise<DeductionFormState> {
  const workerId = String(formData.get("worker_id") ?? "").trim();
  const deductionId = String(formData.get("deduction_id") ?? "").trim() || null;
  const typeValue = String(formData.get("type") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "").trim());
  const transactionDate = String(formData.get("transaction_date") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!workerId) {
    return { error: "Select a worker before saving a transaction." };
  }

  if (!isDeductionType(typeValue)) {
    return { error: "Choose a valid transaction type." };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be greater than zero." };
  }

  if (!transactionDate) {
    return { error: "Transaction date is required." };
  }

  if (typeValue === "other" && !note) {
    return { error: "Please add a note explaining the other deduction." };
  }

  try {
    await saveWorkerDeduction({
      amount,
      id: deductionId,
      note,
      transaction_date: transactionDate,
      type: typeValue,
      worker_id: workerId,
    });
  } catch (error) {
    return {
      error: getDeductionErrorMessage(error),
    };
  }

  revalidatePath("/advances-deductions");
  revalidatePath("/payroll");
  revalidatePath(`/workers/${workerId}`);
  redirect(getRedirectHref(formData));
}

export async function cancelDeductionAction(formData: FormData) {
  const deductionId = String(formData.get("deduction_id") ?? "").trim();
  const reason = String(formData.get("cancellation_reason") ?? "").trim();

  if (!deductionId || !reason) {
    throw new Error("Please enter a cancellation reason.");
  }

  try {
    await cancelWorkerDeduction(deductionId, reason);
  } catch (error) {
    throw new Error(getDeductionErrorMessage(error));
  }

  const workerId = String(formData.get("worker_id") ?? "").trim();
  revalidatePath("/advances-deductions");
  revalidatePath("/payroll");
  revalidatePath(`/workers/${workerId}`);
  redirect(getRedirectHref(formData));
}
