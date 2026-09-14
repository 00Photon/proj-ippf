'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** True when running as an installed PWA (standalone window). */
function isStandalone(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
  )
}

export default function PwaClient() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    if (isStandalone() || localStorage.getItem('pwa-install-dismissed')) return

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  // Small loader shown only on first launch from the installed app
  const [appLoading, setAppLoading] = useState(true)
  useEffect(() => {
    if (!isStandalone()) {
      setAppLoading(false)
      return
    }
    const timer = setTimeout(() => setAppLoading(false), 900)
    return () => clearTimeout(timer)
  }, [])

  if (appLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-[#10261d]">
        <img src="/pwa-192.png" alt="" className="size-20 rounded-2xl" />
        <div className="size-7 animate-spin rounded-full border-2 border-[#2b4a3c] border-t-[#3ecf8e]" aria-label="Loading" />
      </div>
    )
  }

  async function install() {
    if (!installEvent) return
    setInstalling(true)
    try {
      await installEvent.prompt()
      const { outcome } = await installEvent.userChoice
      if (outcome === 'accepted') localStorage.setItem('pwa-install-dismissed', '1')
    } finally {
      setInstalling(false)
      setInstallEvent(null)
    }
  }

  if (!installEvent || dismissed) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] sm:left-auto sm:w-96">
      <div className="flex items-center gap-3 rounded-2xl border border-[#2b4a3c] bg-[#16352a] p-4 shadow-2xl">
        <img src="/pwa-192.png" alt="" className="size-11 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Install IPPIS Vote</p>
          <p className="text-xs text-[#9cc9b2]">Add to your home screen for one-tap voting.</p>
        </div>
        <button
          onClick={install}
          disabled={installing}
          className="shrink-0 rounded-xl bg-[#0b8a51] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#0a7a47] disabled:opacity-50"
        >
          {installing ? '…' : 'Install'}
        </button>
        <button
          onClick={() => {
            localStorage.setItem('pwa-install-dismissed', '1')
            setDismissed(true)
          }}
          className="shrink-0 rounded-lg p-1.5 text-[#5f7d6f] hover:bg-[#1f4032]"
          aria-label="Dismiss install prompt"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
