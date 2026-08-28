"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  calculateGrossSalary,
  calculateNetSalary,
  calculateTotalDeductions,
} from "@/lib/payroll/calculations";
import {
  approvePayrollRun,
  PayrollApprovedError,
  PayrollAuthenticationError,
  PayrollPermissionError,
  PayrollValidationError,
  savePayrollRecord,
} from "@/lib/payroll/data";
import type { PayrollSaveWorkEntry } from "@/lib/payroll/types";

export type PayrollFormState = {
  error?: string;
};

function readNumber(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();

  if (!value) {
    return 0;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : Number.NaN;
}

function readBoolean(formData: FormData, name: string) {
  return String(formData.get(name) ?? "") === "true";
}

function readPositivePeriod(year: number, month: number) {
  return {
    month: month >= 1 && month <= 12 ? month : new Date().getMonth() + 1,
    year: year >= 2000 && year <= 2100 ? year : new Date().getFullYear(),
  };
}

function getPayrollErrorMessage(error: unknown) {
  if (error instanceof PayrollAuthenticationError) {
    return "Your login session has expired. Please sign in again.";
  }

  if (error instanceof PayrollPermissionError) {
    return "You do not have permission to manage payroll records.";
  }

  if (error instanceof PayrollApprovedError) {
    return "This payroll month is approved and can no longer be edited.";
  }

  if (error instanceof PayrollValidationError) {
    if (error.message.includes("Other deduction note")) {
      return "Add a note explaining the other deduction.";
    }

    if (error.message.includes("deductions exceed gross")) {
      return "Total deductions exceed this worker's gross salary. Please review the deductions before saving.";
    }

    return "Please review the payroll values and try again.";
  }

  return "Unable to save payroll right now. Please try again.";
}

function readWorkEntries(formData: FormData) {
  const workplaceIds = formData.getAll("workplace_id").map(String);
  const shifts = formData.getAll("shifts").map(String);
  const shiftRates = formData.getAll("shift_rate").map(String);
  const entryCount = Math.max(workplaceIds.length, shifts.length, shiftRates.length);
  const entries: PayrollSaveWorkEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    const shiftValue = Number(shifts[index] || 0);
    const rateValue = Number(shiftRates[index] || 0);

    if (!Number.isFinite(shiftValue) || !Number.isFinite(rateValue)) {
      throw new PayrollValidationError("Shifts and rates must be valid numbers.");
    }

    if (shiftValue < 0 || rateValue < 0) {
      throw new PayrollValidationError("Shifts and rates must be zero or more.");
    }

    entries.push({
      shift_rate: rateValue,
      shifts: shiftValue,
      workplace_id: workplaceIds[index] || null,
    });
  }

  if (entries.length === 0) {
    throw new PayrollValidationError("At least one work entry is required.");
  }

  return entries;
}

export async function savePayrollRecordAction(
  year: number,
  month: number,
  workerId: string,
  _previousState: PayrollFormState,
  formData: FormData,
): Promise<PayrollFormState> {
  const period = readPositivePeriod(year, month);

  try {
    const workEntries = readWorkEntries(formData);
    const deductions = {
      advance: readNumber(formData, "advance"),
      epf: readNumber(formData, "epf"),
      meals: readNumber(formData, "meals"),
      otherDeduction: readNumber(formData, "other_deduction"),
      uniform: readNumber(formData, "uniform"),
    };
    const overrides = {
      advance: readBoolean(formData, "advance_override"),
      meals: readBoolean(formData, "meals_override"),
      otherDeduction: readBoolean(formData, "other_deduction_override"),
      uniform: readBoolean(formData, "uniform_override"),
    };
    const otherNote = String(formData.get("other_note") ?? "").trim() || null;
    const deductionValues = Object.values(deductions);

    if (deductionValues.some((value) => !Number.isFinite(value))) {
      return { error: "Deductions must be valid numbers." };
    }

    if (deductionValues.some((value) => value < 0)) {
      return { error: "Deductions must be zero or more." };
    }

    if (overrides.otherDeduction && deductions.otherDeduction > 0 && !otherNote) {
      return { error: "Add a note explaining the other deduction." };
    }

    const grossSalary = calculateGrossSalary(
      workEntries.map((entry) => ({
        shiftRate: entry.shift_rate,
        shifts: entry.shifts,
      })),
    );
    const totalDeductions = calculateTotalDeductions(deductions);
    const netSalary = calculateNetSalary(grossSalary, totalDeductions);

    if (netSalary < 0) {
      return {
        error:
          "Total deductions exceed this worker's gross salary. Please review the deductions before saving.",
      };
    }

    await savePayrollRecord({
      advance: deductions.advance,
      advance_override: overrides.advance,
      epf: deductions.epf,
      meals: deductions.meals,
      meals_override: overrides.meals,
      month: period.month,
      other_deduction: deductions.otherDeduction,
      other_deduction_override: overrides.otherDeduction,
      other_note: otherNote,
      uniform: deductions.uniform,
      uniform_override: overrides.uniform,
      worker_id: workerId,
      work_entries: workEntries,
      year: period.year,
    });
  } catch (error) {
    return {
      error: getPayrollErrorMessage(error),
    };
  }

  revalidatePath("/payroll");
  revalidatePath(`/payroll/${workerId}`);
  redirect(`/payroll?year=${period.year}&month=${period.month}`);
}

export async function approvePayrollRunAction(
  year: number,
  month: number,
) {
  const period = readPositivePeriod(year, month);

  try {
    await approvePayrollRun(period.year, period.month);
  } catch (error) {
    throw new Error(getPayrollErrorMessage(error));
  }

  revalidatePath("/payroll");
  redirect(`/payroll?year=${period.year}&month=${period.month}`);
}

