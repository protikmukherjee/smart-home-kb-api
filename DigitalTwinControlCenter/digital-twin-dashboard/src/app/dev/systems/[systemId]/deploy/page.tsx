"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SYSTEM_DEFINITIONS as RUNTIME_SYSTEM_TEMPLATES } from "@/types/systems";
import {
  FIREBASE_URL_CONFIGS,
  type SystemFirebaseConfig
} from "@/config/firebaseUrlConfig";
import {
  SIMULATION_URL_CONFIGS,
  type SystemSimulationConfig
} from "@/config/simulationUrlConfig";

const API_URL = process.env.NEXT_PUBLIC_DEV_API_URL ?? "http://localhost:4001";

type RuntimeComponentDefinition = {
  name: string;
  type: "sensor" | "actuator" | "controller" | "network" | "power" | "temperature" | "unit";
  methods: {
    getters: string[];
    setters: string[];
    actions: string[];
  };
  properties: Record<
    string,
    {
      type: "boolean" | "number" | "string";
      readable: boolean;
      writable: boolean;
    }
  >;
};

type RuntimeSystemDefinition = {
  name: string;
  displayName: string;
  description: string;
  mainClass: string;
  dependencies: string[];
  components: RuntimeComponentDefinition[];
};

type SystemDetail = {
  id: string;
  name: string;
  components: Array<{ id: string; name: string; deviceType: string }>;
  deployedSystem?: {
    id: string;
    name: string;
    displayName: string;
    description: string;
    icon?: string | null;
    mainClass?: string | null;
    dependencies?: unknown;
    definition?: unknown;
    realtimeConfig?: unknown;
    simulationConfig?: unknown;
    updatedAt: string;
  } | null;
};

type DeployFormState = {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  mainClass: string;
  dependenciesText: string;
  components: Array<{
    name: string;
    type: RuntimeComponentDefinition["type"];
    gettersText: string;
    settersText: string;
    actionsText: string;
    properties: Array<{
      key: string;
      type: "boolean" | "number" | "string";
      readable: boolean;
      writable: boolean;
    }>;
  }>;
};

const COMPONENT_TYPES: RuntimeComponentDefinition["type"][] = [
  "sensor",
  "actuator",
  "controller",
  "network",
  "power",
  "temperature",
  "unit"
];

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function inferRuntimeComponentType(deviceType: string): RuntimeComponentDefinition["type"] {
  const normalized = deviceType.toLowerCase();
  if (normalized.includes("network")) {
    return "network";
  }
  if (normalized.includes("power")) {
    return "power";
  }
  if (normalized.includes("temp")) {
    return "temperature";
  }
  if (normalized.includes("controller")) {
    return "controller";
  }
  if (normalized.includes("actuator")) {
    return "actuator";
  }
  if (normalized.includes("unit")) {
    return "unit";
  }
  return "sensor";
}

function humanizeSystemName(systemName: string): string {
  return systemName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/System$/i, "")
    .trim();
}

function createFallbackRuntimeDefinition(detail: SystemDetail): RuntimeSystemDefinition {
  return {
    name: detail.name,
    displayName: humanizeSystemName(detail.name),
    description: `Deployed runtime system for ${detail.name}`,
    mainClass: detail.name,
    dependencies: detail.components.map((component) => component.name),
    components: detail.components.map((component) => ({
      name: component.name,
      type: inferRuntimeComponentType(component.deviceType),
      methods: {
        getters: [],
        setters: [],
        actions: []
      },
      properties: {}
    }))
  };
}

function createDeployForm(detail: SystemDetail): DeployFormState {
  const template = RUNTIME_SYSTEM_TEMPLATES.find((system) => system.name === detail.name);

  const deployedDefinitionRaw = detail.deployedSystem?.definition;
  const deployedDefinition =
    deployedDefinitionRaw && typeof deployedDefinitionRaw === "object"
      ? (deployedDefinitionRaw as RuntimeSystemDefinition)
      : null;

  const deployedDependencies = Array.isArray(detail.deployedSystem?.dependencies)
    ? (detail.deployedSystem?.dependencies as string[])
    : undefined;

  const definition: RuntimeSystemDefinition = template
    ? {
        name: template.name,
        displayName: template.displayName,
        description: template.description,
        mainClass: template.mainClass,
        dependencies: template.dependencies,
        components: template.components.map((component) => ({
          name: component.name,
          type: component.type,
          methods: {
            getters: component.methods.getters,
            setters: component.methods.setters,
            actions: component.methods.actions
          },
          properties: component.properties
        }))
      }
    : createFallbackRuntimeDefinition(detail);

  const finalDefinition = deployedDefinition
    ? {
        name: deployedDefinition.name || detail.deployedSystem?.name || definition.name,
        displayName:
          deployedDefinition.displayName ||
          detail.deployedSystem?.displayName ||
          definition.displayName,
        description:
          deployedDefinition.description ||
          detail.deployedSystem?.description ||
          definition.description,
        mainClass:
          deployedDefinition.mainClass ||
          detail.deployedSystem?.mainClass ||
          definition.mainClass,
        dependencies:
          Array.isArray(deployedDefinition.dependencies) && deployedDefinition.dependencies.length > 0
            ? deployedDefinition.dependencies
            : deployedDependencies ?? definition.dependencies,
        components:
          Array.isArray(deployedDefinition.components) && deployedDefinition.components.length > 0
            ? deployedDefinition.components
            : definition.components
      }
    : definition;

  return {
    name: detail.deployedSystem?.name || finalDefinition.name,
    displayName: detail.deployedSystem?.displayName || finalDefinition.displayName,
    description: detail.deployedSystem?.description || finalDefinition.description,
    icon: detail.deployedSystem?.icon ?? "",
    mainClass: detail.deployedSystem?.mainClass || finalDefinition.mainClass,
    dependenciesText: finalDefinition.dependencies.join(", "),
    components: finalDefinition.components.map((component) => ({
      name: component.name,
      type: component.type,
      gettersText: component.methods.getters.join(", "),
      settersText: component.methods.setters.join(", "),
      actionsText: component.methods.actions.join(", "),
      properties: Object.entries(component.properties).map(([key, property]) => ({
        key,
        type: property.type,
        readable: property.readable,
        writable: property.writable
      }))
    }))
  };
}

