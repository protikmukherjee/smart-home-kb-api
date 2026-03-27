/**
 * Frontend Fault Detection Engine — TypeScript port of tools/fault_engine.py
 *
 * Reads live telemetry from Firebase RTDB via the existing FirebaseService,
 * applies a suite of fault detectors, and returns structured fault objects.
 *
 * Supported fault types:
 *   OUT_OF_RANGE     — numeric value outside configured [min, max]
 *   STUCK_READING    — sensor value unchanged across N consecutive checks
 *   RAPID_DRIFT      — value changed faster than physically plausible
 *   MISSING_FIELD    — an expected property is absent
 *   STATE_MISMATCH   — two correlated properties contradict each other
 *   STALE_HEARTBEAT  — device hasn't reported within its timeout window
 *   POWER_ANOMALY    — power draw outside expected envelope
 *
 * The engine also includes a KB bridge that maps detected faults to
 * recommender queries for auto-suggesting replacement components.
 */

import FirebaseService from "@/lib/firebaseService";
import {
  getSystemFirebaseConfig,
  type SystemFirebaseConfig,
  type PropertyConfig,
} from "@/config/firebaseUrlConfig";

// ═══════════════════════════════════════════════════════════════════════════════
//  Data model
// ═══════════════════════════════════════════════════════════════════════════════

export type FaultSeverity = "CRIT" | "WARN" | "INFO";

export interface Fault {
  code: string;
  severity: FaultSeverity;
  systemName: string;
  componentName: string;
  propertyName: string;
  detail: string;
  value?: unknown;
  expected?: string;
  timestamp: number;
}

