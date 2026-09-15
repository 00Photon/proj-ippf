/** The seven official IPPIS divisions, in canonical order. */
export const DIVISIONS = [
  'Director IPPIS Office',
  'Payroll',
  'Payment',
  'Admin',
  'Audit/Checking',
  'ICT',
  'Third Party',
] as const

export type Division = (typeof DIVISIONS)[number]

/** True if the value matches one of the 7 official divisions (case/space-insensitive). */
export function isDivision(value: string): boolean {
  const norm = value.trim().toLowerCase().replace(/\s+/g, ' ')
  return (DIVISIONS as readonly string[]).some((d) => d.toLowerCase() === norm)
}

/** Canonical division name for a raw value, or null if it isn't one of the 7. */
export function canonicalDivision(value: string): Division | null {
  const norm = value.trim().toLowerCase().replace(/\s+/g, ' ')
  const found = (DIVISIONS as readonly string[]).find((d) => d.toLowerCase() === norm)
  return (found as Division) ?? null
}
