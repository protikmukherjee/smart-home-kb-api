import "dotenv/config";
import cors from "cors";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  mapFirebaseVariant,
  mapFirebaseVariantCollection,
  mapVariantInputForWrite,
  toFirebaseThingDescription,
  type VariantDoc
} from "./knowledgebase-mapper.js";
import { fi } from "zod/v4/locales";

const PORT = Number(process.env.PORT ?? 4001);
const DATABASE_URL = process.env.DATABASE_URL ?? "";
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";
const PYTHON_BIN = process.env.PYTHON_BIN ?? "python3";
const FIREBASE_DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL ?? "https://iot-archm-kb-default-rtdb.firebaseio.com";
const FIREBASE_CREDS_PATH =
  process.env.FIREBASE_CREDS_PATH ?? path.resolve(process.cwd(), "firebase_creds.json");

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const app = express();
const corsOptions = { origin: CORS_ORIGIN.includes(",") ? CORS_ORIGIN.split(",") : CORS_ORIGIN };
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));

const prisma = new PrismaClient();
let firebaseReady: Promise<ReturnType<typeof getDatabase>> | null = null;

let cachedAccountId: string | null = null;

async function getKnowledgebaseDb() {
  try {
    if (!firebaseReady) {
      firebaseReady = (async () => {
        if (getApps().length === 0) {
          const rawCreds = await fs.readFile(FIREBASE_CREDS_PATH, "utf-8");
          const serviceAccount = JSON.parse(rawCreds);
          initializeApp({
            credential: cert(serviceAccount),
            databaseURL: FIREBASE_DATABASE_URL
          });
        }
        return getDatabase(getApp());
      })();
    }
    return await firebaseReady;
  } catch (error) {
    console.error("Error connecting to Firebase Realtime Database:", error);
    throw new Error("Failed to connect to Firebase Realtime Database");
  }
}

async function getKnowledgebaseVariantsByType(type: string): Promise<VariantDoc[]> {
  const db = await getKnowledgebaseDb();
  const normalizedType = type.toLowerCase();
  const snapshot = await db.ref("/").get();

  if (!snapshot.exists()) {
    return [];
  }

  const allVariants = mapFirebaseVariantCollection(snapshot.val());

  let matches = allVariants.filter(
    (variant) => variant.type.toLowerCase() === normalizedType || variant.category.toLowerCase() === normalizedType
  );

  if (matches.length === 0) {
    matches = allVariants.filter(
      (variant) =>
        variant.type.toLowerCase().includes(normalizedType) ||
        normalizedType.includes(variant.type.toLowerCase()) ||
        variant.category.toLowerCase().includes(normalizedType) ||
        normalizedType.includes(variant.category.toLowerCase())
    );
  }

  if (matches.length === 0) {
    matches = allVariants;
  }

  return matches;
}

async function getKnowledgebaseVariants(): Promise<VariantDoc[]> {
  const db = await getKnowledgebaseDb();
  const snapshot = await db.ref("/").get();

  if (!snapshot.exists()) {
    return [];
  }

  return mapFirebaseVariantCollection(snapshot.val());
}

async function getKnowledgebaseVariantsByIds(ids: string[]): Promise<Map<string, VariantDoc>> {
  const db = await getKnowledgebaseDb();
  const uniqueIds = Array.from(new Set(ids));
  const variants = await Promise.all(
    uniqueIds.map(async (id) => {
      const snapshot = await db.ref(id).get();
      if (!snapshot.exists()) {
        return null;
      }
      return mapFirebaseVariant(id, snapshot.val());
    })
  );

  const variantMap = new Map<string, VariantDoc>();
  variants.forEach((variant) => {
    if (variant) {
      variantMap.set(variant._id, variant);
    }
  });
  return variantMap;
}

// Enhanced error handling for Prisma client
async function getBaseAccountId() {
  try {
    if (cachedAccountId) {
      return cachedAccountId;
    }
    const existing = await prisma.account.findFirst();
    if (existing) {
      cachedAccountId = existing.id;
      return existing.id;
    }
    const created = await prisma.account.create({ data: { name: "Base Account" } });
    cachedAccountId = created.id;
    return created.id;
  } catch (error) {
    console.error("Error with Prisma client:", error);
    throw new Error("Failed to retrieve or create base account");
  }
}

type ComponentItem = { name: string; deviceType: string };

function normalizeMatchValue(value: string): string {
  return value.toLowerCase().trim();
}

function normalizeCompactValue(value: string): string {
  return normalizeMatchValue(value).replace(/[^a-z0-9]+/g, "");
}

