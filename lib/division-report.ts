import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { divisionColor } from '@/lib/division-list'

/**
 * Builds the admin "Division vote report" PDF: formatted cover header,
 * percentage summary, vote-share charts, per-division result tables and the
 * full audit appendix. Runs client-side (dynamically imported on export).
 */

export interface DivisionReportStanding {
  division: string
  voters: number
  leader: { sn: number; name: string; voteCount: number } | null
  results: { sn: number; name: string; voteCount: number }[]
}

export interface DivisionReportVote {
  id: number
  voterPhone: string
  candidateSn: number
  candidateName: string
  division: string
  remarks: string | null
  ip: string | null
  location: string | null
  userAgent: string | null
  isProxy: boolean
  votedAt: string
}

export interface DivisionReportInput {
  month: string
  generatedAt: string
  divisionOpen: boolean
  votingMonth: string
  standings: DivisionReportStanding[]
  votes: DivisionReportVote[]
  perDay: { day: string; count: number }[]
}

/* ---- Palette (matches the admin UI) ---- */

const GREEN = '#0b8a51'
const GREEN_DARK = '#17352b'
const GREEN_SOFT = '#e3f4e9'
const INK = '#26483a'
const MUTED = '#587268'
const LINE = '#dbe8e1'

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function setFill(doc: jsPDF, hex: string): void {
  const [r, g, b] = hexToRgb(hex)
  doc.setFillColor(r, g, b)
}

function setText(doc: jsPDF, hex: string): void {
  const [r, g, b] = hexToRgb(hex)
  doc.setTextColor(r, g, b)
}

function setStroke(doc: jsPDF, hex: string): void {
  const [r, g, b] = hexToRgb(hex)
  doc.setDrawColor(r, g, b)
}

/** jsPDF core fonts only cover WinAnsi — drop anything outside it. */
function safe(text: string): string {
  return text.replace(/[^\r\n\t\x20-\x7e\xa0-\xff]/g, '?')
}

function pct(part: number, whole: number): number {
  if (!whole) return 0
  return Math.round((part / whole) * 1000) / 10
}

