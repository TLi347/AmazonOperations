/**
 * Subtract n days from a YYYY-MM-DD date string.
 * Returns a YYYY-MM-DD string.
 */
export function subtractDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