function isFuzzyMatch(candidate: string, query: string): boolean {
  const normalizedCandidate = normalizeMatchValue(candidate);
  const normalizedQuery = normalizeMatchValue(query);
  if (!normalizedCandidate || !normalizedQuery) {
    return false;
  }
  if (
    normalizedCandidate === normalizedQuery ||
    normalizedCandidate.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedCandidate)
  ) {
    return true;
  }

  const compactCandidate = normalizeCompactValue(candidate);
  const compactQuery = normalizeCompactValue(query);
  if (!compactCandidate || !compactQuery) {
    return false;
  }

  return (
    compactCandidate === compactQuery ||
    compactCandidate.includes(compactQuery) ||
    compactQuery.includes(compactCandidate)
  );
}

// Items that are never a valid recommendation for any device type.
// These are non-electronic products that sometimes sneak into the KB.
const NON_PRODUCT_PATTERNS = [
  /\bcookbook\b/i, /\bhandbook\b/i, /\btextbook\b/i, /\bedition\b/i,
  /\bbook\b/i, /\bguide\b/i, /\bprogramming\b/i,
  /\bcase\b/i, /\benclosure\b/i, /\bhousing\b/i,
  /\bsticker\b/i, /\bposter\b/i, /\bpaint\b/i, /\btin\b/i,
  /\bmat\b/i, /\bstand\b/i, /\bmount\b/i, /\barm stand\b/i,
  /\brack\b/i, /\bbracket\b/i, /\bdinrplate\b/i,
];

// For controller searches, these positive patterns identify actual dev boards.
const DEV_BOARD_PATTERNS = [
  /\bboard\b/i, /\bmodule\b/i, /\bmicrocontroller\b/i, /\bmcu\b/i,
  /\buno\b/i, /\bmega\b/i, /\bnano\b/i, /\bmini\b/i, /\bmicro\b/i,
  /\bdue\b/i, /\bleonardo\b/i, /\bzero\b/i, /\bgiga\b/i, /\bevery\b/i,
  /\bfio\b/i, /\byun\b/i, /\bmkr\b/i, /\bpro mini\b/i, /\bpro micro\b/i,
  /\bfeather\b/i, /\btrinket\b/i, /\bflora\b/i, /\blilypad\b/i,
  /\bdevkit\b/i, /\bnodemcu\b/i, /\bwroom\b/i, /\bwrover\b/i,
  /\besp32\b/i, /\besp8266\b/i, /\besp32-s[23]\b/i,
  /\bpico\b/i, /\bteensy\b/i, /\bmetro\b/i, /\bitsybitsy\b/i,
  /\bredboard\b/i, /\bseeeduino\b/i, /\bqduino\b/i,
  /\batmega\b/i, /\bbootloader\b/i, /\bcompatible\b/i,
  /\br3\b/i, /\br4\b/i, /\brev\d/i, /\bv\d/i,
  /\bmaker uno\b/i, /\bstemtera\b/i, /\bsnapino\b/i,
];

function filterVariantsByDeviceAndType(
  allVariants: VariantDoc[],
  deviceType?: string,
  componentType?: string,
  name?: string
): VariantDoc[] {
  const normalizedDeviceType = deviceType?.trim().toLowerCase() || "";
  const normalizedComponentType = componentType?.trim().toLowerCase() || "";
  const normalizedName = name?.trim().toLowerCase() || "";

  if (!normalizedDeviceType && !normalizedComponentType && !normalizedName) {
    return allVariants;
  }

  // deviceType has to be strict match to category
  let filteredVariants: VariantDoc[] = allVariants.filter(item => item.type === normalizedDeviceType || item.type === normalizedDeviceType.slice(0, -1));

  if (filteredVariants.length === 0) {
    filteredVariants = allVariants.filter(item => item.category === normalizedDeviceType || item.category === normalizedDeviceType.slice(0, -1));
  }

  // --- Layer 1: Remove items tagged as "accessory" in the KB ---
  const primaryOnly = filteredVariants.filter(v => v.componentClass !== "accessory");
  if (primaryOnly.length > 0) {
    filteredVariants = primaryOnly;
  }

  // --- Layer 2: Remove non-products (books, cases, enclosures, paint, mats) ---
  const noJunk = filteredVariants.filter(v => !NON_PRODUCT_PATTERNS.some(p => p.test(v.name)));
  if (noJunk.length > 0) {
    filteredVariants = noJunk;
  }

  // --- Layer 3: For controllers, keep only actual dev boards ---
  const isControllerSearch = normalizedDeviceType === "controller" || normalizedDeviceType === "controllers";
  if (isControllerSearch) {
    const boards = filteredVariants.filter(v => DEV_BOARD_PATTERNS.some(p => p.test(v.name)));
    if (boards.length > 0) {
      filteredVariants = boards;
    }
  }

  const tokenize = (s: string) => s.replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(w => w.length > 0);
  const combinedQuery = `${normalizedName} ${normalizedComponentType} ${normalizedDeviceType}`;
  const queryTokens = Array.from(new Set(tokenize(combinedQuery)));

  const scoreVariant = (variant: VariantDoc): number => {
    let score = 0;
    const vName = (variant.name || "").toLowerCase();
    const vType = (variant.type || "").toLowerCase();
    const vCategory = (variant.category || "").toLowerCase();
    const vSub = (variant.subcategory || "general").toLowerCase();

    // 1. Exact or strict Subcategory matches against Name/Type
    if (vSub && vSub !== "general" && vSub !== "sensors" && vSub !== "actuators") {
        if (queryTokens.includes(vSub)) score += 5000;
        else if (combinedQuery.includes(vSub)) score += 3000;
        else if (vSub.includes(normalizedName) && normalizedName.length > 3) score += 3000;
        else if (vSub.includes(normalizedComponentType) && normalizedComponentType.length > 3) score += 3000;
    }

    // 2. Token overlap logic specifically for the Name and type
    const vNameTokens = tokenize(vName);
    let nameMatches = 0;

    for (const t of queryTokens) {
        if (t.length < 3) continue;

        if (vNameTokens.includes(t)) {
            nameMatches++;
            score += 500;
        } else if (vName.includes(t)) {
            score += 200;
        }

        if (vSub === t) score += 1000;
        if (vType === t) score += 100;
        if (vCategory === t) score += 100;
    }

    if (nameMatches > 1) {
        score += nameMatches * 300;
    }

    return score;
  };

  const scored = filteredVariants
    .map(v => ({ variant: v, score: scoreVariant(v) }))
    .filter(item => item.score > 0);

  scored.sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
      const topScore = scored[0].score;
      // Tighter threshold: 60% instead of 40% to reduce noise
      return scored.filter(item => item.score >= topScore * 0.6).map(item => item.variant);
  }

  return [];
}

