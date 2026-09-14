'use client'

import { useEffect, useMemo, useState } from 'react'
import confetti from 'canvas-confetti'
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Loader2,
  LockKeyhole,
  Menu,
  Phone,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react'

interface StaffEntry {
  sn: number
  name: string
}

interface VerifyResponse {
  valid: boolean
  hasVoted?: boolean
  voter?: { sn: number; name: string }
}

// Initials from a name like "EKWEM Virginus E. N." -> "EV"
function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

function toneFor(sn: number): string {
  const tones = ['bg-[#e7f2ec] text-[#0b6b40]', 'bg-[#f2efe4] text-[#6b5d1f]', 'bg-[#e8eef5] text-[#2f5470]', 'bg-[#f5e9e9] text-[#7c3a3a]', 'bg-[#efebf5] text-[#4d3f75]']
  return tones[sn % tones.length]
}

const REGISTER_PREVIEW = 8

export default function Page() {
  const [isVoteOpen, setIsVoteOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [votingOpen, setVotingOpen] = useState<boolean | null>(null)
  const [votingMonth, setVotingMonth] = useState('September 2026')

  const [phone, setPhone] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [voter, setVoter] = useState<{ sn: number; name: string } | null>(null)
  const [verifyError, setVerifyError] = useState('')
  const [hasVoted, setHasVoted] = useState(false)

  const [staff, setStaff] = useState<StaffEntry[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedSn, setSelectedSn] = useState<number | null>(null)
  const [remarks, setRemarks] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Fire confetti on the success screen
  useEffect(() => {
    if (!submitted) return
    const colors = ['#087443', '#0b8a51', '#3ecf8e', '#f5c518', '#ffffff']
    confetti({
      particleCount: 160,
      spread: 80,
      startVelocity: 45,
      origin: { y: 0.7 },
      colors,
      zIndex: 100,
    })
    const sideCannon = setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.7 },
        colors,
        zIndex: 100,
      })
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.7 },
        colors,
        zIndex: 100,
      })
    }, 350)
    return () => clearTimeout(sideCannon)
  }, [submitted])

  // Load the full nominal roll as the nominee pool
  useEffect(() => {
    let cancelled = false
    fetch('/api/staff')
      .then((res) => res.json())
      .then((data: { staff: StaffEntry[] }) => {
        if (!cancelled) setStaff(data.staff ?? [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingStaff(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Load public voting state (open/closed + active month)
  useEffect(() => {
    let cancelled = false
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data: { votingOpen: boolean; votingMonth: string }) => {
        if (cancelled) return
        setVotingOpen(data.votingOpen)
        if (data.votingMonth) setVotingMonth(data.votingMonth)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const filteredStaff = useMemo(
    () => staff.filter((member) => member.name.toLowerCase().includes(search.toLowerCase())),
    [staff, search],
  )

  const digits = phone.replace(/[^0-9]/g, '')
  const phoneLooksComplete = digits.length === 11 && digits.startsWith('0')

  async function verifyPhone() {
    setVerifying(true)
    setVerifyError('')
    setVoter(null)
    try {
      const res = await fetch(`/api/verify?phone=${encodeURIComponent(phone)}`)
      const data: VerifyResponse = await res.json()
      if (!res.ok || !data.valid) {
        setVerifyError('This number is not on the approved nominal roll.')
        return
      }
      if (data.hasVoted) {
        setHasVoted(true)
        setVoter(data.voter ?? null)
        return
      }
      setVoter(data.voter ?? null)
    } catch {
      setVerifyError('Verification failed. Check your connection and try again.')
    } finally {
      setVerifying(false)
    }
  }

  async function submitVote() {
    if (!voter || selectedSn === null) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, candidateSn: selectedSn, remarks }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setSubmitted(true)
      setHasVoted(true)
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function resetFlow() {
    setIsVoteOpen(false)
    setSubmitted(false)
    setVoter(null)
    setSelectedSn(null)
    setRemarks('')
    setSubmitError('')
    setVerifyError('')
    setPhone('')
    setHasVoted(false)
  }

  const isOpen = votingOpen !== false
  const registerPreview = staff.slice(0, REGISTER_PREVIEW)

  return (
    <main className="min-h-screen bg-[#fbfcfb] text-[#15291f]">
      {/* Institutional bar */}
      <div className="border-b border-[#e3ebe5]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-2 text-[11px] font-medium tracking-[0.08em] text-[#6d7f74] uppercase lg:px-8">
          <span>Office of the Accountant-General of the Federation</span>
          <span className="hidden sm:inline">One verified staff · one vote</span>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-[#e3ebe5] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="IPPIS Staff Recognition home">
            <img src="/ippis-logo.svg" alt="IPPIS OAGF seal" className="h-11 w-auto" />
          </a>
          <nav className="hidden items-center gap-8 text-[13px] font-medium tracking-wide text-[#47584d] md:flex" aria-label="Main navigation">
            <a href="#how-it-works" className="border-b border-transparent pb-0.5 transition hover:border-[#087443] hover:text-[#087443]">How it works</a>
            <a href="#guidelines" className="border-b border-transparent pb-0.5 transition hover:border-[#087443] hover:text-[#087443]">Guidelines</a>
            <a href="#support" className="border-b border-transparent pb-0.5 transition hover:border-[#087443] hover:text-[#087443]">Support</a>
          </nav>
          <button
            className="border border-[#dbe5de] p-2 text-[#47584d] md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Open navigation"
          >
            {isMobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
        {isMobileMenuOpen && (
          <nav className="border-t border-[#e3ebe5] bg-white px-5 py-3 text-sm md:hidden" aria-label="Mobile navigation">
            <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="block py-2.5 text-[#47584d]">How it works</a>
            <a href="#guidelines" onClick={() => setIsMobileMenuOpen(false)} className="block py-2.5 text-[#47584d]">Guidelines</a>
            <a href="#support" onClick={() => setIsMobileMenuOpen(false)} className="block py-2.5 text-[#47584d]">Support</a>
          </nav>
        )}
      </header>

      {/* Hero */}
      <section id="top" className="border-b border-[#e3ebe5] bg-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:px-8 lg:py-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#087443]">
              Best Staff of the Month — {votingMonth}
            </p>
            <h1 className="mt-5 max-w-xl font-serif text-5xl leading-[1.04] tracking-[-0.01em] text-[#15291f] sm:text-6xl">
              Recognising the people who keep IPPIS moving.
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-7 text-[#5c6f63]">
              Staff of the Office of the Accountant-General of the Federation(IPPIS). vote for a colleague whose
              work stood out. To cast your vote, Sign in with your registered phone number.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              {isOpen ? (
                <button
                  onClick={() => setIsVoteOpen(true)}
                  className={`inline-flex items-center justify-center gap-2.5 bg-[#087443] px-7 py-4 text-sm font-semibold tracking-wide text-white transition hover:bg-[#06603a] ${votingOpen ? 'animate-[glow-pulse_2.6s_ease-in-out_infinite]' : ''}`}
                >
                  Cast your vote <ArrowRight className="size-4" />
                </button>
              ) : (
                <button disabled className="inline-flex cursor-not-allowed items-center justify-center gap-2.5 bg-[#c3cec7] px-7 py-4 text-sm font-semibold tracking-wide text-white">
                  Voting is closed <LockKeyhole className="size-4" />
                </button>
              )}
              <a href="#how-it-works" className="inline-flex items-center gap-2 px-1 py-4 text-sm font-semibold text-[#087443] underline decoration-[#b5d3c3] underline-offset-4 transition hover:decoration-[#087443]">
                How the ballot works
              </a>
            </div>

            {/* Status ledger */}
            <dl className="mt-12 grid max-w-md grid-cols-3 border-t border-[#e3ebe5]">
              <div className="border-r border-[#e3ebe5] py-4 pr-4">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#84948a]">Status</dt>
                <dd className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#15291f]">
                  <span className={`size-1.5 rounded-full ${isOpen ? 'animate-pulse bg-[#0b8a51]' : 'bg-[#b04a4a]'}`} />
                  {isOpen ? 'Open' : 'Closed'}
                </dd>
              </div>
              <div className="border-r border-[#e3ebe5] py-4 pr-4">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#84948a]">Cycle</dt>
                <dd className="mt-2 text-sm font-semibold text-[#15291f]">{votingMonth}</dd>
              </div>
              <div className="py-4">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#84948a]">Register</dt>
                <dd className="mt-2 text-sm font-semibold text-[#15291f] tabular-nums">{loadingStaff ? '—' : `${staff.length} staff`}</dd>
              </div>
            </dl>
          </div>

          {/* Nominal register preview */}
          <div className="lg:pt-2">
            <div className="border border-[#e3ebe5] bg-[#fbfcfb]">
              <div className="flex items-baseline justify-between border-b border-[#e3ebe5] px-5 py-4">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#47584d]">Nominal register</h2>
                <span className="font-mono text-[11px] text-[#84948a]">2026</span>
              </div>
              <ul className="divide-y divide-[#edf2ee]">
                {registerPreview.map((member) => (
                  <li key={member.sn} className="flex items-center gap-4 px-5 py-3">
                    <span className="w-7 shrink-0 font-mono text-xs text-[#9aab9f] tabular-nums">{String(member.sn).padStart(2, '0')}</span>
                    <span className="truncate text-sm font-medium text-[#2b4033]">{member.name}</span>
                  </li>
                ))}
                {loadingStaff && <li className="px-5 py-6 text-sm text-[#84948a]">Loading register…</li>}
              </ul>
              <button
                onClick={() => setIsVoteOpen(true)}
                className="flex w-full items-center justify-between border-t border-[#e3ebe5] px-5 py-4 text-left text-sm font-semibold text-[#087443] transition hover:bg-[#f2f8f4]"
              >
                View the full register — {loadingStaff ? '…' : `${staff.length} names`}
                <ArrowRight className="size-4" />
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#84948a]">
              Every name on the official roll may be nominated. Voting closes when the cycle ends.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-b border-[#e3ebe5] bg-[#fbfcfb]">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
          <div className="flex items-baseline justify-between border-b border-[#e3ebe5] pb-4">
            <h2 className="font-serif text-3xl text-[#15291f]">How the ballot works</h2>
            <span className="font-mono text-xs text-[#9aab9f]">01</span>
          </div>
          <div className="grid gap-10 pt-10 md:grid-cols-3 md:gap-8">
            {[
              { n: '01', t: 'Verify your number', d: 'Enter the phone number registered on the IPPIS nominal roll. The system matches it against the official register' },
              { n: '02', t: 'Choose a colleague', d: 'Search the register and select the staff whose work stood out this month. Every name on the roll is eligible.' },
              { n: '03', t: 'Submit once', d: 'One phone number, one vote.' },
            ].map((step) => (
              <div key={step.n}>
                <p className="font-mono text-sm text-[#0b8a51]">{step.n}</p>
                <h3 className="mt-3 text-lg font-semibold text-[#15291f]">{step.t}</h3>
                <p className="mt-2.5 text-sm leading-6 text-[#5c6f63]">{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guidelines */}
      <section id="guidelines" className="border-b border-[#e3ebe5] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
          <div className="flex items-baseline justify-between border-b border-[#e3ebe5] pb-4">
            <h2 className="font-serif text-3xl text-[#15291f]">Voting guidelines</h2>
            <span className="font-mono text-xs text-[#9aab9f]">02</span>
          </div>
          <div className="grid gap-x-10 gap-y-8 pt-10 sm:grid-cols-2">
            {[
             
              { t: 'Official register only', d: 'Eligibility is matched against the monthly nominal roll. Numbers not on the roll are not eligible.' },
              { t: 'One vote per staff', d: 'A phone number that has voted is locked for the rest of the cycle. Votes cannot be changed once cast.' },
              { t: 'Audit & integrity', d: 'Connection details are logged for accountability and reviewed only by authorised administrators.' },
            ].map((item) => (
              <div key={item.t} className="border-t border-[#e3ebe5] pt-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-[#087443]">{item.t}</h3>
                <p className="mt-2.5 text-sm leading-6 text-[#5c6f63]">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="support" className="bg-[#f4f8f5]">
        <div className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <img src="/ippis-logo.svg" alt="IPPIS OAGF seal" className="h-12 w-auto" />
              <p className="mt-4 font-serif text-lg italic text-[#3d5446]">Always Ready to Serve You Better</p>
            </div>
            <div className="text-sm leading-7 text-[#5c6f63] md:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#84948a]">Support</p>
              <p className="mt-1">IPPIS Payroll Desk · <span className="font-medium text-[#087443]">info@ippis.gov.ng</span></p>
              <p className="text-xs text-[#84948a]">© 2026 Office of the Accountant-General of the Federation</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Vote modal */}
      {isVoteOpen && votingOpen !== false && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#12271f]/55 backdrop-blur-[2px] sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="vote-title">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto bg-white shadow-2xl sm:max-w-xl">
            <div className="flex items-start justify-between border-b border-[#e3ebe5] px-6 py-5 sm:px-8">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#087443]">{votingMonth} Staff of the Month </p>
                <h2 id="vote-title" className="mt-1.5 font-serif text-2xl text-[#15291f]">Cast your vote</h2>
              </div>
              <button className="p-1.5 text-[#6d7f74] transition hover:bg-[#f2f6f3]" onClick={resetFlow} aria-label="Close vote dialog">
                <X className="size-5" />
              </button>
            </div>

            {submitted ? (
              <div className="px-6 py-14 text-center sm:px-8">
                <div className="mx-auto flex size-14 items-center justify-center border border-[#bfe3cd] bg-[#eef8f1] text-[#087443]">
                  <Check className="size-7" />
                </div>
                <h3 className="mt-6 font-serif text-2xl text-[#15291f]">Vote recorded</h3>
                <p className="mx-auto mt-2.5 max-w-sm text-sm leading-6 text-[#5c6f63]">
                  Thank you. This phone number has used its one vote for the {votingMonth} cycle.
                </p>
                <button onClick={resetFlow} className="mt-8 bg-[#087443] px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-[#06603a]">
                  Done
                </button>
              </div>
            ) : hasVoted && voter ? (
              <div className="px-6 py-14 text-center sm:px-8">
                <div className="mx-auto flex size-14 items-center justify-center border border-[#eccfcf] bg-[#fbf1f1] text-[#b04a4a]">
                  <XCircle className="size-7" />
                </div>
                <h3 className="mt-6 font-serif text-2xl text-[#15291f]">Already voted</h3>
                <p className="mx-auto mt-2.5 max-w-sm text-sm leading-6 text-[#5c6f63]">
                  {voter.name}, this number has already been used in the {votingMonth} cycle. One staff, one vote.
                </p>
                <button onClick={resetFlow} className="mt-8 bg-[#087443] px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-[#06603a]">
                  Close
                </button>
              </div>
            ) : voter ? (
              <div className="flex flex-col gap-6 px-6 py-7 sm:px-8">
                <div className="flex items-center justify-between border border-[#bfe3cd] bg-[#f4faf6] px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#15291f]">{voter.name}</p>
                    <p className="mt-0.5 text-xs text-[#5c6f63]">Verified · S/N {voter.sn} on the nominal roll</p>
                  </div>
                  <BadgeCheck className="size-5 shrink-0 text-[#0b8a51]" />
                </div>

                <div>
                  <label htmlFor="candidate-search" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#47584d]">
                    Your nominee
                  </label>
                  <div className="relative mt-2.5">
                    <Search className="absolute left-3.5 top-3 size-4 text-[#9aab9f]" />
                    <input
                      id="candidate-search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search the register"
                      className="w-full border border-[#dbe5de] bg-[#fbfcfb] py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-[#9aab9f] focus:border-[#087443]"
                    />
                  </div>
                  <div className="mt-3 max-h-60 divide-y divide-[#edf2ee] overflow-y-auto border border-[#e3ebe5]">
                    {loadingStaff ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#84948a]">
                        <Loader2 className="size-4 animate-spin" /> Loading register…
                      </div>
                    ) : (
                      filteredStaff.map((member) => (
                        <button
                          key={member.sn}
                          onClick={() => setSelectedSn(member.sn)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${selectedSn === member.sn ? 'bg-[#eef8f1]' : 'bg-white hover:bg-[#f7faf8]'}`}
                        >
                          <span className="w-7 shrink-0 font-mono text-xs text-[#9aab9f] tabular-nums">{String(member.sn).padStart(2, '0')}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#2b4033]">{member.name}</span>
                          {selectedSn === member.sn && <Check className="size-4 shrink-0 text-[#087443]" />}
                        </button>
                      ))
                    )}
                    {!loadingStaff && filteredStaff.length === 0 && (
                      <p className="px-4 py-6 text-center text-sm text-[#84948a]">No name matches “{search}”.</p>
                    )}
                  </div>
                </div>

                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#47584d]">
                    Remarks <span className="font-normal normal-case tracking-normal text-[#9aab9f]">— optional</span>
                  </span>
                  <textarea
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    placeholder="What made their work stand out?"
                    rows={3}
                    className="mt-2.5 w-full resize-none border border-[#dbe5de] bg-[#fbfcfb] px-4 py-3 text-sm outline-none placeholder:text-[#9aab9f] focus:border-[#087443]"
                  />
                </label>

                {submitError && (
                  <div className="border border-[#eccfcf] bg-[#fbf1f1] px-4 py-3 text-xs leading-5 text-[#b04a4a]">{submitError}</div>
                )}

                <div className="flex items-start gap-2.5 border-t border-[#e3ebe5] pt-4 text-xs leading-5 text-[#6d7f74]">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#0b8a51]" />
                  Your ballot is confidential.
                </div>

                <button
                  disabled={selectedSn === null || submitting}
                  onClick={submitVote}
                  className="flex items-center justify-center gap-2 bg-[#087443] py-4 text-sm font-semibold tracking-wide text-white transition hover:bg-[#06603a] disabled:cursor-not-allowed disabled:bg-[#c3cec7]"
                >
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  {submitting ? 'Recording…' : 'Submit vote'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-6 px-6 py-7 sm:px-8">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#47584d]">Phone number</span>
                  <div className="relative mt-2.5">
                    <Phone className="absolute left-3.5 top-3 size-4 text-[#9aab9f]" />
                    <input
                      inputMode="numeric"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value)
                        setVerifyError('')
                        setHasVoted(false)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && phoneLooksComplete && !verifying) verifyPhone()
                      }}
                      placeholder="0803 000 0000"
                      className="w-full border border-[#dbe5de] bg-[#fbfcfb] py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-[#9aab9f] focus:border-[#087443]"
                    />
                  </div>
                  <span className="mt-2 block text-xs text-[#84948a]">Enter the number registered on the IPPIS nominal roll.</span>
                </label>

                {verifyError && (
                  <div className="border border-[#eccfcf] bg-[#fbf1f1] px-4 py-3 text-xs leading-5 text-[#b04a4a]">{verifyError}</div>
                )}

                <button
                  disabled={!phoneLooksComplete || verifying}
                  onClick={verifyPhone}
                  className="flex items-center justify-center gap-2 bg-[#087443] py-4 text-sm font-semibold tracking-wide text-white transition hover:bg-[#06603a] disabled:cursor-not-allowed disabled:bg-[#c3cec7]"
                >
                  {verifying && <Loader2 className="size-4 animate-spin" />}
                  {verifying ? 'Verifying…' : 'Continue'}
                </button>

                <div className="flex items-start gap-2.5 border-t border-[#e3ebe5] pt-4 text-xs leading-5 text-[#6d7f74]">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#0b8a51]" />
                  We match your number against the official register. Your choice of nominee stays confidential.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
