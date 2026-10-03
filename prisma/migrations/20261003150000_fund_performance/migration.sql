CREATE TABLE "FundSnapshot" (
  "capturedAt" TIMESTAMP(3) PRIMARY KEY DEFAULT CURRENT_TIMESTAMP,
  "value" DECIMAL(30,2) NOT NULL,
  CONSTRAINT "FundSnapshot_value_check" CHECK ("value" >= 0)
);
ALTER TABLE "FundSnapshot" ENABLE ROW LEVEL SECURITY;
-- Cash is an exact valuation only when no crypto positions are open.
INSERT INTO "FundSnapshot" ("value")
SELECT "cash" FROM "Fund"
WHERE "id" = 'main' AND NOT EXISTS (SELECT 1 FROM "Position" WHERE "status" = 'OPEN');