function extractComponentTypeByName(
  systemJson: Record<string, unknown>
): Map<string, string> {
  const systems = (systemJson.systems as Record<string, unknown>[]) ?? [systemJson];
  const firstSystem = systems[0] ?? {};
  const componentTypeByName = new Map<string, string>();

  const physicalEntities = (firstSystem["physical entities"] as Record<string, unknown>[]) ?? [];
  for (const pe of physicalEntities) {
    const controllers = (pe["controllers"] as Record<string, unknown>[]) ?? [];
    for (const controller of controllers) {
      const devices = (controller["devices"] as Record<string, unknown>[]) ?? [];
      for (const device of devices) {
        const name = (device["name"] as string) ?? "";
        const componentType = (device["type"] as string) ?? "";
        if (name.trim().length > 0 && componentType.trim().length > 0) {
          componentTypeByName.set(name, componentType.toLowerCase());
        }
      }
    }
  }

  return componentTypeByName;
}

function extractComponents(systemJson: Record<string, unknown>): {
  systemName: string;
  components: Array<ComponentItem & { componentType?: string }>;
} {
  const systems = (systemJson.systems as Record<string, unknown>[]) ?? [systemJson];
  const firstSystem = systems[0] ?? {};
  const systemName = (firstSystem["name"] as string) ?? "Unnamed System";
  const components: ComponentItem[] = [];

  const physicalEntities = (firstSystem["physical entities"] as Record<string, unknown>[]) ?? [];
  for (const pe of physicalEntities) {
    const controllers = (pe["controllers"] as Record<string, unknown>[]) ?? [];
    for (const controller of controllers) {
      const devices = (controller["devices"] as Record<string, unknown>[]) ?? [];
      for (const device of devices) {
        const name = (device["name"] as string) ?? "Unnamed Device";
        const deviceType = (device["device type"] as string) ?? "sensor";
        const componentType = (device["type"] as string) ?? "";
        components.push({
          name,
          deviceType: deviceType.toLowerCase(),
          ...(componentType.trim().length > 0 ? { componentType: componentType.toLowerCase() } : {})
        });
      }
    }
  }

  return { systemName, components };
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/systems", async (_req, res) => {
  const accountId = await getBaseAccountId();
  const systems = await prisma.system.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    include: { components: true, deployedSystem: true }
  });

  res.json(
    systems.map((system) => ({
      id: system.id,
      name: system.name,
      createdAt: system.createdAt,
      componentCount: system.components.length,
      hasConfig: Boolean(system.latestConfig),
      latestConfigAt: system.latestConfigAt,
      isDeployed: Boolean(system.deployedSystem?.isActive),
      deployedAt: system.deployedSystem?.updatedAt ?? null
    }))
  );
});

