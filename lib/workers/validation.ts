import {
  emergencyContactRelationships,
  workerGenders,
  workerStatuses,
  workerTypes,
  type EmergencyContactRelationship,
  type WorkerGender,
  type WorkerSaveInput,
  type WorkerStatus,
  type WorkerType,
} from "./types";

export type WorkerFormState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof WorkerSaveInput, string>>;
};

function readOptionalString(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();

  return value || null;
}

function readRequiredString(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

function readMoney(formData: FormData, field: string) {
  const rawValue = String(formData.get(field) ?? "").trim();

  if (!rawValue) {
    return 0;
  }

  return Number(rawValue);
}

function isWorkerStatus(value: string): value is WorkerStatus {
  return workerStatuses.includes(value as WorkerStatus);
}

function isWorkerType(value: string): value is WorkerType {
  return workerTypes.includes(value as WorkerType);
}

function isWorkerGender(value: string): value is WorkerGender {
  return workerGenders.includes(value as WorkerGender);
}

function isEmergencyContactRelationship(
  value: string,
): value is EmergencyContactRelationship {
  return emergencyContactRelationships.includes(
    value as EmergencyContactRelationship,
  );
}

function readOptionalDate(formData: FormData, field: string) {
  const value = readOptionalString(formData, field);

  if (!value) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "invalid";
}

type ValidateWorkerFormOptions = {
  previousStatus?: WorkerStatus | null;
  isCreate?: boolean;
};

export function validateWorkerForm(
  formData: FormData,
  options: ValidateWorkerFormOptions = {},
):
  | {
      ok: true;
      data: WorkerSaveInput;
    }
  | {
      ok: false;
      state: WorkerFormState;
    } {
  const employeeNo = readRequiredString(formData, "employee_no");
  const fullName = readRequiredString(formData, "full_name");
  const workerTypeValue = readRequiredString(formData, "worker_type") || "permanent";
  const workerType = isWorkerType(workerTypeValue) ? workerTypeValue : null;
  const basicSalary = readMoney(formData, "basic_salary");
  const defaultShiftRate = readMoney(formData, "default_shift_rate");
  const statusValue = readRequiredString(formData, "status");
  const status = isWorkerStatus(statusValue) ? statusValue : null;
  const genderValue = readOptionalString(formData, "gender");
  const gender = genderValue && isWorkerGender(genderValue) ? genderValue : null;
  const relationshipValue = readOptionalString(
    formData,
    "emergency_contact_relationship",
  );
  const emergencyContactRelationship =
    relationshipValue && isEmergencyContactRelationship(relationshipValue)
      ? relationshipValue
      : null;
  const dateOfBirth = readOptionalDate(formData, "date_of_birth");
  const joinedDate = readOptionalDate(formData, "joined_date");
  const statusEffectiveDate = readOptionalDate(
    formData,
    "status_effective_date",
  );
  const statusReason = readOptionalString(formData, "status_reason");
  const statusNote = readOptionalString(formData, "status_note");
  const isStatusTransition = options.isCreate
    ? status !== "active"
    : Boolean(status && options.previousStatus !== status);
  const today = new Date().toISOString().slice(0, 10);
  const fieldErrors: WorkerFormState["fieldErrors"] = {};

  if (!employeeNo) {
    fieldErrors.employee_no = "Employee No is required.";
  }

  if (!fullName) {
    fieldErrors.full_name = "Full Name is required.";
  }

  if (!workerType) {
    fieldErrors.worker_type = "Choose a valid worker type.";
  }

  if (!Number.isFinite(basicSalary) || basicSalary < 0) {
    fieldErrors.basic_salary = "Basic Salary must be zero or more.";
  }

  if (!Number.isFinite(defaultShiftRate) || defaultShiftRate < 0) {
    fieldErrors.default_shift_rate = "Default Shift Rate must be zero or more.";
  }

  if (!status) {
    fieldErrors.status = "Choose a valid worker status.";
  }

  if (genderValue && !gender) {
    fieldErrors.gender = "Choose a valid gender.";
  }

  if (relationshipValue && !emergencyContactRelationship) {
    fieldErrors.emergency_contact_relationship =
      "Choose a valid relationship.";
  }

  if (dateOfBirth === "invalid") {
    fieldErrors.date_of_birth = "Choose a valid date of birth.";
  }

  if (dateOfBirth && dateOfBirth !== "invalid" && dateOfBirth > today) {
    fieldErrors.date_of_birth = "Date of birth cannot be in the future.";
  }

  if (joinedDate === "invalid") {
    fieldErrors.joined_date = "Choose a valid joined date.";
  }

  if (statusEffectiveDate === "invalid") {
    fieldErrors.status_effective_date = "Choose a valid effective date.";
  }

  if (isStatusTransition && !statusEffectiveDate) {
    fieldErrors.status_effective_date =
      status === "resigned"
        ? "Resignation date is required."
        : status === "terminated"
          ? "Termination date is required."
          : "Effective date is required.";
  }

  if (status === "terminated" && isStatusTransition && !statusReason) {
    fieldErrors.status_reason = "Termination reason is required.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      state: {
        error: "Please review the highlighted fields.",
        fieldErrors,
      },
    };
  }

  if (!status || !workerType) {
    return {
      ok: false,
      state: {
        error: "Choose valid worker details.",
        fieldErrors: {
          ...(status ? {} : { status: "Choose a valid worker status." }),
          ...(workerType ? {} : { worker_type: "Choose a valid worker type." }),
        },
      },
    };
  }

  return {
    ok: true,
    data: {
      employee_no: employeeNo,
      worker_type: workerType,
      full_name: fullName,
      nic: readOptionalString(formData, "nic"),
      date_of_birth: dateOfBirth,
      gender,
      etf_no: readOptionalString(formData, "etf_no"),
      epf_no: readOptionalString(formData, "epf_no"),
      phone: readOptionalString(formData, "phone"),
      secondary_phone: readOptionalString(formData, "secondary_phone"),
      address: readOptionalString(formData, "address"),
      emergency_contact_name: readOptionalString(
        formData,
        "emergency_contact_name",
      ),
      emergency_contact_relationship: emergencyContactRelationship,
      emergency_contact_phone: readOptionalString(
        formData,
        "emergency_contact_phone",
      ),
      previous_occupation: readOptionalString(
        formData,
        "previous_occupation",
      ),
      previous_employer: readOptionalString(formData, "previous_employer"),
      joined_date: joinedDate,
      basic_salary: basicSalary,
      default_shift_rate: defaultShiftRate,
      status,
      notes: readOptionalString(formData, "notes"),
      status_effective_date: statusEffectiveDate,
      status_reason: statusReason,
      status_note: statusNote,
    },
  };
}
