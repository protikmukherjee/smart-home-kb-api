CREATE TABLE "DeployedSystem" (
    "id" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "mainClass" TEXT,
    "dependencies" JSONB NOT NULL,
    "definition" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeployedSystem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeployedSystem_sourceSystemId_key" ON "DeployedSystem"("sourceSystemId");

ALTER TABLE "DeployedSystem" ADD CONSTRAINT "DeployedSystem_sourceSystemId_fkey" FOREIGN KEY ("sourceSystemId") REFERENCES "System"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
