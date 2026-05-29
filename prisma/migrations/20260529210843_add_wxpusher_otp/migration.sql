-- CreateTable
CREATE TABLE "WxPusherOtp" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WxPusherOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WxPusherOtp_uid_used_idx" ON "WxPusherOtp"("uid", "used");
