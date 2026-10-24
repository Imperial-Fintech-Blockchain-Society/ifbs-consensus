BEGIN;

ALTER TABLE "Pitch" DROP CONSTRAINT "Pitch_stop_loss_check";
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_stop_loss_check"
  CHECK ("stopLossPercent" IS NULL OR "stopLossPercent" BETWEEN 5 AND 20);

COMMIT;
