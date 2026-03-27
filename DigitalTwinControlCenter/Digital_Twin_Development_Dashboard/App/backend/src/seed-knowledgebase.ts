// import "dotenv/config";
// import { MongoClient } from "mongodb";

// const MONGODB_URI = process.env.MONGODB_URI ?? "";

// if (!MONGODB_URI) {
//   throw new Error("MONGODB_URI is required.");
// }

// type VariantSeed = {
//   type: string;
//   name: string;
//   price: number;
//   category: string;
//   vendorUrl: string;
//   pinType: "digital" | "analog";
//   componentId: string;
// };

// const DEVICE_TYPES = [
//   "sensor",
//   "actuator",
//   "controller",
//   "power",
//   "communication",
//   "processor",
//   "input",
//   "display"
// ];

// const PIN_TYPES: Array<"digital" | "analog"> = ["digital", "analog"];

// const VENDORS = [
//   "https://example.com/atlas",
//   "https://example.com/aurora",
//   "https://example.com/helix",
//   "https://example.com/nova",
//   "https://example.com/pulse"
// ];

// function toId(value: string) {
//   return value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/(^_|_$)/g, "").toUpperCase();
// }

// function buildSeedVariants(totalCount: number): VariantSeed[] {
//   const variants: VariantSeed[] = [];
//   let counter = 1;

//   for (const type of DEVICE_TYPES) {
//     for (let i = 0; i < 2; i += 1) {
//       const name = `${type} module ${i + 1}`;
//       variants.push({
//         type,
//         name: name.replace(/\b\w/g, (char) => char.toUpperCase()),
//         price: Number((2.5 + i + counter * 0.12).toFixed(2)),
//         category: type,
//         vendorUrl: VENDORS[counter % VENDORS.length],
//         pinType: PIN_TYPES[counter % PIN_TYPES.length],
//         componentId: `${toId(type)}_${counter}`
//       });
//       counter += 1;
//     }
//   }

//   while (variants.length < totalCount) {
//     const type = DEVICE_TYPES[counter % DEVICE_TYPES.length];
//     const name = `${type} module ${counter}`;
//     variants.push({
//       type,
//       name: name.replace(/\b\w/g, (char) => char.toUpperCase()),
//       price: Number((3 + (counter % 17) * 0.45).toFixed(2)),
//       category: type,
//       vendorUrl: VENDORS[counter % VENDORS.length],
//       pinType: PIN_TYPES[counter % PIN_TYPES.length],
//       componentId: `${toId(type)}_${counter}`
//     });
//     counter += 1;
//   }

//   return variants;
// }

// async function main() {
//   const client = new MongoClient(MONGODB_URI);
//   await client.connect();
//   const collection = client.db().collection("componentVariants");
//   const sampleVariants = buildSeedVariants(100);
//   await collection.deleteMany({});
//   await collection.insertMany(sampleVariants);
//   await client.close();
//   console.log(`Seeded ${sampleVariants.length} knowledgebase component variants.`);
// }

// main().catch((error) => {
//   console.error(error);
//   process.exit(1);
// });
console.error(
  "Knowledgebase is configured as read-only via Firebase. Seeding is intentionally disabled."
);
process.exit(1);  