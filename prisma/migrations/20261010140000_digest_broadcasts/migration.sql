CREATE TABLE "DigestBroadcast" (
    "week" TEXT NOT NULL,
    "broadcastId" TEXT,
    "segmentId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "lockOwner" TEXT,
    "lockedUntil" TIMESTAMP(3),
    CONSTRAINT "DigestBroadcast_pkey" PRIMARY KEY ("week")
);
CREATE UNIQUE INDEX "DigestBroadcast_broadcastId_key" ON "DigestBroadcast"("broadcastId");
ALTER TABLE "DigestBroadcast" ENABLE ROW LEVEL SECURITY;
