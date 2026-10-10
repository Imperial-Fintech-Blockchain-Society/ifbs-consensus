CREATE TABLE "PendingSignup" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PendingSignup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PendingSignup_email_key" ON "PendingSignup"("email");
CREATE UNIQUE INDEX "PendingSignup_tokenHash_key" ON "PendingSignup"("tokenHash");
CREATE INDEX "PendingSignup_expiresAt_idx" ON "PendingSignup"("expiresAt");
ALTER TABLE "PendingSignup" ENABLE ROW LEVEL SECURITY;
