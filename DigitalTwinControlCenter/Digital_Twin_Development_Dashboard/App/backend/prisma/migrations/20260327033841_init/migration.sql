-- AlterTable
ALTER TABLE "DeployedSystem" ALTER COLUMN "realtimeConfig" DROP DEFAULT,
ALTER COLUMN "simulationConfig" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RuntimeSetupConfig" ADD COLUMN     "activeSystems" JSONB,
ADD COLUMN     "reasoning" JSONB;
