-- AlterTable
ALTER TABLE "UserChannelAccess" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "UserChannelAccess_expiresAt_idx" ON "UserChannelAccess"("expiresAt");