function mapPropertyTypeToDataType(
  type: "boolean" | "number" | "string"
): "boolean" | "number" | "string" | "object" {
  return type;
}

function createDefaultFirebaseMapping(definition: RuntimeSystemDefinition): SystemFirebaseConfig {
  return {
    systemName: definition.name,
    baseUrl: "",
    systemStateUrl: "",
    systemActionsUrl: "",
    properties: Object.fromEntries(
      definition.components.map((component) => [
        component.name,
        Object.fromEntries(
          Object.entries(component.properties).map(([propertyName, property]) => [
            propertyName,
            {
              firebaseUrl: "",
              dataType: mapPropertyTypeToDataType(property.type),
              writable: property.writable,
              description: `${component.name}.${propertyName}`
            }
          ])
        )
      ])
    ),
    actions: Object.fromEntries(
      definition.components.map((component) => [
        component.name,
        Object.fromEntries(
          component.methods.actions.map((action) => [
            action,
            {
              firebaseUrl: "",
              dataType: "boolean" as const,
              value: true,
              description: `${component.name}.${action}`
            }
          ])
        )
      ])
    ),
    faults: Object.fromEntries(
      definition.components.map((component) => [
        component.name,
        {
          faultUrl: "",
          dataType: "boolean" as const,
          description: `${component.name}.fault`
        }
      ])
    )
  };
}

function createDefaultSimulationMapping(definition: RuntimeSystemDefinition): SystemSimulationConfig {
  return {
    systemName: definition.name,
    systemType: definition.name,
    baseEndpoint: "",
    endpoints: {
      create: { endpoint: "", method: "POST", description: "Create" },
      start: { endpoint: "", method: "POST", description: "Start" },
      stop: { endpoint: "", method: "POST", description: "Stop" },
      delete: { endpoint: "", method: "DELETE", description: "Delete" },
      getState: { endpoint: "", method: "GET", description: "State" },
      runCycle: { endpoint: "", method: "POST", description: "Run cycle" },
      raiseEvent: { endpoint: "", method: "POST", description: "Raise event" },
      setEnvironmentData: {
        endpoint: "",
        method: "POST",
        description: "Set environment data"
      }
    },
    properties: Object.fromEntries(
      definition.components.map((component) => [
        component.name,
        Object.fromEntries(
          Object.entries(component.properties).map(([propertyName, property]) => [
            propertyName,
            {
              dataType: mapPropertyTypeToDataType(property.type),
              description: `${component.name}.${propertyName}`
            }
          ])
        )
      ])
    ),
    actions: Object.fromEntries(
      definition.components.map((component) => [
        component.name,
        Object.fromEntries(
          component.methods.actions.map((action) => [
            action,
            {
              endpoint: "",
              method: "POST" as const,
              componentName: component.name,
              eventName: action,
              description: `${component.name}.${action}`
            }
          ])
        )
      ])
    ),
    sensors: Object.fromEntries(
      definition.components
        .filter((component) => component.type === "sensor")
        .map((component) => [
          component.name,
          {
            endpoint: "",
            method: "POST" as const,
            sensorType: component.name,
            description: `${component.name} sensor data`
          }
        ])
    )
  };
}

function buildDefinitionFromDeployForm(form: DeployFormState): RuntimeSystemDefinition {
  return {
    name: form.name.trim(),
    displayName: form.displayName.trim(),
    description: form.description.trim(),
    mainClass: form.mainClass.trim(),
    dependencies: splitCsv(form.dependenciesText),
    components: form.components.map((component) => ({
      name: component.name.trim(),
      type: component.type,
      methods: {
        getters: splitCsv(component.gettersText),
        setters: splitCsv(component.settersText),
        actions: splitCsv(component.actionsText)
      },
      properties: Object.fromEntries(
        component.properties
          .filter((property) => property.key.trim().length > 0)
          .map((property) => [
            property.key.trim(),
            {
              type: property.type,
              readable: property.readable,
              writable: property.writable
            }
          ])
      )
    }))
  };
}

function reconcileFirebaseMapping(
  current: SystemFirebaseConfig | null,
  target: SystemFirebaseConfig
): SystemFirebaseConfig {
  const properties: SystemFirebaseConfig["properties"] = Object.fromEntries(
    Object.entries(target.properties ?? {}).map(([componentName, propertyMap]) => [
      componentName,
      Object.fromEntries(
        Object.entries(propertyMap ?? {}).map(([propertyName, defaultProperty]) => {
          const existing = current?.properties?.[componentName]?.[propertyName];
          return [
            propertyName,
            {
              ...defaultProperty,
              ...existing,
              dataType: existing?.dataType ?? defaultProperty.dataType,
              writable: existing?.writable ?? defaultProperty.writable
            }
          ];
        })
      )
    ])
  );

  const actions: SystemFirebaseConfig["actions"] = Object.fromEntries(
    Object.entries(target.actions ?? {}).map(([componentName, actionMap]) => [
      componentName,
      Object.fromEntries(
        Object.entries(actionMap ?? {}).map(([actionName, defaultAction]) => {
          const existing = current?.actions?.[componentName]?.[actionName];
          return [
            actionName,
            {
              ...defaultAction,
              ...existing,
              dataType: existing?.dataType ?? defaultAction.dataType,
              value: existing?.value ?? defaultAction.value
            }
          ];
        })
      )
    ])
  );

  const faults: NonNullable<SystemFirebaseConfig["faults"]> = Object.fromEntries(
    Object.keys(target.properties ?? {}).map((componentName) => {
      const existing = current?.faults?.[componentName];
      return [
        componentName,
        {
          faultUrl: existing?.faultUrl ?? "",
          dataType: "boolean" as const,
          description: existing?.description ?? `${componentName}.fault`
        }
      ];
    })
  );

  return {
    ...target,
    baseUrl: current?.baseUrl ?? target.baseUrl,
    systemStateUrl: current?.systemStateUrl ?? target.systemStateUrl,
    systemActionsUrl: current?.systemActionsUrl ?? target.systemActionsUrl,
    properties,
    actions,
    faults
  };
}

