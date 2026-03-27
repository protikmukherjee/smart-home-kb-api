/**
 * ARC-Twin Recommender Engine
 *
 * Constraint-based recommendation system that queries the IoT Knowledge Base
 * (Firebase RTDB) and returns ranked hardware component suggestions.
 *
 * Filtering dimensions:
 *   - Category (sensor, actuator, controller, power, etc.)
 *   - Subcategory (temperature, motor, arduino, etc.)
 *   - Budget (min/max price in CAD)
 *   - Operating voltage (matches against hardwareSpecs.power or description)
 *   - Interface (I2C, SPI, GPIO, UART, ADC, etc.)
 *   - Keywords (fuzzy matching on title, description, tag)
 *
 * Scoring is a weighted sum so that results are ranked by relevance even when
 * not every constraint is specified.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecommendationConstraints {
  category?: string;
  subcategory?: string;
  budgetMin?: number;
  budgetMax?: number;
  voltage?: number;
  interfaces?: string[];
  keywords?: string[];
  limit?: number;
  includeAccessories?: boolean; // default false — only return primary/module components
}

export interface RecommendedComponent {
  id: string;
  title: string;
  type: string;
  category: string;
  subcategory: string;
  componentClass: string; // "primary" | "accessory" | "module"
  tag: string;
  price: number | null;
  purchaseUrl: string;
  description: string;
  interfaces: string[];
  voltageRange: { min: number | null; max: number | null };
  hardwareSpecs: Record<string, unknown>;
  score: number;
  matchReasons: string[];
}

export interface RecommendationResult {
  components: RecommendedComponent[];
  totalCandidates: number;
  appliedFilters: string[];
  elapsed: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIREBASE_DB_URL = "https://iot-archm-kb-default-rtdb.firebaseio.com";

const SCORE_WEIGHTS = {
  categoryExact: 200,
  subcategoryExact: 300,
  budgetWithin: 100,
  voltageCompatible: 150,
  interfaceMatch: 120,
  keywordTitle: 350,       // bumped: keyword relevance MUST outweigh popularity alone
  keywordDescription: 20,
  keywordTag: 80,
  hasPrice: 10,
  hasPurchaseUrl: 5,
  devBoardBonus: 200,
  domainExpert: 600,       // huge boost for domain-knowledge matches
  popularComponent: 400,   // well-known, community-proven components (GATED on keyword match)
  qualityIndicator: 250,   // quality signals (capacitive > resistive, digital > analog, etc.)
};

// ---------------------------------------------------------------------------
// Domain Knowledge Layer
// ---------------------------------------------------------------------------
// Encodes real IoT engineering knowledge: which components are best for
// which use cases, which are industry standards, and quality signals.

/** Well-known, community-proven components. Title substring → bonus score. */
const POPULAR_COMPONENTS: Record<string, string[]> = {
  // Controllers
  controllers: [
    "esp32 devkit", "esp32-wroom", "esp32-wrover", "esp32-s3",
    "nodemcu", "esp8266",
    "arduino uno r3", "arduino uno rev3", "arduino nano",
    "arduino mega 2560", "arduino mkr wifi",
    "raspberry pi pico", "adafruit feather",
  ],
  // Sensors — the gold standard for each type
  sensors: [
    "dht22", "dht11", "bme280", "bmp280", "sht31", "sht30",     // temp/humidity
    "bh1750", "tsl2561", "veml7700",                              // light/lux
    "capacitive soil moisture", "chirp",                           // moisture
    "hc-sr04", "vl53l0x", "tof",                                  // distance
    "mpu6050", "mpu9250", "bno055",                               // imu/motion
    "max30102", "max30105",                                        // heart rate
    "mq-2", "mq-135", "sgp30", "ccs811", "bme680",               // gas/air
    "ds18b20", "tmp36",                                            // temp only
    "ina219", "acs712",                                            // current
    "hx711", "load cell",                                          // weight
    "pir", "am312", "hc-sr501",                                   // motion
    "flame sensor", "ir flame",                                    // flame detection
    "rfid", "rc522", "pn532",                                     // RFID/NFC
    "reed switch", "magnetic switch",                              // door/window
    "sound sensor", "microphone module",                           // sound
  ],
  // Actuators
  actuators: [
    "5v relay", "relay module",
    "submersible pump", "mini water pump", "peristaltic pump",
    "sg90", "mg996r", "servo",
    "l298n", "drv8825", "a4988",                                  // motor drivers
    "nema 17", "stepper",
    "solenoid valve",
    "2n2222", "irf520", "mosfet",                                 // transistor switches
    "buzzer", "piezo buzzer", "active buzzer", "passive buzzer",   // sound output
    "rgb led", "neopixel", "ws2812", "led module", "led strip",   // LEDs
    "lcd", "oled display", "ssd1306",                              // displays
  ],
};

/**
 * Domain-specific quality signals.
 * When a search involves these device-type keywords, boost items containing
 * quality indicators and penalize items with inferior alternatives.
 */
