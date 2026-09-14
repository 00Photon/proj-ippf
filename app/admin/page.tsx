'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Award,
  BarChart3,
  Check,
  ClipboardList,
  Eye,
  EyeOff,
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
  Trash2,
  TrendingUp,
  Trophy,
  Pencil,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'

/* ============ Types ============ */

interface AdminUser {
  id: number
  username: string
}
interface Settings {
  votingOpen: boolean
  votingMonth: string
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
  votesReceived: number
  hasVoted: boolean
}
interface StaffData {
  total: number
  votedCount: number
  staff: StaffRow[]
}

type View = 'overview' | 'votes' | 'nominees' | 'settings'

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
  if (phone.length === 11) return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`
  return phone
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
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
      <div className="w-full max-w-sm rounded-[28px] border border-[#2b4a3c] bg-[#16352a] p-8 shadow-2xl">
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

function RowActions({ items }: { items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] }) {
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
                onClick={() => {
                  setOpen(false)
                  item.onClick()
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium transition hover:bg-[#f3f9f6] ${item.danger ? 'text-[#b04a4a]' : 'text-[#315d4a]'}`}
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

/* ============ Overview view ============ */

function OverviewView({ results, settings }: { results: Results | null; settings: Settings | null }) {
  const maxVotes = Math.max(1, ...(results?.results.map((r) => r.voteCount) ?? [1]))
  const maxDay = Math.max(1, ...(results?.perDay.map((d) => d.count) ?? [1]))
  const maxHour = Math.max(1, ...(results?.perHour.map((h) => h.count) ?? [1]))

  const statCards = results
    ? [
        { icon: <Check className="size-5" />, label: 'Total votes', value: String(results.totalVotes), sub: `of ${results.totalStaff} staff`, accent: 'text-[#0b8a51]', bg: 'bg-[#eef7f2]' },
        { icon: <TrendingUp className="size-5" />, label: 'Turnout', value: `${results.turnoutPct}%`, sub: `${results.remainingVotes} still to vote`, accent: 'text-[#2563eb]', bg: 'bg-[#eaf1fd]' },
        { icon: <Trophy className="size-5" />, label: 'Leading', value: results.leader ? results.leader.name.split(' ')[0] : '—', sub: results.leader ? `${results.leader.voteCount} vote(s)` : 'No votes yet', accent: 'text-[#b78014]', bg: 'bg-[#fdf6e3]' },
        { icon: <Fingerprint className="size-5" />, label: 'Integrity', value: String(results.uniqueIps), sub: `${results.proxyCount} flagged proxy/VPN`, accent: 'text-[#7c3aed]', bg: 'bg-[#f3eefd]' },
      ]
    : []

  return (
    <div className="flex flex-col gap-6">
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
                    <span className="shrink-0 text-xs font-bold text-[#587268]">{r.voteCount}</span>
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

        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle eyebrow="Daily trend" title="Votes per day" />
            <div className="mt-5 flex h-28 items-end gap-1.5">
              {results?.perDay.length ? (
                results.perDay.map((d) => (
                  <div key={d.day} className="group relative flex-1" title={`${d.day}: ${d.count} vote(s)`}>
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
            <div className="mt-5 flex h-24 items-end gap-1">
              {results?.perHour.length ? (
                results.perHour.map((h, i) => (
                  <div key={`${h.hour}-${i}`} className="relative flex-1" title={`${h.hour} — ${h.count} vote(s)`}>
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

      <Card>
        <CardTitle
          eyebrow="Live feed"
          title="Recent votes"
          right={<span className="rounded-full bg-[#eef7f2] px-3 py-1 text-xs font-bold text-[#0b8a51]">{settings?.votingOpen ? 'Voting open' : 'Voting closed'} · {settings?.votingMonth}</span>}
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
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function VotesView({ results, onDeleteVote, refreshKey }: { results: Results | null; onDeleteVote: (id: number) => void; refreshKey: number }) {
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
    fetch(`/api/admin/votes?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load')
        return (await res.json()) as VotesPage
      })
      .then((next) => {
        if (!cancelled) setData(next)
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
  }, [page, pageSize, search, proxyOnly, refreshKey])

  // Reset to page 1 when the filter set changes
  useEffect(() => {
    setPage(1)
  }, [proxyOnly, refreshKey])

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
  )
}

/* ============ Nominees view ============ */

function NomineesView({
  staffData,
  onDeleteVotesFor,
  onRevealPhone,
  onAddNominee,
  onEditNominee,
  onRemoveNominee,
}: {
  staffData: StaffData | null
  onDeleteVotesFor: (sn: number, name: string) => void
  onRevealPhone: (phone: string) => void
  onAddNominee: (name: string, phone: string) => Promise<boolean | string>
  onEditNominee: (sn: number, name: string, phone: string) => Promise<boolean | string>
  onRemoveNominee: (sn: number, name: string) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [votedOnly, setVotedOnly] = useState<'all' | 'voted' | 'not-voted'>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  // When editingSn is set, the modal edits that nominee instead of adding
  const [editingSn, setEditingSn] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [addError, setAddError] = useState('')
  const [addBusy, setAddBusy] = useState(false)

  function openAddModal() {
    setEditingSn(null)
    setNewName('')
    setNewPhone('')
    setAddError('')
    setShowAddForm(true)
  }

  function openEditModal(sn: number, name: string, phone: string) {
    setEditingSn(sn)
    setNewName(name)
    setNewPhone(phone)
    setAddError('')
    setShowAddForm(true)
  }

  async function submitNomineeForm(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    setAddBusy(true)
    const result = editingSn !== null
      ? await onEditNominee(editingSn, newName, newPhone)
      : await onAddNominee(newName, newPhone)
    if (result === true) {
      setShowAddForm(false)
      setNewName('')
      setNewPhone('')
      setEditingSn(null)
    } else {
      setAddError(typeof result === 'string' ? result : 'Could not save the nominee.')
    }
    setAddBusy(false)
  }

  const filtered = useMemo(() => {
    if (!staffData) return []
    const q = search.toLowerCase()
    return staffData.staff.filter((s) => {
      if (votedOnly === 'voted' && !s.hasVoted) return false
      if (votedOnly === 'not-voted' && s.hasVoted) return false
      if (!q) return true
      return s.name.toLowerCase().includes(q) || s.phone.includes(q) || String(s.sn).includes(q)
    })
  }, [staffData, search, votedOnly])

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
      s.votesReceived,
      s.hasVoted ? 'yes' : 'no',
    ])
    const csv = toCsv(
      ['S/N', 'Name', 'Phone', 'Votes Received', 'Has Voted'],
      rows,
    )
    downloadCsv(`ippis-nominal-roll-${csvTimestamp()}.csv`, csv)
  }

  return (
    <Card className="!p-0">
      <div className="flex flex-col gap-4 border-b border-[#eef3f0] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#71867d]">Nominal roll</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight">All {staffData?.total ?? 89} nominees</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-[#8da198]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, S/N…"
              className="w-full rounded-xl border border-[#d7e5de] bg-[#fbfdfc] py-2.5 pl-9 pr-4 text-sm outline-none ring-[#0b8a51] focus:ring-2 sm:w-64"
            />
          </label>
          <select
            value={votedOnly}
            onChange={(e) => setVotedOnly(e.target.value as 'all' | 'voted' | 'not-voted')}
            className="rounded-xl border border-[#d7e5de] bg-[#fbfdfc] px-3 py-2.5 text-sm font-semibold text-[#315d4a] outline-none ring-[#0b8a51] focus:ring-2"
          >
            <option value="all">All staff</option>
            <option value="voted">✓ Have voted</option>
            <option value="not-voted">Not yet voted</option>
          </select>
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#0b8a51] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0a7a47]"
            title="Add a new staff member to the nominal roll"
          >
            <UserPlus className="size-3.5" /> Add nominee
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
              <th className="pb-3 pr-3 font-bold">Phone</th>
              <th className="pb-3 pr-3 font-bold">Votes received</th>
              <th className="pb-3 pr-3 font-bold">Participation</th>
              <th className="pb-3 pr-1 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.sn} className="border-b border-[#f0f5f2] transition hover:bg-[#f7fbf9]">
                <td className="py-3 pr-3 font-mono text-xs text-[#a4b8ae]">{s.sn}</td>
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#eef7f2] text-[10px] font-bold text-[#0b8a51]">{initialsOf(s.name)}</div>
                    <span className="font-semibold text-[#26483a]">{s.name}</span>
                  </div>
                </td>
                <td className="py-3 pr-3">
                  <button onClick={() => onRevealPhone(s.phone)} className="font-mono text-xs text-[#587268] transition hover:text-[#0b8a51]" title="Copy phone number">
                    {formatPhone(s.phone)}
                  </button>
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
                      { label: 'Copy phone', icon: <Phone className="size-4" />, onClick: () => onRevealPhone(s.phone) },
                      { label: 'Edit name / phone', icon: <Pencil className="size-4" />, onClick: () => openEditModal(s.sn, s.name, s.phone) },
                      { label: 'Delete their votes', icon: <Trash2 className="size-4" />, onClick: () => onDeleteVotesFor(s.sn, s.name), danger: true },
                      { label: 'Remove from roll', icon: <UserMinus className="size-4" />, onClick: () => onRemoveNominee(s.sn, s.name), danger: true },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-[#8a9a91]">No staff match your filter.</td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10261d]/50 p-5 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-[24px] bg-white p-7 shadow-2xl">
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
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#315d4a]">Phone number
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  inputMode="numeric"
                  placeholder="0803 000 0000"
                  autoComplete="off"
                  className="rounded-xl border border-[#d7e5de] bg-[#fbfdfc] px-4 py-3 text-sm outline-none ring-[#0b8a51] focus:ring-2"
                />
              </label>
              {addError && (
                <div className="rounded-xl border border-[#f3caca] bg-[#fdf1f1] p-3 text-xs leading-5 text-[#b91c1c]">{addError}</div>
              )}
              <button
                type="submit"
                disabled={addBusy || !newName.trim() || !newPhone.trim()}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#0b8a51] py-3.5 text-sm font-bold text-white transition hover:bg-[#0a7a47] disabled:opacity-40"
              >
                {addBusy && <Loader2 className="size-4 animate-spin" />} {editingSn !== null ? 'Save changes' : 'Add to roll'}
              </button>
              <p className="text-center text-xs text-[#8a9a91]">
                {editingSn !== null
                  ? 'Votes already cast keep the phone number used at vote time.'
                  : 'They become immediately eligible to receive and cast votes.'}
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
}: {
  settings: Settings | null
  monthDraft: string
  setMonthDraft: (m: string) => void
  monthSaved: boolean
  onToggleVoting: () => void
  onSaveMonth: () => void
  toggling: boolean
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
        </p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10261d]/50 p-5 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-[24px] bg-white p-7 shadow-2xl">
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
  { key: 'nominees', label: 'Nominees', icon: <Users className="size-4.5" /> },
  { key: 'settings', label: 'Settings', icon: <SettingsIcon className="size-4.5" /> },
]

export default function AdminPage() {
  const [checking, setChecking] = useState(true)
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [view, setView] = useState<View>('overview')

  const [settings, setSettings] = useState<Settings | null>(null)
  const [results, setResults] = useState<Results | null>(null)
  const [staffData, setStaffData] = useState<StaffData | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

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
      const [sRes, rRes, stRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/results'),
        fetch('/api/admin/staff'),
      ])
      if (sRes.ok) {
        const s = (await sRes.json()) as Settings
        setSettings(s)
        setMonthDraft(s.votingMonth)
      }
      if (rRes.ok) setResults((await rRes.json()) as Results)
      if (stRes.ok) setStaffData((await stRes.json()) as StaffData)
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/session')
      .then((res) => {
        if (res.ok) {
          return res.json().then((d: { admin: AdminUser }) => {
            if (cancelled) return
            setAdmin(d.admin)
            return loadData()
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
  }, [loadData])

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

  async function addNominee(name: string, phone: string): Promise<boolean | string> {
    try {
      const res = await fetch('/api/admin/nominees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
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

  async function editNominee(sn: number, name: string, phone: string): Promise<boolean | string> {
    try {
      const res = await fetch('/api/admin/nominees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sn, name, phone }),
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
        showToast(false, (data.error as string) ?? 'Failed to remove nominee')
        return
      }
      showToast(true, `${name} removed from the roll`)
      await loadData()
    } catch {
      showToast(false, 'Network error. Please try again.')
    }
  }

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
          <div className="flex items-center justify-between px-5 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              {/* Mobile nav */}
              <div className="relative lg:hidden">
                <select
                  value={view}
                  onChange={(e) => setView(e.target.value as View)}
                  className="rounded-xl border border-[#d7e5de] bg-white px-3 py-2.5 text-sm font-bold text-[#315d4a] outline-none"
                >
                  {NAV.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </div>
              <h1 className="hidden text-xl font-bold tracking-tight capitalize sm:block lg:hidden xl:block">{view}</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-[#eef7f2] px-3 py-1.5 text-xs font-bold text-[#0b8a51] sm:inline">{settings?.votingMonth}</span>
              <button onClick={loadData} disabled={loadingData} className="flex items-center gap-2 rounded-xl border border-[#d4e3dc] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#315d4a] transition hover:border-[#9cc9b2] disabled:opacity-50" title="Refresh data">
                <RefreshCw className={`size-4 ${loadingData ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Refresh</span>
              </button>
              <button onClick={handleLogout} className="flex items-center gap-2 rounded-xl border border-[#e5c9c9] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#b04a4a] transition hover:border-[#d49a9a]">
                <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-6 lg:px-8">
          {view === 'overview' && <OverviewView results={results} settings={settings} />}
          {view === 'votes' && <VotesView results={results} onDeleteVote={deleteVote} refreshKey={refreshKey} />}
          {view === 'nominees' && (
            <NomineesView
              staffData={staffData}
              onDeleteVotesFor={deleteVotesFor}
              onRevealPhone={copyPhone}
              onAddNominee={addNominee}
              onEditNominee={editNominee}
              onRemoveNominee={removeNominee}
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
            />
          )}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-2xl ${toast.ok ? 'bg-[#0b8a51]' : 'bg-[#b04a4a]'}`}>
          {toast.ok ? <Check className="size-4" /> : <X className="size-4" />} {toast.text}
        </div>
      )}
    </div>
  )
}