function reconcileSimulationMapping(
  current: SystemSimulationConfig | null,
  target: SystemSimulationConfig
): SystemSimulationConfig {
  const properties: SystemSimulationConfig["properties"] = Object.fromEntries(
    Object.entries(target.properties ?? {}).map(([componentName, propertyMap]) => [
      componentName,
      Object.fromEntries(
        Object.entries(propertyMap ?? {}).map(([propertyName, defaultProperty]) => {
          const existing = current?.properties?.[componentName]?.[propertyName];
          return [propertyName, { ...defaultProperty, ...existing }];
        })
      )
    ])
  );

  const actions: SystemSimulationConfig["actions"] = Object.fromEntries(
    Object.entries(target.actions ?? {}).map(([componentName, actionMap]) => [
      componentName,
      Object.fromEntries(
        Object.entries(actionMap ?? {}).map(([actionName, defaultAction]) => {
          const existing = current?.actions?.[componentName]?.[actionName];
          return [actionName, { ...defaultAction, ...existing }];
        })
      )
    ])
  );

  const sensors: SystemSimulationConfig["sensors"] = Object.fromEntries(
    Object.entries(target.sensors ?? {}).map(([sensorName, defaultSensor]) => {
      const existing = current?.sensors?.[sensorName];
      return [sensorName, { ...defaultSensor, ...existing }];
    })
  );

  return {
    ...target,
    baseEndpoint: current?.baseEndpoint ?? target.baseEndpoint,
    systemType: current?.systemType ?? target.systemType,
    endpoints: {
      ...target.endpoints,
      ...(current?.endpoints ?? {})
    },
    properties,
    actions,
    sensors
  };
}

function replaceSystemIdToken(value: string, systemId: string): string {
  return value.replaceAll("{systemId}", systemId);
}

function materializeFirebaseConfig(
  config: SystemFirebaseConfig,
  systemId: string
): SystemFirebaseConfig {
  return {
    ...config,
    baseUrl: replaceSystemIdToken(config.baseUrl, systemId),
    systemStateUrl: replaceSystemIdToken(config.systemStateUrl, systemId),
    systemActionsUrl: replaceSystemIdToken(config.systemActionsUrl, systemId),
    properties: Object.fromEntries(
      Object.entries(config.properties ?? {}).map(([componentName, properties]) => [
        componentName,
        Object.fromEntries(
          Object.entries(properties ?? {}).map(([propertyName, property]) => [
            propertyName,
            {
              ...property,
              firebaseUrl: replaceSystemIdToken(property.firebaseUrl ?? "", systemId)
            }
          ])
        )
      ])
    ),
    actions: Object.fromEntries(
      Object.entries(config.actions ?? {}).map(([componentName, actions]) => [
        componentName,
        Object.fromEntries(
          Object.entries(actions ?? {}).map(([actionName, action]) => [
            actionName,
            {
              ...action,
              firebaseUrl: replaceSystemIdToken(action.firebaseUrl ?? "", systemId)
            }
          ])
        )
      ])
    ),
    faults: Object.fromEntries(
      Object.entries(config.faults ?? {}).map(([componentName, fault]) => [
        componentName,
        {
          ...fault,
          faultUrl: replaceSystemIdToken(fault.faultUrl ?? "", systemId),
          dataType: "boolean" as const
        }
      ])
    )
  };
}

function materializeSimulationConfig(
  config: SystemSimulationConfig,
  systemId: string
): SystemSimulationConfig {
  return {
    ...config,
    baseEndpoint: replaceSystemIdToken(config.baseEndpoint, systemId),
    endpoints: Object.fromEntries(
      Object.entries(config.endpoints ?? {}).map(([endpointName, endpointConfig]) => [
        endpointName,
        {
          ...endpointConfig,
          endpoint: replaceSystemIdToken(endpointConfig.endpoint ?? "", systemId)
        }
      ])
    ) as SystemSimulationConfig["endpoints"],
    actions: Object.fromEntries(
      Object.entries(config.actions ?? {}).map(([componentName, actions]) => [
        componentName,
        Object.fromEntries(
          Object.entries(actions ?? {}).map(([actionName, action]) => [
            actionName,
            {
              ...action,
              endpoint: replaceSystemIdToken(action.endpoint ?? "", systemId)
            }
          ])
        )
      ])
    ),
    sensors: Object.fromEntries(
      Object.entries(config.sensors ?? {}).map(([sensorName, sensor]) => [
        sensorName,
        {
          ...sensor,
          endpoint: replaceSystemIdToken(sensor.endpoint ?? "", systemId)
        }
      ])
    )
  };
}

