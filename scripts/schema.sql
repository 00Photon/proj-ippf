-- IPPIS Staff Recognition voting schema
-- Run once against the Neon database.

CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  voter_phone TEXT NOT NULL,
  cycle_month TEXT NOT NULL DEFAULT 'September 2026', -- voting cycle this vote belongs to
  candidate_sn INT NOT NULL,                 -- S/N from the nominal roll
  candidate_name TEXT NOT NULL,              -- snapshot of name at vote time
  remarks TEXT,
  ip_address TEXT,                           -- audit: voter IP at submission
  user_agent TEXT,                           -- audit: browser/device string
  location JSONB,                            -- audit: rough IP geolocation
  is_proxy BOOLEAN,                          -- audit: proxy/VPN flag from lookup
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS votes_candidate_sn_idx ON votes (candidate_sn);
CREATE INDEX IF NOT EXISTS votes_cycle_month_idx ON votes (cycle_month);

-- One vote per phone per cycle (new cycles reset eligibility)
CREATE UNIQUE INDEX IF NOT EXISTS votes_phone_cycle_unique_idx ON votes (voter_phone, cycle_month);

-- Aggregate view for admin/results use: totals per candidate
CREATE OR REPLACE VIEW vote_results AS
SELECT
  cycle_month,
  candidate_sn,
  candidate_name,
  COUNT(*) AS vote_count
FROM votes
GROUP BY cycle_month, candidate_sn, candidate_name
ORDER BY vote_count DESC, candidate_sn ASC;
