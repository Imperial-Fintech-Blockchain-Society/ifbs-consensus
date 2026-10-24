BEGIN;

-- The previous migration removed stop levels alongside take profit.
-- Historical values cannot be reconstructed; never invent a stop for an existing pitch.
ALTER TABLE "Pitch" ADD COLUMN "stopLossPercent" DECIMAL(8,2);
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_stop_loss_check"
  CHECK ("stopLossPercent" IS NULL OR "stopLossPercent" BETWEEN 1 AND 90);

ALTER TABLE "Position" ADD COLUMN "stopPrice" DECIMAL(30,12);
ALTER TABLE "Position" ADD CONSTRAINT "Position_stop_price_check"
  CHECK ("stopPrice" IS NULL OR ("stopPrice" > 0 AND "stopPrice" < "entryPrice"));

COMMIT;
