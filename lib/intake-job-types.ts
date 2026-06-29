// Locksmith job types for the answered-call intake sheet (maps to ai_leads.job_type).

export const INTAKE_LOCKSMITH_JOB_TYPES = [
  "All keys lost",
  "Copy",
  "Lockout",
  "Ignition",
  "Something else",
] as const

export type IntakeLocksmithJobType = (typeof INTAKE_LOCKSMITH_JOB_TYPES)[number]

export function isIntakeLocksmithJobType(value: string): value is IntakeLocksmithJobType {
  return (INTAKE_LOCKSMITH_JOB_TYPES as readonly string[]).includes(value)
}
