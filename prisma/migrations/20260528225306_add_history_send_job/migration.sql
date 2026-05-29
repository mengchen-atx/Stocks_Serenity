-- CreateTable
CREATE TABLE "HistorySendJob" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "total" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "HistorySendJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HistorySendJob_uid_key" ON "HistorySendJob"("uid");