app.get("/api/systems/:id", async (req, res) => {
  const system = await prisma.system.findUnique({
    where: { id: req.params.id },
    include: { components: true, selections: true, deployedSystem: true }
  });

  if (!system) {
    res.status(404).json({ message: "System not found." });
    return;
  }

  const componentTypeByName = system.sourceJson
    ? extractComponentTypeByName(system.sourceJson as Record<string, unknown>)
    : new Map<string, string>();

  res.json({
    id: system.id,
    name: system.name,
    latestConfig: system.latestConfig,
    latestConfigAt: system.latestConfigAt,
    components: system.components.map((component) => ({
      id: component.id,
      name: component.name,
      deviceType: component.deviceType,
      type: componentTypeByName.get(component.name) ?? null
    })),
    selections: system.selections.map((selection) => ({
      componentName: selection.componentName,
      variantId: selection.variantId,
      pinType: selection.pinType,
      componentId: selection.componentId,
      variantSnapshot: selection.variantSnapshot,
      pins: selection.pins
    })),
    deployedSystem: system.deployedSystem
      ? {
          id: system.deployedSystem.id,
          name: system.deployedSystem.name,
          displayName: system.deployedSystem.displayName,
          description: system.deployedSystem.description,
          icon: system.deployedSystem.icon,
          mainClass: system.deployedSystem.mainClass,
          dependencies: system.deployedSystem.dependencies,
          definition: system.deployedSystem.definition,
          realtimeConfig: system.deployedSystem.realtimeConfig,
          simulationConfig: system.deployedSystem.simulationConfig,
          updatedAt: system.deployedSystem.updatedAt,
          isActive: system.deployedSystem.isActive
        }
      : null
  });
});

app.post("/api/systems/:id/deploy", async (req, res) => {
  const system = await prisma.system.findUnique({ where: { id: req.params.id } });
  if (!system) {
    res.status(404).json({ message: "System not found." });
    return;
  }

  const name = req.body?.name;
  const displayName = req.body?.displayName;
  const description = req.body?.description;
  const icon = req.body?.icon;
  const mainClass = req.body?.mainClass;
  const dependencies = req.body?.dependencies;
  const definition = req.body?.definition;
  const realtimeConfig = req.body?.realtimeConfig;
  const simulationConfig = req.body?.simulationConfig;

  if (
    typeof name !== "string" ||
    typeof displayName !== "string" ||
    typeof description !== "string" ||
    !Array.isArray(dependencies) ||
    !definition ||
    typeof definition !== "object" ||
    !realtimeConfig ||
    typeof realtimeConfig !== "object" ||
    !simulationConfig ||
    typeof simulationConfig !== "object"
  ) {
    res.status(400).json({
      message:
        "name, displayName, description, dependencies, definition, realtimeConfig and simulationConfig are required."
    });
    return;
  }

  const deployed = await prisma.deployedSystem.upsert({
    where: { sourceSystemId: req.params.id },
    update: {
      name,
      displayName,
      description,
      icon: typeof icon === "string" ? icon : null,
      mainClass: typeof mainClass === "string" ? mainClass : null,
      dependencies,
      definition,
      realtimeConfig,
      simulationConfig,
      isActive: true
    },
    create: {
      sourceSystemId: req.params.id,
      name,
      displayName,
      description,
      icon: typeof icon === "string" ? icon : null,
      mainClass: typeof mainClass === "string" ? mainClass : null,
      dependencies,
      definition,
      realtimeConfig,
      simulationConfig,
      isActive: true
    }
  });

  res.json({
    status: "ok",
    deployedSystem: {
      id: deployed.id,
      sourceSystemId: deployed.sourceSystemId,
      name: deployed.name,
      displayName: deployed.displayName,
      description: deployed.description,
      icon: deployed.icon,
      mainClass: deployed.mainClass,
      dependencies: deployed.dependencies,
      definition: deployed.definition,
      realtimeConfig: deployed.realtimeConfig,
      simulationConfig: deployed.simulationConfig,
      isActive: deployed.isActive,
      updatedAt: deployed.updatedAt
    }
  });
});

app.patch("/api/systems/:id/components", async (req, res) => {
  const { componentId, name, deviceType } = req.body ?? {};
  if (!componentId || !name || !deviceType) {
    res.status(400).json({ message: "componentId, name, and deviceType are required." });
    return;
  }

  const component = await prisma.systemComponent.findUnique({
    where: { id: componentId }
  });

  if (!component || component.systemId !== req.params.id) {
    res.status(404).json({ message: "Component not found." });
    return;
  }

  const updated = await prisma.systemComponent.update({
    where: { id: componentId },
    data: {
      name: String(name),
      deviceType: String(deviceType).toLowerCase()
    }
  });

  res.json({
    id: updated.id,
    name: updated.name,
    deviceType: updated.deviceType
  });
});

app.post("/api/systems/:id/components", async (req, res) => {
  const { name, deviceType } = req.body ?? {};
  if (!name || !deviceType) {
    res.status(400).json({ message: "name and deviceType are required." });
    return;
  }

  const system = await prisma.system.findUnique({ where: { id: req.params.id } });
  if (!system) {
    res.status(404).json({ message: "System not found." });
    return;
  }

  const component = await prisma.systemComponent.create({
    data: {
      systemId: req.params.id,
      name: String(name),
      deviceType: String(deviceType).toLowerCase()
    }
  });

  res.json({
    id: component.id,
    name: component.name,
    deviceType: component.deviceType
  });
});

