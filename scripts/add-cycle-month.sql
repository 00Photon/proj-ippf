-- Monthly cycles: stamp every vote with the voting cycle it was cast under.
-- Idempotent — safe to run more than once. Run via scripts/migrate-cycle.ts.

-- 1. New column (backfilled to the current active cycle for existing votes)
ALTER TABLE votes ADD COLUMN IF NOT EXISTS cycle_month TEXT NOT NULL DEFAULT 'September 2026';

-- 2. Eligibility is per cycle: replace the global phone unique constraint
--    with a unique (phone, cycle) index
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_voter_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS votes_phone_cycle_unique_idx ON votes (voter_phone, cycle_month);

CREATE INDEX IF NOT EXISTS votes_cycle_month_idx ON votes (cycle_month);

-- 3. Results view now groups per cycle
DROP VIEW IF EXISTS vote_results;
CREATE VIEW vote_results AS
SELECT
  cycle_month,
  candidate_sn,
  candidate_name,
  COUNT(*) AS vote_count
FROM votes
GROUP BY cycle_month, candidate_sn, candidate_name
ORDER BY vote_count DESC, candidate_sn ASC;
