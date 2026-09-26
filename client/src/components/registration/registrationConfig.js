export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const phonePattern = /^(09|\+639)\d{9}$/;

export const passwordRequirements = [
  { key: "length", label: "At least 8 characters", test: (value) => value.length >= 8 },
  { key: "upper", label: "One uppercase letter", test: (value) => /[A-Z]/.test(value) },
  { key: "number", label: "One number", test: (value) => /\d/.test(value) },
  { key: "special", label: "One special character", test: (value) => /[\W_]/.test(value) },
];

export const personnelRoles = Object.freeze({
  barangay_personnel: {
    label: "Barangay Personnel",
    icon: "users",
    copy: "Support verified response within an authorized barangay.",
    heading: "Keep your community informed and supported.",
    description: "Apply for barangay-level access within your official jurisdiction.",
  },
  lgu_personnel: {
    label: "LGU Personnel",
    icon: "map",
    copy: "Coordinate municipal or city response operations.",
    heading: "Coordinate local response with confidence.",
    description: "Apply for municipal or city operations access through SafeLink.",
  },
  police_personnel: {
    label: "Police Personnel",
    icon: "shield",
    copy: "Access authorized partner-response information.",
    heading: "Stay connected to verified community incidents.",
    description: "Apply for jurisdiction-scoped police response access.",
  },
});

export const initialRegistrationValues = Object.freeze({
  role: "",
  firstName: "",
  lastName: "",
  middleInitial: "",
  phoneNumber: "",
  email: "",
  municipalityOrCity: "",
  barangay: "",
  street: "",
  zipCode: "",
  password: "",
  confirmPassword: "",
});

export const citizenSteps = ["Personal", "Address", "Security"];
export const personnelSteps = ["Role", "Identity", "Jurisdiction", "Security", "Review"];

export function validateRegistration(values, mode) {
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();
  const middleInitial = values.middleInitial.trim();
  const email = values.email.trim().toLowerCase();
  const passwordFailure = passwordRequirements.find(({ test }) => !test(values.password));

  return {
    role: mode === "personnel" && !personnelRoles[values.role] ? "Choose a personnel account type." : "",
    firstName: !firstName ? "First name is required." : !/^[A-Z]/.test(firstName) ? "First name must start with an uppercase letter." : "",
    lastName: !lastName ? "Last name is required." : !/^[A-Z]/.test(lastName) ? "Last name must start with an uppercase letter." : "",
    middleInitial: middleInitial && !/^[A-Z]$/.test(middleInitial) ? "Use one uppercase letter." : "",
    phoneNumber: !values.phoneNumber.trim() ? "Phone number is required." : !phonePattern.test(values.phoneNumber.trim()) ? "Use 09XXXXXXXXX or +639XXXXXXXXX." : "",
    email: !email ? "Email is required." : !emailPattern.test(email) || !email.endsWith("@gmail.com") ? "Enter a valid Gmail address." : "",
    municipalityOrCity: !values.municipalityOrCity ? "Municipality or city is required." : "",
    barangay: (mode === "citizen" || values.role === "barangay_personnel") && !values.barangay.trim() ? "Barangay is required." : "",
    password: passwordFailure ? `Password must contain ${passwordFailure.label.toLowerCase()}.` : "",
    confirmPassword: !values.confirmPassword ? "Confirm password is required." : values.password !== values.confirmPassword ? "Passwords do not match." : "",
  };
}

export function citizenPayload(values) {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    middleInitial: values.middleInitial.trim() || undefined,
    phoneNumber: values.phoneNumber.trim(),
    email: values.email.trim().toLowerCase(),
    address: {
      municipalityOrCity: values.municipalityOrCity,
      barangay: values.barangay.trim(),
      street: values.street.trim() || undefined,
      zipCode: values.zipCode.trim() || undefined,
    },
    password: values.password,
  };
}

export function personnelPayload(values) {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    middleInitial: values.middleInitial.trim() || undefined,
    phoneNumber: values.phoneNumber.trim(),
    email: values.email.trim().toLowerCase(),
    role: values.role,
    jurisdiction: {
      municipalityOrCity: values.municipalityOrCity,
      ...(values.role === "barangay_personnel" ? { barangay: values.barangay.trim() } : {}),
    },
    password: values.password,
  };
}
