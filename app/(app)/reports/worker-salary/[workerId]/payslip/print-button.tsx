"use client";

export function PayslipPrintButton() {
  return (
    <button
      className="app-focus btn-primary min-h-10 rounded-md px-4 text-sm font-bold transition"
      onClick={() => window.print()}
      type="button"
    >
      Print / Save PDF
    </button>
  );
}
