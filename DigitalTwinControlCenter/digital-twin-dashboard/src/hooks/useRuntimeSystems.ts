"use client";

import { useEffect, useState } from "react";
import type { SystemDefinition } from "@/config/systemConfig";
import { setRuntimeFirebaseAccountOverride } from "@/config/firebaseConfig";
import { setRuntimeSimulationAccountOverride } from "@/config/simulationConfig";
import type { SystemFirebaseConfig } from "@/config/firebaseUrlConfig";
import { setRuntimeFirebaseConfigOverrides } from "@/config/firebaseUrlConfig";
import type { SystemSimulationConfig } from "@/config/simulationUrlConfig";
import { setRuntimeSimulationConfigOverrides } from "@/config/simulationUrlConfig";

type RuntimeApiItem = {
  id: string;
  sourceSystemId?: string;
  name: string;
  displayName: string;
  description: string;
  definition: {
    name?: string;
    displayName?: string;
    description?: string;
    mainClass?: string;
    dependencies?: string[];
    components?: Array<{
      name: string;
      type: "sensor" | "actuator" | "controller" | "network" | "power" | "temperature" | "unit";
      methods?: {
        getters?: string[];
        setters?: string[];
        actions?: string[];
      };
      properties?: Record<
        string,
        {
          type: "boolean" | "number" | "string";
          readable: boolean;
          writable: boolean;
        }
      >;
    }>;
  };
  realtimeConfig?: SystemFirebaseConfig;
  simulationConfig?: SystemSimulationConfig;
};

const API_URL = process.env.NEXT_PUBLIC_DEV_API_URL ?? "http://localhost:4001";

function defaultValueForType(type: "boolean" | "number" | "string") {
  if (type === "boolean") {
    return false;
  }
  if (type === "number") {
    return 0;
  }
  return "";
}

function normalizeRuntimeSystem(item: RuntimeApiItem): SystemDefinition {
  const definition = item.definition ?? {};
  return {
    id: item.id,
    sourceSystemId: item.sourceSystemId,
    name: definition.name || item.name,
    displayName: definition.displayName || item.displayName || item.name,
    description: definition.description || item.description || "Runtime deployed system",
    mainClass: definition.mainClass || item.name,
    dependencies: Array.isArray(definition.dependencies) ? definition.dependencies : [],
    components: Array.isArray(definition.components)
      ? definition.components.map((component) => ({
        name: component.name,
        type: component.type,
        properties: Object.fromEntries(
          Object.entries(component.properties ?? {}).map(([key, property]) => [
            key,
            defaultValueForType(property.type)
          ])
        ),
        actions: component.methods?.actions ?? [],
        methods: {
          getters: component.methods?.getters ?? [],
          setters: component.methods?.setters ?? [],
          actions: component.methods?.actions ?? []
        }
      }))
      : []
  };
}

export function useRuntimeSystems() {
  const [systems, setSystems] = useState<SystemDefinition[]>([]);
  const [activeSystems, setActiveSystems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const setupResponse = await fetch(`${API_URL}/api/runtime/setup`);
        if (setupResponse.ok) {
          const setupData = (await setupResponse.json()) as {
            realtime?: {
              firebaseConfig?: {
                apiKey?: string;
                authDomain?: string;
                databaseURL?: string;
                projectId?: string;
                storageBucket?: string;
                messagingSenderId?: string;
                appId?: string;
              };
            };
            simulation?: {
              apiUrl?: string;
              timeout?: number;
            };
            activeSystems?: string[];
          };
          setRuntimeFirebaseAccountOverride(setupData.realtime?.firebaseConfig ?? {});
          setRuntimeSimulationAccountOverride(setupData.simulation ?? {});
          if (Array.isArray(setupData.activeSystems)) {
            setActiveSystems(setupData.activeSystems);
          }
        }

        const response = await fetch(`${API_URL}/api/runtime/systems`);
        if (!response.ok) {
          throw new Error("Unable to load deployed runtime systems.");
        }
        const data = (await response.json()) as RuntimeApiItem[];
        const firebaseOverrides: Record<string, SystemFirebaseConfig> = {};
        const simulationOverrides: Record<string, SystemSimulationConfig> = {};

        data.forEach((item) => {
          if (item.realtimeConfig && typeof item.realtimeConfig === "object") {
            firebaseOverrides[item.name] = item.realtimeConfig;
          }
          if (item.simulationConfig && typeof item.simulationConfig === "object") {
            simulationOverrides[item.name] = item.simulationConfig;
          }
        });

        setRuntimeFirebaseConfigOverrides(firebaseOverrides);
        setRuntimeSimulationConfigOverrides(simulationOverrides);
        setSystems(data.map(normalizeRuntimeSystem));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load deployed runtime systems.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  return { systems, activeSystems, isLoading, error };
}