app.delete("/api/systems/:id/components/:componentId", async (req, res) => {
  const { id, componentId } = req.params;

  const component = await prisma.systemComponent.findUnique({
    where: { id: componentId }
  });

  if (!component || component.systemId !== id) {
    res.status(404).json({ message: "Component not found." });
    return;
  }

  await prisma.componentSelection.deleteMany({
    where: { componentId }
  });

  await prisma.systemComponent.delete({
    where: { id: componentId }
  });

  res.json({ status: "deleted" });
});

app.delete("/api/systems/:id", async (req, res) => {
  await prisma.componentSelection.deleteMany({ where: { systemId: req.params.id } });
  await prisma.systemComponent.deleteMany({ where: { systemId: req.params.id } });
  await prisma.system.delete({ where: { id: req.params.id } });
  res.json({ status: "deleted" });
});

app.post("/api/systems", async (req, res) => {
  const accountId = await getBaseAccountId();
  let payload = req.body?.systemJson;

  if (!payload) {
    res.status(400).json({ message: "systemJson is required." });
    return;
  }

  if (typeof payload === "string") {
    payload = JSON.parse(payload) as Record<string, unknown>;
  }

  const { systemName, components } = extractComponents(payload as Record<string, unknown>);

  const system = await prisma.system.create({
    data: {
      accountId,
      name: systemName,
      sourceJson: payload,
      components: {
        create: components.map((component) => ({
          name: component.name,
          deviceType: component.deviceType
        }))
      }
    }
  });

  res.json({ systemId: system.id, components });
});

app.get("/api/knowledgebase/variants", async (req, res) => {
  const deviceType = req.query.deviceType?.toString().trim();
  const componentType = req.query.componentType?.toString().trim();
  const name = req.query.name?.toString().trim();

  const type = req.query.type?.toString().trim();

  const allVariants = await getKnowledgebaseVariants();
  const effectiveDeviceType = deviceType || type;
  const variants =
    effectiveDeviceType || componentType
      ? filterVariantsByDeviceAndType(allVariants, effectiveDeviceType, componentType, name)
      : allVariants;

  res.json(
    variants.map((variant) => ({
      _id: variant._id,
      type: variant.type,
      name: variant.name,
      price: variant.price,
      category: variant.category,
      subcategory: variant.subcategory,
      vendorUrl: variant.vendorUrl,
      pinType: variant.pinType,
      componentId: variant.componentId,
      pins: variant.pins
    }))
  );
});

app.post("/api/knowledgebase/variants", async (req, res) => {
  try {
    const type = req.body?.type;
    if (typeof type !== "string" || type.trim().length === 0) {
      res.status(400).json({ message: "type is required." });
      return;
    }

    const mapped = mapVariantInputForWrite(req.body, type);
    if (!mapped) {
      res.status(400).json({
        message: "name and valid price are required."
      });
      return;
    }

    const componentIdSeed =
      mapped.componentId && mapped.componentId.trim().length > 0
        ? mapped.componentId
        : `${mapped.type}_${mapped.name}`;
    const componentId = componentIdSeed
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/(^_|_$)/g, "")
      .toUpperCase();

    const record = toFirebaseThingDescription({
      ...mapped,
      componentId: componentId || `COMP_${Date.now()}`,
      pins: mapped.pins.map((pin) => ({
        pinType: pin.pinType,
        ioType: pin.ioType,
        name: pin.name,
        ...(typeof pin.number === "number" && Number.isFinite(pin.number)
          ? { number: pin.number }
          : {})
      }))
    });

    const db = await getKnowledgebaseDb();
    let categoryFolder = mapped.category ? mapped.category.toLowerCase().trim() : "custom";
    if (categoryFolder === "sensor") categoryFolder = "sensors";
    if (categoryFolder === "actuator") categoryFolder = "actuators";
    if (categoryFolder === "controller") categoryFolder = "controllers";

    const key = componentId || `COMP_${Date.now()}`;
    await db.ref(`/${categoryFolder}/${key}`).set(record);

    const created = mapFirebaseVariant(key, record);
    if (!created) {
      res.status(500).json({ message: "Failed to map created variant." });
      return;
    }

    res.status(201).json(created);
  } catch (error) {
    console.error("Error writing custom variant to Firebase:", error);
    res.status(500).json({ message: "Unable to write variant to Firebase." });
  }
});

