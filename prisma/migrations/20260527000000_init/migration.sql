CREATE TYPE "PushChannel" AS ENUM ('WECHAT_WORK_BOT', 'SERVER_CHAN', 'WECHAT_TEMPLATE');
CREATE TYPE "PushStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "WatchUser" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "displayName" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "includeReplies" BOOLEAN NOT NULL DEFAULT false,
  "includeRetweets" BOOLEAN NOT NULL DEFAULT false,
  "lastTweetId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WatchUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tweet" (
  "id" TEXT NOT NULL,
  "tweetId" TEXT NOT NULL,
  "authorUsername" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "tweetCreatedAt" TIMESTAMP(3) NOT NULL,
  "translatedContent" TEXT,
  "aiAnalysis" JSONB,
  "pushed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "watchUserId" TEXT,
  CONSTRAINT "Tweet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Stock" (
  "id" TEXT NOT NULL,
  "ticker" TEXT NOT NULL,
  "companyName" TEXT,
  "exchange" TEXT,
  "currency" TEXT,
  "price" DOUBLE PRECISION,
  "marketCap" BIGINT,
  "marketCapDisplay" TEXT,
  "companyDescription" TEXT,
  "industry" TEXT,
  "themes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "lastFetchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockMention" (
  "id" TEXT NOT NULL,
  "tweetId" TEXT NOT NULL,
  "stockId" TEXT NOT NULL,
  "stance" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "confidence" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMention_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushLog" (
  "id" TEXT NOT NULL,
  "tweetId" TEXT NOT NULL,
  "channel" "PushChannel" NOT NULL,
  "status" "PushStatus" NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "responseStatus" INTEGER,
  "responseBody" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CronRun" (
  "id" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL,
  "fetched" INTEGER NOT NULL DEFAULT 0,
  "analyzed" INTEGER NOT NULL DEFAULT 0,
  "pushed" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WatchUser_username_key" ON "WatchUser"("username");
CREATE UNIQUE INDEX "Tweet_tweetId_key" ON "Tweet"("tweetId");
CREATE UNIQUE INDEX "Tweet_contentHash_key" ON "Tweet"("contentHash");
CREATE INDEX "Tweet_authorUsername_tweetCreatedAt_idx" ON "Tweet"("authorUsername", "tweetCreatedAt");
CREATE INDEX "Tweet_pushed_idx" ON "Tweet"("pushed");
CREATE UNIQUE INDEX "Stock_ticker_key" ON "Stock"("ticker");
CREATE UNIQUE INDEX "StockMention_tweetId_stockId_stance_key" ON "StockMention"("tweetId", "stockId", "stance");
CREATE INDEX "StockMention_stance_idx" ON "StockMention"("stance");
CREATE UNIQUE INDEX "PushLog_tweetId_channel_payloadHash_key" ON "PushLog"("tweetId", "channel", "payloadHash");
CREATE INDEX "PushLog_status_createdAt_idx" ON "PushLog"("status", "createdAt");

ALTER TABLE "Tweet" ADD CONSTRAINT "Tweet_watchUserId_fkey" FOREIGN KEY ("watchUserId") REFERENCES "WatchUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMention" ADD CONSTRAINT "StockMention_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "Tweet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMention" ADD CONSTRAINT "StockMention_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushLog" ADD CONSTRAINT "PushLog_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "Tweet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
