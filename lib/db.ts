import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Neon serverless SQL client (tagged-template based)
export const sql = neon(process.env.DATABASE_URL)

export interface VoteRow {
  id?: number
  voter_phone?: string
  candidate_sn?: number
  candidate_name?: string
  remarks?: string | null
  created_at?: string
  // Audit columns (per-vote detail view)
  ip_address?: string | null
  user_agent?: string | null
  location?: unknown
  is_proxy?: boolean | null
  // Aggregates (results endpoint)
  vote_count?: number
}
