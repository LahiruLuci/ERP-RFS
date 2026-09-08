"use client";

import { useState } from "react";

import { PayslipPrintButton } from "./print-button";
import {
  WorkerPayslip,
  type PayslipCustomization,
  type WorkerPayslipDocumentData,
} from "./worker-payslip";

type PayslipPreviewProps = {
  consistencyWarnings: string[];
  data: WorkerPayslipDocumentData;
};

const defaultCustomization: PayslipCustomization = {
  authorizedByName: "",
  companyName: "Royal Force Security Services",
  documentTitle: "Pay Slip",
  employerSignatureName: "",
  footerNote: "",
  hideZeroDeductions: false,
  payslipNote: "",
};

export function PayslipPreview({
  consistencyWarnings,
  data,
}: PayslipPreviewProps) {
  const [savedCustomization, setSavedCustomization] =
    useState<PayslipCustomization>(defaultCustomization);
  const [draftCustomization, setDraftCustomization] =
    useState<PayslipCustomization>(defaultCustomization);
  const [isEditing, setIsEditing] = useState(false);
  const activeCustomization = isEditing
    ? draftCustomization
    : savedCustomization;

  const isEdited =
    JSON.stringify(activeCustomization) !== JSON.stringify(defaultCustomization);

  function updateDraft<K extends keyof PayslipCustomization>(
    key: K,
    value: PayslipCustomization[K],
  ) {
    setDraftCustomization((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleEdit() {
    setDraftCustomization(savedCustomization);
    setIsEditing(true);
  }

  function handleSavePreview() {
    setSavedCustomization(draftCustomization);
    setIsEditing(false);
  }

  function handleCancel() {
    setDraftCustomization(savedCustomization);
    setIsEditing(false);
  }

  function handleReset() {
    setSavedCustomization(defaultCustomization);
    setDraftCustomization(defaultCustomization);
    setIsEditing(false);
  }

  return (
    <>
      <section className="app-surface print:hidden rounded-lg p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Payslip Options
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Preview edits affect only this document before printing. They do not
              change payroll records.
            </p>
            <p className="mt-1 text-xs font-semibold text-amber-800">
              For a clean payslip PDF, disable browser Headers and Footers in the
              print dialog.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="app-focus btn-secondary min-h-10 rounded-md px-4 text-sm font-bold transition"
              onClick={handleEdit}
              type="button"
            >
              Edit Payslip
            </button>
            <button
              className="app-focus btn-secondary min-h-10 rounded-md px-4 text-sm font-bold transition"
              onClick={handleReset}
              type="button"
            >
              Reset to Payroll Data
            </button>
            <PayslipPrintButton />
          </div>
        </div>

        {isEditing ? (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                Company Display Name
              </span>
              <input
                className="field-control min-h-10 rounded-md px-3 text-sm transition"
                onChange={(event) =>
                  updateDraft("companyName", event.target.value)
                }
                type="text"
                value={draftCustomization.companyName}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                Document Title
              </span>
              <input
                className="field-control min-h-10 rounded-md px-3 text-sm transition"
                onChange={(event) =>
                  updateDraft("documentTitle", event.target.value)
                }
                type="text"
                value={draftCustomization.documentTitle}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                Employer Signature Name
              </span>
              <input
                className="field-control min-h-10 rounded-md px-3 text-sm transition"
                onChange={(event) =>
                  updateDraft("employerSignatureName", event.target.value)
                }
                type="text"
                value={draftCustomization.employerSignatureName}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                Authorized By Name
              </span>
              <input
                className="field-control min-h-10 rounded-md px-3 text-sm transition"
                onChange={(event) =>
                  updateDraft("authorizedByName", event.target.value)
                }
                type="text"
                value={draftCustomization.authorizedByName}
              />
            </label>
            <label className="flex flex-col gap-1.5 lg:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                Payslip Note
              </span>
              <textarea
                className="field-control min-h-20 rounded-md px-3 py-2 text-sm transition"
                onChange={(event) =>
                  updateDraft("payslipNote", event.target.value)
                }
                value={draftCustomization.payslipNote}
              />
            </label>
            <label className="flex flex-col gap-1.5 lg:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-primary)]">
                Footer Note
              </span>
              <textarea
                className="field-control min-h-20 rounded-md px-3 py-2 text-sm transition"
                onChange={(event) =>
                  updateDraft("footerNote", event.target.value)
                }
                value={draftCustomization.footerNote}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] lg:col-span-2">
              <input
                checked={draftCustomization.hideZeroDeductions}
                className="size-4"
                onChange={(event) =>
                  updateDraft("hideZeroDeductions", event.target.checked)
                }
                type="checkbox"
              />
              Hide zero-value deduction rows
            </label>
            <div className="flex flex-col gap-2 sm:flex-row lg:col-span-2">
              <button
                className="app-focus btn-primary min-h-10 rounded-md px-4 text-sm font-bold transition"
                onClick={handleSavePreview}
                type="button"
              >
                Save Preview Changes
              </button>
              <button
                className="app-focus btn-secondary min-h-10 rounded-md px-4 text-sm font-bold transition"
                onClick={handleCancel}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="overflow-x-auto py-2 print:overflow-visible print:p-0">
        <WorkerPayslip
          consistencyWarnings={consistencyWarnings}
          customization={activeCustomization}
          data={data}
          isEdited={isEdited}
        />
      </div>
    </>
  );
}
