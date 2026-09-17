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

/** Per-division chart palette, shared by the admin charts and the PDF report. */
export const DIVISION_COLORS = [
  '#0b8a51', '#2563eb', '#b78014', '#7c3aed', '#b04a4a', '#0e7490', '#c2410c',
] as const

/** Stable color for a division by its index in the standings list. */
export function divisionColor(index: number): string {
  return DIVISION_COLORS[index % DIVISION_COLORS.length]
}
