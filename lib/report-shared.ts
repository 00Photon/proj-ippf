import type { jsPDF } from 'jspdf'

/**
 * Shared drawing helpers + styles for the admin PDF reports (division and
 * general vote). A4 portrait, 42pt margins, matching the admin UI palette.
 */

export const PAGE_W = 595.28
export const M = 42
export const CONTENT_W = PAGE_W - M * 2

export const GREEN = '#0b8a51'
export const GREEN_DARK = '#17352b'
export const INK = '#26483a'
export const MUTED = '#587268'
export const LINE = '#dbe8e1'

export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function setFill(doc: jsPDF, hex: string): void {
  const [r, g, b] = hexToRgb(hex)
  doc.setFillColor(r, g, b)
}

export function setText(doc: jsPDF, hex: string): void {
  const [r, g, b] = hexToRgb(hex)
  doc.setTextColor(r, g, b)
}

export function setStroke(doc: jsPDF, hex: string): void {
  const [r, g, b] = hexToRgb(hex)
  doc.setDrawColor(r, g, b)
}

/** jsPDF core fonts only cover WinAnsi — drop anything outside it. */
export function safe(text: string): string {
  return text.replace(/[^\r\n\t\x20-\x7e\xa0-\xff]/g, '?')
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0
  return Math.round((part / whole) * 1000) / 10
}

export function fmtPhone(phone: string): string {
  if (phone.length === 11) return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`
  return phone
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function deviceLabel(ua: string | null): string {
  if (!ua) return 'Unknown'
  if (/iphone|ipad/i.test(ua)) return 'iOS'
  if (/android/i.test(ua)) return 'Android'
  if (/windows/i.test(ua)) return 'Windows'
  if (/mac os/i.test(ua)) return 'macOS'
  if (/linux/i.test(ua)) return 'Linux'
  return 'Other'
}

/** Page-break guard: adds a page when `needed` pt don't fit above the footer. */
export function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= 800) return y
  doc.addPage()
  return 42
}

export function sectionTitle(doc: jsPDF, y: number, eyebrow: string, title: string): number {
  y = ensureSpace(doc, y, 64)
  let yy = y
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  setText(doc, '#71867d')
  doc.text(safe(eyebrow.toUpperCase()), M, yy, { charSpace: 0.9 })
  yy += 15
  doc.setFontSize(13)
  setText(doc, GREEN_DARK)
  doc.text(safe(title), M, yy)
  yy += 8
  setStroke(doc, LINE)
  doc.setLineWidth(0.75)
  doc.line(M, yy, PAGE_W - M, yy)
  return yy + 14
}

export function statBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  sub: string,
  accent: string,
): void {
  setFill(doc, '#fbfdfc')
  setStroke(doc, LINE)
  doc.setLineWidth(0.75)
  doc.roundedRect(x, y, w, h, 6, 6, 'FD')
  setFill(doc, accent)
  doc.roundedRect(x + 10, y + 10, 22, 4, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  setText(doc, '#71867d')
  doc.text(safe(label.toUpperCase()), x + 10, y + 24, { charSpace: 0.5 })
  doc.setFontSize(17)
  setText(doc, INK)
  doc.text(safe(value), x + 10, y + 42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setText(doc, MUTED)
  doc.text(safe(sub), x + 10, y + 53)
}

/** Report footer band with page numbers, applied to every page at the end. */
export function footer(doc: jsPDF, pageNo: number, pageCount: number, reportTitle: string, generatedAt: string): void {
  doc.setPage(pageNo)
  setStroke(doc, LINE)
  doc.setLineWidth(0.75)
  doc.line(M, 812, PAGE_W - M, 812)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setText(doc, '#8a9a91')
  doc.text(safe(`IPPIS Staff Recognition Portal - ${reportTitle}`), M, 824)
  doc.text(safe(`Page ${pageNo} of ${pageCount} - generated ${fmtDateTime(generatedAt)}`), PAGE_W - M, 824, {
    align: 'right',
  })
}