function fmtPhone(phone: string): string {
  if (phone.length === 11) return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`
  return phone
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function deviceLabel(ua: string | null): string {
  if (!ua) return 'Unknown'
  if (/iphone|ipad/i.test(ua)) return 'iOS'
  if (/android/i.test(ua)) return 'Android'
  if (/windows/i.test(ua)) return 'Windows'
  if (/mac os/i.test(ua)) return 'macOS'
  if (/linux/i.test(ua)) return 'Linux'
  return 'Other'
}

/* ---- Layout helpers (A4 pt: 595.28 x 841.89) ---- */

const PAGE_W = 595.28
const M = 42 // side margin
const CONTENT_W = PAGE_W - M * 2

/** Table end-Y across autotable versions (functional API exposes lastAutoTable). */
function tableEndY(doc: jsPDF, fallback: number): number {
  const last = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
  return typeof last?.finalY === 'number' ? last.finalY : fallback
}

function sectionTitle(doc: jsPDF, y: number, eyebrow: string, title: string): number {
  y = ensureSpace(doc, y, 64)
  let yy = y
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  setText(doc, '#71867d')
  const eyebrowText = safe(eyebrow.toUpperCase())
  doc.text(eyebrowText, M, yy, { charSpace: 0.9 })
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

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= 800) return y
  doc.addPage()
  return 42
}

function statBox(
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
  // accent chip
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

/** Horizontal share bars for per-division vote share. */
function shareBars(
  doc: jsPDF,
  y: number,
  items: { label: string; value: number; total: number; color: string }[],
): number {
  let yy = y
  const labelW = 118
  const barX = M + labelW + 8
  const barMaxW = CONTENT_W - labelW - 118
  const rowH = 17

  for (const item of items) {
    if (yy + rowH > 800) {
      doc.addPage()
      yy = 42
    }
    const share = pct(item.value, item.total)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    setText(doc, INK)
    doc.text(safe(item.label), M, yy, { maxWidth: labelW - 4 })

    // track
    setFill(doc, '#eef3f0')
    doc.roundedRect(barX, yy - 6, barMaxW, 8, 4, 4, 'F')
    // bar — proportional to share, with a minimum sliver for nonzero values
    if (item.value > 0) {
      const w = Math.max((item.value / item.total) * barMaxW, 6)
      setFill(doc, item.color)
      doc.roundedRect(barX, yy - 6, w, 8, 4, 4, 'F')
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    setText(doc, MUTED)
    const countText = `${item.value}`
    doc.text(countText, barX + barMaxW + 8, yy)
    setText(doc, GREEN)
    doc.text(`${share}%`, barX + barMaxW + 34, yy)
    yy += rowH
  }
  return yy
}

/** Vertical bars for the daily turnout trend. */
function dailyTrend(doc: jsPDF, y: number, perDay: { day: string; count: number }[]): number {
  if (perDay.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setText(doc, '#8a9a91')
    doc.text('No votes recorded in this period.', M, y)
    return y + 16
  }

  const chartH = 90
  const baseY = y + chartH
  const slot = CONTENT_W / perDay.length
  const barW = Math.max(Math.min(slot - 4, 26), 3)
  const max = Math.max(1, ...perDay.map((d) => d.count))

  setStroke(doc, LINE)
  doc.setLineWidth(0.5)
  doc.line(M, baseY, PAGE_W - M, baseY)

  perDay.forEach((d, i) => {
    const h = Math.max((d.count / max) * (chartH - 14), d.count > 0 ? 3 : 1)
    const x = M + i * slot + (slot - barW) / 2
    setFill(doc, d.count > 0 ? GREEN : '#cfe3d8')
    doc.roundedRect(x, baseY - h, barW, h, 2, 2, 'F')
    // count above the tallest bars only, to avoid clutter
    if (perDay.length <= 14 || d.count === max) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      setText(doc, MUTED)
      doc.text(String(d.count), x + barW / 2, baseY - h - 4, { align: 'center' })
    }
    // date label — thin out on dense ranges
    const showEvery = Math.ceil(perDay.length / 12)
    if (i % showEvery === 0 || i === perDay.length - 1) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      setText(doc, '#8a9a91')
      const label = safe(d.day.slice(5)) // MM-DD
      doc.text(label, x + barW / 2, baseY + 10, { align: 'center' })
    }
  })
  return baseY + 20
}

function footer(doc: jsPDF, pageNo: number, pageCount: number, generatedAt: string): void {
  doc.setPage(pageNo)
  setStroke(doc, LINE)
  doc.setLineWidth(0.75)
  doc.line(M, 812, PAGE_W - M, 812)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setText(doc, '#8a9a91')
  doc.text(safe('IPPIS Staff Recognition Portal - Division vote report'), M, 824)
  doc.text(
    safe(`Page ${pageNo} of ${pageCount} - generated ${fmtDateTime(generatedAt)}`),
    PAGE_W - M,
    824,
    { align: 'right' },
  )
}

/* ---- Main builder ---- */

export function buildDivisionReportPdf(input: DivisionReportInput): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const { month, generatedAt, divisionOpen, votingMonth, standings, votes, perDay } = input

  const totalVotes = votes.length
  const activeDivisions = standings.filter((d) => d.voters > 0).length
  const decided = standings.filter((d) => d.leader).length
  const totalDivisions = Math.max(standings.length, 7)
  const proxyCount = votes.filter((v) => v.isProxy).length

  /* Header band */
  setFill(doc, GREEN)
  doc.rect(0, 0, PAGE_W, 96, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  doc.setTextColor(255, 255, 255)
  doc.text('Division Vote Report', M, 42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(214, 236, 224)
  doc.text('IPPIS Staff Recognition Portal', M, 60)
  // phase badge
  const badge = divisionOpen ? 'DIVISION VOTING OPEN' : 'DIVISION VOTING CLOSED'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  const badgeW = doc.getTextWidth(badge) + 16
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(PAGE_W - M - badgeW, 26, badgeW, 18, 9, 9, 'F')
  setText(doc, divisionOpen ? GREEN : '#6b7f76')
  doc.text(badge, PAGE_W - M - badgeW / 2, 38, { align: 'center' })
  // cycle line
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  const period = month === '__all__' ? 'All-time (every cycle)' : `${month} cycle`
  doc.text(safe(`Reporting period: ${period}`), M, 80)
  if (month === '__all__' && votingMonth) {
    doc.text(safe(`Current cycle: ${votingMonth}`), PAGE_W - M, 80, { align: 'right' })
  }

  /* Summary stat boxes */
  let y = 120
  const boxW = (CONTENT_W - 3 * 10) / 4
  const boxH = 62
  statBox(doc, M, y, boxW, boxH, 'Division votes', String(totalVotes), `${proxyCount} flagged VPN (${pct(proxyCount, totalVotes)}%)`, GREEN)
  statBox(doc, M + boxW + 10, y, boxW, boxH, 'Participation', `${pct(activeDivisions, totalDivisions)}%`, `${activeDivisions}/${totalDivisions} divisions voting`, '#2563eb')
  statBox(doc, M + 2 * (boxW + 10), y, boxW, boxH, 'Divisions decided', `${pct(decided, totalDivisions)}%`, `${decided}/${totalDivisions} winners ready`, '#b78014')
  statBox(doc, M + 3 * (boxW + 10), y, boxW, boxH, 'Avg votes / division', activeDivisions ? (totalVotes / activeDivisions).toFixed(1) : '0', 'across participating divisions', '#7c3aed')
  y += boxH + 26

  /* Vote share by division */
  y = sectionTitle(doc, y, 'Vote share', 'Votes by division')
  const shareItems = standings.map((d, i) => ({
    label: d.division,
    value: d.voters,
    total: totalVotes,
    color: divisionColor(i),
  }))
  y = shareBars(doc, y, shareItems)
  y += 12

  /* Daily turnout */
  y = sectionTitle(doc, y, 'Turnout', 'Division votes per day')
  y = dailyTrend(doc, y, perDay)
  y += 12

  /* Winners summary */
  const winners = standings.filter((d) => d.leader)
  if (winners.length > 0) {
    y = sectionTitle(doc, y, 'Outcomes', 'Division winners (top vote-getter per division)')
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Division', 'Winner', 'S/N', 'Votes', 'Share of division', 'Share of all votes']],
      body: winners.map((d) => [
        safe(d.division),
        safe(d.leader!.name),
        String(d.leader!.sn),
        String(d.leader!.voteCount),
        `${pct(d.leader!.voteCount, d.voters)}%`,
        `${pct(d.leader!.voteCount, totalVotes)}%`,
      ]),
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: hexToRgb(INK), lineColor: hexToRgb(LINE), lineWidth: 0.5 },
      headStyles: { fillColor: hexToRgb(GREEN), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: hexToRgb('#f7fbf9') },
      theme: 'grid',
    })
    y = tableEndY(doc, y) + 24
  }

  /* Per-division results */
  for (const d of standings.filter((x) => x.results.length > 0)) {
    y = ensureSpace(doc, y, 110)
    const color = divisionColor(standings.findIndex((s) => s.division === d.division))
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    setText(doc, '#71867d')
    doc.text(safe(d.division.toUpperCase()), M, y, { charSpace: 0.9 })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    setText(doc, MUTED)
    doc.text(safe(`${d.voters} vote${d.voters === 1 ? '' : 's'} cast`), PAGE_W - M, y, { align: 'right' })
    y += 6
    setFill(doc, color)
    doc.roundedRect(M, y, CONTENT_W, 2.5, 1, 1, 'F')
    y += 10

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Rank', 'S/N', 'Candidate', 'Votes', 'Share of division']],
      body: d.results.map((r, i) => [
        String(i + 1),
        String(r.sn),
        safe(r.name),
        String(r.voteCount),
        `${pct(r.voteCount, d.voters)}%`,
      ]),
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4.5, textColor: hexToRgb(INK), lineColor: hexToRgb(LINE), lineWidth: 0.5 },
      headStyles: { fillColor: hexToRgb('#eef7f2'), textColor: hexToRgb(GREEN_DARK), fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 44 }, 3: { cellWidth: 54, halign: 'right' }, 4: { cellWidth: 100, halign: 'right' } },
      theme: 'grid',
    })
    y = tableEndY(doc, y) + 20
  }

  /* Audit appendix */
  doc.addPage()
  y = 42
  y = sectionTitle(doc, y, 'Appendix', 'Full division vote audit trail')
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['#', 'Voter phone', 'Division', 'Voted for', 'Remarks', 'IP', 'Device', 'Time']],
    body: votes.map((v) => [
      String(v.id),
      safe(fmtPhone(v.voterPhone)),
      safe(v.division),
      safe(`${v.candidateName} (#${v.candidateSn})`),
      safe((v.remarks ?? '-').slice(0, 80)),
      safe(v.ip ?? '-'),
      safe(deviceLabel(v.userAgent)) + (v.isProxy ? ' (VPN)' : ''),
      safe(fmtDateTime(v.votedAt)),
    ]),
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 3.5, textColor: hexToRgb(INK), lineColor: hexToRgb('#e4eee8'), lineWidth: 0.4 },
    headStyles: { fillColor: hexToRgb(GREEN_DARK), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: hexToRgb('#f7fbf9') },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 72 },
      2: { cellWidth: 66 },
      4: { cellWidth: 96 },
      5: { cellWidth: 62 },
      6: { cellWidth: 48 },
      7: { cellWidth: 74 },
    },
    theme: 'grid',
    rowPageBreak: 'avoid',
  })

  if (votes.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setText(doc, '#8a9a91')
    doc.text('No division votes recorded in this reporting period.', M, tableEndY(doc, y) + 20)
  }

  /* Footers on every page */
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    footer(doc, i, pageCount, generatedAt)
  }

  return doc
}
