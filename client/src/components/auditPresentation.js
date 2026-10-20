export const auditRoles = {
  citizen: "Citizen", barangay_personnel: "Barangay Personnel", lgu_personnel: "LGU Personnel",
  police_personnel: "Police Personnel", admin: "Administrator",
};
export const auditEvents = {
  PERSONNEL_ACCOUNT_CREATED: ['Personnel Account Created', 'Provisioned an authorized personnel account', 'users'],
  PERSONNEL_ACCOUNT_UPDATED: ['Personnel Account Updated', 'Updated personnel information or jurisdiction', 'users'],
  PERSONNEL_ACCOUNT_ENABLED: ['Personnel Account Enabled', 'Enabled personnel account access', 'shield'],
  PERSONNEL_ACCOUNT_DISABLED: ['Personnel Account Disabled', 'Suspended personnel account access', 'shield'],
  PERSONNEL_PASSWORD_RESET_REQUESTED: ['Personnel Recovery Requested', 'Requested account recovery for personnel', 'shield'],
  AUTH_PASSWORD_CHANGED: ['Password Changed', 'Voluntarily updated the account password', 'shield'],
  LGU_ACCOUNT_CREATED: ['LGU Account Created', 'Created an authorized LGU personnel account', 'users'],
  LGU_ACCOUNT_UPDATED: ['LGU Account Updated', 'Updated LGU personnel information or jurisdiction', 'users'],
  LGU_ACCOUNT_DISABLED: ['LGU Account Deactivated', 'Suspended LGU account access', 'shield'],
  LGU_ACCOUNT_ENABLED: ['LGU Account Activated', 'Enabled LGU account access', 'shield'],
  LGU_PASSWORD_CHANGED: ['LGU Password Changed', 'Voluntarily updated the account password', 'shield'],
  LGU_PASSWORD_RESET: ['LGU Password Reset', 'Completed authorized account recovery', 'shield'],
  LGU_PASSWORD_RESET_REQUESTED: ['LGU Password Reset Requested', 'Initiated recovery for an LGU account', 'shield'],
  AUTH_LOGIN: ["Successful Login", "Signed in to SafeLink", "users"],
  AUTH_ACCOUNT_LOCKED: ['Login Cooldown Started', 'Applied a progressive sign-in cooldown', 'shield'],
  AUTH_LOGOUT: ["Sign-out Requested", "Requested sign-out from SafeLink", "users"],
  AUTH_CITIZEN_REGISTERED: ["Citizen Registered", "Created a citizen account", "users"],
  AUTH_EMAIL_VERIFIED: ["Email Verified", "Verified account email", "shield"],
  AUTH_PASSWORD_RESET_COMPLETED: ["Password Reset", "Completed a password reset", "shield"],
  AUTH_VERIFICATION_EMAIL_RESENT: ["Verification Email Sent", "Requested a new verification email", "shield"],
  AUTH_VERIFICATION_EMAIL_FAILED: ["Verification Email Failed", "Verification email could not be sent", "priority"],
  PERSONNEL_REGISTRATION_SUBMITTED: ["Personnel Registered", "Created a personnel account", "users"],
  PERSONNEL_APPLICATION_SUBMITTED: ["Personnel Application", "Submitted an application for personnel access", "users"],
  PERSONNEL_APPROVED: ["Personnel Approved", "Approved a personnel account", "shield"],
  USER_STATUS_CHANGED: ["Account Status Changed", "Updated account access status", "shield"],
  USER_DELETED: ["Account Deleted", "Deleted a user account", "shield"],
  AUDIT_EXPORT: ["Audit Export", "Exported recent administrator audit records", "history"],
  INCIDENT_SUBMITTED: ["Incident Report Submitted", "Created a new community safety report", "report"],
  INCIDENT_STATUS_CHANGED: ["Incident Status Updated", "Updated incident response status", "report"],
  INCIDENT_SEVERITY_CHANGED: ["Incident Priority Changed", "Updated official incident severity", "priority"],
  INCIDENT_PRIORITY_CONFIRMED: ["Incident Priority Confirmed", "Confirmed official incident severity", "priority"],
  INCIDENT_BARANGAY_HANDLING_CONFIRMED: ["Barangay Handling Confirmed", "Chose to handle the verified report at Barangay level", "report"],
  INCIDENT_ESCALATION_REQUESTED: ["Escalation Requested", "Requested assistance from an authorized agency", "report"],
  INCIDENT_ESCALATION_ACKNOWLEDGED: ["Escalation Acknowledged", "Acknowledged the escalation request", "report"],
  INCIDENT_REFERRED: ["Incident Referred", "Referred an incident to an authorized agency", "report"],
  INCIDENT_REFERRAL_REMOVED: ["Referral Removed", "Removed an incident referral", "report"],
  INCIDENT_ASSIGNED: ["Incident Assigned", "Assigned an incident to authorized personnel", "users"],
  INCIDENT_REASSIGNED: ["Incident Reassigned", "Changed the assigned responder", "users"],
  INCIDENT_CLOSURE_CONFIRMATION_REQUESTED: ["Closure Confirmation Requested", "Requested confirmation before closing a report", "report"],
  INCIDENT_CLOSURE_CONFIRMED: ["Closure Confirmed", "Confirmed closure of the report", "report"],
  INCIDENT_NOTE_ADDED: ["Incident Note Added", "Added an operational update to the report", "report"],
  INCIDENT_EVIDENCE_UPLOADED: ["Evidence Uploaded", "Attached protected evidence to a report", "shield"],
};
const words = (value = "") => String(value).replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
export function auditPresentation(event) {
  let [title, description, icon] = auditEvents[event.action] || [words(event.action), "Recorded system activity", "history"];
  if (event.action === "AUTH_LOGIN" && event.outcome === "failure") {
    title = "Unsuccessful Login"; description = "A sign-in attempt was not accepted"; icon = "priority";
  }
  if (event.action === "INCIDENT_STATUS_CHANGED" && event.details?.newStatus) {
    description = "Changed incident status to " + event.details.newStatus;
  }
  const actor = event.actorName || [event.actor?.firstName, event.actor?.lastName].filter(Boolean).join(" ") || (event.actorId ? "Former or unavailable account" : "Unauthenticated / system");
  const role = auditRoles[event.actorRole || event.actor?.role] || "Not authenticated / unavailable";
  const resource = event.incident ? "Incident " + String(event.incident) : event.targetUser ? "Account " + String(event.targetUser) : "—";
  return { title, description, icon, actor, role, resource };
}
export function auditTime(value, exact = false) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: exact ? "long" : "short",
  }).format(date);
}
export function dateBoundary(value, end = false) {
  return value ? new Date(value + (end ? "T23:59:59.999+08:00" : "T00:00:00.000+08:00")).toISOString() : "";
}