app.get("/api/systems/:id/budget-suggestions", async (req, res) => {
  const budgetRaw = req.query.budget?.toString();
  const budget = budgetRaw ? Number(budgetRaw) : NaN;
  const limit = Math.min(Math.max(Number(req.query.limit ?? 5), 1), 5);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);

  if (!Number.isFinite(budget) || budget <= 0) {
    res.status(400).json({ message: "budget must be a positive number." });
    return;
  }

  const system = await prisma.system.findUnique({
    where: { id: req.params.id },
    include: { components: true }
  });

  if (!system) {
    res.status(404).json({ message: "System not found." });
    return;
  }

  if (system.components.length === 0) {
    res.status(400).json({ message: "System has no components." });
    return;
  }

  // Fetch ALL variants exactly ONCE to prevent hitting Firebase heavily in a loop
  const allVariants = await getKnowledgebaseVariants();

  const componentTypeByName = system.sourceJson
    ? extractComponentTypeByName(system.sourceJson as Record<string, unknown>)
    : new Map<string, string>();

  const variantsByComponent = system.components.map((component) => {
    const deviceType = component.deviceType.toLowerCase();
    const componentType = componentTypeByName.get(component.name);

    let variants = filterVariantsByDeviceAndType(allVariants, deviceType, componentType, component.name);

    // 3. Complete fallback -> return PENDING placeholder instead of all variants 
    if (variants.length === 0) {
      variants = [{
        _id: "PENDING",
        name: "Pending addition to knowledgebase",
        price: 0,
        category: "Pending",
        subcategory: "Pending",
        componentClass: "primary",
        type: deviceType,
        vendorUrl: "",
        pinType: "digital",
        componentId: `pending_${deviceType}`,
        pins: []
      }];
    }

    const sorted = variants
      .filter((variant) => typeof variant.price === "number" && variant.price >= 0)
      .sort((a, b) => {
        const priceA = a.price ?? 0;
        const priceB = b.price ?? 0;
        if (priceA === 0 && priceB !== 0) return 1;
        if (priceB === 0 && priceA !== 0) return -1;
        return priceA - priceB;
      });

    return {
      componentName: component.name,
      deviceType: component.deviceType,
      variants: sorted
    };
  });

  const missing = variantsByComponent.filter((entry) => entry.variants.length === 0);
  if (missing.length > 0) {
    res.status(400).json({
      message: "Missing variants for one or more component types.",
      missing: missing.map((entry) => entry.deviceType)
    });
    return;
  }

  const cheapestSelection = variantsByComponent.map((entry) => entry.variants[0]);
  const minCost = cheapestSelection.reduce((sum, variant) => sum + (variant.price ?? 0), 0);

  if (minCost > budget) {
    res.json({ minCost, suggestions: [] });
    return;
  }

  // Enumerate all budget-valid combinations, then page server-side without hard-capping options.
  const sortedVariantsByComponent = variantsByComponent.map((entry) => ({
    ...entry,
    variants: [...entry.variants].sort((a, b) => {
      const priceA = a.price ?? 0;
      const priceB = b.price ?? 0;
      if (priceA === 0 && priceB !== 0) return 1;
      if (priceB === 0 && priceA !== 0) return -1;
      return priceA - priceB;
    })
  }));

  const minSuffixCost: number[] = new Array(sortedVariantsByComponent.length + 1).fill(0);
  for (let i = sortedVariantsByComponent.length - 1; i >= 0; i -= 1) {
    const minVariantCost = Math.min(...sortedVariantsByComponent[i].variants.map(v => v.price ?? 0));
    minSuffixCost[i] = minSuffixCost[i + 1] + minVariantCost;
  }

  const pageCombos: VariantDoc[][] = [];
  const currentCombo: VariantDoc[] = new Array(sortedVariantsByComponent.length);
  let matchedCount = 0;
  let hasMore = false;
  const lastIndexForPage = offset + limit;

  const enumerate = (componentIndex: number, runningCost: number): void => {
    if (hasMore) {
      return;
    }

    if (componentIndex >= sortedVariantsByComponent.length) {
      if (matchedCount >= offset && pageCombos.length < limit) {
        pageCombos.push([...currentCombo]);
      }
      matchedCount += 1;
      // Only mark hasMore once we have discovered at least one item beyond this page.
      if (matchedCount > lastIndexForPage && pageCombos.length >= limit) {
        hasMore = true;
      }
      return;
    }

    if (runningCost + minSuffixCost[componentIndex] > budget) {
      return;
    }

    const componentVariants = sortedVariantsByComponent[componentIndex].variants;

    for (const variant of componentVariants) {
      const variantCost = variant.price ?? 0;
      const nextCost = runningCost + variantCost;
      const minimumRemaining = minSuffixCost[componentIndex + 1];

      if (nextCost + minimumRemaining > budget) {
        // Variants are sorted with non-zero ascending, but $0 might be at the end.
        // So we can only continue, not break.
        continue;
      }

      currentCombo[componentIndex] = variant;
      enumerate(componentIndex + 1, nextCost);

      if (hasMore) {
        return;
      }
    }
  };

  enumerate(0, 0);

  const suggestions = pageCombos.map((set) => {
    const selections = set.map((variant, index) => ({
      componentName: sortedVariantsByComponent[index].componentName,
      variantId: variant._id,
      name: variant.name ?? "Unnamed",
      price: variant.price,
      pinType: variant.pinType,
      componentId: variant.componentId,
      vendorUrl: variant.vendorUrl
    }));

    return {
      totalCost: selections.reduce((sum, selection) => sum + selection.price, 0),
      selections
    };
  });

  res.json({
    minCost,
    suggestions,
    nextOffset: offset + suggestions.length,
    hasMore: hasMore || matchedCount > offset + suggestions.length
  });
});

