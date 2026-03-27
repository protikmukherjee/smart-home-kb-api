import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const systemJson = {
  systems: [
    {
      name: "Demo System",
      "physical entities": [
        {
          controllers: [
            {
              devices: [
                { name: "Temp Sensor", "device type": "sensor" },
                { name: "Pressure Sensor", "device type": "sensor" },
                { name: "Stepper Motor", "device type": "actuator" },
                { name: "Relay Board", "device type": "actuator" },
                { name: "Gateway", "device type": "communication" },
                { name: "Main CPU", "device type": "processor" }
              ]
            }
          ]
        }
      ]
    }
  ]
};

const components = [
  { name: "Temp Sensor", deviceType: "sensor" },
  { name: "Pressure Sensor", deviceType: "sensor" },
  { name: "Stepper Motor", deviceType: "actuator" },
  { name: "Relay Board", deviceType: "actuator" },
  { name: "Gateway", deviceType: "communication" },
  { name: "Main CPU", deviceType: "processor" }
];

async function main() {
  const account = await prisma.account.findFirst();
  const baseAccount =
    account ??
    (await prisma.account.create({
      data: {
        name: "Base Account"
      }
    }));

  const existing = await prisma.system.findFirst({
    where: {
      accountId: baseAccount.id,
      name: "Demo System"
    }
  });

  if (existing) {
    console.log("Postgres seed skipped: Demo System already exists.");
    return;
  }

  await prisma.system.create({
    data: {
      accountId: baseAccount.id,
      name: "Demo System",
      sourceJson: systemJson,
      components: {
        create: components
      }
    }
  });

  console.log("Seeded Postgres with Demo System and components.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
