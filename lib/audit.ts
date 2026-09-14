import type { NextRequest } from 'next/server'

export interface AuditInfo {
  ip: string | null
  userAgent: string | null
}

export interface IpLocation {
  countryName?: string
  countryCode?: string
  regionName?: string
  cityName?: string
  timeZone?: string
  latitude?: number
  longitude?: number
  isProxy?: boolean
}

const PRIVATE_IPV4 =
  /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|::1$|f[cd][0-9a-f]{2}:)/i

/** Best-effort client IP extraction behind proxies/CDNs (Vercel, nginx, etc.) */
export function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const cfIp = request.headers.get('cf-connecting-ip')?.trim()
  if (cfIp) return cfIp
  return null
}

export function getAuditInfo(request: NextRequest): AuditInfo {
  const ip = getClientIp(request)
  const userAgent = (request.headers.get('user-agent') ?? '').slice(0, 300) || null
  return { ip, userAgent }
}

function isPrivateOrLocal(ip: string): boolean {
  return PRIVATE_IPV4.test(ip)
}

/**
 * Look up rough location for a public IP via freeipapi.com (free, no key).
 * Never throws — audit data must never block a vote.
 */
export async function lookupIpLocation(ip: string | null): Promise<IpLocation | null> {
  if (!ip || isPrivateOrLocal(ip)) return null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`https://freeipapi.com/api/json/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    return {
      countryName: typeof data.countryName === 'string' ? data.countryName : undefined,
      countryCode: typeof data.countryCode === 'string' ? data.countryCode : undefined,
      regionName: typeof data.regionName === 'string' ? data.regionName : undefined,
      cityName: typeof data.cityName === 'string' ? data.cityName : undefined,
      timeZone: typeof data.timeZone === 'string' ? data.timeZone : undefined,
      latitude: typeof data.latitude === 'number' ? data.latitude : undefined,
      longitude: typeof data.longitude === 'number' ? data.longitude : undefined,
      isProxy: data.isProxy === true,
    }
  } catch {
    return null
  }
}

/** Human-readable one-liner of a location for admin display */
export function formatLocation(location: IpLocation | null): string | null {
  if (!location) return null
  const parts = [location.cityName, location.regionName, location.countryName].filter(Boolean)
  const proxy = location.isProxy ? ' (proxy/VPN detected)' : ''
  return parts.length ? `${parts.join(', ')}${proxy}` : null
}
