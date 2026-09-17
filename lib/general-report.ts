import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { divisionColor } from '@/lib/division-list'
import {
  CONTENT_W,
  GREEN,
  GREEN_DARK,
  INK,
  LINE,
  M,
  MUTED,
  PAGE_W,
  deviceLabel,
  fmtPhone,
  fmtDateTime,
  footer,
  hexToRgb,
  pct,
  safe,
  sectionTitle,
  setFill,
  setText,
  setStroke,
  statBox,
} from '@/lib/report-shared'

/**
 * Builds the admin "Vote report" PDF for the general (public) ballot: cover
 * header, percentage summary, vote-share donut-free chart bars, daily/hourly
 * turnout charts, full standings with percentages, and the audit appendix.
 * Runs client-side (dynamically imported on export).
 */

export interface GeneralReportResult {
  sn: number
  name: string
  voteCount: number
}

export interface GeneralReportVote {
  id: number
  voterPhone: string
  voterSn: number | null
  candidateSn: number
  candidateName: string
  remarks: string | null
  ip: string | null
  userAgent: string | null
  location: string | null
  isProxy: boolean
  votedAt: string
}

export interface GeneralReportInput {
  month: string
  generatedAt: string
  votingOpen: boolean
  votingMonth: string
  results: {
    totalVotes: number
    totalStaff: number
    turnoutPct: number
    remainingVotes: number
    leader: GeneralReportResult | null
    proxyCount: number
    uniqueIps: number
    results: GeneralReportResult[]
    perDay: { day: string; count: number }[]
    perHour: { hour: string; count: number }[]
    votes: GeneralReportVote[]
  }
}

/** Table end-Y across autotable versions (functional API exposes lastAutoTable). */
function tableEndY(doc: jsPDF, fallback: number): number {
  const last = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
  return typeof last?.finalY === 'number' ? last.finalY : fallback
}

/** Horizontal share bars: label | proportional bar | count | share %. */
function shareBars(
  doc: jsPDF,
  y: number,
  items: { label: string; value: number; total: number; color: string }[],
): number {
  let yy = y
  const labelW = 170
  const barX = M + labelW + 8
  const barMaxW = CONTENT_W - labelW - 118
  const rowH = 16.5

  for (const item of items) {
    if (yy + rowH > 800) {
      doc.addPage()
      yy = 42
    }
    const share = pct(item.value, item.total)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setText(doc, INK)
    doc.text(safe(item.label), M, yy, { maxWidth: labelW - 4 })

    setFill(doc, '#eef3f0')
    doc.roundedRect(barX, yy - 6, barMaxW, 8, 4, 4, 'F')
    if (item.value > 0) {
      const w = Math.max((item.value / item.total) * barMaxW, 6)
      setFill(doc, item.color)
      doc.roundedRect(barX, yy - 6, w, 8, 4, 4, 'F')
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    setText(doc, MUTED)
    doc.text(String(item.value), barX + barMaxW + 8, yy)
    setText(doc, GREEN)
    doc.text(`${share}%`, barX + barMaxW + 34, yy)
    yy += rowH
  }
  return yy
}


/** Vertical bar chart with an axis baseline, counts and thinned labels. */
function vBars(
  doc: jsPDF,
  y: number,
  data: { label: string; value: number }[],
  opts: { color: string; total: number; chartH?: number } = { color: GREEN, total: 0 },
): number {
  if (data.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setText(doc, '#8a9a91')
    doc.text('No votes recorded in this period.', M, y)
    return y + 16
  }

  const chartH = opts.chartH ?? 90
  const baseY = y + chartH
  const slot = CONTENT_W / data.length
  const barW = Math.max(Math.min(slot - 4, 26), 3)
  const max = Math.max(1, ...data.map((d) => d.value))

  setStroke(doc, LINE)
  doc.setLineWidth(0.5)
  doc.line(M, baseY, PAGE_W - M, baseY)

  data.forEach((d, i) => {
    const h = Math.max((d.value / max) * (chartH - 14), d.value > 0 ? 3 : 1)
    const x = M + i * slot + (slot - barW) / 2
    setFill(doc, d.value > 0 ? opts.color : '#cfe3d8')
    doc.roundedRect(x, baseY - h, barW, h, 2, 2, 'F')
    if (data.length <= 14 || d.value === max) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      setText(doc, MUTED)
      doc.text(String(d.value), x + barW / 2, baseY - h - 4, { align: 'center' })
    }
    const showEvery = Math.ceil(data.length / 12)
    if (i % showEvery === 0 || i === data.length - 1) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      setText(doc, '#8a9a91')
      doc.text(safe(d.label), x + barW / 2, baseY + 10, { align: 'center' })
    }
  })
  return baseY + 20
}

