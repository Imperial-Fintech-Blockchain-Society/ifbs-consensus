BEGIN;

-- Keep allocations, entries, and historical closes; remove automatic exit levels.
ALTER TABLE "Pitch" DROP CONSTRAINT IF EXISTS "Pitch_targets_check";
ALTER TABLE "Pitch"
  DROP COLUMN IF EXISTS "takeProfitPercent",
  DROP COLUMN IF EXISTS "stopLossPercent";
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_quorum_check" CHECK ("quorum" > 0);

ALTER TABLE "Position" DROP CONSTRAINT IF EXISTS "Position_price_check";
ALTER TABLE "Position"
  DROP COLUMN IF EXISTS "targetPrice",
  DROP COLUMN IF EXISTS "stopPrice";
ALTER TABLE "Position" ADD CONSTRAINT "Position_price_check"
  CHECK ("entryPrice" > 0 AND "quantity" > 0 AND "allocation" > 0);

COMMIT;
