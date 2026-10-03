CREATE SCHEMA IF NOT EXISTS "public";
CREATE TYPE "PitchStatus" AS ENUM ('PENDING', 'PASSED', 'REJECTED');
CREATE TYPE "PositionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TABLE "User" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "digestEnabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Pitch" (
  "id" TEXT NOT NULL, "authorId" TEXT NOT NULL, "coinId" TEXT NOT NULL, "tokenName" TEXT NOT NULL,
  "ticker" TEXT NOT NULL, "title" TEXT NOT NULL, "thesis" TEXT NOT NULL,
  "stopLossPercent" DECIMAL(8,2) NOT NULL, "takeProfitPercent" DECIMAL(8,2) NOT NULL,
  "allocation" DECIMAL(18,2) NOT NULL DEFAULT 1000, "quorum" INTEGER NOT NULL DEFAULT 5,
  "status" "PitchStatus" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL, "resolvedAt" TIMESTAMP(3), CONSTRAINT "Pitch_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Vote" (
  "id" TEXT NOT NULL, "pitchId" TEXT NOT NULL, "voterId" TEXT NOT NULL, "decision" BOOLEAN NOT NULL,
  "reason" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Position" (
  "id" TEXT NOT NULL, "pitchId" TEXT NOT NULL, "coinId" TEXT NOT NULL, "ticker" TEXT NOT NULL,
  "entryPrice" DECIMAL(30,12) NOT NULL, "quantity" DECIMAL(30,12) NOT NULL, "allocation" DECIMAL(18,2) NOT NULL,
  "targetPrice" DECIMAL(30,12) NOT NULL, "stopPrice" DECIMAL(30,12) NOT NULL,
  "entryTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "status" "PositionStatus" NOT NULL DEFAULT 'OPEN',
  "closePrice" DECIMAL(30,12), "closeTime" TIMESTAMP(3), "closeReason" TEXT,
  CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RateLimit" (
  "key" TEXT NOT NULL, "count" INTEGER NOT NULL DEFAULT 1, "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);
CREATE TABLE "DigestDelivery" (
  "id" TEXT NOT NULL, "week" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "DigestDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Pitch_status_expiresAt_idx" ON "Pitch"("status", "expiresAt");
CREATE UNIQUE INDEX "Vote_pitchId_voterId_key" ON "Vote"("pitchId", "voterId");
CREATE UNIQUE INDEX "Position_pitchId_key" ON "Position"("pitchId");
CREATE INDEX "Position_status_idx" ON "Position"("status");
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");
CREATE UNIQUE INDEX "DigestDelivery_week_userId_key" ON "DigestDelivery"("week", "userId");
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- These tables are accessed by the server through Prisma, never by Supabase's public client.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pitch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Position" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DigestDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_targets_check" CHECK ("stopLossPercent" BETWEEN 1 AND 90 AND "takeProfitPercent" BETWEEN 1 AND 1000 AND "allocation" > 0 AND "quorum" > 0);
ALTER TABLE "Position" ADD CONSTRAINT "Position_price_check" CHECK ("entryPrice" > 0 AND "quantity" > 0 AND "allocation" > 0 AND "targetPrice" > "entryPrice" AND "stopPrice" > 0 AND "stopPrice" < "entryPrice");