const QUALITY_SIGNALS: Array<{
  /** Words in the search query / device type that activate this rule */
  trigger: string[];
  /** Title substrings that get a quality boost */
  boost: string[];
  /** Title substrings that get a penalty (inferior alternatives) */
  penalize: string[];
}> = [
  {
    trigger: ["moisture", "soil"],
    boost: ["capacitive", "v1.2", "chirp"],
    penalize: ["resistive"],
  },
  {
    trigger: ["temperature", "temp", "humidity"],
    boost: ["dht22", "bme280", "sht31", "sht30", "bme680"],
    penalize: ["dht11", "ntc", "thermistor"],
  },
  {
    trigger: ["light", "lux", "ambient"],
    boost: ["bh1750", "tsl2561", "veml7700", "lux"],
    penalize: ["ldr", "photoresistor", "photocell"],
  },
  {
    trigger: ["pump", "water"],
    boost: ["submersible", "mini water pump", "peristaltic", "5v"],
    penalize: ["tubing", "hose", "fitting"],
  },
  {
    trigger: ["motor", "drive"],
    boost: ["l298n", "drv8825", "a4988", "motor driver", "h-bridge"],
    penalize: ["wheel", "chassis", "bracket"],
  },
  {
    trigger: ["relay", "switch"],
    boost: ["relay module", "5v relay", "optocoupler", "solid state"],
    penalize: ["extension", "socket"],
  },
  {
    trigger: ["distance", "ultrasonic", "range"],
    boost: ["hc-sr04", "vl53l0x", "tof", "lidar"],
    penalize: ["mount", "bracket"],
  },
  {
    trigger: ["gas", "air", "quality", "smoke"],
    boost: ["mq-", "sgp30", "ccs811", "bme680", "pm2.5"],
    penalize: [],
  },
  {
    trigger: ["imu", "accelerometer", "gyro", "motion"],
    boost: ["mpu6050", "mpu9250", "bno055", "lis3dh"],
    penalize: [],
  },
  {
    trigger: ["esp32", "esp"],
    boost: ["devkit", "wroom", "wrover", "nodemcu", "esp32-s3", "wifi"],
    penalize: ["case", "enclosure", "programmer"],
  },
  {
    trigger: ["arduino"],
    boost: ["uno r3", "uno rev3", "r4 wifi", "nano", "mega 2560", "mkr"],
    penalize: ["case", "enclosure", "cookbook"],
  },
  {
    trigger: ["flame", "fire"],
    boost: ["flame sensor", "flame detector", "ir flame", "flame module"],
    penalize: ["extinguisher", "retardant", "blanket"],
  },
  {
    trigger: ["buzzer", "alarm", "beep", "siren"],
    boost: ["buzzer", "piezo", "active buzzer", "passive buzzer", "alarm module"],
    penalize: ["servo", "motor", "relay", "arm"],
  },
  {
    trigger: ["led", "light", "indicator", "lamp"],
    boost: ["rgb led", "neopixel", "ws2812", "led module", "led strip", "5mm led", "3mm led", "led -", "led pack", "led array", "led ring", "led bar"],
    penalize: ["relay", "servo", "motor", "sealed"],
  },
  {
    trigger: ["rfid", "card", "badge", "access"],
    boost: ["rfid", "rc522", "pn532", "nfc", "card reader"],
    penalize: [],
  },
  {
    trigger: ["door", "garage", "gate", "lock"],
    boost: ["reed switch", "magnetic", "door sensor", "limit switch", "solenoid"],
    penalize: [],
  },
  {
    trigger: ["current", "power", "energy", "watt", "amp"],
    boost: ["ina219", "ina260", "ina3221", "power monitor"],
    penalize: ["acs712", "hall effect current"],
  },
];

// Common interface tokens we can detect in titles, descriptions and specs
const KNOWN_INTERFACES = [
  "I2C", "SPI", "UART", "GPIO", "ADC", "DAC", "PWM", "OneWire",
  "BLE", "WiFi", "USB", "HDMI", "Ethernet", "CAN", "RS485", "RS232",
  "LoRa", "Zigbee", "NFC", "RFID", "IR", "Serial",
];

// ---------------------------------------------------------------------------
// KB Fetching
// ---------------------------------------------------------------------------

let cachedKB: Record<string, unknown> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function fetchKnowledgeBase(): Promise<Record<string, unknown>> {
  const now = Date.now();
  if (cachedKB && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedKB;
  }

  const response = await fetch(`${FIREBASE_DB_URL}/.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch KB: ${response.status} ${response.statusText}`);
  }

  cachedKB = (await response.json()) as Record<string, unknown>;
  cacheTimestamp = now;
  return cachedKB;
}

// ---------------------------------------------------------------------------
// Part Extraction
// ---------------------------------------------------------------------------

interface RawPart {
  path: string;
  category: string;
  subcategory: string;
  data: Record<string, unknown>;
}

function isPartNode(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r["title"] === "string" ||
    (typeof r["@type"] === "string" && typeof r["description"] === "string")
  );
}