export default function DeploySystemPage() {
  const params = useParams();
  const router = useRouter();
  const systemId = params.systemId as string;

  const [deployForm, setDeployForm] = useState<DeployFormState | null>(null);
  const [systemName, setSystemName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState("");
  const [deployFormError, setDeployFormError] = useState("");
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [systemFirebaseMapping, setSystemFirebaseMapping] = useState<SystemFirebaseConfig | null>(null);
  const [systemSimulationMapping, setSystemSimulationMapping] = useState<SystemSimulationConfig | null>(null);
  const [firebaseComponentIndex, setFirebaseComponentIndex] = useState(0);
  const [simulationComponentIndex, setSimulationComponentIndex] = useState(0);

  const firebaseComponentNames = Object.keys(systemFirebaseMapping?.properties ?? {});
  const simulationComponentNames = Object.keys(systemSimulationMapping?.properties ?? {});

  const activeFirebaseComponent = firebaseComponentNames[firebaseComponentIndex] ?? "";
  const activeSimulationComponent = simulationComponentNames[simulationComponentIndex] ?? "";

  useEffect(() => {
    if (firebaseComponentIndex >= firebaseComponentNames.length && firebaseComponentNames.length > 0) {
      setFirebaseComponentIndex(firebaseComponentNames.length - 1);
    }
  }, [firebaseComponentIndex, firebaseComponentNames.length]);

  useEffect(() => {
    if (
      simulationComponentIndex >= simulationComponentNames.length &&
      simulationComponentNames.length > 0
    ) {
      setSimulationComponentIndex(simulationComponentNames.length - 1);
    }
  }, [simulationComponentIndex, simulationComponentNames.length]);

  const updateDeployComponent = (
    componentIndex: number,
    updater: (component: DeployFormState["components"][number]) => DeployFormState["components"][number]
  ) => {
    setDeployForm((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        components: prev.components.map((component, index) =>
          index === componentIndex ? updater(component) : component
        )
      };
    });
  };

  useEffect(() => {
    const loadSystem = async () => {
      try {
        setError("");
        setIsLoading(true);
        const response = await fetch(`${API_URL}/api/systems/${systemId}`);
        if (!response.ok) {
          throw new Error("Unable to load system deployment details.");
        }
        const detail = (await response.json()) as SystemDetail;
        const baseForm = createDeployForm(detail);
        setSystemName(detail.name);
        setDeployForm(baseForm);

        const deployedRealtime =
          detail.deployedSystem?.realtimeConfig && typeof detail.deployedSystem.realtimeConfig === "object"
            ? (detail.deployedSystem.realtimeConfig as SystemFirebaseConfig)
            : null;
        const deployedSimulation =
          detail.deployedSystem?.simulationConfig && typeof detail.deployedSystem.simulationConfig === "object"
            ? (detail.deployedSystem.simulationConfig as SystemSimulationConfig)
            : null;

        const definitionForDefaults: RuntimeSystemDefinition = {
          name: baseForm.name,
          displayName: baseForm.displayName,
          description: baseForm.description,
          mainClass: baseForm.mainClass,
          dependencies: splitCsv(baseForm.dependenciesText),
          components: baseForm.components.map((component) => ({
            name: component.name,
            type: component.type,
            methods: {
              getters: splitCsv(component.gettersText),
              setters: splitCsv(component.settersText),
              actions: splitCsv(component.actionsText)
            },
            properties: Object.fromEntries(
              component.properties.map((property) => [
                property.key,
                {
                  type: property.type,
                  readable: property.readable,
                  writable: property.writable
                }
              ])
            )
          }))
        };

        const templateFirebase = FIREBASE_URL_CONFIGS[detail.name]
          ? (JSON.parse(JSON.stringify(FIREBASE_URL_CONFIGS[detail.name])) as SystemFirebaseConfig)
          : null;
        const templateSimulation = SIMULATION_URL_CONFIGS[detail.name]
          ? (JSON.parse(JSON.stringify(SIMULATION_URL_CONFIGS[detail.name])) as SystemSimulationConfig)
          : null;

        setSystemFirebaseMapping(
          deployedRealtime ?? templateFirebase ?? createDefaultFirebaseMapping(definitionForDefaults)
        );
        setSystemSimulationMapping(
          deployedSimulation ?? templateSimulation ?? createDefaultSimulationMapping(definitionForDefaults)
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load deployment details.");
      } finally {
        setIsLoading(false);
      }
    };

    loadSystem();
  }, [systemId]);

  useEffect(() => {
    if (!deployForm) {
      return;
    }

    const definition = buildDefinitionFromDeployForm(deployForm);
    const nextFirebase = createDefaultFirebaseMapping(definition);
    const nextSimulation = createDefaultSimulationMapping(definition);

    setSystemFirebaseMapping((prev) => reconcileFirebaseMapping(prev, nextFirebase));
    setSystemSimulationMapping((prev) => reconcileSimulationMapping(prev, nextSimulation));
  }, [deployForm]);

  const addComponentRow = () => {
    setDeployForm((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        components: [
          ...prev.components,
          {
            name: "",
            type: "sensor",
            gettersText: "",
            settersText: "",
            actionsText: "",
            properties: []
          }
        ]
      };
    });
  };

  const validateMappings = () => {
    if (!systemFirebaseMapping || !systemSimulationMapping) {
      return "System-level realtime/simulation mapping is required.";
    }

    if (!systemFirebaseMapping.baseUrl.trim()) {
      return "Firebase base URL is required.";
    }
    if (!systemFirebaseMapping.systemStateUrl.trim()) {
      return "Firebase system state URL is required.";
    }
    if (!systemFirebaseMapping.systemActionsUrl.trim()) {
      return "Firebase system actions URL is required.";
    }

    for (const [componentName, actions] of Object.entries(systemFirebaseMapping.actions ?? {})) {
      for (const [actionName, action] of Object.entries(actions ?? {})) {
        if (!action.firebaseUrl?.trim()) {
          const idx = firebaseComponentNames.indexOf(componentName);
          if (idx >= 0) setFirebaseComponentIndex(idx);
          return `Firebase URL required for action ${componentName}.${actionName}.`;
        }
      }
    }

    if (!systemSimulationMapping.baseEndpoint.trim()) {
      return "Simulation base endpoint is required.";
    }

    for (const [endpointName, endpointConfig] of Object.entries(systemSimulationMapping.endpoints ?? {})) {
      if (!endpointConfig.endpoint?.trim()) {
        return `Simulation endpoint is required for '${endpointName}'.`;
      }
    }

    for (const [componentName, actions] of Object.entries(systemSimulationMapping.actions ?? {})) {
      for (const [actionName, action] of Object.entries(actions ?? {})) {
        if (!action.endpoint?.trim()) {
          const idx = simulationComponentNames.indexOf(componentName);
          if (idx >= 0) setSimulationComponentIndex(idx);
          return `Simulation endpoint required for action ${componentName}.${actionName}.`;
        }
      }
    }

    for (const [sensorName, sensor] of Object.entries(systemSimulationMapping.sensors ?? {})) {
      if (!sensor.endpoint?.trim()) {
        return `Simulation endpoint required for sensor '${sensorName}'.`;
      }
    }

    return "";
  };

  const handleDeploy = async () => {
    if (!deployForm) {
      return;
    }
    if (!systemFirebaseMapping || !systemSimulationMapping) {
      setDeployFormError("System-level realtime/simulation mapping is required.");
      return;
    }

    const mappingError = validateMappings();
    if (mappingError) {
      setDeployFormError(mappingError);
      return;
    }

    setIsDeploying(true);
    setError("");
    setDeployFormError("");

    try {
      const builtComponents: RuntimeComponentDefinition[] = deployForm.components.map((component) => ({
        name: component.name.trim(),
        type: component.type,
        methods: {
          getters: splitCsv(component.gettersText),
          setters: splitCsv(component.settersText),
          actions: splitCsv(component.actionsText)
        },
        properties: Object.fromEntries(
          component.properties
            .filter((property) => property.key.trim().length > 0)
            .map((property) => [
              property.key.trim(),
              {
                type: property.type,
                readable: property.readable,
                writable: property.writable
              }
            ])
        )
      }));

      if (builtComponents.length === 0) {
        setDeployFormError("Add at least one component before deploying.");
        return;
      }

      const invalidComponent = builtComponents.find(
        (component) =>
          !component.name ||
          !component.type ||
          !component.methods ||
          !Array.isArray(component.methods.getters) ||
          !Array.isArray(component.methods.setters) ||
          !Array.isArray(component.methods.actions) ||
          !component.properties ||
          typeof component.properties !== "object"
      );

      if (invalidComponent) {
        setDeployFormError(
          `Component '${invalidComponent.name || "Unknown"}' is missing required methods/properties shape.`
        );
        return;
      }

      const dependencies = splitCsv(deployForm.dependenciesText);
      const resolvedRealtimeConfig = materializeFirebaseConfig(systemFirebaseMapping, systemId);
      const resolvedSimulationConfig = materializeSimulationConfig(systemSimulationMapping, systemId);

      const definition: RuntimeSystemDefinition = {
        name: deployForm.name.trim(),
        displayName: deployForm.displayName.trim(),
        description: deployForm.description.trim(),
        mainClass: deployForm.mainClass.trim(),
        dependencies,
        components: builtComponents
      };

      const response = await fetch(`${API_URL}/api/systems/${systemId}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deployForm.name.trim(),
          displayName: deployForm.displayName.trim(),
          description: deployForm.description.trim(),
          icon: deployForm.icon.trim(),
          mainClass: deployForm.mainClass.trim(),
          dependencies,
          definition
          ,
          realtimeConfig: resolvedRealtimeConfig,
          simulationConfig: resolvedSimulationConfig
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Unable to deploy system.");
      }

      router.push("/dev/systems");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to deploy system.");
    } finally {
      setIsDeploying(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center">Loading deployment editor...</CardContent>
      </Card>
    );
  }

  if (!deployForm) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-ember">
          {error || "Unable to initialize deployment editor."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">Deployment</p>
          <h1 className="font-display text-2xl text-ink">Deploy {systemName}</h1>
          <p className="mt-1 text-sm text-ink/60">
            Complete runtime metadata and component-level details, then deploy.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/dev/systems")}>Back</Button>
          {currentStep > 1 ? (
            <Button variant="outline" onClick={() => setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3)}>
              Previous
            </Button>
          ) : null}
          {currentStep < 3 ? (
            <Button variant="accent" onClick={() => setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3)}>
              Next
            </Button>
          ) : (
            <Button variant="accent" onClick={handleDeploy} disabled={isDeploying}>
              {isDeploying ? "Deploying..." : "Save & Deploy"}
            </Button>
          )}
        </div>
      </header>

      <Card className="border-ink/10 bg-white/95">
        <CardContent className="flex flex-wrap gap-2 px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
          <span className={currentStep === 1 ? "text-cobalt" : ""}>1. Runtime Metadata</span>
          <span className={currentStep === 2 ? "text-cobalt" : ""}>2. Components</span>
          <span className={currentStep === 3 ? "text-cobalt" : ""}>3. Mappings & Deploy</span>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-ember">{error}</p> : null}

      {currentStep === 1 ? (
      <Card className="border-ink/10 bg-white/95">
        <CardHeader>
          <CardTitle>Runtime Metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <input
            className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
            placeholder="Runtime name"
            value={deployForm.name}
            onChange={(event) =>
              setDeployForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))
            }
          />
          <input
            className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
            placeholder="Display name"
            value={deployForm.displayName}
            onChange={(event) =>
              setDeployForm((prev) => (prev ? { ...prev, displayName: event.target.value } : prev))
            }
          />
          <textarea
            className="min-h-[90px] rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
            placeholder="Description"
            value={deployForm.description}
            onChange={(event) =>
              setDeployForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
              placeholder="Icon (optional)"
              value={deployForm.icon}
              onChange={(event) =>
                setDeployForm((prev) => (prev ? { ...prev, icon: event.target.value } : prev))
              }
            />
            <input
              className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
              placeholder="Main class"
              value={deployForm.mainClass}
              onChange={(event) =>
                setDeployForm((prev) => (prev ? { ...prev, mainClass: event.target.value } : prev))
              }
            />
          </div>
          <input
            className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
            placeholder="Dependencies (comma separated)"
            value={deployForm.dependenciesText}
            onChange={(event) =>
              setDeployForm((prev) =>
                prev ? { ...prev, dependenciesText: event.target.value } : prev
              )
            }
          />
        </CardContent>
      </Card>
      ) : null}

      {currentStep === 2 ? (
      <Card className="border-ink/10 bg-white/95">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Components</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addComponentRow}>
            Add Component
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {deployForm.components.map((component, componentIndex) => (
            <div key={`${component.name}-${componentIndex}`} className="rounded-2xl border border-ink/15 bg-white p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="rounded-xl border border-ink/20 bg-white/90 px-3 py-2 text-xs"
                  placeholder="Component name"
                  value={component.name}
                  onChange={(event) =>
                    updateDeployComponent(componentIndex, (current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                />
                <select
                  className="rounded-xl border border-ink/20 bg-white/90 px-3 py-2 text-xs"
                  value={component.type}
                  onChange={(event) =>
                    updateDeployComponent(componentIndex, (current) => ({
                      ...current,
                      type: event.target.value as RuntimeComponentDefinition["type"]
                    }))
                  }
                >
                  {COMPONENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-xl border border-ink/20 bg-white/90 px-3 py-2 text-xs"
                  placeholder="Getters (comma separated)"
                  value={component.gettersText}
                  onChange={(event) =>
                    updateDeployComponent(componentIndex, (current) => ({
                      ...current,
                      gettersText: event.target.value
                    }))
                  }
                />
                <input
                  className="rounded-xl border border-ink/20 bg-white/90 px-3 py-2 text-xs"
                  placeholder="Setters (comma separated)"
                  value={component.settersText}
                  onChange={(event) =>
                    updateDeployComponent(componentIndex, (current) => ({
                      ...current,
                      settersText: event.target.value
                    }))
                  }
                />
              </div>
              <input
                className="mt-2 w-full rounded-xl border border-ink/20 bg-white/90 px-3 py-2 text-xs"
                placeholder="Actions (comma separated)"
                value={component.actionsText}
                onChange={(event) =>
                  updateDeployComponent(componentIndex, (current) => ({
                    ...current,
                    actionsText: event.target.value
                  }))
                }
              />

              <div className="mt-3 rounded-xl border border-ink/10 bg-mist/60 p-2">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">Properties</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateDeployComponent(componentIndex, (current) => ({
                        ...current,
                        properties: [
                          ...current.properties,
                          { key: "", type: "string", readable: true, writable: false }
                        ]
                      }))
                    }
                  >
                    Add Property
                  </Button>
                </div>
                <div className="grid gap-2">
                  {component.properties.map((property, propertyIndex) => (
                    <div key={`${property.key}-${propertyIndex}`} className="grid gap-2 sm:grid-cols-[1.2fr_1fr_auto_auto_auto]">
                      <input
                        className="rounded-xl border border-ink/20 bg-white/90 px-2 py-1 text-xs"
                        placeholder="key"
                        value={property.key}
                        onChange={(event) =>
                          updateDeployComponent(componentIndex, (current) => ({
                            ...current,
                            properties: current.properties.map((item, index) =>
                              index === propertyIndex ? { ...item, key: event.target.value } : item
                            )
                          }))
                        }
                      />
                      <select
                        className="rounded-xl border border-ink/20 bg-white/90 px-2 py-1 text-xs"
                        value={property.type}
                        onChange={(event) =>
                          updateDeployComponent(componentIndex, (current) => ({
                            ...current,
                            properties: current.properties.map((item, index) =>
                              index === propertyIndex
                                ? { ...item, type: event.target.value as "boolean" | "number" | "string" }
                                : item
                            )
                          }))
                        }
                      >
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                      </select>
                      <label className="flex items-center gap-1 text-[10px] text-ink/70">
                        <input
                          type="checkbox"
                          checked={property.readable}
                          onChange={(event) =>
                            updateDeployComponent(componentIndex, (current) => ({
                              ...current,
                              properties: current.properties.map((item, index) =>
                                index === propertyIndex ? { ...item, readable: event.target.checked } : item
                              )
                            }))
                          }
                        />
                        R
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-ink/70">
                        <input
                          type="checkbox"
                          checked={property.writable}
                          onChange={(event) =>
                            updateDeployComponent(componentIndex, (current) => ({
                              ...current,
                              properties: current.properties.map((item, index) =>
                                index === propertyIndex ? { ...item, writable: event.target.checked } : item
                              )
                            }))
                          }
                        />
                        W
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateDeployComponent(componentIndex, (current) => ({
                            ...current,
                            properties: current.properties.filter((_, index) => index !== propertyIndex)
                          }))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDeployForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            components: prev.components.filter((_, index) => index !== componentIndex)
                          }
                        : prev
                    )
                  }
                >
                  Remove Component
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      ) : null}

      {currentStep === 3 && systemFirebaseMapping ? (
        <Card className="border-ink/10 bg-white/95">
          <CardHeader>
            <CardTitle>System-level Firebase Mapping</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                placeholder="Base URL"
                value={systemFirebaseMapping.baseUrl}
                onChange={(event) =>
                  setSystemFirebaseMapping((prev) =>
                    prev ? { ...prev, baseUrl: event.target.value } : prev
                  )
                }
              />
              <input
                className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                placeholder="System State URL"
                value={systemFirebaseMapping.systemStateUrl}
                onChange={(event) =>
                  setSystemFirebaseMapping((prev) =>
                    prev ? { ...prev, systemStateUrl: event.target.value } : prev
                  )
                }
              />
              <input
                className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                placeholder="System Actions URL"
                value={systemFirebaseMapping.systemActionsUrl}
                onChange={(event) =>
                  setSystemFirebaseMapping((prev) =>
                    prev ? { ...prev, systemActionsUrl: event.target.value } : prev
                  )
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-mist/50 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Guided Firebase Mapping</p>
                <p className="text-xs text-ink/60">
                  {firebaseComponentNames.length > 0
                    ? `Component ${firebaseComponentIndex + 1} of ${firebaseComponentNames.length}`
                    : "No component properties available"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={firebaseComponentIndex <= 0}
                  onClick={() => setFirebaseComponentIndex((prev) => Math.max(0, prev - 1))}
                >
                  Previous Component
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={firebaseComponentIndex >= firebaseComponentNames.length - 1}
                  onClick={() =>
                    setFirebaseComponentIndex((prev) =>
                      Math.min(firebaseComponentNames.length - 1, prev + 1)
                    )
                  }
                >
                  Next Component
                </Button>
              </div>
            </div>

            {activeFirebaseComponent ? (
              <div className="grid gap-3 rounded-2xl border border-ink/10 bg-mist/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                  {activeFirebaseComponent}
                </p>

                <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                  <div className="self-center text-xs font-medium text-ink/70">Fault URL</div>
                  <input
                    className="rounded-xl border border-ink/20 bg-white/90 px-2 py-1 text-xs"
                    placeholder="Firebase fault URL (boolean)"
                    value={systemFirebaseMapping.faults?.[activeFirebaseComponent]?.faultUrl ?? ""}
                    onChange={(event) =>
                      setSystemFirebaseMapping((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          faults: {
                            ...(prev.faults ?? {}),
                            [activeFirebaseComponent]: {
                              ...(prev.faults?.[activeFirebaseComponent] ?? {
                                dataType: "boolean" as const,
                                description: `${activeFirebaseComponent}.fault`
                              }),
                              faultUrl: event.target.value,
                              dataType: "boolean" as const
                            }
                          }
                        };
                      })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  {Object.entries(systemFirebaseMapping.properties?.[activeFirebaseComponent] ?? {}).map(
                    ([propertyName, property]) => (
                      <div
                        key={`${activeFirebaseComponent}-${propertyName}`}
                        className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr_auto]"
                      >
                        <div className="self-center text-xs font-medium text-ink/70">{propertyName}</div>
                        <input
                          className="rounded-xl border border-ink/20 bg-white/90 px-2 py-1 text-xs"
                          placeholder="Firebase URL"
                          value={property.firebaseUrl}
                          onChange={(event) =>
                            setSystemFirebaseMapping((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                properties: {
                                  ...prev.properties,
                                  [activeFirebaseComponent]: {
                                    ...(prev.properties?.[activeFirebaseComponent] ?? {}),
                                    [propertyName]: {
                                      ...(prev.properties?.[activeFirebaseComponent]?.[propertyName] ?? property),
                                      firebaseUrl: event.target.value
                                    }
                                  }
                                }
                              };
                            })
                          }
                        />
                        <select
                          className="rounded-xl border border-ink/20 bg-white/90 px-2 py-1 text-xs"
                          value={property.dataType}
                          onChange={(event) =>
                            setSystemFirebaseMapping((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                properties: {
                                  ...prev.properties,
                                  [activeFirebaseComponent]: {
                                    ...(prev.properties?.[activeFirebaseComponent] ?? {}),
                                    [propertyName]: {
                                      ...(prev.properties?.[activeFirebaseComponent]?.[propertyName] ?? property),
                                      dataType: event.target.value as "boolean" | "number" | "string" | "object"
                                    }
                                  }
                                }
                              };
                            })
                          }
                        >
                          <option value="boolean">boolean</option>
                          <option value="number">number</option>
                          <option value="string">string</option>
                          <option value="object">object</option>
                        </select>
                        <label className="flex items-center gap-1 text-xs text-ink/70">
                          <input
                            type="checkbox"
                            checked={property.writable}
                            onChange={(event) =>
                              setSystemFirebaseMapping((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  properties: {
                                    ...prev.properties,
                                    [activeFirebaseComponent]: {
                                      ...(prev.properties?.[activeFirebaseComponent] ?? {}),
                                      [propertyName]: {
                                        ...(prev.properties?.[activeFirebaseComponent]?.[propertyName] ?? property),
                                        writable: event.target.checked
                                      }
                                    }
                                  }
                                };
                              })
                            }
                          />
                          Writable
                        </label>
                      </div>
                    )
                  )}
                </div>

                <div className="grid gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                    Component Actions
                  </p>
                  {Object.entries(systemFirebaseMapping.actions?.[activeFirebaseComponent] ?? {}).map(
                    ([actionName, action]) => (
                      <div
                        key={`${activeFirebaseComponent}-action-${actionName}`}
                        className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr_1fr]"
                      >
                        <div className="self-center text-xs font-medium text-ink/70">{actionName}</div>
                        <input
                          className="rounded-xl border border-ink/20 bg-white/90 px-2 py-1 text-xs"
                          placeholder="Action Firebase URL"
                          value={action.firebaseUrl}
                          onChange={(event) =>
                            setSystemFirebaseMapping((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                actions: {
                                  ...prev.actions,
                                  [activeFirebaseComponent]: {
                                    ...(prev.actions?.[activeFirebaseComponent] ?? {}),
                                    [actionName]: {
                                      ...(prev.actions?.[activeFirebaseComponent]?.[actionName] ?? action),
                                      firebaseUrl: event.target.value
                                    }
                                  }
                                }
                              };
                            })
                          }
                        />
                        <select
                          className="rounded-xl border border-ink/20 bg-white/90 px-2 py-1 text-xs"
                          value={action.dataType}
                          onChange={(event) =>
                            setSystemFirebaseMapping((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                actions: {
                                  ...prev.actions,
                                  [activeFirebaseComponent]: {
                                    ...(prev.actions?.[activeFirebaseComponent] ?? {}),
                                    [actionName]: {
                                      ...(prev.actions?.[activeFirebaseComponent]?.[actionName] ?? action),
                                      dataType: event.target.value as "boolean" | "number" | "string" | "object"
                                    }
                                  }
                                }
                              };
                            })
                          }
                        >
                          <option value="boolean">boolean</option>
                          <option value="number">number</option>
                          <option value="string">string</option>
                          <option value="object">object</option>
                        </select>
                        <input
                          className="rounded-xl border border-ink/20 bg-white/90 px-2 py-1 text-xs"
                          placeholder="Value"
                          value={String(action.value ?? "")}
                          onChange={(event) =>
                            setSystemFirebaseMapping((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                actions: {
                                  ...prev.actions,
                                  [activeFirebaseComponent]: {
                                    ...(prev.actions?.[activeFirebaseComponent] ?? {}),
                                    [actionName]: {
                                      ...(prev.actions?.[activeFirebaseComponent]?.[actionName] ?? action),
                                      value: event.target.value
                                    }
                                  }
                                }
                              };
                            })
                          }
                        />
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-ink/10 bg-mist/40 px-3 py-2 text-xs text-ink/70">
              Fill each component's property/action mapping before deploy. These mappings are persisted to DB on Save & Deploy.
            </div>
          </CardContent>
        </Card>
      ) : null}

      {currentStep === 3 && systemSimulationMapping ? (
        <Card className="border-ink/10 bg-white/95">
          <CardHeader>
            <CardTitle>System-level Simulation Mapping</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                placeholder="System Type"
                value={systemSimulationMapping.systemType}
                onChange={(event) =>
                  setSystemSimulationMapping((prev) =>
                    prev ? { ...prev, systemType: event.target.value } : prev
                  )
                }
              />
              <input
                className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                placeholder="Base Endpoint"
                value={systemSimulationMapping.baseEndpoint}
                onChange={(event) =>
                  setSystemSimulationMapping((prev) =>
                    prev ? { ...prev, baseEndpoint: event.target.value } : prev
                  )
                }
              />
            </div>
            <div className="grid gap-2">
              {Object.entries(systemSimulationMapping.endpoints ?? {}).map(([endpointName, endpointConfig]) => (
                <div key={endpointName} className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr]">
                  <div className="self-center text-xs font-medium text-ink/70">{endpointName}</div>
                  <input
                    className="rounded-xl border border-ink/20 bg-white/90 px-2 py-1 text-xs"
                    value={endpointConfig?.endpoint ?? ""}
                    placeholder="Endpoint"
                    onChange={(event) =>
                      setSystemSimulationMapping((prev) =>
                        prev
                          ? {
                              ...prev,
                              endpoints: {
                                ...(prev.endpoints ?? {}),
                                [endpointName]: {
                                  ...(prev.endpoints?.[endpointName as keyof SystemSimulationConfig["endpoints"]] ?? {}),
                                  endpoint: event.target.value
                                }
                              }
                            }
                          : prev
                      )
                    }
                  />
                  <select
                    className="rounded-xl border border-ink/20 bg-white/90 px-2 py-1 text-xs"
                    value={endpointConfig?.method ?? "POST"}
                    onChange={(event) =>
                      setSystemSimulationMapping((prev) =>
                        prev
                          ? {
                              ...prev,
                              endpoints: {
                                ...(prev.endpoints ?? {}),
                                [endpointName]: {
                                  ...(prev.endpoints?.[endpointName as keyof SystemSimulationConfig["endpoints"]] ?? {}),
                                  method: event.target.value as "GET" | "POST" | "PUT" | "DELETE"
                                }
                              }
                            }
                          : prev
                      )
                    }
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-mist/50 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Guided Simulation Mapping</p>
                <p className="text-xs text-ink/60">
                  {simulationComponentNames.length > 0
                    ? `Component ${simulationComponentIndex + 1} of ${simulationComponentNames.length}`
                    : "No component simulation mappings available"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={simulationComponentIndex <= 0}
                  onClick={() => setSimulationComponentIndex((prev) => Math.max(0, prev - 1))}
                >
                  Previous Component
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={simulationComponentIndex >= simulationComponentNames.length - 1}
                  onClick={() =>
                    setSimulationComponentIndex((prev) =>
                      Math.min(simulationComponentNames.length - 1, prev + 1)
                    )
                  }
                >
                  Next Component
                </Button>
              </div>
            </div>

            {activeSimulationComponent ? (
              <div className="grid gap-3 rounded-2xl border border-ink/10 bg-mist/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                  {activeSimulationComponent}
                </p>

                <div className="grid gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Properties</p>
                  {Object.entries(systemSimulationMapping.properties?.[activeSimulationComponent] ?? {}).map(
                    ([propertyName, property]) => (
                      <div
                        key={`${activeSimulationComponent}-property-${propertyName}`}
                        className="grid gap-2 sm:grid-cols-[1fr_1fr]"
                      >
                        <div className="self-center text-xs font-medium text-ink/70">{propertyName}</div>
                        <select
                          className="rounded-xl border border-ink/20 bg-white/90 px-2 py-1 text-xs"
                          value={property.dataType}
                          onChange={(event) =>
                            setSystemSimulationMapping((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                properties: {
                                  ...prev.properties,
                                  [activeSimulationComponent]: {
                                    ...(prev.properties?.[activeSimulationComponent] ?? {}),
                                    [propertyName]: {
                                      ...(prev.properties?.[activeSimulationComponent]?.[propertyName] ?? property),
                                      dataType: event.target.value as "boolean" | "number" | "string" | "object"
                                    }
                                  }
                                }
                              };
                            })
                          }
                        >
                          <option value="boolean">boolean</option>
                          <option value="number">number</option>
                          <option value="string">string</option>
                          <option value="object">object</option>
                        </select>
                      </div>
                    )
                  )}
                </div>

                <div className="grid gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Actions</p>
                  {Object.entries(systemSimulationMapping.actions?.[activeSimulationComponent] ?? {}).map(
                    ([actionName, action]) => (
                      <div
                        key={`${activeSimulationComponent}-action-${actionName}`}
                        className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr]"
                      >
                        <div className="self-center text-xs font-medium text-ink/70">{actionName}</div>
                        <input
                          className="rounded-xl border border-ink/20 bg-white/90 px-2 py-1 text-xs"
                          placeholder="Action endpoint"
                          value={action.endpoint}
                          onChange={(event) =>
                            setSystemSimulationMapping((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                actions: {
                                  ...prev.actions,
                                  [activeSimulationComponent]: {
                                    ...(prev.actions?.[activeSimulationComponent] ?? {}),
                                    [actionName]: {
                                      ...(prev.actions?.[activeSimulationComponent]?.[actionName] ?? action),
                                      endpoint: event.target.value
                                    }
                                  }
                                }
                              };
                            })
                          }
                        />
                        <select
                          className="rounded-xl border border-ink/20 bg-white/90 px-2 py-1 text-xs"
                          value={action.method}
                          onChange={(event) =>
                            setSystemSimulationMapping((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                actions: {
                                  ...prev.actions,
                                  [activeSimulationComponent]: {
                                    ...(prev.actions?.[activeSimulationComponent] ?? {}),
                                    [actionName]: {
                                      ...(prev.actions?.[activeSimulationComponent]?.[actionName] ?? action),
                                      method: event.target.value as "POST"
                                    }
                                  }
                                }
                              };
                            })
                          }
                        >
                          <option value="POST">POST</option>
                        </select>
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : null}

            <div className="grid gap-2 rounded-2xl border border-ink/10 bg-mist/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Sensors</p>
              {Object.entries(systemSimulationMapping.sensors ?? {}).map(([sensorName, sensor]) => (
                <div key={`sensor-${sensorName}`} className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr]">
                  <div className="self-center text-xs font-medium text-ink/70">{sensorName}</div>
                  <input
                    className="rounded-xl border border-ink/20 bg-white/90 px-2 py-1 text-xs"
                    placeholder="Sensor endpoint"
                    value={sensor.endpoint}
                    onChange={(event) =>
                      setSystemSimulationMapping((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          sensors: {
                            ...prev.sensors,
                            [sensorName]: {
                              ...(prev.sensors?.[sensorName] ?? sensor),
                              endpoint: event.target.value
                            }
                          }
                        };
                      })
                    }
                  />
                  <select
                    className="rounded-xl border border-ink/20 bg-white/90 px-2 py-1 text-xs"
                    value={sensor.method}
                    onChange={(event) =>
                      setSystemSimulationMapping((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          sensors: {
                            ...prev.sensors,
                            [sensorName]: {
                              ...(prev.sensors?.[sensorName] ?? sensor),
                              method: event.target.value as "POST"
                            }
                          }
                        };
                      })
                    }
                  >
                    <option value="POST">POST</option>
                  </select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {deployFormError ? <p className="text-xs text-ember">{deployFormError}</p> : null}
    </div>
  );
}