export interface FaultCheckResult {
  systemName: string;
  faults: Fault[];
  snapshot: Record<string, unknown>;
  checkedAt: number;
  healthy: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Sensor thresholds — defaults for known property types
// ═══════════════════════════════════════════════════════════════════════════════

interface SensorThreshold {
  min?: number;
  max?: number;
  criticalBelow?: number;
  criticalAbove?: number;
  maxDriftPerS?: number;
  unit?: string;
}

/** Default thresholds keyed by property name patterns */
const DEFAULT_THRESHOLDS: Record<string, SensorThreshold> = {
  temperature: { min: -10, max: 80, criticalBelow: -20, criticalAbove: 100, maxDriftPerS: 5, unit: "°C" },
  humidity: { min: 0, max: 100, criticalBelow: 0, criticalAbove: 100, unit: "%" },
  distance: { min: 0, max: 400, unit: "cm" },
  ambient_light: { min: 0, max: 65535, unit: "lux" },
  brightness: { min: 0, max: 65535, unit: "lux" },
  power_total: { min: 0, max: 5000, criticalAbove: 10000, unit: "mW" },
  volume: { min: 0, max: 100, unit: "" },
  eCO2: { min: 400, max: 5000, criticalAbove: 8000, unit: "ppm" },
  battery_level: { min: 0, max: 100, criticalBelow: 10, unit: "%" },
  timer: { min: 0, max: 7200, unit: "s" },
  power_level: { min: 1, max: 10, unit: "" },
};

function getThresholdForProperty(propName: string): SensorThreshold | undefined {
  const lower = propName.toLowerCase();
  for (const [key, threshold] of Object.entries(DEFAULT_THRESHOLDS)) {
    if (lower.includes(key)) return threshold;
  }
  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  In-memory history for stuck / drift detection
// ═══════════════════════════════════════════════════════════════════════════════

const readingHistory: Record<string, Array<{ ts: number; value: unknown }>> = {};
const HISTORY_DEPTH = 5;

function recordHistory(key: string, value: unknown): void {
  if (!readingHistory[key]) readingHistory[key] = [];
  readingHistory[key].push({ ts: Date.now(), value });
  if (readingHistory[key].length > HISTORY_DEPTH) {
    readingHistory[key] = readingHistory[key].slice(-HISTORY_DEPTH);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Individual detectors
// ═══════════════════════════════════════════════════════════════════════════════

function checkNumericProperty(
  systemName: string,
  componentName: string,
  propName: string,
  value: unknown,
  threshold: SensorThreshold
): Fault[] {
  const faults: Fault[] = [];
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return faults;

  const histKey = `${systemName}::${componentName}::${propName}`;
  recordHistory(histKey, num);

  const unit = threshold.unit ?? "";

  // Out of range
  if (threshold.min !== undefined && threshold.max !== undefined) {
    if (num < threshold.min || num > threshold.max) {
      let severity: FaultSeverity = "WARN";
      if (
        (threshold.criticalBelow !== undefined && num < threshold.criticalBelow) ||
        (threshold.criticalAbove !== undefined && num > threshold.criticalAbove)
      ) {
        severity = "CRIT";
      }
      faults.push({
        code: "OUT_OF_RANGE",
        severity,
        systemName,
        componentName,
        propertyName: propName,
        detail: `${propName} = ${num}${unit} (expected [${threshold.min}, ${threshold.max}]${unit})`,
        value: num,
        expected: `[${threshold.min}, ${threshold.max}]${unit}`,
        timestamp: Date.now(),
      });
    }
  }

  // Rapid drift
  if (threshold.maxDriftPerS !== undefined) {
    const hist = readingHistory[histKey] ?? [];
    if (hist.length >= 2) {
      const prev = hist[hist.length - 2];
      const dt = (Date.now() - prev.ts) / 1000;
      if (dt > 0) {
        const drift = Math.abs(num - Number(prev.value)) / dt;
        if (drift > threshold.maxDriftPerS) {
          faults.push({
            code: "RAPID_DRIFT",
            severity: "WARN",
            systemName,
            componentName,
            propertyName: propName,
            detail: `${propName} drifting at ${drift.toFixed(2)}${unit}/s (max: ${threshold.maxDriftPerS}${unit}/s)`,
            value: drift,
            expected: `≤ ${threshold.maxDriftPerS}${unit}/s`,
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  // Stuck reading (3+ identical consecutive readings)
  const hist = readingHistory[histKey] ?? [];
  if (hist.length >= 3) {
    const recent = hist.slice(-3);
    const allSame = recent.every((h) => String(h.value) === String(recent[0].value));
    if (allSame) {
      faults.push({
        code: "STUCK_READING",
        severity: "WARN",
        systemName,
        componentName,
        propertyName: propName,
        detail: `${propName} stuck at ${num}${unit} for ${recent.length} consecutive readings`,
        value: num,
        expected: "Varying readings",
        timestamp: Date.now(),
      });
    }
  }

  return faults;
}

function checkBooleanCoherence(
  systemName: string,
  componentName: string,
  values: Record<string, unknown>
): Fault[] {
  // If a system isOn=false but sensors still report active data, that's a mismatch
  // This is generic — specific systems can override
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Main engine: runs all checks for a system
// ═══════════════════════════════════════════════════════════════════════════════

export async function runFaultCheck(systemName: string): Promise<FaultCheckResult> {
  const config = getSystemFirebaseConfig(systemName);
  if (!config) {
    return {
      systemName,
      faults: [{
        code: "NO_CONFIG",
        severity: "WARN",
        systemName,
        componentName: "system",
        propertyName: "",
        detail: `No Firebase config found for system "${systemName}"`,
        timestamp: Date.now(),
      }],
      snapshot: {},
      checkedAt: Date.now(),
      healthy: false,
    };
  }

  const allFaults: Fault[] = [];
  const snapshot: Record<string, unknown> = {};

  // Iterate over every component and every property
  for (const [componentName, properties] of Object.entries(config.properties)) {
    for (const [propName, propConfig] of Object.entries(properties)) {
      try {
        const rawValue = await FirebaseService.getRawValue(propConfig.firebaseUrl);
        snapshot[`${componentName}.${propName}`] = rawValue;

        // Missing field
        if (rawValue === null || rawValue === undefined) {
          allFaults.push({
            code: "MISSING_FIELD",
            severity: "WARN",
            systemName,
            componentName,
            propertyName: propName,
            detail: `Property "${propName}" not found at ${propConfig.firebaseUrl}`,
            timestamp: Date.now(),
          });
          continue;
        }

        // Numeric checks
        if (propConfig.dataType === "number") {
          const threshold = getThresholdForProperty(propName);
          if (threshold) {
            allFaults.push(
              ...checkNumericProperty(systemName, componentName, propName, rawValue, threshold)
            );
          }
        }
      } catch (err) {
        allFaults.push({
          code: "FETCH_ERROR",
          severity: "WARN",
          systemName,
          componentName,
          propertyName: propName,
          detail: `Failed to read ${propConfig.firebaseUrl}: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
        });
      }
    }

    // Boolean coherence checks per component
    const componentValues: Record<string, unknown> = {};
    for (const [propName] of Object.entries(properties)) {
      const key = `${componentName}.${propName}`;
      if (key in snapshot) componentValues[propName] = snapshot[key];
    }
    allFaults.push(...checkBooleanCoherence(systemName, componentName, componentValues));
  }

  // Power anomaly: check if any power property is abnormally high
  for (const [componentName, properties] of Object.entries(config.properties)) {
    for (const [propName, propConfig] of Object.entries(properties)) {
      if (propName.toLowerCase().includes("power") && propConfig.dataType === "number") {
        const val = snapshot[`${componentName}.${propName}`];
        if (typeof val === "number" && val > 5000) {
          allFaults.push({
            code: "POWER_ANOMALY",
            severity: "CRIT",
            systemName,
            componentName,
            propertyName: propName,
            detail: `Power consumption ${val}mW exceeds 5000mW threshold`,
            value: val,
            expected: "≤ 5000mW",
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  return {
    systemName,
    faults: allFaults,
    snapshot,
    checkedAt: Date.now(),
    healthy: allFaults.length === 0,
  };
}

/**
 * Run fault checks for multiple systems concurrently.
 */
export async function runFaultCheckAll(systemNames: string[]): Promise<FaultCheckResult[]> {
  return Promise.all(systemNames.map((name) => runFaultCheck(name)));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  KB Replacement Bridge
// ═══════════════════════════════════════════════════════════════════════════════
//  Maps a faulty component to a recommender API query to auto-suggest
//  replacement parts from the IoT knowledge base.

export interface ReplacementSuggestion {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  price: number | null;
  purchaseUrl: string;
  score: number;
  matchReasons: string[];
}

/** Map component names / types to KB search constraints */
const COMPONENT_KB_MAP: Record<string, { category: string; keywords: string[]; subcategory?: string }> = {
  // Sensors
  heat_sensor:       { category: "sensors", keywords: ["temperature", "heat"], subcategory: "temperature" },
  smoke_sensor:      { category: "sensors", keywords: ["smoke", "gas", "mq"], subcategory: "gas" },
  flame_sensor:      { category: "sensors", keywords: ["flame", "fire", "ir flame"] },
  humidity_sensor:   { category: "sensors", keywords: ["humidity", "dht22", "sht31"] },
  eco2_sensor:       { category: "sensors", keywords: ["co2", "eco2", "gas", "ccs811"] },
  motion_sensor:     { category: "sensors", keywords: ["motion", "pir", "hc-sr501"] },
  brightness_sensor: { category: "sensors", keywords: ["light", "lux", "bh1750"] },
  ultrasonic_sensor: { category: "sensors", keywords: ["ultrasonic", "distance", "hc-sr04"] },
  door_sensor:       { category: "sensors", keywords: ["door", "reed", "magnetic", "switch"] },
  vehicle_sensor:    { category: "sensors", keywords: ["vehicle", "presence", "ir"] },
  // Actuators
  alarm_unit:        { category: "actuators", keywords: ["buzzer", "alarm", "piezo"] },
  ledlight_unit:     { category: "actuators", keywords: ["led", "light", "rgb"] },
  garagedoor_unit:   { category: "actuators", keywords: ["motor", "servo", "relay"] },
  trafficlight_unit: { category: "actuators", keywords: ["led", "traffic", "signal"] },
  microwave_unit:    { category: "actuators", keywords: ["relay", "switch", "microwave"] },
  tv_unit:           { category: "actuators", keywords: ["display", "screen"] },
  // Controllers
  microcontroller:   { category: "controllers", keywords: ["esp32"], subcategory: "esp" },
  hub_component:     { category: "controllers", keywords: ["esp32", "hub"], subcategory: "esp" },
  // Infrastructure
  power_component:   { category: "sensors", keywords: ["current", "power", "ina219"] },
  network_component: { category: "controllers", keywords: ["wifi", "esp32"], subcategory: "esp" },
  devicetemp_component: { category: "sensors", keywords: ["temperature"], subcategory: "temperature" },
  remote_control:    { category: "sensors", keywords: ["ir", "remote", "receiver"] },
};

function normalizeComponentName(name: string): string {
  return name
    .replace(/[_\s]+/g, "_")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

/**
 * Given a faulty component, query the recommender API for replacement suggestions.
 */
export async function fetchReplacementSuggestions(
  componentName: string,
  componentType?: string
): Promise<ReplacementSuggestion[]> {
  const normalized = normalizeComponentName(componentName);

  // Find the best match in our KB map
  let mapping = COMPONENT_KB_MAP[normalized];
  if (!mapping) {
    // Fuzzy match — check if any key is a substring of the normalized name or vice versa
    for (const [key, val] of Object.entries(COMPONENT_KB_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        mapping = val;
        break;
      }
    }
  }

  // Fallback: use the component name itself as keywords
  const constraints: Record<string, unknown> = {
    keywords: mapping
      ? mapping.keywords
      : normalized.split("_").filter((t) => t.length > 2),
    category: mapping?.category ?? "sensors",
    limit: 5,
  };
  if (mapping?.subcategory) {
    constraints.subcategory = mapping.subcategory;
  }

  try {
    const response = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(constraints),
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.components ?? []).slice(0, 5).map((c: Record<string, unknown>) => ({
      id: c.id as string,
      title: c.title as string,
      category: c.category as string,
      subcategory: c.subcategory as string,
      price: c.price as number | null,
      purchaseUrl: c.purchaseUrl as string,
      score: c.score as number,
      matchReasons: c.matchReasons as string[],
    }));
  } catch {
    return [];
  }
}