function extractAllParts(kb: Record<string, unknown>): RawPart[] {
  const parts: RawPart[] = [];

  // Top-level categories: sensors, actuators, controllers, power, mechanical, tags, tooling, miscellaneous
  for (const [topCat, topVal] of Object.entries(kb)) {
    if (!topVal || typeof topVal !== "object" || Array.isArray(topVal)) continue;

    const topObj = topVal as Record<string, unknown>;

    // Check if topVal itself is a part (unlikely but handle miscellaneous case)
    if (isPartNode(topObj) && typeof topObj["title"] === "string") {
      parts.push({
        path: `${topCat}`,
        category: topCat,
        subcategory: "general",
        data: topObj,
      });
      continue;
    }

    // Iterate subcategories
    for (const [subCat, subVal] of Object.entries(topObj)) {
      if (!subVal || typeof subVal !== "object" || Array.isArray(subVal)) continue;

      const subObj = subVal as Record<string, unknown>;

      // Check if subVal is itself a part
      if (isPartNode(subObj) && typeof subObj["title"] === "string") {
        parts.push({
          path: `${topCat}/${subCat}`,
          category: topCat,
          subcategory: subCat,
          data: subObj,
        });
        continue;
      }

      // Iterate part entries
      for (const [partKey, partVal] of Object.entries(subObj)) {
        if (!isPartNode(partVal)) continue;
        parts.push({
          path: `${topCat}/${subCat}/${partKey}`,
          category: topCat,
          subcategory: subCat,
          data: partVal as Record<string, unknown>,
        });
      }
    }
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Feature Extraction Helpers
// ---------------------------------------------------------------------------

function extractPrice(data: Record<string, unknown>): number | null {
  for (const key of ["price_cad", "price", "cost", "price_usd"]) {
    const val = data[key];
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (typeof val === "string") {
      const n = parseFloat(val);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function extractVoltageRange(data: Record<string, unknown>): { min: number | null; max: number | null } {
  const specs = data["hardwareSpecs"] as Record<string, unknown> | undefined;
  const result: { min: number | null; max: number | null } = { min: null, max: null };

  // Check structured power specs
  if (specs) {
    const power = specs["power"] as Record<string, unknown> | undefined;
    if (power) {
      if (typeof power["min"] === "number") result.min = power["min"];
      if (typeof power["max"] === "number") result.max = power["max"];
      return result;
    }

    // Try operating_voltage or rated_voltage string
    for (const key of ["operating_voltage", "rated_voltage", "voltage", "input_voltage"]) {
      const val = specs[key];
      if (typeof val === "string") {
        const range = parseVoltageString(val);
        if (range.min !== null || range.max !== null) return range;
      }
    }
  }

  // Try description for voltage info
  const desc = (data["description"] as string) || "";
  if (desc) {
    const range = parseVoltageString(desc);
    if (range.min !== null || range.max !== null) return range;
  }

  return result;
}

function parseVoltageString(s: string): { min: number | null; max: number | null } {
  // Match patterns like "3.3V-5V", "5V", "3.3-5.5V", "DC 5V"
  const rangeMatch = s.match(/(\d+\.?\d*)\s*[-–~]\s*(\d+\.?\d*)\s*V/i);
  if (rangeMatch) {
    return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
  }

  const singleMatch = s.match(/(\d+\.?\d*)\s*V(?:DC|AC)?/i);
  if (singleMatch) {
    const v = parseFloat(singleMatch[1]);
    return { min: v, max: v };
  }

  return { min: null, max: null };
}

function extractInterfaces(data: Record<string, unknown>): string[] {
  const interfaces: Set<string> = new Set();

  // Check WoT forms
  const forms = data["forms"] as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(forms)) {
    for (const form of forms) {
      const sub = (form["subprotocol"] as string) || "";
      const href = (form["href"] as string) || "";
      for (const iface of KNOWN_INTERFACES) {
        if (sub.toUpperCase().includes(iface.toUpperCase()) || href.toUpperCase().includes(iface.toUpperCase())) {
          interfaces.add(iface);
        }
      }
    }
  }

  // Check title, description, tag for interface keywords
  const searchable = [
    (data["title"] as string) || "",
    (data["description"] as string) || "",
    (data["tag"] as string) || "",
  ].join(" ").toUpperCase();

  for (const iface of KNOWN_INTERFACES) {
    if (searchable.includes(iface.toUpperCase())) {
      interfaces.add(iface);
    }
  }

  // Check hardwareSpecs
  const specs = data["hardwareSpecs"] as Record<string, unknown> | undefined;
  if (specs) {
    const specsStr = JSON.stringify(specs).toUpperCase();
    for (const iface of KNOWN_INTERFACES) {
      if (specsStr.includes(iface.toUpperCase())) {
        interfaces.add(iface);
      }
    }
  }

  return Array.from(interfaces);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scorePart(
  raw: RawPart,
  component: RecommendedComponent,
  constraints: RecommendationConstraints
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Category match
  if (constraints.category) {
    const target = constraints.category.toLowerCase();
    const actual = raw.category.toLowerCase();
    // Handle plural/singular: "sensors" matches "sensor", etc.
    if (actual === target || actual === target + "s" || actual + "s" === target) {
      score += SCORE_WEIGHTS.categoryExact;
      reasons.push(`Category: ${raw.category}`);
    }
  }

  // Subcategory match
  if (constraints.subcategory) {
    const target = constraints.subcategory.toLowerCase();
    const actual = raw.subcategory.toLowerCase();
    if (actual === target || actual.includes(target) || target.includes(actual)) {
      score += SCORE_WEIGHTS.subcategoryExact;
      reasons.push(`Subcategory: ${raw.subcategory}`);
    }
  }

  // Budget
  if (component.price !== null) {
    const withinMin = constraints.budgetMin == null || component.price >= constraints.budgetMin;
    const withinMax = constraints.budgetMax == null || component.price <= constraints.budgetMax;
    if (withinMin && withinMax) {
      score += SCORE_WEIGHTS.budgetWithin;
      reasons.push(`Within budget: $${component.price.toFixed(2)}`);
    }
    score += SCORE_WEIGHTS.hasPrice;
  }

  // Voltage compatibility
  if (constraints.voltage != null) {
    const { min, max } = component.voltageRange;
    if (min !== null && max !== null) {
      if (constraints.voltage >= min && constraints.voltage <= max) {
        score += SCORE_WEIGHTS.voltageCompatible;
        reasons.push(`Voltage compatible: ${min}V–${max}V`);
      }
    } else if (min !== null && constraints.voltage >= min) {
      score += SCORE_WEIGHTS.voltageCompatible * 0.5;
      reasons.push(`Partial voltage match: ≥${min}V`);
    } else if (max !== null && constraints.voltage <= max) {
      score += SCORE_WEIGHTS.voltageCompatible * 0.5;
      reasons.push(`Partial voltage match: ≤${max}V`);
    }
  }

  // Interface match
  if (constraints.interfaces && constraints.interfaces.length > 0) {
    const targetIfaces = constraints.interfaces.map((i) => i.toUpperCase());
    const partIfaces = component.interfaces.map((i) => i.toUpperCase());
    let matched = 0;
    for (const ti of targetIfaces) {
      if (partIfaces.some((pi) => pi.includes(ti) || ti.includes(pi))) {
        matched++;
      }
    }
    if (matched > 0) {
      score += SCORE_WEIGHTS.interfaceMatch * (matched / targetIfaces.length);
      reasons.push(`Interface match: ${matched}/${targetIfaces.length}`);
    }
  }

  // Keyword matching — use word-boundary regex to prevent "led" matching "sealed"
  if (constraints.keywords && constraints.keywords.length > 0) {
    const title = component.title.toLowerCase();
    const desc = component.description.toLowerCase();
    const tag = component.tag.toLowerCase();

    for (const kw of constraints.keywords) {
      const kwLower = kw.toLowerCase();
      // Escape regex special chars, then wrap in word boundaries.
      // For short keywords (≤4 chars like "led", "pir", "nfc") always use
      // word boundary. For longer keywords, substring match is fine and faster.
      const useWordBoundary = kwLower.length <= 4;
      const escaped = kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = useWordBoundary ? new RegExp(`(?:^|[\\s\\-_/,.;:()])${escaped}(?:$|[\\s\\-_/,.;:()])`, "i") : null;

      const matchesIn = (text: string) =>
        re ? re.test(text) : text.includes(kwLower);

      if (matchesIn(title)) {
        score += SCORE_WEIGHTS.keywordTitle;
        reasons.push(`Keyword in title: "${kw}"`);
      }
      if (matchesIn(desc)) {
        score += SCORE_WEIGHTS.keywordDescription;
        reasons.push(`Keyword in description: "${kw}"`);
      }
      if (matchesIn(tag)) {
        score += SCORE_WEIGHTS.keywordTag;
        reasons.push(`Keyword in tag: "${kw}"`);
      }
    }
  }

  // Bonus for having purchase URL
  if (component.purchaseUrl) {
    score += SCORE_WEIGHTS.hasPurchaseUrl;
  }

  // Dev board bonus: when searching for controllers, boost items that look
  // like actual development boards rather than accessories/cables/displays
  if (constraints.category?.toLowerCase() === "controllers") {
    const titleLower = component.title.toLowerCase();
    const boardIndicators = [
      "board", "module", "microcontroller", "mcu",
      " uno", "mega ", "nano ", " mini ", " micro ", " due ", " zero ",
      "leonardo", " giga ", "every", "fio", "yun", "mkr",
      "pro mini", "pro micro",
      "feather", "devkit", "nodemcu", "wroom", "wrover",
      "trinket", "flora", "lilypad",
      "esp32", "esp8266",
      "pico", "teensy", "metro", "itsybitsy",
      "redboard", "seeeduino", "qduino",
      "atmega", "bootloader",
      "maker uno", "stemtera", "snapino",
    ];
    const hasBoard = boardIndicators.some((b) => titleLower.includes(b.trim()));
    if (hasBoard) {
      score += SCORE_WEIGHTS.devBoardBonus;
      reasons.push("Dev board detected in title");
    }

    // Penalize non-board items that snuck through
    const nonBoardPatterns = [
      "case", "enclosure", "housing", "cookbook", "handbook", "book",
      "guide", "edition", "sticker", "paint", "mat", "stand",
      "mount", "poster", "tin", "rack", "bracket", "dinrplate",
      "lens", "programmer", "breakout", "sound board", "led array",
      "thermal camera", "keypad", "coin acceptor", "receipt printer",
    ];
    const isNonBoard = nonBoardPatterns.some((p) => titleLower.includes(p));
    if (isNonBoard) {
      score = Math.max(0, score - 500);
      reasons.push("Non-board item penalty");
    }
  }

  // -------------------------------------------------------------------------
  // Domain Knowledge: Popular Component Boosting
  // -------------------------------------------------------------------------
  // Components that are well-known, community-proven standards get a big boost.
  // This ensures ESP32 DevKit, DHT22, BH1750, etc. rank above obscure clones.
  //
  // CRITICAL GATE: The popular boost ONLY applies if the component also matches
  // at least one search keyword in its title. This prevents a popular TMP36 from
  // outscoring an actual "Flame Sensor" when searching for flame detection.
  // Without this gate, popularComponent(400) overwhelms keywordTitle(350).
  {
    const titleLower = component.title.toLowerCase();
    const categoryKey = raw.category.toLowerCase();

    // First, check if this component has ANY keyword match in its title
    const hasKeywordInTitle = (constraints.keywords && constraints.keywords.length > 0)
      ? constraints.keywords.some((kw) => {
          const kwLower = kw.toLowerCase();
          if (kwLower.length <= 4) {
            const escaped = kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const re = new RegExp(`(?:^|[\\s\\-_/,.;:()])${escaped}(?:$|[\\s\\-_/,.;:()])`, "i");
            return re.test(titleLower);
          }
          return titleLower.includes(kwLower);
        })
      : true; // no keywords = no gate (ungated popularity is fine)

    // Check the component's own category list first, then check ALL lists
    const listsToCheck: string[][] = [];
    if (POPULAR_COMPONENTS[categoryKey]) {
      listsToCheck.push(POPULAR_COMPONENTS[categoryKey]);
    }
    for (const [key, list] of Object.entries(POPULAR_COMPONENTS)) {
      if (key !== categoryKey) listsToCheck.push(list);
    }

    let popularMatched = false;
    for (const list of listsToCheck) {
      for (const popularName of list) {
        if (titleLower.includes(popularName)) {
          if (hasKeywordInTitle) {
            // Full boost — popular AND relevant to the search
            score += SCORE_WEIGHTS.popularComponent;
            reasons.push(`Popular component: "${popularName}"`);
          } else {
            // Tiny boost — popular but NOT matching any keyword in title.
            // Still worth noting for transparency but doesn't dominate.
            score += 30;
            reasons.push(`Popular component (ungated, no keyword match): "${popularName}"`);
          }
          popularMatched = true;
          break;
        }
      }
      if (popularMatched) break;
    }
  }

  // -------------------------------------------------------------------------
  // Domain Knowledge: Quality Signal Evaluation
  // -------------------------------------------------------------------------
  // When the search context (keywords, device type, subcategory) matches a
  // quality rule's trigger, we boost superior components and penalize inferior
  // ones. E.g. searching for "moisture" → boost capacitive, penalize resistive.
  {
    const titleLower = component.title.toLowerCase();
    const descLower = component.description.toLowerCase();
    const titleAndDesc = titleLower + " " + descLower;

    // Build the search context from constraints keywords + subcategory + category
    const searchContext = [
      ...(constraints.keywords ?? []),
      constraints.subcategory ?? "",
      constraints.category ?? "",
    ]
      .join(" ")
      .toLowerCase();

    for (const rule of QUALITY_SIGNALS) {
      // Check if any trigger word appears in the search context
      const triggered = rule.trigger.some((t) => searchContext.includes(t));
      if (!triggered) continue;

      // Apply boosts — check title AND description for quality indicators
      for (const boostTerm of rule.boost) {
        if (titleAndDesc.includes(boostTerm)) {
          score += SCORE_WEIGHTS.qualityIndicator;
          reasons.push(`Quality boost: "${boostTerm}"`);
          break; // one boost per rule is enough
        }
      }

      // Apply penalties — only check title for penalty (avoid false positives from descriptions)
      for (const penalizeTerm of rule.penalize) {
        if (titleLower.includes(penalizeTerm)) {
          score -= Math.round(SCORE_WEIGHTS.qualityIndicator * 0.6);
          reasons.push(`Quality penalty: "${penalizeTerm}"`);
          break; // one penalty per rule
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Domain Knowledge: Expert Combo Boost
  // -------------------------------------------------------------------------
  // A component that is BOTH popular AND matches a quality signal for the
  // current search context gets the full domain expert bonus. This is the
  // highest-value signal: "this is THE component you want for this use case."
  {
    const titleLower = component.title.toLowerCase();
    const searchContext = [
      ...(constraints.keywords ?? []),
      constraints.subcategory ?? "",
    ]
      .join(" ")
      .toLowerCase();

    // Check if this component got a popular match
    const isPopular = reasons.some((r) => r.startsWith("Popular component:"));
    // Check if this component got a quality boost
    const hasQualityBoost = reasons.some((r) => r.startsWith("Quality boost:"));

    if (isPopular && hasQualityBoost) {
      score += SCORE_WEIGHTS.domainExpert;
      reasons.push("Domain expert match: popular + quality signal");
    } else if (isPopular) {
      // Even without quality signal, a popular component in the right category
      // with a keyword match in the search context deserves a partial expert boost
      const categoryKey = raw.category.toLowerCase();
      const popularList = POPULAR_COMPONENTS[categoryKey] ?? [];
      const matchesSearchContext = popularList.some(
        (p) => titleLower.includes(p) && constraints.keywords?.some((kw) => titleLower.includes(kw.toLowerCase()))
      );
      if (matchesSearchContext) {
        score += Math.round(SCORE_WEIGHTS.domainExpert * 0.4);
        reasons.push("Domain expert partial: popular + keyword match");
      }
    }
  }

  return { score, reasons };
}

// ---------------------------------------------------------------------------
// Hard Filters
// ---------------------------------------------------------------------------

function passesHardFilters(
  component: RecommendedComponent,
  constraints: RecommendationConstraints
): boolean {
  // Filter out accessories by default — only primary components and modules
  // pass through unless the caller explicitly opts in with includeAccessories
  if (!constraints.includeAccessories && component.componentClass === "accessory") {
    return false;
  }

  // If category is specified, it MUST match
  if (constraints.category) {
    const target = constraints.category.toLowerCase();
    const actual = component.category.toLowerCase();
    if (actual !== target && actual !== target + "s" && actual + "s" !== target) {
      return false;
    }
  }

  // If subcategory is specified, it MUST match (prevents accessories/displays
  // from the same top-level category polluting results for dev boards)
  if (constraints.subcategory) {
    const target = constraints.subcategory.toLowerCase();
    const actual = component.subcategory.toLowerCase();
    if (
      actual !== target &&
      !actual.includes(target) &&
      !target.includes(actual)
    ) {
      return false;
    }
  }

  // If budget max is specified, price MUST not exceed it (null price passes — unknown)
  if (constraints.budgetMax != null && component.price !== null) {
    if (component.price > constraints.budgetMax) {
      return false;
    }
  }

  // Keyword relevance gate — ONLY for controllers.
  // Controllers have a garbage problem where accessories ("Arduino compatible
  // 7-segment display") match on description alone.  For sensors/actuators
  // this gate is too strict because a "Capacitive Soil Sensor" won't have
  // keyword "moisture" in its title.
  if (
    constraints.category?.toLowerCase() === "controllers" &&
    constraints.keywords &&
    constraints.keywords.length > 0
  ) {
    const title = component.title.toLowerCase();
    const tag = component.tag.toLowerCase();
    const sub = component.subcategory.toLowerCase();
    const titleTagSub = title + " " + tag + " " + sub;
    const hasRelevantKeyword = constraints.keywords.some((kw) =>
      titleTagSub.includes(kw.toLowerCase())
    );
    if (!hasRelevantKeyword) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Main Recommendation Function
// ---------------------------------------------------------------------------

export async function recommend(
  constraints: RecommendationConstraints
): Promise<RecommendationResult> {
  const start = Date.now();
  const kb = await fetchKnowledgeBase();
  const rawParts = extractAllParts(kb);

  const appliedFilters: string[] = [];
  if (constraints.category) appliedFilters.push(`category=${constraints.category}`);
  if (constraints.subcategory) appliedFilters.push(`subcategory=${constraints.subcategory}`);
  if (constraints.budgetMin != null) appliedFilters.push(`budgetMin=$${constraints.budgetMin}`);
  if (constraints.budgetMax != null) appliedFilters.push(`budgetMax=$${constraints.budgetMax}`);
  if (constraints.voltage != null) appliedFilters.push(`voltage=${constraints.voltage}V`);
  if (constraints.interfaces?.length) appliedFilters.push(`interfaces=${constraints.interfaces.join(",")}`);
  if (constraints.keywords?.length) appliedFilters.push(`keywords=${constraints.keywords.join(",")}`);

  // Build component objects with extracted features
  const components: Array<{ raw: RawPart; component: RecommendedComponent }> = [];

  for (const raw of rawParts) {
    const price = extractPrice(raw.data);
    const voltageRange = extractVoltageRange(raw.data);
    const interfaces = extractInterfaces(raw.data);

    const component: RecommendedComponent = {
      id: raw.path,
      title: (raw.data["title"] as string) || raw.path.split("/").pop() || "Unknown",
      type: (raw.data["@type"] as string) || raw.category,
      category: raw.category,
      subcategory: raw.subcategory,
      componentClass: (raw.data["component_class"] as string) || "primary",
      tag: (raw.data["tag"] as string) || raw.subcategory,
      price,
      purchaseUrl: (raw.data["purchase_url"] as string) || "",
      description: ((raw.data["description"] as string) || "").slice(0, 500),
      interfaces,
      voltageRange,
      hardwareSpecs: (raw.data["hardwareSpecs"] as Record<string, unknown>) || {},
      score: 0,
      matchReasons: [],
    };

    components.push({ raw, component });
  }

  // Apply hard filters
  const filtered = components.filter(({ component }) => passesHardFilters(component, constraints));

  // Score remaining
  for (const { raw, component } of filtered) {
    const { score, reasons } = scorePart(raw, component, constraints);
    component.score = score;
    component.matchReasons = reasons;
  }

  // Sort by score descending. Price is a very minor tiebreaker only when
  // scores are extremely close (within 5 points). This ensures relevance
  // always dominates — a DHT22 at $12 ranks above a random NTC at $0.50.
  filtered.sort((a, b) => {
    const scoreDiff = b.component.score - a.component.score;
    if (Math.abs(scoreDiff) > 5) return scoreDiff;
    // Near-tie: prefer items that have a price listed, then cheaper
    const pa = a.component.price ?? 9999;
    const pb = b.component.price ?? 9999;
    return pa - pb;
  });

  const limit = constraints.limit ?? 20;
  const results = filtered.slice(0, limit).map(({ component }) => component);

  return {
    components: results,
    totalCandidates: rawParts.length,
    appliedFilters,
    elapsed: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// KB Statistics (useful for populating filter dropdowns)
// ---------------------------------------------------------------------------

export interface KBStats {
  totalParts: number;
  categories: Record<string, number>;
  subcategories: Record<string, string[]>;
  priceRange: { min: number; max: number };
  interfaces: string[];
}

// ---------------------------------------------------------------------------
// System JSON Parsing & Per-Component Recommendation
// ---------------------------------------------------------------------------

export interface SystemDevice {
  name: string;
  deviceType: string;   // "sensor", "actuator", "controller", "network", etc.
  componentType: string; // "Motor", "Ultrasonic_Sensor", "WiFi", etc.
  controllerName: string;
}

export interface ComponentRecommendation {
  device: SystemDevice;
  recommendations: RecommendedComponent[];
  selectedIndex: number; // index into recommendations (default 0 = top pick)
}

export interface SystemBuildResult {
  systemName: string;
  components: ComponentRecommendation[];
  totalBudget: number | null;
  elapsed: number;
}

/**
 * Parse a system JSON (ArchML format) and extract all devices that need
 * hardware recommendations.
 */
export function parseSystemJson(json: Record<string, unknown>): {
  systemName: string;
  devices: SystemDevice[];
} {
  const systems = (json["systems"] as Record<string, unknown>[]) ?? [json];
  const firstSystem = systems[0] ?? {};
  const systemName = (firstSystem["name"] as string) ?? "Untitled System";
  const devices: SystemDevice[] = [];

  const physicalEntities =
    (firstSystem["physical entities"] as Record<string, unknown>[]) ?? [];

  for (const pe of physicalEntities) {
    const controllers =
      (pe["controllers"] as Record<string, unknown>[]) ?? [];

    for (const controller of controllers) {
      const controllerName = (controller["name"] as string) ?? "Controller";

      // Regular devices (sensors, actuators)
      const devs = (controller["devices"] as Record<string, unknown>[]) ?? [];
      for (const dev of devs) {
        const name = (dev["name"] as string) ?? "";
        const deviceType = ((dev["device type"] as string) ?? "sensor").toLowerCase();
        const componentType = (dev["type"] as string) ?? name;
        if (name) {
          devices.push({ name, deviceType, componentType, controllerName });
        }
      }

      // Network devices
      const netDevs =
        (controller["network devices"] as Record<string, unknown>[]) ?? [];
      for (const nd of netDevs) {
        const name = (nd["name"] as string) ?? "";
        const componentType = (nd["type"] as string) ?? name;
        if (name) {
          devices.push({
            name,
            deviceType: "network",
            componentType,
            controllerName,
          });
        }
      }

      // The controller board itself – recommend a controller board
      const logicUnit = (controller["logic unit"] as string) ?? "";
      if (logicUnit || controllerName) {
        devices.push({
          name: controllerName,
          deviceType: "controller",
          componentType: logicUnit || controllerName,
          controllerName,
        });
      }
    }
  }

  return { systemName, devices };
}

/**
 * Map device types from the system JSON to KB categories & keyword hints.
 */
function deviceTypeToConstraints(
  device: SystemDevice,
  budget?: number
): RecommendationConstraints {
  const dtLower = device.deviceType.toLowerCase();
  const ctLower = device.componentType.toLowerCase().replace(/_/g, " ");

  // Map deviceType → KB category
  let category: string | undefined;
  let subcategory: string | undefined;
  const interfaces: string[] = [];

  if (dtLower === "sensor") {
    category = "sensors";
  } else if (dtLower === "actuator") {
    category = "actuators";
  } else if (dtLower === "controller") {
    category = "controllers";
    // Controllers need board-specific keywords, NOT the logic unit name
    // (logic unit is the app name like "Garage_Door", not a board type)
  } else if (dtLower === "network") {
    category = "controllers"; // network modules live under controllers
  } else if (dtLower === "power") {
    category = "power";
  } else if (dtLower === "tag") {
    category = "tags";
  } else if (dtLower === "mechanical") {
    category = "mechanical";
  }

  // Keywords from the component type and name
  const keywords: string[] = [];

  if (dtLower === "controller") {
    // For controllers, the componentType is the logic unit (e.g. "Garage_Door")
    // which is NOT useful for finding boards. Instead, use board-related keywords.
    // Detect hints from the controller name itself.
    // Default preference: ESP32 (built-in WiFi = no separate WiFi module needed).
    // Only use Arduino-specific subcategory when explicitly ATmega/AVR.
    const cNameLower = device.name.toLowerCase();
    if (cNameLower.includes("esp32") || cNameLower.includes("esp")) {
      keywords.push("esp32");
      subcategory = "esp";
    } else if (
      cNameLower.includes("atmega") || cNameLower.includes("avr") ||
      cNameLower.includes("uno") || cNameLower.includes("mega") ||
      cNameLower.includes("nano")
    ) {
      // Explicitly AVR/ATmega-based — use Arduino
      keywords.push("arduino");
      subcategory = "arduino";
    } else if (cNameLower.includes("raspberry") || cNameLower.includes("rpi")) {
      keywords.push("raspberry", "pi");
      subcategory = "raspberry_pi";
    } else if (cNameLower.includes("micro:bit") || cNameLower.includes("microbit")) {
      keywords.push("micro:bit");
      subcategory = "microbit";
    } else {
      // Generic controller (incl. "Arduino" label from CAPS models) —
      // prefer ESP32 because it has built-in WiFi, reducing BOM complexity.
      keywords.push("esp32");
      subcategory = "esp";
    }
  } else if (dtLower === "network") {
    // For network devices, use the type (WiFi, BLE, Zigbee) as keyword
    const netType = device.componentType.toLowerCase();
    keywords.push(netType);
    if (netType === "wifi") interfaces.push("WiFi");
    else if (netType === "ble" || netType === "bluetooth") interfaces.push("BLE");
    else if (netType === "zigbee") interfaces.push("Zigbee");
    else if (netType === "lora") interfaces.push("LoRa");
  } else if (dtLower === "tag") {
    // For tags like NFC, RFID — use the type as keyword and interface
    const tagType = device.componentType.toLowerCase();
    keywords.push(tagType);
    if (tagType === "nfc") interfaces.push("NFC");
    else if (tagType === "rfid") interfaces.push("RFID");
  } else {
    // For sensors, actuators, etc. — use component type tokens as keywords
    const ctTokens = ctLower.split(/\s+/).filter((t) => t.length > 2);
    keywords.push(...ctTokens);

    // Add the device name as a keyword too if different from componentType
    const nameLower = device.name.toLowerCase().replace(/_/g, " ");
    if (nameLower !== ctLower) {
      const nameTokens = nameLower.split(/\s+/).filter((t) => t.length > 2);
      keywords.push(...nameTokens);
    }
  }

  // Deduplicate
  const uniqueKeywords = Array.from(new Set(keywords));

  return {
    category,
    subcategory,
    keywords: uniqueKeywords,
    interfaces: interfaces.length > 0 ? interfaces : undefined,
    budgetMax: budget,
    limit: 10,
  };
}

/**
 * Given a system JSON and optional global budget, recommend hardware for
 * every component and return a full build plan.
 */
export async function buildSystem(
  systemJson: Record<string, unknown>,
  options?: { budget?: number; voltage?: number }
): Promise<SystemBuildResult> {
  const start = Date.now();
  const { systemName, devices } = parseSystemJson(systemJson);

  // Per-component budget heuristic: divide budget evenly if specified
  const perComponentBudget = options?.budget && devices.length > 0
    ? Math.round((options.budget / devices.length) * 100) / 100
    : undefined;

  const components: ComponentRecommendation[] = [];

  for (const device of devices) {
    const constraints = deviceTypeToConstraints(device, perComponentBudget);
    if (options?.voltage) constraints.voltage = options.voltage;

    const result = await recommend(constraints);

    components.push({
      device,
      recommendations: result.components,
      selectedIndex: 0,
    });
  }

  // Calculate total budget from top picks
  let totalBudget: number | null = 0;
  for (const comp of components) {
    const topPick = comp.recommendations[comp.selectedIndex];
    if (topPick?.price !== null && topPick?.price !== undefined) {
      totalBudget += topPick.price;
    } else {
      totalBudget = null; // can't calculate if any price is unknown
      break;
    }
  }

  return {
    systemName,
    components,
    totalBudget,
    elapsed: Date.now() - start,
  };
}

/**
 * Generate an enriched system config JSON with hardware selections injected.
 */
export function generateEnrichedConfig(
  originalJson: Record<string, unknown>,
  components: ComponentRecommendation[]
): Record<string, unknown> {
  // Deep clone
  const enriched = JSON.parse(JSON.stringify(originalJson));

  const systems = (enriched["systems"] as Record<string, unknown>[]) ?? [enriched];
  const firstSystem = systems[0] ?? {};
  const physicalEntities =
    (firstSystem["physical entities"] as Record<string, unknown>[]) ?? [];

  // Build a lookup: device name → selected component
  const selectionMap = new Map<string, RecommendedComponent>();
  for (const comp of components) {
    const selected = comp.recommendations[comp.selectedIndex];
    if (selected) {
      selectionMap.set(comp.device.name, selected);
    }
  }

  // Walk the JSON and inject hardware selections
  for (const pe of physicalEntities) {
    const controllers =
      (pe["controllers"] as Record<string, unknown>[]) ?? [];

    for (const controller of controllers) {
      const devs = (controller["devices"] as Record<string, unknown>[]) ?? [];
      for (const dev of devs) {
        const name = dev["name"] as string;
        const selected = selectionMap.get(name);
        if (selected) {
          dev["recommended_component"] = selected.title;
          dev["component_id"] = selected.id;
          dev["price_cad"] = selected.price;
          dev["purchase_url"] = selected.purchaseUrl;
          dev["interfaces"] = selected.interfaces;
          if (selected.voltageRange.min !== null) {
            dev["voltage_range"] = `${selected.voltageRange.min}V–${selected.voltageRange.max ?? "?"}V`;
          }
        }
      }

      // Inject controller board recommendation
      const controllerName = controller["name"] as string;
      const controllerSelection = selectionMap.get(controllerName);
      if (controllerSelection) {
        controller["recommended_board"] = controllerSelection.title;
        controller["board_id"] = controllerSelection.id;
        controller["board_price_cad"] = controllerSelection.price;
        controller["board_purchase_url"] = controllerSelection.purchaseUrl;
      }
    }
  }

  return enriched;
}

export async function getKBStats(): Promise<KBStats> {
  const kb = await fetchKnowledgeBase();
  const parts = extractAllParts(kb);

  const categories: Record<string, number> = {};
  const subcategories: Record<string, Set<string>> = {};
  const allInterfaces = new Set<string>();
  let minPrice = Infinity;
  let maxPrice = -Infinity;

  for (const part of parts) {
    // Categories
    categories[part.category] = (categories[part.category] || 0) + 1;

    // Subcategories
    if (!subcategories[part.category]) subcategories[part.category] = new Set();
    subcategories[part.category].add(part.subcategory);

    // Price
    const price = extractPrice(part.data);
    if (price !== null) {
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;
    }

    // Interfaces
    const ifaces = extractInterfaces(part.data);
    ifaces.forEach((i) => allInterfaces.add(i));
  }

  return {
    totalParts: parts.length,
    categories,
    subcategories: Object.fromEntries(
      Object.entries(subcategories).map(([k, v]) => [k, Array.from(v).sort()])
    ),
    priceRange: {
      min: minPrice === Infinity ? 0 : minPrice,
      max: maxPrice === -Infinity ? 0 : maxPrice,
    },
    interfaces: Array.from(allInterfaces).sort(),
  };
}
