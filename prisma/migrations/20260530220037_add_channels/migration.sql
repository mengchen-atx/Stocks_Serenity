-- AlterTable
ALTER TABLE "Tweet" ADD COLUMN     "channelId" TEXT;

-- AlterTable
ALTER TABLE "WatchUser" ADD COLUMN     "channelId" TEXT;

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatarUrl" TEXT,
    "wxpusherTopicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserChannelAccess" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserChannelAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Channel_slug_key" ON "Channel"("slug");

-- CreateIndex
CREATE INDEX "UserChannelAccess_uid_idx" ON "UserChannelAccess"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "UserChannelAccess_uid_channelId_key" ON "UserChannelAccess"("uid", "channelId");

-- CreateIndex
CREATE INDEX "Tweet_channelId_tweetCreatedAt_idx" ON "Tweet"("channelId", "tweetCreatedAt");

-- AddForeignKey
ALTER TABLE "UserChannelAccess" ADD CONSTRAINT "UserChannelAccess_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchUser" ADD CONSTRAINT "WatchUser_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tweet" ADD CONSTRAINT "Tweet_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