app.post("/api/systems/:id/selections", async (req, res) => {
  const selections = req.body?.selections as {
    componentName: string;
    variantId: string;
    variantSnapshot?: unknown;
    pins?: Array<{ pinType: string; ioType: string; name: string; number: number }>;
  }[];
  if (!Array.isArray(selections) || selections.length === 0) {
    res.status(400).json({ message: "selections are required." });
    return;
  }

  const invalidIds = selections.filter(
    (selection) => typeof selection.variantId !== "string" || selection.variantId.trim().length === 0
  );
  if (invalidIds.length > 0) {
    res.status(400).json({ message: "One or more variant IDs are invalid." });
    return;
  }
  const variantMap = await getKnowledgebaseVariantsByIds(
    selections.map((selection) => selection.variantId)
  );

  await prisma.componentSelection.deleteMany({ where: { systemId: req.params.id } });

  await prisma.componentSelection.createMany({
    data: selections.map((selection) => {
      const variant =
        variantMap.get(selection.variantId) ??
        (selection.variantSnapshot
          ? mapFirebaseVariant(selection.variantId, selection.variantSnapshot)
          : null);
      if (!variant) {
        throw new Error(`Variant ${selection.variantId} not found.`);
      }
      const variantSnapshot = JSON.parse(JSON.stringify(variant));
      return {
        systemId: req.params.id,
        componentName: selection.componentName,
        variantId: selection.variantId,
        variantSnapshot,
        pins: selection.pins ?? undefined,
        pinType: variant.pinType,
        componentId: variant.componentId
      };
    })
  });

  await prisma.system.update({
    where: { id: req.params.id },
    data: { latestConfig: null, latestConfigAt: null }
  });

  res.json({ status: "ok" });
});

app.get("/api/systems/:id/config", async (req, res) => {
  const system = await prisma.system.findUnique({
    where: { id: req.params.id }
  });

  if (!system?.latestConfig) {
    res.status(404).json({ message: "No saved config found." });
    return;
  }

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename=\"${system.name}.Config\"`);
  res.send(system.latestConfig);
});

app.post("/api/systems/:id/config", async (req, res) => {
  try {
    const system = await prisma.system.findUnique({
      where: { id: req.params.id },
      include: { selections: true }
    });

    if (!system?.sourceJson) {
      res.status(404).json({ message: "System not found." });
      return;
    }

    if (system.selections.length === 0) {
      res.status(400).json({ message: "No selections saved." });
      return;
    }

    const selectionMap = new Map(
      system.selections.map((selection) => [selection.componentName, selection])
    );

    const enriched = JSON.parse(JSON.stringify(system.sourceJson)) as Record<string, unknown>;
    const systems = (enriched.systems as Record<string, unknown>[]) ?? [enriched];
    const firstSystem = systems[0] ?? {};
    const systemName = (firstSystem["name"] as string) ?? "System";

    const physicalEntities = (firstSystem["physical entities"] as Record<string, unknown>[]) ?? [];
    for (const pe of physicalEntities) {
      const controllers = (pe["controllers"] as Record<string, unknown>[]) ?? [];
      for (const controller of controllers) {
        const devices = (controller["devices"] as Record<string, unknown>[]) ?? [];
        for (const device of devices) {
          const deviceName = device["name"] as string;
          const selection = selectionMap.get(deviceName);
          if (selection) {
            device["pin_type"] = selection.pinType;
            device["component_id"] = selection.componentId;
            if (selection.pins) {
              device["pins"] = selection.pins;
            }
          }
        }
      }
    }

    const toId = (value: string) => {
      const cleaned = value.replace(/[^a-zA-Z0-9_]/g, "_");
      const trimmed = cleaned.replace(/(^_+|_+$)/g, "");
      const safe = trimmed.length > 0 ? trimmed : "Component";
      return /^[0-9]/.test(safe) ? `C_${safe}` : safe;
    };

    const componentTypeForDevice = (value: string) => {
      const lowered = value.toLowerCase();
      if (lowered.includes("actuator")) {
        return "actuator";
      }
      if (lowered.includes("controller")) {
        return "controller";
      }
      return "sensor";
    };

    const ioForComponent = (componentType: string) =>
      componentType === "actuator" ? "output" : "input";

    const renderFallbackConfig = () => {
      const lines: string[] = [];
      let pinCounter = 1;

      for (const pe of physicalEntities) {
        const controllers = (pe["controllers"] as Record<string, unknown>[]) ?? [];
        for (const controller of controllers) {
          const devices = (controller["devices"] as Record<string, unknown>[]) ?? [];
          for (const device of devices) {
            const rawName = String(device["name"] ?? "Device");
            const deviceType = String(device["device type"] ?? "sensor");
            const componentType = componentTypeForDevice(deviceType);
            const ioType = ioForComponent(componentType);
            const pinType = String(device["pin_type"] ?? "digital").toLowerCase();
            const componentId = String(device["component_id"] ?? "UNKNOWN");

            const componentName = toId(rawName);
            const componentIdSafe = toId(componentId);

            const pinsRaw = device["pins"] as Record<string, unknown>[] | undefined;
            const pins = Array.isArray(pinsRaw) && pinsRaw.length > 0
              ? pinsRaw.map((pin) => ({
                pinType: String(pin["pinType"] ?? pinType).toLowerCase(),
                ioType: String(pin["ioType"] ?? ioType).toLowerCase(),
                name: toId(String(pin["name"] ?? rawName).toLowerCase()),
                number: pin["number"] === undefined || pin["number"] === null ? -1 : Number(pin["number"])
              }))
              : [
                {
                  pinType,
                  ioType,
                  name: toId(rawName).toLowerCase(),
                  number: -1
                }
              ];

            lines.push(`component ${componentType} ${componentName} ${componentIdSafe} {`);
            pins.forEach((pin, index) => {
              const comma = index < pins.length - 1 ? "," : "";
              const comment = pin.number === -1 ? " //pin not defined enter a valid pin before using the config" : "";
              lines.push(`\t${pin.pinType} ${pin.ioType} pin ${pin.name} : ${pin.number}${comma}${comment}`);
            });
            lines.push("}");
            lines.push("");
          }
        }
      }

      return lines.join("\n").trim();
    };

    const configText = renderFallbackConfig();

    await prisma.system.update({
      where: { id: req.params.id },
      data: { latestConfig: configText, latestConfigAt: new Date() }
    });

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename=\"${systemName}.Config\"`);
    res.send(configText);
  } catch (error) {
    console.error("Config generation error:", error);
    res.status(500).json({ message: "Config generation failed." });
  }
});

