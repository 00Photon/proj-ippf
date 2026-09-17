'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Award,
  BarChart3,
  Building2,
  Check,
  ChartPie,
  ClipboardList,
  Eye,
  EyeOff,
  FileDown,
  Fingerprint,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Download,
  MoreVertical,
  Phone,
  Power,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Star,
  StarOff,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  Pencil,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react'
import type { jsPDF } from 'jspdf'

/* ============ Types ============ */

interface AdminUser {
  id: number
  username: string
}
interface Settings {
  votingOpen: boolean
  divisionOpen: boolean
  votingMonth: string
}
interface Cycle {
  month: string
  votes: number
  firstVoteAt: string | null
  lastVoteAt: string | null
  isCurrent: boolean
}
interface CandidateResult {
  sn: number
  name: string
  voteCount: number
}
interface VoteDetail {
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
interface Results {
  cycleMonth: string
  totalVotes: number
  totalStaff: number
  turnoutPct: number
  remainingVotes: number
  leader: { sn: number; name: string; voteCount: number } | null
  proxyCount: number
  uniqueIps: number
  results: CandidateResult[]
  perDay: { day: string; count: number }[]
  perHour: { hour: string; count: number }[]
  votes: VoteDetail[]
}
interface StaffRow {
  sn: number
  name: string
  phone: string
  division: string | null
  nominated: boolean
  notNominee: boolean
  votesReceived: number
  hasVoted: boolean
}
interface StaffData {
  total: number
  nominatedCount: number
  votedCount: number
  divisionCount: number
  staff: StaffRow[]
}
interface DivisionStanding {
  division: string
  totalVotes: number
  voters: number
  leader: { sn: number; name: string; voteCount: number } | null
  results: { sn: number; name: string; voteCount: number }[]
}
interface DivisionVoteDetail {
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
interface DivisionCycle {
  month: string
  votes: number
  isCurrent: boolean
}
interface DivisionsData {
  standings: DivisionStanding[]
  votes: DivisionVoteDetail[]
  cycles: DivisionCycle[]
}

type View = 'overview' | 'votes' | 'divisions' | 'staff' | 'settings'

const MONTHS = [
  'September 2026', 'October 2026', 'November 2026', 'December 2026',
  'January 2027', 'February 2027', 'March 2027', 'April 2027',
  'May 2027', 'June 2027', 'July 2027', 'August 2027',
]

/* ============ Helpers ============ */

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
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

function formatPhone(phone: string): string {
  if (!phone) return ''
  if (phone.length === 11) return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`
  return phone
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/** Percentage of `part` within `whole`, 0-safe, rounded to 1 decimal. */
function pct(part: number, whole: number): number {
  if (!whole) return 0
  return Math.round((part / whole) * 1000) / 10
}

/* ============ CSV export ============ */

type CsvValue = string | number | boolean | null | undefined

function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Quote when the value contains a comma, quote, or newline; escape inner quotes
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))]
  // BOM so Excel opens the file as UTF-8 (names like 'Chukwuemeka' render correctly)
  return '\ufeff' + lines.join('\r\n')
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function csvTimestamp(): string {
  return new Date().toISOString().slice(0, 10)
}

/* ============ Login screen ============ */

function LoginScreen({ onLogin }: { onLogin: (u: string, p: string) => Promise<boolean | string> }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = await onLogin(username, password)
    if (result !== true) setError(typeof result === 'string' ? result : 'Login failed.')
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#10261d] px-5">
      <div className="w-full max-w-sm rounded-[28px] border border-[#2b4a3c] bg-[#16352a] p-6 shadow-2xl sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#0b8a51] text-white">
            <ShieldCheck className="size-7" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-white">Admin sign in</h1>
          <p className="mt-1 text-sm text-[#7ea291]">IPPIS Staff Recognition Portal</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#a8c5b8]">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="admin"
              className="rounded-xl border border-[#2b4a3c] bg-[#0f2a20] px-4 py-3 text-sm text-white outline-none ring-[#0b8a51] focus:ring-2"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#a8c5b8]">
            Password
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="w-full rounded-xl border border-[#2b4a3c] bg-[#0f2a20] px-4 py-3 pr-11 text-sm text-white outline-none ring-[#0b8a51] focus:ring-2"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-3 text-[#5f7d6f]"
                aria-label="Toggle password visibility"
              >
                {showPass ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </label>
          {error && (
            <div className="rounded-xl border border-[#7f2f2f] bg-[#3a1518] p-3 text-xs leading-5 text-[#f0a5a5]">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy || !username || !password}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#0b8a51] py-3.5 text-sm font-bold text-white transition hover:bg-[#0a7a47] disabled:opacity-40"
          >
            {busy && <Loader2 className="size-4 animate-spin" />} Sign in
          </button>
        </form>
      </div>
    </div>
  )
}

/* ============ Reusable bits ============ */

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[24px] border border-[#dbe8e1] bg-white p-6 shadow-sm ${className}`}>{children}</div>
}

function CardTitle({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#71867d]">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-bold tracking-tight">{title}</h2>
      </div>
      {right}
    </div>
  )
}

function RowActions({ items }: { items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg p-1.5 text-[#587268] transition hover:bg-[#eef5f1]"
        aria-label="Row actions"
        aria-expanded={open}
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-40 w-44 overflow-hidden rounded-xl border border-[#e2ece6] bg-white py-1 shadow-xl">
            {items.map((item) => (
              <button
                key={item.label}
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return
                  setOpen(false)
                  item.onClick()
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium transition ${item.disabled ? 'cursor-not-allowed text-[#b3c2ba]' : 'hover:bg-[#f3f9f6]'} ${item.danger && !item.disabled ? 'text-[#b04a4a]' : item.danger ? 'text-[#d8a3a3]' : item.disabled ? '' : 'text-[#315d4a]'}`}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}


/* ============ Vote summary (shared by Overview + Votes tabs) ============ */

/**
 * Detailed general-vote summary: percentage stat cards, standings with share
 * bars, vote-share donut and daily/hourly trend charts, plus the PDF export.
 * Rendered on the Overview tab and at the top of the Votes tab.
 */
function VoteSummary({
  results,
  settings,
  cycles,
  month,
  onMonthChange,
}: {
  results: Results | null
  settings: Settings | null
  cycles: Cycle[]
  month: string
  onMonthChange: (m: string) => void
}) {
  const maxVotes = Math.max(1, ...(results?.results.map((r) => r.voteCount) ?? [1]))
  const maxDay = Math.max(1, ...(results?.perDay.map((d) => d.count) ?? [1]))
  const maxHour = Math.max(1, ...(results?.perHour.map((h) => h.count) ?? [1]))
  const totalVotes = results?.totalVotes ?? 0
  const proxyPct = pct(results?.proxyCount ?? 0, totalVotes)
  const leaderShare = pct(results?.leader?.voteCount ?? 0, totalVotes)

  // Vote-share donut: top 7 nominees + "Others"
  const shareSlices = useMemo(() => {
    const ranked = (results?.results ?? []).filter((r) => r.voteCount > 0)
    const top = ranked.slice(0, 7).map((r, i) => ({ label: r.name, value: r.voteCount, color: divisionColor(i) }))
    const restTotal = ranked.slice(7).reduce((sum, r) => sum + r.voteCount, 0)
    return restTotal > 0 ? [...top, { label: 'Others', value: restTotal, color: '#b3c2ba' }] : top
  }, [results])

  const [exportingPdf, setExportingPdf] = useState(false)

  async function exportPdf() {
    if (!results) return
    setExportingPdf(true)
    try {
      const { buildGeneralReportPdf } = await import('@/lib/general-report')
      const doc = buildGeneralReportPdf({
        month,
        generatedAt: new Date().toISOString(),
        votingOpen: settings?.votingOpen ?? false,
        votingMonth: settings?.votingMonth ?? '',
        results,
      })
      doc.save(`ippis-vote-report-${month === '__all__' ? 'all-time' : month.replace(/\s+/g, '-').toLowerCase()}-${csvTimestamp()}.pdf`)
    } catch {
      alert('PDF export failed. Please try again.')
    } finally {
      setExportingPdf(false)
    }
  }

  const statCards = results
    ? [
        { icon: <Check className="size-5" />, label: 'Total votes', value: String(results.totalVotes), sub: `${results.turnoutPct}% of ${results.totalStaff} staff voted`, accent: 'text-[#0b8a51]', bg: 'bg-[#eef7f2]' },
        { icon: <TrendingUp className="size-5" />, label: 'Turnout', value: `${results.turnoutPct}%`, sub: `${results.remainingVotes} still to vote (${pct(results.remainingVotes, results.totalStaff)}%)`, accent: 'text-[#2563eb]', bg: 'bg-[#eaf1fd]' },
        { icon: <Trophy className="size-5" />, label: 'Leading', value: results.leader ? results.leader.name.split(' ')[0] : '—', sub: results.leader ? `${results.leader.voteCount} vote(s) · ${leaderShare}% share` : 'No votes yet', accent: 'text-[#b78014]', bg: 'bg-[#fdf6e3]' },
        { icon: <Fingerprint className="size-5" />, label: 'Integrity', value: String(results.uniqueIps), sub: `${results.proxyCount} flagged VPN (${proxyPct}%)`, accent: 'text-[#7c3aed]', bg: 'bg-[#f3eefd]' },
      ]
    : []

  return (
    <div className="flex flex-col gap-6">
      {/* Reporting-period filter + PDF export */}
      <Card className="!p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#71867d]">Reporting period</p>
            <p className="mt-0.5 text-sm font-semibold text-[#26483a]">
              {month === '__all__' ? 'All-time totals across every cycle' : `Votes cast in the ${month} cycle`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#71867d]">
              Month
              <select
                value={month}
                onChange={(e) => onMonthChange(e.target.value)}
                className="rounded-xl border border-[#d7e5de] bg-[#fbfdfc] px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-[#315d4a] outline-none ring-[#0b8a51] focus:ring-2"
                aria-label="Filter overview by voting month"
              >
                <option value="__all__">All time</option>
                {cycles.map((c) => (
                  <option key={c.month} value={c.month}>
                    {c.month}{c.isCurrent ? ' · current' : ''} ({c.votes} vote{c.votes === 1 ? '' : 's'})
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={exportPdf}
              disabled={exportingPdf || !results}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#0b8a51] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0a7a47] disabled:opacity-50"
              title="Download the full vote report as a formatted PDF"
            >
              {exportingPdf ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />} Export PDF
            </button>
          </div>
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} className="!p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#71867d]">{card.label}</p>
              <div className={`flex size-9 items-center justify-center rounded-xl ${card.bg} ${card.accent}`}>{card.icon}</div>
            </div>
            <p className="mt-3 truncate text-3xl font-bold tracking-tight" title={card.value}>{card.value}</p>
            <p className="mt-1 text-xs text-[#8a9a91]">{card.sub}</p>
          </Card>
        ))}
      </div>

      {/* Standings bars + vote-share donut */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardTitle eyebrow="Standings" title="Votes by nominee" right={<BarChart3 className="size-5 text-[#8cc9a6]" />} />
          <div className="mt-5 flex max-h-[380px] flex-col gap-2.5 overflow-y-auto pr-1">
            {results?.results.map((r) => (
              <div key={r.sn} className="flex items-center gap-3">
                <span className="w-8 shrink-0 text-right font-mono text-xs text-[#a4b8ae]">{r.sn}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`truncate text-sm font-semibold ${r.voteCount === maxVotes && r.voteCount > 0 ? 'text-[#0b8a51]' : 'text-[#26483a]'}`}>
                      {r.name}{r.voteCount === maxVotes && r.voteCount > 0 ? ' 🏆' : ''}
                    </p>
                    <span className="shrink-0 text-xs font-bold text-[#587268]">
                      {r.voteCount} <span className="text-[#8a9a91]">({pct(r.voteCount, totalVotes)}%)</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#eef3f0]">
                    <div
                      className={`h-full rounded-full transition-all ${r.voteCount === maxVotes && r.voteCount > 0 ? 'bg-gradient-to-r from-[#0b8a51] to-[#3ecf8e]' : 'bg-[#9cc9b2]'}`}
                      style={{ width: `${(r.voteCount / maxVotes) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Vote-share donut */}
        <Card>
          <CardTitle eyebrow="Vote share" title="Share of all votes" right={<ChartPie className="size-5 text-[#8cc9a6]" />} />
          <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
            <DonutChart
              slices={shareSlices}
              centerLabel={String(totalVotes)}
              centerSub="Votes"
              size={150}
              stroke={24}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {shareSlices.length === 0 && <p className="text-sm text-[#8a9a91]">No votes yet.</p>}
              {shareSlices.map((s) => (
                <div key={s.label} className="flex items-center gap-2.5 text-sm">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-[#26483a]">{s.label}</span>
                  <span className="shrink-0 text-xs font-bold text-[#587268]">{s.value}</span>
                  <span className="w-14 shrink-0 text-right text-xs font-bold text-[#0b8a51]">{pct(s.value, totalVotes)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Daily + hourly trend charts */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardTitle eyebrow="Daily trend" title="Votes per day" />
          <div className="mt-5 flex h-28 items-end gap-1.5">
            {results?.perDay.length ? (
              results.perDay.map((d) => (
                <div key={d.day} className="group relative flex-1" title={`${d.day}: ${d.count} vote(s) (${pct(d.count, totalVotes)}%)`}>
                  <div className="w-full rounded-t-md bg-gradient-to-t from-[#0b8a51] to-[#3ecf8e]" style={{ height: `${Math.max(6, (d.count / maxDay) * 100)}%` }} />
                </div>
              ))
            ) : (
              <p className="self-center text-sm text-[#8a9a91]">No votes yet.</p>
            )}
          </div>
          {results?.perDay.length ? (
            <p className="mt-2 text-xs text-[#8a9a91]">{results.perDay[0].day} → {results.perDay[results.perDay.length - 1].day}</p>
          ) : null}
        </Card>
        <Card>
          <CardTitle eyebrow="Peak activity" title="Votes by hour" />
          <div className="mt-5 flex h-28 items-end gap-1">
            {results?.perHour.length ? (
              results.perHour.map((h, i) => (
                <div key={`${h.hour}-${i}`} className="relative flex-1" title={`${h.hour} — ${h.count} vote(s) (${pct(h.count, totalVotes)}%)`}>
                  <div className="w-full rounded-t-md bg-[#7fb99a]" style={{ height: `${Math.max(6, (h.count / maxHour) * 100)}%` }} />
                </div>
              ))
            ) : (
              <p className="self-center text-sm text-[#8a9a91]">No votes yet.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ============ Overview view ============ */

/** Overview = shared vote summary + recent-votes live feed. */
function OverviewView({
  results,
  settings,
  cycles,
  month,
  onMonthChange,
}: {
  results: Results | null
  settings: Settings | null
  cycles: Cycle[]
  month: string
  onMonthChange: (m: string) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <VoteSummary
        results={results}
        settings={settings}
        cycles={cycles}
        month={month}
        onMonthChange={onMonthChange}
      />

      {/* Live feed */}
      <Card>
        <CardTitle
          eyebrow="Live feed"
          title="Recent votes"
          right={<span className="rounded-full bg-[#eef7f2] px-3 py-1 text-xs font-bold text-[#0b8a51]">{settings?.votingOpen ? 'Voting open' : 'Voting closed'} · {month === '__all__' ? 'All time' : month}</span>}
        />
        <div className="mt-4 flex flex-col divide-y divide-[#f0f5f2]">
          {results?.votes.slice(0, 6).map((v) => (
            <div key={v.id} className="flex items-center gap-3 py-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eef7f2] text-xs font-bold text-[#0b8a51]">
                {initialsOf(v.candidateName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#26483a]">
                  {v.voterPhone} voted for <span className="text-[#0b8a51]">{v.candidateName}</span>
                </p>
                <p className="truncate text-xs text-[#8a9a91]">
                  {fmtDateTime(v.votedAt)} · {deviceLabel(v.userAgent)}{v.location ? ` · ${v.location}` : ''}
                </p>
              </div>
              {v.isProxy && <span className="rounded-md bg-[#fdeaea] px-2 py-0.5 text-[10px] font-bold text-[#b04a4a]">VPN</span>}
            </div>
          ))}
          {results && results.votes.length === 0 && <p className="py-8 text-center text-sm text-[#8a9a91]">No votes recorded yet.</p>}
        </div>
      </Card>
    </div>
  )
}

/* ============ Votes view (paginated) ============ */

interface VotesPage {
  votes: VoteDetail[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  cycles: Cycle[]
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function VotesView({
  month,
  onMonthChange,
  onDeleteVote,
  refreshKey,
  results,
  settings,
  cycles,
}: {
  month: string
  onMonthChange: (m: string) => void
  onDeleteVote: (id: number) => void
  refreshKey: number
  results: Results | null
  settings: Settings | null
  cycles: Cycle[]
}) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('') // debounced
  const [proxyOnly, setProxyOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [data, setData] = useState<VotesPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  // Debounce search input → query (300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Fetch current page from the server whenever query changes
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })
    if (search) params.set('search', search)
    if (proxyOnly) params.set('proxy', '1')
    if (month && month !== '__all__') params.set('month', month)
    fetch(`/api/admin/votes?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load')
        return (await res.json()) as VotesPage
      })
      .then((next) => {
        if (!cancelled) {
          setData(next)
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load votes. Try refreshing.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, pageSize, search, proxyOnly, month, refreshKey])

  // Reset to page 1 when the filter set changes
  useEffect(() => {
    setPage(1)
  }, [proxyOnly, month, refreshKey])

  async function exportVotesCsv() {
    if (!data || data.total === 0) {
      alert('No votes to export yet.')
      return
    }
    setExporting(true)
    try {
      // Pull every matching row (server-side export mode)
      const params = new URLSearchParams({ all: '1' })
      if (search) params.set('search', search)
      if (proxyOnly) params.set('proxy', '1')
      if (month && month !== '__all__') params.set('month', month)
      const res = await fetch(`/api/admin/votes?${params.toString()}`)
      if (!res.ok) throw new Error()
      const full = (await res.json()) as { total: number; votes: VoteDetail[] }
      const rows: CsvValue[][] = full.votes.map((v) => [
        v.id,
        v.voterPhone,
        v.voterSn ?? '',
        v.candidateSn,
        v.candidateName,
        v.remarks ?? '',
        v.ip ?? '',
        v.location ?? '',
        deviceLabel(v.userAgent),
        v.userAgent ?? '',
        v.isProxy ? 'yes' : 'no',
        new Date(v.votedAt).toISOString(),
      ])
      const csv = toCsv(
        ['Vote ID', 'Voter Phone', 'Voter Roll SN', 'Candidate SN', 'Candidate Name', 'Remarks', 'IP Address', 'Location', 'Device', 'User Agent', 'Proxy/VPN Flag', 'Voted At (UTC)'],
        rows,
      )
      downloadCsv(`ippis-votes-${csvTimestamp()}.csv`, csv)
    } catch {
      alert('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const votes = data?.votes ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const currentPage = data?.page ?? 1
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, total)

  function gotoPage(next: number) {
    setPage(Math.min(Math.max(1, next), totalPages))
  }

  function pageNumbers(): (number | '…')[] {
    // Compact page list: 1 … 4 5 6 … 20
    const pages: (number | '…')[] = []
    const windowSize = 1
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - page) <= windowSize) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== '…') {
        pages.push('…')
      }
    }
    return pages
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Detailed summary (same as Overview) */}
      <VoteSummary
        results={results}
        settings={settings}
        cycles={cycles}
        month={month}
        onMonthChange={onMonthChange}
      />

      <Card className="!p-0">
      <div className="flex flex-col gap-4 border-b border-[#eef3f0] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#71867d]">Vote log</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight">All votes · full audit trail</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-[#8da198]" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search phone, name, IP, location…"
              className="w-full rounded-xl border border-[#d7e5de] bg-[#fbfdfc] py-2.5 pl-9 pr-4 text-sm outline-none ring-[#0b8a51] focus:ring-2 sm:w-72"
            />
          </label>
          <select
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="rounded-xl border border-[#d7e5de] bg-[#fbfdfc] px-3 py-2.5 text-xs font-bold text-[#315d4a] outline-none ring-[#0b8a51] focus:ring-2"
            aria-label="Filter votes by voting month"
            title="Filter votes by voting cycle"
          >
            <option value="__all__">All cycles</option>
            {cycles.map((c) => (
              <option key={c.month} value={c.month}>
                {c.month}{c.isCurrent ? ' · current' : ''} ({c.votes})
              </option>
            ))}
          </select>
          <button
            onClick={() => setProxyOnly(!proxyOnly)}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition ${proxyOnly ? 'border-[#b04a4a] bg-[#fdf1f1] text-[#b04a4a]' : 'border-[#d7e5de] bg-[#fbfdfc] text-[#587268] hover:border-[#b8d8c5]'}`}
          >
            ⚠ Flagged only
          </button>
          <button
            onClick={exportVotesCsv}
            disabled={exporting}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#0b8a51] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0a7a47] disabled:opacity-50"
            title="Download every matching vote as CSV"
          >
            {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />} Export CSV
          </button>
        </div>
      </div>

      <div className="relative overflow-x-auto p-6 pt-4">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
            <Loader2 className="size-6 animate-spin text-[#0b8a51]" />
          </div>
        )}
        <table className="w-full min-w-[1020px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#e4eee8] text-left text-xs uppercase tracking-wider text-[#71867d]">
              <th className="pb-3 pr-3 font-bold">#</th>
              <th className="pb-3 pr-3 font-bold">Voter</th>
              <th className="pb-3 pr-3 font-bold">Voted for</th>
              <th className="pb-3 pr-3 font-bold">Remarks</th>
              <th className="pb-3 pr-3 font-bold">IP address</th>
              <th className="pb-3 pr-3 font-bold">Location</th>
              <th className="pb-3 pr-3 font-bold">Device</th>
              <th className="pb-3 pr-3 font-bold">Time</th>
              <th className="pb-3 pr-1 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {votes.map((v) => (
              <tr key={v.id} className="border-b border-[#f0f5f2] transition hover:bg-[#f7fbf9]">
                <td className="py-3 pr-3 font-mono text-xs text-[#a4b8ae]">{v.id}</td>
                <td className="py-3 pr-3">
                  <p className="font-mono text-xs font-bold text-[#26483a]">{formatPhone(v.voterPhone)}</p>
                  <p className="text-xs text-[#8a9a91]">{v.voterSn ? `S/N ${v.voterSn}` : '—'}</p>
                </td>
                <td className="py-3 pr-3 font-semibold text-[#26483a]">
                  {v.candidateName} <span className="font-mono text-xs text-[#a4b8ae]">#{v.candidateSn}</span>
                </td>
                <td className="max-w-[180px] py-3 pr-3">
                  <p className="truncate text-xs text-[#587268]" title={v.remarks ?? undefined}>{v.remarks || '—'}</p>
                </td>
                <td className="py-3 pr-3">
                  <span className="font-mono text-xs text-[#587268]">{v.ip ?? '—'}</span>
                  {v.isProxy && <span className="ml-1.5 rounded-md bg-[#fdeaea] px-1.5 py-0.5 text-[10px] font-bold text-[#b04a4a]">VPN</span>}
                </td>
                <td className="max-w-[160px] py-3 pr-3">
                  <p className="truncate text-xs text-[#587268]" title={v.location ?? undefined}>{v.location ?? '—'}</p>
                </td>
                <td className="py-3 pr-3 text-xs text-[#587268]">{deviceLabel(v.userAgent)}</td>
                <td className="py-3 pr-3 text-xs text-[#587268]">{fmtDateTime(v.votedAt)}</td>
                <td className="py-3 pr-1">
                  <RowActions
                    items={[
                      { label: 'Delete vote', icon: <Trash2 className="size-4" />, onClick: () => onDeleteVote(v.id), danger: true },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {votes.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-sm text-[#8a9a91]">
                  {error ? error : total === 0 && !search && !proxyOnly ? 'No votes recorded yet.' : 'No votes match your filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="flex flex-col gap-3 border-t border-[#eef3f0] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-xs text-[#8a9a91]">
          <span>
            {total === 0 ? 'No votes' : `Showing ${rangeStart}–${rangeEnd} of ${total}`} · newest first
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number.parseInt(e.target.value, 10))
              setPage(1)
            }}
            className="rounded-lg border border-[#d7e5de] bg-[#fbfdfc] px-2 py-1.5 text-xs font-semibold text-[#315d4a] outline-none ring-[#0b8a51] focus:ring-2"
            aria-label="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => gotoPage(page - 1)}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-[#d7e5de] bg-white px-3 py-1.5 text-xs font-bold text-[#315d4a] transition hover:border-[#9cc9b2] disabled:opacity-40"
            >
              ← Prev
            </button>
            {pageNumbers().map((p, i) =>
              p === '…' ? (
                <span key={`gap-${i}`} className="px-1.5 text-xs text-[#a4b8ae]">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => gotoPage(p)}
                  disabled={loading}
                  className={`min-w-8 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${p === page ? 'bg-[#0b8a51] text-white' : 'border border-[#d7e5de] bg-white text-[#315d4a] hover:border-[#9cc9b2]'} disabled:opacity-40`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              onClick={() => gotoPage(page + 1)}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-[#d7e5de] bg-white px-3 py-1.5 text-xs font-bold text-[#315d4a] transition hover:border-[#9cc9b2] disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>
      </Card>
    </div>
  )
}

/* ============ Donut chart (SVG, for division summary) ============ */

function DonutChart({
  slices,
  centerLabel,
  centerSub,
  size = 168,
  stroke = 26,
}: {
  slices: { label: string; value: number; color: string }[]
  centerLabel: string
  centerSub: string
  size?: number
  stroke?: number
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#eef3f0" strokeWidth={stroke} />
        {total > 0 &&
          slices.map((s) => {
            if (s.value <= 0) return null
            const frac = s.value / total
            const dash = frac * circumference
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(dash - 2, 0.5)} ${circumference - Math.max(dash - 2, 0.5) + 0.5}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              >
                <title>{`${s.label}: ${s.value} (${pct(s.value, total)}%)`}</title>
              </circle>
            )
            offset += dash
            return el
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-2xl font-bold tracking-tight text-[#26483a]">{centerLabel}</p>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a9a91]">{centerSub}</p>
      </div>
    </div>
  )
}

/* ============ Divisions view ============ */

function DivisionsView({
  divisionData,
  settings,
  month,
  onMonthChange,
  onToggleDivisionVoting,
  onCloseDivisionsAndNominate,
  onDeleteDivisionVote,
  toggling,
  refreshKey,
}: {
  divisionData: DivisionsData | null
  settings: Settings | null
  month: string
  onMonthChange: (m: string) => void
  onToggleDivisionVoting: () => void
  onCloseDivisionsAndNominate: () => void
  onDeleteDivisionVote: (id: number) => void
  toggling: boolean
  refreshKey: number
}) {
  // Local refresh fetches just the division feed
  const [rows, setRows] = useState<DivisionVoteDetail[] | null>(null)
  useEffect(() => {
    if (!divisionData) return
    setRows(divisionData.votes)
  }, [divisionData, refreshKey])

  const standings = divisionData?.standings ?? []
  const votes = rows ?? []
  const totalDivisionVotes = votes.length

  // ---- Detailed analytics ----
  // Overall vote share per division (who received the most votes overall)
  const shareSlices = useMemo(
    () =>
      standings
        .map((d, i) => ({ label: d.division, value: d.voters, color: divisionColor(i) }))
        .filter((s) => s.value > 0),
    [standings],
  )

  // Candidates by total votes received across all divisions
  const candidateTotals = useMemo(() => {
    const map = new Map<number, { sn: number; name: string; votes: number }>()
    for (const d of standings) {
      for (const r of d.results) {
        const entry = map.get(r.sn)
        if (entry) entry.votes += r.voteCount
        else map.set(r.sn, { sn: r.sn, name: r.name, votes: r.voteCount })
      }
    }
    return [...map.values()].sort((a, b) => b.votes - a.votes || a.sn - b.sn)
  }, [standings])

  const maxCandidateVotes = candidateTotals[0]?.votes ?? 0

  // Division votes per day (turnout trend for this reporting period)
  const perDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of votes) {
      const day = new Date(v.votedAt).toLocaleDateString('en-CA') // YYYY-MM-DD
      map.set(day, (map.get(day) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count }))
  }, [votes])
  const maxDay = Math.max(1, ...perDay.map((d) => d.count))

  const activeDivisions = standings.filter((d) => d.voters > 0).length
  const decidedDivisions = standings.filter((d) => d.leader).length
  const leadingPct = pct(decidedDivisions, standings.length || 7)
  const proxyCount = votes.filter((v) => v.isProxy).length
  const proxyPct = pct(proxyCount, totalDivisionVotes)
  const participationPct = pct(activeDivisions, standings.length || 7)

  const [exportingPdf, setExportingPdf] = useState(false)

  async function exportPdf() {
    setExportingPdf(true)
    try {
      const { buildDivisionReportPdf } = await import('@/lib/division-report')
      const doc = buildDivisionReportPdf({
        month,
        generatedAt: new Date().toISOString(),
        divisionOpen: settings?.divisionOpen ?? false,
        votingMonth: settings?.votingMonth ?? '',
        standings,
        votes,
        perDay,
      })
      doc.save(`ippis-division-vote-${month === '__all__' ? 'all-time' : month.replace(/\s+/g, '-').toLowerCase()}-${csvTimestamp()}.pdf`)
    } catch {
      alert('PDF export failed. Please try again.')
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Phase control */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className={`transition-all ${settings?.divisionOpen ? 'border-[#0b8a51] shadow-[0_0_0_3px_rgba(11,138,81,0.12),0_0_28px_rgba(11,138,81,0.35)]' : ''}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#71867d]">Division phase</p>
              <h2 className={`mt-1 text-2xl font-bold tracking-tight ${settings?.divisionOpen ? 'text-[#0b8a51]' : 'text-[#8a9a91]'}`}>
                {settings?.divisionOpen ? 'Division voting OPEN' : 'Division voting CLOSED'}
              </h2>
              <p className="mt-1 text-sm text-[#71867d]">Cycle: <span className="font-semibold text-[#315d4a]">{settings?.votingMonth ?? '—'}</span></p>
            </div>
            <div className={`flex size-12 items-center justify-center rounded-2xl ${settings?.divisionOpen ? 'bg-[#e3f4e9] text-[#0b8a51]' : 'bg-[#f0f2f1] text-[#8a9a91]'}`}>
              <Building2 className="size-6" />
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={onToggleDivisionVoting}
              disabled={toggling}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-50 ${settings?.divisionOpen ? 'bg-[#b04a4a] hover:bg-[#9d3f3f]' : 'bg-[#0b8a51] hover:bg-[#0a7a47]'}`}
            >
              {toggling ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
              {settings?.divisionOpen ? 'Close division voting' : 'Open division voting'}
            </button>
            <button
              onClick={onCloseDivisionsAndNominate}
              disabled={toggling || !settings?.divisionOpen}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#d4a017] bg-[#fdf6e3] py-3.5 text-sm font-bold text-[#b78014] transition hover:bg-[#faf0d0] disabled:opacity-40"
              title="Nominate each division's top staff and close division voting"
            >
              {toggling ? <Loader2 className="size-4 animate-spin" /> : <Award className="size-4" />}
              Close & nominate winners
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-[#8a9a91]">
            “Close & nominate” locks in each division's top vote-getter as the general-ballot nominee and closes division voting. The manual nominate toggle on the Staff tab still works as an override.
          </p>
        </Card>

        {/* Division selector summary */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#71867d]">Reporting period</p>
              <p className="mt-0.5 text-sm font-semibold text-[#26483a]">
                {month === '__all__' ? 'All-time division votes across every cycle' : `Division votes in the ${month} cycle`}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#71867d]">
              Month
              <select
                value={month}
                onChange={(e) => onMonthChange(e.target.value)}
                className="rounded-xl border border-[#d7e5de] bg-[#fbfdfc] px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-[#315d4a] outline-none ring-[#0b8a51] focus:ring-2"
                aria-label="Filter division votes by month"
              >
                <option value="__all__">All time</option>
                {(divisionData?.cycles ?? []).map((c) => (
                  <option key={c.month} value={c.month}>
                    {c.month}{c.isCurrent ? ' · current' : ''} ({c.votes})
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={exportPdf}
              disabled={exportingPdf}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#0b8a51] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0a7a47] disabled:opacity-50"
              title="Download the full division vote report as a formatted PDF"
            >
              {exportingPdf ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />} Export PDF
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="rounded-2xl bg-[#eef7f2] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#71867d]">Division votes</p>
              <p className="mt-1 text-2xl font-bold text-[#0b8a51]">{totalDivisionVotes}</p>
              <p className="mt-1 text-[11px] text-[#587268]">{proxyCount} flagged VPN ({proxyPct}%)</p>
            </div>
            <div className="rounded-2xl bg-[#eaf1fd] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#71867d]">Participation</p>
              <p className="mt-1 text-2xl font-bold text-[#2563eb]">{participationPct}%</p>
              <p className="mt-1 text-[11px] text-[#587268]">{activeDivisions}/7 divisions voting</p>
            </div>
            <div className="rounded-2xl bg-[#fdf6e3] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#71867d]">Winners ready</p>
              <p className="mt-1 text-2xl font-bold text-[#b78014]">{decidedDivisions}/7</p>
              <p className="mt-1 text-[11px] text-[#587268]">{leadingPct}% of divisions decided</p>
            </div>
            <div className="rounded-2xl bg-[#f3eefd] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#71867d]">Avg votes / division</p>
              <p className="mt-1 text-2xl font-bold text-[#7c3aed]">{activeDivisions ? (totalDivisionVotes / activeDivisions).toFixed(1) : '0'}</p>
              <p className="mt-1 text-[11px] text-[#587268]">across participating divisions</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Detailed analytics: vote share donut + cross-division candidate totals */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle eyebrow="Vote share" title="Votes by division" right={<ChartPie className="size-5 text-[#8cc9a6]" />} />
          <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
            <DonutChart
              slices={shareSlices}
              centerLabel={String(totalDivisionVotes)}
              centerSub="Votes"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {shareSlices.length === 0 && <p className="text-sm text-[#8a9a91]">No division votes yet.</p>}
              {shareSlices.map((s) => (
                <div key={s.label} className="flex items-center gap-2.5 text-sm">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-[#26483a]">{s.label}</span>
                  <span className="shrink-0 text-xs font-bold text-[#587268]">{s.value} vote{s.value === 1 ? '' : 's'}</span>
                  <span className="w-14 shrink-0 text-right text-xs font-bold text-[#0b8a51]">{pct(s.value, totalDivisionVotes)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle eyebrow="Vote share" title="Candidates by total votes" right={<Target className="size-5 text-[#8cc9a6]" />} />
          <div className="mt-5 flex max-h-[280px] flex-col gap-3 overflow-y-auto pr-1">
            {candidateTotals.length === 0 && <p className="text-sm text-[#8a9a91]">No division votes yet.</p>}
            {candidateTotals.slice(0, 10).map((c, i) => (
              <div key={c.sn} className="flex items-center gap-3">
                <span className="w-8 shrink-0 text-right font-mono text-xs text-[#a4b8ae]">{c.sn}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`truncate text-sm font-semibold ${i === 0 && c.votes > 0 ? 'text-[#0b8a51]' : 'text-[#26483a]'}`}>
                      {c.name}{i === 0 && c.votes > 0 ? ' 🏆' : ''}
                    </p>
                    <span className="shrink-0 text-xs font-bold text-[#587268]">
                      {c.votes} <span className="text-[#8a9a91]">({pct(c.votes, totalDivisionVotes)}%)</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#eef3f0]">
                    <div
                      className={`h-full rounded-full transition-all ${i === 0 && c.votes > 0 ? 'bg-gradient-to-r from-[#0b8a51] to-[#3ecf8e]' : 'bg-[#9cc9b2]'}`}
                      style={{ width: `${maxCandidateVotes ? (c.votes / maxCandidateVotes) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Turnout trend */}
      <Card>
        <CardTitle eyebrow="Turnout" title="Division votes per day" />
        <div className="mt-5 flex h-28 items-end gap-1.5">
          {perDay.length ? (
            perDay.map((d) => (
              <div key={d.day} className="group relative flex-1" title={`${d.day}: ${d.count} vote(s)`}>
                <div className="w-full rounded-t-md bg-gradient-to-t from-[#0b8a51] to-[#3ecf8e]" style={{ height: `${Math.max(6, (d.count / maxDay) * 100)}%` }} />
              </div>
            ))
          ) : (
            <p className="self-center text-sm text-[#8a9a91]">No votes yet.</p>
          )}
        </div>
        {perDay.length ? (
          <p className="mt-2 text-xs text-[#8a9a91]">{perDay[0].day} → {perDay[perDay.length - 1].day}</p>
        ) : null}
      </Card>

      {/* Standings per division */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {standings.map((d) => (
          <Card key={d.division} className="!p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-bold text-[#26483a]" title={d.division}>{d.division}</p>
              <span className="shrink-0 rounded-full bg-[#eef7f2] px-2 py-0.5 text-[10px] font-bold text-[#0b8a51]">{d.voters} vote{d.voters === 1 ? '' : 's'}</span>
            </div>
            {d.results.length > 0 ? (
              <div className="mt-3 flex flex-col gap-2">
                {d.results.slice(0, 3).map((r, i) => (
                  <div key={r.sn}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className={`truncate font-semibold ${i === 0 ? 'text-[#0b8a51]' : 'text-[#587268]'}`}>
                        {i === 0 ? '★ ' : ''}{r.name}
                      </span>
                      <span className="shrink-0 font-bold text-[#8a9a91]">
                        {r.voteCount} <span className="text-[#b3c2ba]">({pct(r.voteCount, d.voters)}%)</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#eef3f0]">
                      <div
                        className={`h-full rounded-full ${i === 0 ? 'bg-gradient-to-r from-[#0b8a51] to-[#3ecf8e]' : 'bg-[#9cc9b2]'}`}
                        style={{ width: `${d.voters ? (r.voteCount / d.voters) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
                {d.results.length > 3 && (
                  <p className="text-[11px] text-[#8a9a91]">+{d.results.length - 3} more candidate{d.results.length - 3 === 1 ? '' : 's'}</p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#8a9a91]">No votes yet.</p>
            )}
          </Card>
        ))}
      </div>

      {/* Audit trail */}
      <Card className="!p-0">
        <div className="border-b border-[#eef3f0] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#71867d]">Division vote log</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight">All division votes · full audit trail</h2>
        </div>
        <div className="overflow-x-auto p-6 pt-4">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e4eee8] text-left text-xs uppercase tracking-wider text-[#71867d]">
                <th className="pb-3 pr-3 font-bold">#</th>
                <th className="pb-3 pr-3 font-bold">Voter</th>
                <th className="pb-3 pr-3 font-bold">Division</th>
                <th className="pb-3 pr-3 font-bold">Voted for</th>
                <th className="pb-3 pr-3 font-bold">Remarks</th>
                <th className="pb-3 pr-3 font-bold">IP address</th>
                <th className="pb-3 pr-3 font-bold">Location</th>
                <th className="pb-3 pr-3 font-bold">Device</th>
                <th className="pb-3 pr-3 font-bold">Time</th>
                <th className="pb-3 pr-1 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {votes.map((v) => (
                <tr key={v.id} className="border-b border-[#f0f5f2] transition hover:bg-[#f7fbf9]">
                  <td className="py-3 pr-3 font-mono text-xs text-[#a4b8ae]">{v.id}</td>
                  <td className="py-3 pr-3">
                    <p className="font-mono text-xs font-bold text-[#26483a]">{formatPhone(v.voterPhone)}</p>
                  </td>
                  <td className="py-3 pr-3">
                    <span className="rounded-full bg-[#e8eef5] px-2.5 py-1 text-[11px] font-bold text-[#2f5470]">{v.division}</span>
                  </td>
                  <td className="py-3 pr-3 font-semibold text-[#26483a]">
                    {v.candidateName} <span className="font-mono text-xs text-[#a4b8ae]">#{v.candidateSn}</span>
                  </td>
                  <td className="max-w-[180px] py-3 pr-3">
                    <p className="truncate text-xs text-[#587268]" title={v.remarks ?? undefined}>{v.remarks || '—'}</p>
                  </td>
                  <td className="py-3 pr-3">
                    <span className="font-mono text-xs text-[#587268]">{v.ip ?? '—'}</span>
                    {v.isProxy && <span className="ml-1.5 rounded-md bg-[#fdeaea] px-1.5 py-0.5 text-[10px] font-bold text-[#b04a4a]">VPN</span>}
                  </td>
                  <td className="max-w-[160px] py-3 pr-3">
                    <p className="truncate text-xs text-[#587268]" title={v.location ?? undefined}>{v.location ?? '—'}</p>
                  </td>
                  <td className="py-3 pr-3 text-xs text-[#587268]">{deviceLabel(v.userAgent)}</td>
                  <td className="py-3 pr-3 text-xs text-[#587268]">{fmtDateTime(v.votedAt)}</td>
                  <td className="py-3 pr-1">
                    <RowActions
                      items={[
                        { label: 'Delete vote', icon: <Trash2 className="size-4" />, onClick: () => onDeleteDivisionVote(v.id), danger: true },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {votes.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-sm text-[#8a9a91]">No division votes recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ============ Staff view ============ */

import { DIVISIONS, divisionColor } from '@/lib/division-list'

function StaffView({
  staffData,
  onDeleteVotesFor,
  onRevealPhone,
  onAddNominee,
  onEditNominee,
  onRemoveNominee,
  onSetNominated,
  onSetNotNominee,
}: {
  staffData: StaffData | null
  onDeleteVotesFor: (sn: number, name: string) => void
  onRevealPhone: (phone: string) => void
  onAddNominee: (name: string, phone: string, division: string) => Promise<boolean | string>
  onEditNominee: (sn: number, name: string, phone: string, division: string) => Promise<boolean | string>
  onRemoveNominee: (sn: number, name: string) => Promise<void>
  onSetNominated: (sn: number, name: string, nominated: boolean) => Promise<void>
  onSetNotNominee: (sn: number, name: string, notNominee: boolean) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'voted' | 'not-voted' | 'nominated' | 'not-nominated' | 'no-division' | 'voters-only'>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  // When editingSn is set, the modal edits that nominee instead of adding
  const [editingSn, setEditingSn] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newDivision, setNewDivision] = useState('')
  const [addError, setAddError] = useState('')
  const [addBusy, setAddBusy] = useState(false)

  function openAddModal() {
    setEditingSn(null)
    setNewName('')
    setNewPhone('')
    setNewDivision('')
    setAddError('')
    setShowAddForm(true)
  }

  function openEditModal(sn: number, name: string, phone: string, division: string | null) {
    setEditingSn(sn)
    setNewName(name)
    setNewPhone(phone)
    setNewDivision(division ?? '')
    setAddError('')
    setShowAddForm(true)
  }

  async function submitNomineeForm(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    setAddBusy(true)
    const result = editingSn !== null
      ? await onEditNominee(editingSn, newName, newPhone, newDivision)
      : await onAddNominee(newName, newPhone, newDivision)
    if (result === true) {
      setShowAddForm(false)
      setNewName('')
      setNewPhone('')
      setNewDivision('')
      setEditingSn(null)
    } else {
      setAddError(typeof result === 'string' ? result : 'Could not save the staff member.')
    }
    setAddBusy(false)
  }

  const filtered = useMemo(() => {
    if (!staffData) return []
    const q = search.toLowerCase()
    return staffData.staff.filter((s) => {
      if (filter === 'voted' && !s.hasVoted) return false
      if (filter === 'not-voted' && s.hasVoted) return false
      if (filter === 'nominated' && !s.nominated) return false
      if (filter === 'not-nominated' && s.nominated) return false
      if (filter === 'no-division' && s.division) return false
      if (filter === 'voters-only' && !s.notNominee) return false
      if (!q) return true
      return s.name.toLowerCase().includes(q) || s.phone.includes(q) || String(s.sn).includes(q) || (s.division ?? '').toLowerCase().includes(q)
    })
  }, [staffData, search, filter])

  const maxReceived = Math.max(1, ...(staffData?.staff.map((s) => s.votesReceived) ?? [1]))

  function exportStaffCsv() {
    if (!staffData || staffData.staff.length === 0) {
      alert('No staff data to export yet.')
      return
    }
    const rows: CsvValue[][] = staffData.staff.map((s) => [
      s.sn,
      s.name,
      s.phone,
      s.division ?? '',
      s.nominated ? 'yes' : 'no',
      s.notNominee ? 'yes' : 'no',
      s.votesReceived,
      s.hasVoted ? 'yes' : 'no',
    ])
    const csv = toCsv(
      ['S/N', 'Name', 'Phone', 'Division', 'On Ballot', 'Voters-Only', 'Votes Received', 'Has Voted'],
      rows,
    )
    downloadCsv(`ippis-nominal-roll-${csvTimestamp()}.csv`, csv)
  }

  return (
    <Card className="!p-0">
      <div className="flex flex-col gap-4 border-b border-[#eef3f0] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#71867d]">Nominal roll</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight">All {staffData?.total ?? 89} staff · {staffData?.nominatedCount ?? 0} on the ballot</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-[#8da198]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, S/N, division…"
              className="w-full rounded-xl border border-[#d7e5de] bg-[#fbfdfc] py-2.5 pl-9 pr-4 text-sm outline-none ring-[#0b8a51] focus:ring-2 sm:w-64"
            />
          </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'voted' | 'not-voted' | 'nominated' | 'not-nominated' | 'no-division' | 'voters-only')}
            className="rounded-xl border border-[#d7e5de] bg-[#fbfdfc] px-3 py-2.5 text-sm font-semibold text-[#315d4a] outline-none ring-[#0b8a51] focus:ring-2"
          >
            <option value="all">All staff</option>
            <option value="nominated">★ On the ballot</option>
            <option value="not-nominated">Not on the ballot</option>
            <option value="no-division">No division set</option>
            <option value="voters-only">Voters-only (cannot be voted for)</option>
            <option value="voted">✓ Have voted</option>
            <option value="not-voted">Not yet voted</option>
          </select>
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#0b8a51] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0a7a47]"
            title="Add a new staff member to the nominal roll"
          >
            <UserPlus className="size-3.5" /> Add staff
          </button>
          <button
            onClick={exportStaffCsv}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#d4e3dc] bg-white px-4 py-2.5 text-xs font-bold text-[#315d4a] transition hover:border-[#9cc9b2]"
            title="Download the full nominal roll with vote counts as CSV"
          >
            <Download className="size-3.5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto p-6 pt-4">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#e4eee8] text-left text-xs uppercase tracking-wider text-[#71867d]">
              <th className="pb-3 pr-3 font-bold">S/N</th>
              <th className="pb-3 pr-3 font-bold">Name</th>
              <th className="pb-3 pr-3 font-bold">Division</th>
              <th className="pb-3 pr-3 font-bold">Ballot</th>
              <th className="pb-3 pr-3 font-bold">Phone</th>
              <th className="pb-3 pr-3 font-bold">Votes received</th>
              <th className="pb-3 pr-3 font-bold">Participation</th>
              <th className="pb-3 pr-1 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.sn} className={`border-b border-[#f0f5f2] transition hover:bg-[#f7fbf9] ${s.notNominee ? 'bg-[#fafbfa]' : ''}`}>
                <td className="py-3 pr-3 font-mono text-xs text-[#a4b8ae]">{s.sn}</td>
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${s.notNominee ? 'bg-[#f1f4f2] text-[#8a9a91]' : 'bg-[#eef7f2] text-[#0b8a51]'}`}>{initialsOf(s.name)}</div>
                    <span className={`font-semibold ${s.notNominee ? 'text-[#587268]' : 'text-[#26483a]'}`}>{s.name}</span>
                    {s.notNominee && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fdeaea] px-2 py-0.5 text-[10px] font-bold text-[#b04a4a]" title="Voters-only: can vote but can never be voted for">
                        <UserX className="size-3" /> Voters-only
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 pr-3">
                  {s.division ? (
                    <span className="rounded-full bg-[#e8eef5] px-2.5 py-1 text-[11px] font-bold text-[#2f5470]">{s.division}</span>
                  ) : (
                    <span className="rounded-full bg-[#f1f4f2] px-2.5 py-1 text-[11px] font-bold text-[#8a9a91]">—</span>
                  )}
                </td>
                <td className="py-3 pr-3">
                  {s.nominated ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf6e3] px-2.5 py-1 text-[11px] font-bold text-[#b78014]"><Star className="size-3 fill-current" /> On ballot</span>
                  ) : (
                    <span className="rounded-full bg-[#f1f4f2] px-2.5 py-1 text-[11px] font-bold text-[#8a9a91]">—</span>
                  )}
                </td>
                <td className="py-3 pr-3">
                  {s.phone ? (
                    <button onClick={() => onRevealPhone(s.phone)} className="font-mono text-xs text-[#587268] transition hover:text-[#0b8a51]" title="Copy phone number">
                      {formatPhone(s.phone)}
                    </button>
                  ) : (
                    <span className="text-xs italic text-[#b3c2ba]">Not set</span>
                  )}
                </td>
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 overflow-hidden rounded-full bg-[#eef3f0]">
                      <div className="h-full rounded-full bg-[#0b8a51]" style={{ width: `${(s.votesReceived / maxReceived) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-[#587268]">{s.votesReceived}</span>
                  </div>
                </td>
                <td className="py-3 pr-3">
                  {s.hasVoted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#e3f4e9] px-2.5 py-1 text-[11px] font-bold text-[#0b6b40]"><Check className="size-3" /> Voted</span>
                  ) : (
                    <span className="rounded-full bg-[#f1f4f2] px-2.5 py-1 text-[11px] font-bold text-[#8a9a91]">Pending</span>
                  )}
                </td>
                <td className="py-3 pr-1">
                  <RowActions
                    items={[
                      s.notNominee
                        ? { label: 'Allow to be voted for', icon: <UserCheck className="size-4" />, onClick: () => onSetNotNominee(s.sn, s.name, false) }
                        : { label: 'Flag voters-only (cannot be voted for)', icon: <UserX className="size-4" />, onClick: () => onSetNotNominee(s.sn, s.name, true) },
                      s.nominated
                        ? { label: 'Withdraw from ballot', icon: <StarOff className="size-4" />, onClick: () => onSetNominated(s.sn, s.name, false), disabled: s.notNominee }
                        : { label: 'Nominate for ballot', icon: <Star className="size-4" />, onClick: () => onSetNominated(s.sn, s.name, true), disabled: s.notNominee },
                      { label: 'Copy phone', icon: <Phone className="size-4" />, onClick: () => onRevealPhone(s.phone), disabled: !s.phone },
                      { label: 'Edit name / phone / division', icon: <Pencil className="size-4" />, onClick: () => openEditModal(s.sn, s.name, s.phone, s.division) },
                      { label: 'Delete their votes', icon: <Trash2 className="size-4" />, onClick: () => onDeleteVotesFor(s.sn, s.name), danger: true },
                      { label: 'Remove from roll', icon: <UserMinus className="size-4" />, onClick: () => onRemoveNominee(s.sn, s.name), danger: true },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-[#8a9a91]">No staff match your filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[#eef3f0] px-6 py-4">
        <p className="text-xs text-[#8a9a91]">Showing {filtered.length} of {staffData?.total ?? 0} staff · {staffData?.votedCount ?? 0} have voted</p>
      </div>

      {/* Add / edit nominee modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#10261d]/50 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-6 shadow-2xl sm:rounded-[24px] sm:p-7">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0b8a51]">Nominal roll</p>
                <h2 className="mt-1 text-xl font-bold">{editingSn !== null ? `Edit nominee — S/N ${editingSn}` : 'Add nominee'}</h2>
              </div>
              <button onClick={() => setShowAddForm(false)} className="rounded-xl p-2 text-[#71867d] hover:bg-[#f1f6f3]" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <form onSubmit={submitNomineeForm} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#315d4a]">Full name
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. ADEBAYO Samuel O." 
                  autoComplete="off"
                  className="rounded-xl border border-[#d7e5de] bg-[#fbfdfc] px-4 py-3 text-sm outline-none ring-[#0b8a51] focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#315d4a]">Phone number <span className="font-normal text-[#8a9a91]">(optional — needed to vote)</span>
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  inputMode="numeric"
                  placeholder="0803 000 0000"
                  autoComplete="off"
                  className="rounded-xl border border-[#d7e5de] bg-[#fbfdfc] px-4 py-3 text-sm outline-none ring-[#0b8a51] focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#315d4a]">Division
                <select
                  value={newDivision}
                  onChange={(e) => setNewDivision(e.target.value)}
                  className="rounded-xl border border-[#d7e5de] bg-[#fbfdfc] px-4 py-3 text-sm outline-none ring-[#0b8a51] focus:ring-2"
                >
                  <option value="">— No division —</option>
                  {DIVISIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              {addError && (
                <div className="rounded-xl border border-[#f3caca] bg-[#fdf1f1] p-3 text-xs leading-5 text-[#b91c1c]">{addError}</div>
              )}
              <button
                type="submit"
                disabled={addBusy || !newName.trim()}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#0b8a51] py-3.5 text-sm font-bold text-white transition hover:bg-[#0a7a47] disabled:opacity-40"
              >
                {addBusy && <Loader2 className="size-4 animate-spin" />} {editingSn !== null ? 'Save changes' : 'Add to roll'}
              </button>
              <p className="text-center text-xs text-[#8a9a91]">
                {editingSn !== null
                  ? 'Votes already cast keep the phone number used at vote time. Leave phone blank for staff whose number is not yet known.'
                  : 'Phone is optional — staff without one appear on the roll but can only vote once their number is added. Use “Nominate for ballot” to put them on the public ballot.'}
              </p>
            </form>
          </div>
        </div>
      )}
    </Card>
  )
}

/* ============ Settings view ============ */

function SettingsView({
  settings,
  monthDraft,
  setMonthDraft,
  monthSaved,
  onToggleVoting,
  onSaveMonth,
  toggling,
  cycles,
}: {
  settings: Settings | null
  monthDraft: string
  setMonthDraft: (m: string) => void
  monthSaved: boolean
  onToggleVoting: () => void
  onSaveMonth: () => void
  toggling: boolean
  cycles: Cycle[]
}) {
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [curPass, setCurPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passMsg, setPassMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [passBusy, setPassBusy] = useState(false)

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPassMsg(null)
    if (newPass !== confirmPass) {
      setPassMsg({ ok: false, text: 'New passwords do not match.' })
      return
    }
    if (newPass.length < 10) {
      setPassMsg({ ok: false, text: 'New password must be at least 10 characters.' })
      return
    }
    setPassBusy(true)
    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: curPass, newPassword: newPass }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPassMsg({ ok: false, text: data.error ?? 'Failed to update password.' })
        return
      }
      setPassMsg({ ok: true, text: 'Password updated. Redirecting to sign in…' })
      setTimeout(() => { window.location.href = '/admin' }, 1500)
    } catch {
      setPassMsg({ ok: false, text: 'Network error.' })
    } finally {
      setPassBusy(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Ballot control */}
      <Card className={`transition-all ${settings?.votingOpen ? 'border-[#0b8a51] shadow-[0_0_0_3px_rgba(11,138,81,0.12),0_0_28px_rgba(11,138,81,0.35)]' : ''}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#71867d]">Ballot control</p>
            <h2 className={`mt-1 text-2xl font-bold tracking-tight ${settings?.votingOpen ? 'text-[#0b8a51]' : 'text-[#8a9a91]'}`}>
              {settings?.votingOpen ? 'Voting is OPEN' : 'Voting is CLOSED'}
            </h2>
            <p className="mt-1 text-sm text-[#71867d]">Cycle: <span className="font-semibold text-[#315d4a]">{settings?.votingMonth ?? '—'}</span></p>
          </div>
          <div className={`flex size-12 items-center justify-center rounded-2xl ${settings?.votingOpen ? 'bg-[#e3f4e9] text-[#0b8a51]' : 'bg-[#f0f2f1] text-[#8a9a91]'}`}>
            <Power className="size-6" />
          </div>
        </div>
        <button
          onClick={onToggleVoting}
          disabled={toggling}
          className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-50 ${settings?.votingOpen ? 'bg-[#b04a4a] hover:bg-[#9d3f3f] hover:shadow-[0_0_20px_rgba(176,74,74,0.4)]' : 'bg-[#0b8a51] hover:bg-[#0a7a47] hover:shadow-[0_0_20px_rgba(11,138,81,0.5)]'}`}
        >
          {toggling ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
          {settings?.votingOpen ? 'Close voting now' : 'Open voting now'}
        </button>
        <p className="mt-3 text-center text-xs text-[#8a9a91]">
          {settings?.votingOpen ? 'Staff can currently submit votes.' : 'Vote submissions are blocked at API level.'}
        </p>
      </Card>

      {/* Cycle picker */}
      <Card>
        <CardTitle eyebrow="Active cycle" title="Specify voting month" />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MONTHS.map((m) => (
            <button
              key={m}
              onClick={() => setMonthDraft(m)}
              className={`rounded-xl border px-2 py-2.5 text-xs font-bold transition ${monthDraft === m ? 'border-[#0b8a51] bg-[#e3f4e9] text-[#0b8a51]' : 'border-[#e4eee8] bg-[#fbfdfc] text-[#587268] hover:border-[#b8d8c5]'}`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <input
            value={monthDraft}
            onChange={(e) => setMonthDraft(e.target.value)}
            placeholder="e.g. September 2026"
            className="w-full rounded-xl border border-[#d7e5de] bg-[#fbfdfc] px-4 py-3 text-sm outline-none ring-[#0b8a51] focus:ring-2"
          />
          <button onClick={onSaveMonth} disabled={!monthDraft.trim()} className="flex items-center justify-center gap-2 rounded-xl bg-[#0b8a51] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0a7a47] disabled:opacity-40">
            {monthSaved ? <Check className="size-4" /> : null} {monthSaved ? 'Saved' : 'Save cycle'}
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-[#8a9a91]">
          The cycle name appears on the public page and ballot. Changes reflect immediately for voters.
          Past cycles are never deleted — their votes stay in the archive and remain available in the month
          filters on Overview and Votes.
        </p>
      </Card>

      {/* Cycle history */}
      <Card>
        <CardTitle eyebrow="History" title="Voting cycles" />
        <p className="mt-2 text-sm leading-6 text-[#71867d]">
          Every cycle that has votes on record, newest first. Switching the active cycle never removes a
          past one — each keeps its own tallies and one-vote-per-staff record.
        </p>
        <div className="mt-4 flex flex-col divide-y divide-[#f0f5f2]">
          {cycles.map((c) => (
            <div key={c.month} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#26483a]">
                  {c.month}
                  {c.isCurrent && (
                    <span className="ml-2 rounded-full bg-[#e3f4e9] px-2 py-0.5 text-[10px] font-bold text-[#0b8a51]">ACTIVE</span>
                  )}
                </p>
                <p className="text-xs text-[#8a9a91]">
                  {c.firstVoteAt && c.lastVoteAt
                    ? `${fmtDate(c.firstVoteAt)} → ${fmtDate(c.lastVoteAt)}`
                    : 'No votes recorded yet'}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[#eef7f2] px-3 py-1 text-xs font-bold text-[#0b8a51]">
                {c.votes} vote{c.votes === 1 ? '' : 's'}
              </span>
            </div>
          ))}
          {cycles.length === 0 && <p className="py-6 text-center text-sm text-[#8a9a91]">No cycles on record yet.</p>}
        </div>
      </Card>

      {/* Security / password */}
      <Card className="xl:col-span-2">
        <CardTitle
          eyebrow="Security"
          title="Admin password"
          right={
            <button onClick={() => setShowPasswordForm(true)} className="flex items-center gap-2 rounded-xl border border-[#d4e3dc] bg-white px-4 py-2.5 text-sm font-semibold text-[#315d4a] transition hover:border-[#9cc9b2]">
              <KeyRound className="size-4" /> Change password
            </button>
          }
        />
        <p className="mt-3 text-sm leading-6 text-[#71867d]">
          Passwords are hashed with scrypt. After a change, all admin sessions are signed out for safety.
        </p>
      </Card>

      {/* Password modal */}
      {showPasswordForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#10261d]/50 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-6 shadow-2xl sm:rounded-[24px] sm:p-7">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0b8a51]">Security</p>
                <h2 className="mt-1 text-xl font-bold">Change admin password</h2>
              </div>
              <button onClick={() => { setShowPasswordForm(false); setPassMsg(null) }} className="rounded-xl p-2 text-[#71867d] hover:bg-[#f1f6f3]" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <form onSubmit={changePassword} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#315d4a]">Current password
                <input type="password" value={curPass} onChange={(e) => setCurPass(e.target.value)} autoComplete="current-password" className="rounded-xl border border-[#d7e5de] bg-[#fbfdfc] px-4 py-3 text-sm outline-none ring-[#0b8a51] focus:ring-2" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#315d4a]">New password
                <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} autoComplete="new-password" className="rounded-xl border border-[#d7e5de] bg-[#fbfdfc] px-4 py-3 text-sm outline-none ring-[#0b8a51] focus:ring-2" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#315d4a]">Confirm new password
                <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} autoComplete="new-password" className="rounded-xl border border-[#d7e5de] bg-[#fbfdfc] px-4 py-3 text-sm outline-none ring-[#0b8a51] focus:ring-2" />
              </label>
              {passMsg && (
                <div className={`rounded-xl border p-3 text-xs leading-5 ${passMsg.ok ? 'border-[#bfe3cd] bg-[#edf7f1] text-[#0b6b40]' : 'border-[#f3caca] bg-[#fdf1f1] text-[#b91c1c]'}`}>
                  {passMsg.text}
                </div>
              )}
              <button type="submit" disabled={passBusy || !curPass || !newPass || !confirmPass} className="flex items-center justify-center gap-2 rounded-xl bg-[#0b8a51] py-3.5 text-sm font-bold text-white transition hover:bg-[#0a7a47] disabled:opacity-40">
                {passBusy && <Loader2 className="size-4 animate-spin" />} Update password
              </button>
              <p className="text-center text-xs text-[#8a9a91]">All sessions are signed out after a password change.</p>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/* ============ Main app ============ */

const NAV: { key: View; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="size-4.5" /> },
  { key: 'votes', label: 'Votes', icon: <ClipboardList className="size-4.5" /> },
  { key: 'divisions', label: 'Divisions', icon: <Building2 className="size-4.5" /> },
  { key: 'staff', label: 'Staff', icon: <Users className="size-4.5" /> },
  { key: 'settings', label: 'Settings', icon: <SettingsIcon className="size-4.5" /> },
]

export default function AdminPage() {
  const [checking, setChecking] = useState(true)
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [view, setView] = useState<View>('overview')

  const [settings, setSettings] = useState<Settings | null>(null)
  const [results, setResults] = useState<Results | null>(null)
  const [staffData, setStaffData] = useState<StaffData | null>(null)
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [divisionData, setDivisionData] = useState<DivisionsData | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Reporting-period filter, shared by Overview and Votes. '__all__' = all-time.
  const [monthFilter, setMonthFilter] = useState('__all__')

  const [monthDraft, setMonthDraft] = useState('')
  const [monthSaved, setMonthSaved] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)

  const showToast = useCallback((ok: boolean, text: string) => {
    setToast({ ok, text })
    setTimeout(() => setToast(null), 2600)
  }, [])

  const loadData = useCallback(async () => {
    setLoadingData(true)
    try {
      const [sRes, rRes, stRes, cRes, dRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch(`/api/admin/results?${monthFilter === '__all__' ? 'all=1' : `month=${encodeURIComponent(monthFilter)}`}`),
        fetch('/api/admin/staff'),
        fetch('/api/admin/cycles'),
        fetch(`/api/admin/divisions?${monthFilter === '__all__' ? '' : `month=${encodeURIComponent(monthFilter)}`}`),
      ])
      if (sRes.ok) {
        const s = (await sRes.json()) as Settings
        setSettings(s)
        setMonthDraft(s.votingMonth)
      }
      if (rRes.ok) setResults((await rRes.json()) as Results)
      if (stRes.ok) setStaffData((await stRes.json()) as StaffData)
      if (cRes.ok) {
        const c = (await cRes.json()) as { cycles: Cycle[] }
        setCycles(c.cycles ?? [])
      }
      if (dRes.ok) setDivisionData((await dRes.json()) as DivisionsData)
    } finally {
      setLoadingData(false)
    }
  }, [monthFilter])

  // Check the session once on mount
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/session')
      .then((res) => {
        if (res.ok) {
          return res.json().then((d: { admin: AdminUser }) => {
            if (!cancelled) setAdmin(d.admin)
          })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Load (or reload) data once signed in and whenever the month filter changes
  useEffect(() => {
    if (!admin) return
    loadData()
  }, [admin, loadData])

  async function handleLogin(u: string, p: string): Promise<boolean | string> {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      })
      const data = await res.json()
      if (!res.ok) return (data.error as string) ?? 'Login failed.'
      setAdmin(data.admin)
      await loadData()
      return true
    } catch {
      return 'Network error. Please try again.'
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    setAdmin(null)
    setSettings(null)
    setResults(null)
    setStaffData(null)
  }

  async function toggleVoting() {
    if (!settings) return
    setToggling(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ votingOpen: !settings.votingOpen }),
      })
      if (res.ok) {
        const next = (await res.json()) as Settings
        setSettings(next)
        showToast(true, next.votingOpen ? 'Voting is now open' : 'Voting is now closed')
      }
    } finally {
      setToggling(false)
    }
  }

  async function saveMonth() {
    if (!monthDraft.trim()) return
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ votingMonth: monthDraft.trim() }),
    })
    if (res.ok) {
      setSettings((await res.json()) as Settings)
      setMonthSaved(true)
      showToast(true, 'Voting cycle updated')
      setTimeout(() => setMonthSaved(false), 2000)
      // The new cycle becomes the default reporting period and appears in filters
      setMonthFilter(monthDraft.trim())
      await loadData()
    }
  }

  async function deleteVote(id: number) {
    if (!confirm(`Delete vote #${id}? This cannot be undone, and that phone number will be able to vote again.`)) return
    const res = await fetch(`/api/admin/votes/${id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast(true, `Vote #${id} deleted`)
      setRefreshKey((k) => k + 1)
      await loadData()
    } else {
      showToast(false, 'Failed to delete vote')
    }
  }

  async function deleteDivisionVote(id: number) {
    if (!confirm(`Delete division vote #${id}? This cannot be undone, and that phone number will be able to cast a division vote again.`)) return
    const res = await fetch(`/api/admin/divisions/${id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast(true, `Division vote #${id} deleted`)
      setRefreshKey((k) => k + 1)
      await loadData()
    } else {
      showToast(false, 'Failed to delete division vote')
    }
  }

  async function deleteVotesFor(sn: number, name: string) {
    if (!results) return
    const theirs = results.votes.filter((v) => v.candidateSn === sn)
    if (theirs.length === 0) {
      showToast(false, `${name} has no votes to delete`)
      return
    }
    if (!confirm(`Delete all ${theirs.length} vote(s) received by ${name}? This cannot be undone.`)) return
    for (const v of theirs) {
      await fetch(`/api/admin/votes/${v.id}`, { method: 'DELETE' })
    }
    showToast(true, `Deleted ${theirs.length} vote(s) for ${name}`)
    await loadData()
  }

  function copyPhone(phone: string) {
    navigator.clipboard?.writeText(phone)
    showToast(true, `Copied ${formatPhone(phone)}`)
  }

  async function addNominee(name: string, phone: string, division: string): Promise<boolean | string> {
    try {
      const res = await fetch('/api/admin/nominees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, division }),
      })
      const data = await res.json()
      if (!res.ok) return (data.error as string) ?? 'Failed to add nominee.'
      showToast(true, `${data.nominee.name} added to the roll`)
      await loadData()
      return true
    } catch {
      return 'Network error. Please try again.'
    }
  }

  async function editNominee(sn: number, name: string, phone: string, division: string): Promise<boolean | string> {
    try {
      const res = await fetch('/api/admin/nominees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sn, name, phone, division }),
      })
      const data = await res.json()
      if (!res.ok) return (data.error as string) ?? 'Failed to update nominee.'
      showToast(true, `${data.nominee.name} updated`)
      await loadData()
      return true
    } catch {
      return 'Network error. Please try again.'
    }
  }

  async function removeNominee(sn: number, name: string) {
    if (!confirm(`Remove ${name} from the nominal roll? They will no longer be able to vote or receive votes.`)) return
    try {
      const res = await fetch(`/api/admin/nominees?sn=${sn}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        showToast(false, (data.error as string) ?? 'Failed to remove staff member')
        return
      }
      showToast(true, `${name} removed from the roll`)
      await loadData()
    } catch {
      showToast(false, 'Network error. Please try again.')
    }
  }

  async function setNotNominee(sn: number, name: string, notNominee: boolean) {
    if (notNominee && !confirm(`Flag ${name} as voters-only? They can still vote, but will be hidden from the public roll, removed from every ballot, and can never receive votes or win a division vote.`)) return
    if (!notNominee && !confirm(`Remove the voters-only flag from ${name}? They will be visible on the public roll again and eligible to be voted for.`)) return
    try {
      const res = await fetch('/api/admin/nominees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sn, notNominee }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(false, (data.error as string) ?? 'Failed to update the voters-only flag')
        return
      }
      showToast(true, notNominee ? `${name} flagged voters-only (can vote, cannot be voted for)` : `${name} is eligible to be voted for again`)
      await loadData()
    } catch {
      showToast(false, 'Network error. Please try again.')
    }
  }

  async function setNominated(sn: number, name: string, nominated: boolean) {
    if (!nominated && !confirm(`Withdraw ${name} from the ballot? Past votes stay on record, but they can no longer receive new votes.`)) return
    try {
      const res = await fetch('/api/admin/nominees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sn, nominated }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(false, (data.error as string) ?? 'Failed to update nomination')
        return
      }
      showToast(true, nominated ? `${name} added to the ballot` : `${name} withdrawn from the ballot`)
      await loadData()
    } catch {
      showToast(false, 'Network error. Please try again.')
    }
  }

  async function toggleDivisionVoting() {
    if (!settings) return
    setToggling(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ divisionOpen: !settings.divisionOpen }),
      })
      if (res.ok) {
        const next = (await res.json()) as Settings
        setSettings(next)
        showToast(true, next.divisionOpen ? 'Division voting is now open' : 'Division voting is now closed')
      }
    } finally {
      setToggling(false)
    }
  }

  async function closeDivisionsAndNominate() {
    if (!settings) return
    const expected = divisionData?.standings.filter((s) => s.leader).length ?? 0
    if (!confirm(`Close division voting and nominate each division's top vote-getter${expected ? ` (${expected} division winner(s))` : ''}? Nominees are added to the general ballot.`)) return
    setToggling(true)
    try {
      const res = await fetch('/api/admin/divisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleMonth: settings.votingMonth }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(false, (data.error as string) ?? 'Failed to nominate division winners')
        return
      }
      const winners = (data.nominated as { division: string; name: string }[]) ?? []
      showToast(true, winners.length ? `Nominated: ${winners.map((w) => w.name).join(', ')}` : 'No division votes to nominate from')
      await loadData()
      setRefreshKey((k) => k + 1)
    } finally {
      setToggling(false)
    }
  }

  // Distinct divisions on the roll (for the assignment modal quick-pick)
  const divisions = useMemo(
    () => [...new Set((staffData?.staff ?? []).map((s) => s.division).filter((d): d is string => Boolean(d)))].sort(),
    [staffData],
  )

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#10261d] text-[#9cc9b2]">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (!admin) {
    return <LoginScreen onLogin={handleLogin} />
  }

  return (
    <div className="flex min-h-screen bg-[#f2f7f4] text-[#17352b]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-[#dbe8e1] bg-white lg:flex">
        <div className="flex items-center gap-3 border-b border-[#eef3f0] px-6 py-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#0b8a51] text-white">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">IPPIS Admin</p>
            <p className="text-xs text-[#71867d]">Recognition Portal</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${view === item.key ? 'bg-[#e3f4e9] text-[#0b8a51]' : 'text-[#587268] hover:bg-[#f3f9f6]'}`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-[#eef3f0] p-4">
          <div className={`mb-3 rounded-xl px-3 py-2.5 text-center text-xs font-bold ${settings?.votingOpen ? 'bg-[#e3f4e9] text-[#0b8a51]' : 'bg-[#f1f4f2] text-[#8a9a91]'}`}>
            {settings?.votingOpen ? '● Voting open' : ' Voting closed'}
          </div>
          <p className="mb-1 truncate text-xs font-semibold text-[#315d4a]" title={admin.username}>Signed in: {admin.username}</p>
          <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#e5c9c9] bg-white px-3 py-2.5 text-xs font-bold text-[#b04a4a] transition hover:bg-[#fdf5f5]">
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Content area */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-[#dbe8e1] bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 lg:px-8">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#0b8a51] text-white lg:hidden">
                <ShieldCheck className="size-4.5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight capitalize sm:text-xl">{view}</h1>
                <p className="text-[11px] font-medium text-[#71867d] lg:hidden">IPPIS Admin</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-[#eef7f2] px-3 py-1.5 text-xs font-bold text-[#0b8a51] sm:inline">{settings?.votingMonth}</span>
              <button onClick={loadData} disabled={loadingData} className="flex items-center gap-2 rounded-xl border border-[#d4e3dc] bg-white px-3 py-2 sm:px-3.5 sm:py-2.5 text-sm font-semibold text-[#315d4a] transition hover:border-[#9cc9b2] disabled:opacity-50" title="Refresh data">
                <RefreshCw className={`size-4 ${loadingData ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Refresh</span>
              </button>
              <button onClick={handleLogout} className="flex items-center gap-2 rounded-xl border border-[#e5c9c9] bg-white px-3 py-2 sm:px-3.5 sm:py-2.5 text-sm font-semibold text-[#b04a4a] transition hover:border-[#d49a9a]">
                <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-5 sm:px-5 lg:px-8 lg:pb-6 lg:pt-6">
          {view === 'overview' && (
            <OverviewView results={results} settings={settings} cycles={cycles} month={monthFilter} onMonthChange={setMonthFilter} />
          )}
          {view === 'votes' && (
            <VotesView
              month={monthFilter}
              onMonthChange={setMonthFilter}
              onDeleteVote={deleteVote}
              refreshKey={refreshKey}
              results={results}
              settings={settings}
              cycles={cycles}
            />
          )}
          {view === 'divisions' && (
            <DivisionsView
              divisionData={divisionData}
              settings={settings}
              month={monthFilter}
              onMonthChange={setMonthFilter}
              onToggleDivisionVoting={toggleDivisionVoting}
              onCloseDivisionsAndNominate={closeDivisionsAndNominate}
              onDeleteDivisionVote={deleteDivisionVote}
              toggling={toggling}
              refreshKey={refreshKey}
            />
          )}
          {view === 'staff' && (
            <StaffView
              staffData={staffData}
              onDeleteVotesFor={deleteVotesFor}
              onRevealPhone={copyPhone}
              onAddNominee={addNominee}
              onEditNominee={editNominee}
              onRemoveNominee={removeNominee}
              onSetNominated={setNominated}
              onSetNotNominee={setNotNominee}
            />
          )}
          {view === 'settings' && (
            <SettingsView
              settings={settings}
              monthDraft={monthDraft}
              setMonthDraft={setMonthDraft}
              monthSaved={monthSaved}
              onToggleVoting={toggleVoting}
              onSaveMonth={saveMonth}
              toggling={toggling}
              cycles={cycles}
            />
          )}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-20 left-4 right-4 z-50 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-center text-sm font-bold text-white shadow-2xl sm:left-auto sm:right-6 sm:text-left lg:bottom-6 ${toast.ok ? 'bg-[#0b8a51]' : 'bg-[#b04a4a]'}`}>
          {toast.ok ? <Check className="size-4 shrink-0" /> : <X className="size-4 shrink-0" />} {toast.text}
        </div>
      )}

      {/* Bottom tab bar (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dbe8e1] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition ${view === item.key ? 'text-[#0b8a51]' : 'text-[#8a9a91] hover:text-[#587268]'}`}
              aria-current={view === item.key ? 'page' : undefined}
            >
              <span className={`flex size-8 items-center justify-center rounded-xl transition ${view === item.key ? 'bg-[#e3f4e9]' : ''}`}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
