import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import PwaClient from './pwa'
import './globals.css'

export const metadata: Metadata = {
  title: 'IPPIS Staff Recognition | OAGF',
  description: 'Secure monthly staff recognition voting for the Office of the Accountant-General of the Federation.',
  generator: 'v0.app',
  manifest: '/manifest.webmanifest',
  applicationName: 'IPPIS Vote',
  appleWebApp: {
    capable: true,
    title: 'IPPIS Vote',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7faf8' },
    { media: '(prefers-color-scheme: dark)', color: '#0e211a' },
  ],
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-[#f7faf8]">
      <body className="antialiased">
        {children}
        <PwaClient />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