app.get("/api/runtime/setup", async (_req, res) => {
  try {
    const accountId = await getBaseAccountId();
    const setup = await prisma.runtimeSetupConfig.findUnique({
      where: { accountId }
    });

    res.json({
      realtime: setup?.realtime ?? {},
      simulation: setup?.simulation ?? {},
      reasoning: setup?.reasoning ?? {}
    });
  } catch (error) {
    console.error("Error reading runtime setup:", error);
    res.status(500).json({ message: "Failed to read runtime setup" });
  }
});

app.put("/api/runtime/setup", async (req, res) => {
  try {
    const accountId = await getBaseAccountId();
    const { realtime, simulation, reasoning, activeSystems } = req.body;

    await prisma.runtimeSetupConfig.upsert({
      where: { accountId },
      update: {
        ...(realtime !== undefined && { realtime }),
        ...(simulation !== undefined && { simulation }),
        ...(reasoning !== undefined && { reasoning }),
        ...(activeSystems !== undefined && { activeSystems })
      },
      create: {
        accountId,
        realtime: realtime ?? {},
        simulation: simulation ?? {},
        ...(reasoning !== undefined && { reasoning }),
        ...(activeSystems !== undefined && { activeSystems })
      }
    });

    res.json({ message: "Runtime setup saved successfully" });
  } catch (error) {
    console.error("Error saving runtime setup:", error);
    res.status(500).json({ message: "Failed to save runtime setup" });
  }
});

app.get("/api/runtime/setup", async (_req, res) => {
  try {
    const accountId = await getBaseAccountId();
    const config = await prisma.runtimeSetupConfig.findUnique({
      where: { accountId }
    });

    if (!config) {
      return res.json({});
    }

    res.json({
      realtime: config.realtime,
      simulation: config.simulation,
      reasoning: config.reasoning,
      activeSystems: config.activeSystems
    });
  } catch (error) {
    console.error("Error fetching runtime setup:", error);
    res.status(500).json({ message: "Failed to fetch runtime setup" });
  }
});

app.get("/api/runtime/systems", async (_req, res) => {
  try {
    const systems = await prisma.deployedSystem.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" }
    });

    res.json(
      systems.map((system) => ({
        id: system.id,
        sourceSystemId: system.sourceSystemId,
        name: system.name,
        displayName: system.displayName,
        description: system.description,
        definition: system.definition,
        realtimeConfig: system.realtimeConfig,
        simulationConfig: system.simulationConfig
      }))
    );
  } catch (error) {
    console.error("Error fetching runtime systems:", error);
    res.status(500).json({ message: "Failed to fetch runtime systems" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
