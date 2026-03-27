CREATE TABLE "RuntimeSetupConfig" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "realtime" JSONB NOT NULL,
    "simulation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuntimeSetupConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RuntimeSetupConfig_accountId_key" ON "RuntimeSetupConfig"("accountId");

ALTER TABLE "RuntimeSetupConfig" ADD CONSTRAINT "RuntimeSetupConfig_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