export function buildGeneralReportPdf(input: GeneralReportInput): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const { month, generatedAt, votingOpen, votingMonth } = input
  const { results: standings, votes, perDay, perHour, totalVotes: inputTotalVotes } = input.results

  const totalVotes = votes.length || inputTotalVotes
  const proxyCount = input.results.proxyCount

  /* Header band */
  setFill(doc, GREEN)
  doc.rect(0, 0, PAGE_W, 96, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  doc.setTextColor(255, 255, 255)
  doc.text('General Vote Report', M, 42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(214, 236, 224)
  doc.text('IPPIS Staff Recognition Portal', M, 60)
  // phase badge
  const badge = votingOpen ? 'VOTING OPEN' : 'VOTING CLOSED'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  const badgeW = doc.getTextWidth(badge) + 16
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(PAGE_W - M - badgeW, 26, badgeW, 18, 9, 9, 'F')
  setText(doc, votingOpen ? GREEN : '#6b7f76')
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
  const leader = input.results.leader
  statBox(doc, M, y, boxW, boxH, 'Total votes', String(inputTotalVotes), `${input.results.turnoutPct}% turnout of ${input.results.totalStaff} staff`, GREEN)
  statBox(doc, M + boxW + 10, y, boxW, boxH, 'Turnout', `${input.results.turnoutPct}%`, `${input.results.remainingVotes} staff yet to vote`, '#2563eb')
  statBox(doc, M + 2 * (boxW + 10), y, boxW, boxH, 'Leading', leader ? safe(leader.name.split(' ')[0]) : '—', leader ? `${leader.voteCount} votes · ${pct(leader.voteCount, totalVotes)}% share` : 'No votes yet', '#b78014')
  statBox(doc, M + 3 * (boxW + 10), y, boxW, boxH, 'Integrity', String(input.results.uniqueIps), `${proxyCount} flagged VPN (${pct(proxyCount, totalVotes)}%)`, '#7c3aed')
  y += boxH + 26

  /* Full standings with percentages */
  y = sectionTitle(doc, y, 'Standings', 'Votes by nominee')
  const standingsItems = standings.map((r, i) => ({
    label: `${r.sn}. ${r.name}`,
    value: r.voteCount,
    total: totalVotes,
    color: r.voteCount === (standings[0]?.voteCount ?? 0) && r.voteCount > 0 ? GREEN : divisionColor(i),
  }))
  y = shareBars(doc, y, standingsItems)
  y += 12

  /* Daily trend */
  y = sectionTitle(doc, y, 'Turnout', 'Votes per day')
  y = vBars(doc, y, perDay.map((d) => ({ label: safe(d.day.slice(5)), value: d.count })), { color: GREEN, total: totalVotes })
  y += 12

  /* Hourly activity */
  y = sectionTitle(doc, y, 'Peak activity', 'Votes by hour of day')
  y = vBars(doc, y, perHour.map((h) => ({ label: h.hour, value: h.count })), { color: '#0e7490', total: totalVotes })
  y += 12

  /* Results table with percentages */
  y = sectionTitle(doc, y, 'Results', 'Full results table')
  const ranked = [...standings].sort((a, b) => b.voteCount - a.voteCount || a.sn - b.sn)
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Rank', 'S/N', 'Nominee', 'Votes', 'Share of all votes']],
    body: ranked.map((r, i) => [
      String(i + 1),
      String(r.sn),
      safe(r.name),
      String(r.voteCount),
      `${pct(r.voteCount, totalVotes)}%`,
    ]),
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: hexToRgb(INK), lineColor: hexToRgb(LINE), lineWidth: 0.5 },
    headStyles: { fillColor: hexToRgb(GREEN), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: hexToRgb('#f7fbf9') },
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 44 }, 3: { cellWidth: 54, halign: 'right' }, 4: { cellWidth: 110, halign: 'right' } },
    theme: 'grid',
  })
  y = tableEndY(doc, y) + 24

  /* Audit appendix */
  doc.addPage()
  y = 42
  y = sectionTitle(doc, y, 'Appendix', 'Full vote audit trail')
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['#', 'Voter phone', 'Voter S/N', 'Voted for', 'Remarks', 'IP', 'Device', 'Time']],
    body: votes.map((v) => [
      String(v.id),
      safe(fmtPhone(v.voterPhone)),
      v.voterSn ? String(v.voterSn) : '-',
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
      0: { cellWidth: 24 },
      1: { cellWidth: 70 },
      2: { cellWidth: 40 },
      4: { cellWidth: 92 },
      5: { cellWidth: 60 },
      6: { cellWidth: 46 },
      7: { cellWidth: 74 },
    },
    theme: 'grid',
    rowPageBreak: 'avoid',
  })

  if (votes.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setText(doc, '#8a9a91')
    doc.text('No votes recorded in this reporting period.', M, tableEndY(doc, y) + 20)
  }

  /* Footers on every page */
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    footer(doc, i, pageCount, 'General vote report', generatedAt)
  }

  return doc
}
