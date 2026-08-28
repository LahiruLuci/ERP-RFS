export type PayrollDeductionValues = {
  advance: number;
  epf: number;
  meals: number;
  otherDeduction: number;
  uniform: number;
};

export type PayrollWorkEntryValues = {
  shiftRate: number;
  shifts: number;
};

function toCents(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 100);
}

function fromCents(value: number) {
  return value / 100;
}

export function calculateLineGross(entry: PayrollWorkEntryValues) {
  const shifts = Number.isFinite(entry.shifts) ? entry.shifts : 0;
  const rateCents = toCents(entry.shiftRate);

  return fromCents(Math.round(shifts * rateCents));
}

export function calculateGrossSalary(entries: PayrollWorkEntryValues[]) {
  return fromCents(
    entries.reduce(
      (total, entry) => total + toCents(calculateLineGross(entry)),
      0,
    ),
  );
}

export function calculateTotalDeductions(deductions: PayrollDeductionValues) {
  return fromCents(
    toCents(deductions.advance) +
      toCents(deductions.epf) +
      toCents(deductions.meals) +
      toCents(deductions.uniform) +
      toCents(deductions.otherDeduction),
  );
}

export function calculateNetSalary(
  grossSalary: number,
  totalDeductions: number,
) {
  return fromCents(toCents(grossSalary) - toCents(totalDeductions));
}
