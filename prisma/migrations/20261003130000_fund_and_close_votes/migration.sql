ALTER TYPE "PitchStatus" ADD VALUE 'QUEUED';
ALTER TABLE "Pitch" ALTER COLUMN "allocation" SET DEFAULT 10000;
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_allocation_limit" CHECK ("allocation" > 0 AND "allocation" <= 10000);
CREATE TYPE "CloseProposalStatus" AS ENUM ('PENDING', 'PASSED', 'REJECTED', 'CANCELLED');
CREATE TABLE "Fund" (
  "id" TEXT PRIMARY KEY DEFAULT 'main',
  "initialCapital" DECIMAL(18,2) NOT NULL DEFAULT 100000,
  "cash" DECIMAL(18,2) NOT NULL DEFAULT 100000,
  "allocated" DECIMAL(18,2) NOT NULL DEFAULT 0,
  CONSTRAINT "Fund_singleton" CHECK ("id" = 'main'),
  CONSTRAINT "Fund_capital_check" CHECK ("initialCapital" = 100000 AND "cash" >= 0 AND "allocated" >= 0 AND "allocated" <= "initialCapital")
);
-- Reconcile the starting ledger from existing positions without changing them.
INSERT INTO "Fund" ("id", "cash", "allocated") SELECT 'main',
  100000 - COALESCE(SUM("allocation"), 0) + COALESCE(SUM(CASE WHEN "status" = 'CLOSED' THEN ROUND("closePrice" * "quantity", 2) ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN "status" = 'OPEN' THEN "allocation" ELSE 0 END), 0) FROM "Position";
CREATE TABLE "CloseProposal" (
  "id" TEXT PRIMARY KEY,
  "positionId" TEXT NOT NULL REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "proposerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reason" TEXT NOT NULL,
  "status" "CloseProposalStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "CloseProposal_window" CHECK ("expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + INTERVAL '24 hours')
);
CREATE TABLE "CloseVote" (
  "id" TEXT PRIMARY KEY,
  "proposalId" TEXT NOT NULL REFERENCES "CloseProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "voterId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "decision" BOOLEAN NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CloseProposal_status_expiresAt_idx" ON "CloseProposal"("status", "expiresAt");
CREATE INDEX "CloseProposal_positionId_createdAt_idx" ON "CloseProposal"("positionId", "createdAt");
CREATE UNIQUE INDEX "CloseProposal_one_pending_per_position" ON "CloseProposal"("positionId") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "CloseVote_proposalId_voterId_key" ON "CloseVote"("proposalId", "voterId");
ALTER TABLE "Fund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CloseProposal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CloseVote" ENABLE ROW LEVEL SECURITY;
