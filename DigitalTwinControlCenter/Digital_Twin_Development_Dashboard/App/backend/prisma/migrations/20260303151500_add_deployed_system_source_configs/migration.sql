ALTER TABLE "DeployedSystem"
ADD COLUMN "realtimeConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN "simulationConfig" JSONB NOT NULL DEFAULT '{}'::jsonb;
