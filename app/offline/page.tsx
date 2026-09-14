import Link from 'next/link'

export const metadata = { title: 'Offline | IPPIS Staff Recognition' }

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#10261d] px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-[#0b8a51] text-white">
        <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-6.5 2.4" />
          <path d="M17.5 4.6A10 10 0 0 1 22 12" />
          <path d="M2 12a10 10 0 0 0 16.5 7.6" />
          <path d="M4.5 19.6 22 2" />
          <path d="M12 22a10 10 0 0 1-9.6-7.2" />
        </svg>
      </div>
      <h1 className="mt-6 text-2xl font-bold text-white">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[#9cc9b2]">
        The ballot needs an internet connection. Check your network and try again — your vote is only recorded once you&apos;re back online.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-[#0b8a51] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#0a7a47]"
      >
        Try again
      </Link>
    </main>
  )
}
