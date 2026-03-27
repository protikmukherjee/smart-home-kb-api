"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit2, Trash2, Plus, Sparkles, ExternalLink, BrainCircuit, X, AlertTriangle, CheckCircle, Info, Lightbulb } from "lucide-react";
import {
  type LLMProvider,
  type LLMConfig,
  type LLMReviewResult,
  type LLMSuggestionResult,
  type SystemContext,
  reviewSelections as llmReview,
  generateSuggestions as llmSuggest,
} from "@/lib/llmService";

const API_URL = process.env.NEXT_PUBLIC_DEV_API_URL ?? "http://localhost:4001";

type AIRecommendation = {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  componentClass?: string;
  price: number | null;
  purchaseUrl: string;
  interfaces: string[];
  voltageRange?: { min: number | null; max: number | null };
  score: number;
  matchReasons: string[];
  description: string;
};

type BuildConstraints = {
  budgetMin: string;
  budgetMax: string;
  voltage: string;
  preferredPlatform: "esp32" | "arduino" | "any";
  requiredInterfaces: string[];
};

type ComponentItem = {
  id: string;
  name: string;
  deviceType: string;
  type?: string | null;
};

type SavedSelection = {
  componentName: string;
  variantId: string;
  pinType: string;
  componentId: string;
  variantSnapshot: unknown;
  pins?: Array<{ pinType: string; ioType: string; name: string; number: number }>;
};

type Variant = {
  _id: string;
  name: string;
  price: number;
  category: string;
  vendorUrl: string;
  pinType: string;
  componentId: string;
  pins?: Array<{ pinType: string; ioType: string; name: string }>;
};

type PinInput = {
  pinType: string;
  ioType: string;
  name: string;
  number: string;
};

type ManualPin = {
  pinType: string;
  ioType: string;
  name: string;
};

export default function BuildSystemPage() {
  const params = useParams();
  const systemId = params.systemId as string;
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [variants, setVariants] = useState<Record<string, Variant[]>>({});
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [configText, setConfigText] = useState("");
  const [budgetStep, setBudgetStep] = useState<"choice" | "budget" | "suggestions" | "constraints" | "variants">(
    "choice"
  );
  // Track which variants came from AI so we can visually flag them in the dropdown
  const [aiInjectedIds, setAiInjectedIds] = useState<Set<string>>(new Set());
  const [buildConstraints, setBuildConstraints] = useState<BuildConstraints>({
    budgetMin: "",
    budgetMax: "250",
    voltage: "3.3",
    preferredPlatform: "esp32",
    requiredInterfaces: [],
  });
  const [budget, setBudget] = useState("250");
  const [suggestions, setSuggestions] = useState<
    Array<{ totalCost: number; selections: Array<{ componentName: string; variantId: string; name: string; price: number }> }>
  >([]);
  const [minCost, setMinCost] = useState<number | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionOffset, setSuggestionOffset] = useState(0);
  const [hasMoreSuggestions, setHasMoreSuggestions] = useState(false);
  const [manualForms, setManualForms] = useState<
    Record<
      string,
      { name: string; price: string; category: string; vendorUrl: string; pinType: string; pins: ManualPin[] }
    >
  >({});
  const [pinAssignments, setPinAssignments] = useState<Record<string, PinInput[]>>({});
  const [showCustomForm, setShowCustomForm] = useState<Record<string, boolean>>({});
  const [editComponentId, setEditComponentId] = useState<string | null>(null);
  const [componentDrafts, setComponentDrafts] = useState<Record<string, { name: string; deviceType: string }>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiRecommendations, setAiRecommendations] = useState<Record<string, AIRecommendation[]>>({});
  const [isAiRecommending, setIsAiRecommending] = useState(false);
  const [aiRecommendedSystem, setAiRecommendedSystem] = useState<string | null>(null);

  // ── LLM Review / Suggest state ──
  const [llmModalOpen, setLlmModalOpen] = useState(false);
  const [llmProvider, setLlmProvider] = useState<LLMProvider>("anthropic");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmAction, setLlmAction] = useState<"review" | "suggest">("review");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmReviewResult, setLlmReviewResult] = useState<LLMReviewResult | null>(null);
  const [llmSuggestResult, setLlmSuggestResult] = useState<LLMSuggestionResult | null>(null);
  const [llmError, setLlmError] = useState("");

  const loadComponents = async () => {
    try {
      const response = await fetch(`${API_URL}/api/systems/${systemId}`);
      if (!response.ok) {
        throw new Error("Unable to load system.");
      }
      const data = (await response.json()) as {
        components: ComponentItem[];
        selections?: SavedSelection[];
        latestConfig?: string | null;
      };
      setComponents(data.components);
      if (data.latestConfig) {
        setConfigText(data.latestConfig);
      }
      setComponentDrafts((prev) => {
        const next = { ...prev };
        data.components.forEach((component) => {
          next[component.id] = {
            name: component.name,
            deviceType: component.deviceType
          };
        });
        return next;
      });
      if (data.selections && data.selections.length > 0) {
        const nextSelections: Record<string, string> = {};
        const nextPins: Record<string, PinInput[]> = {};
        data.selections.forEach((selection) => {
          nextSelections[selection.componentName] = selection.variantId;
          if (selection.pins && selection.pins.length > 0) {
            nextPins[selection.componentName] = selection.pins.map((pin) => ({
              pinType: String(pin.pinType ?? "digital"),
              ioType: String(pin.ioType ?? "input"),
              name: String(pin.name ?? "pin"),
              number: String(pin.number ?? "")
            }));
          }
        });
        setSelections(nextSelections);
        setPinAssignments(nextPins);
        setBudgetStep("variants");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load system.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComponents();
  }, [systemId]);

  useEffect(() => {
    const loadVariants = async () => {
      const nextVariants: Record<string, Variant[]> = {};
      for (const component of components) {
        const query = new URLSearchParams();
        query.set("deviceType", component.deviceType);
        if (component.type && component.type.trim().length > 0) {
          query.set("componentType", component.type);
        }
        if (component.name && component.name.trim().length > 0) {
          query.set("name", component.name);
        }

        const response = await fetch(`${API_URL}/api/knowledgebase/variants?${query.toString()}`);
        if (response.ok) {
          nextVariants[component.name] = (await response.json()) as Variant[];
        }
      }
      setVariants(nextVariants);
    };

    if (components.length > 0) {
      loadVariants();
    }
  }, [components]);

  useEffect(() => {
    if (components.length === 0 || Object.keys(selections).length === 0) {
      return;
    }

    setPinAssignments((prev) => {
      let hasChanges = false;
      const next = { ...prev };

      components.forEach((component) => {
        const selectionId = selections[component.name];
        if (!selectionId) {
          return;
        }
        const existingPins = next[component.name];
        if (existingPins && existingPins.length > 0) {
          return;
        }
        const variant = (variants[component.name] ?? []).find((item) => item._id === selectionId);
        next[component.name] = buildPinsForVariant(component, variant);
        hasChanges = true;
      });

      return hasChanges ? next : prev;
    });
  }, [components, selections, variants]);

  const toPinName = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const trimmed = cleaned.replace(/(^_+|_+$)/g, "");
    return trimmed.length > 0 ? trimmed : "pin";
  };

  const ioForDevice = (deviceType: string) =>
    deviceType.toLowerCase().includes("actuator") ? "output" : "input";

  const buildPinsForVariant = (component: ComponentItem, variant?: Variant) => {
    const defaultPinType = variant?.pinType ?? "digital";
    const defaultIo = ioForDevice(component.deviceType);
    if (variant?.pins && variant.pins.length > 0) {
      return variant.pins.map((pin) => ({
        pinType: pin.pinType ?? defaultPinType,
        ioType: pin.ioType ?? defaultIo,
        name: pin.name ?? toPinName(component.name),
        number: ""
      }));
    }
    return [
      {
        pinType: defaultPinType,
        ioType: defaultIo,
        name: toPinName(component.name),
        number: ""
      }
    ];
  };

  const handleSelect = (component: ComponentItem, variantId: string) => {
    setSelections((prev) => ({ ...prev, [component.name]: variantId }));
    const variant = (variants[component.name] ?? []).find((item) => item._id === variantId);
    setPinAssignments((prev) => ({
      ...prev,
      [component.name]: buildPinsForVariant(component, variant)
    }));
  };

  const handlePinNumberChange = (componentName: string, index: number, value: string) => {
    setPinAssignments((prev) => {
      const pins = prev[componentName];
      if (!pins) {
        return prev;
      }
      const nextPins = pins.map((pin, pinIndex) =>
        pinIndex === index ? { ...pin, number: value } : pin
      );
      return {
        ...prev,
        [componentName]: nextPins
      };
    });
  };

  const handleAddPin = (componentName: string) => {
    setPinAssignments((prev) => {
      const pins = prev[componentName] || [];
      return {
        ...prev,
        [componentName]: [...pins, { name: `Pin ${pins.length + 1}`, number: "", pinType: "Digital", ioType: "Output" }]
      };
    });
  };

  const handleRemovePin = (componentName: string, index: number) => {
    setPinAssignments((prev) => {
      const pins = prev[componentName];
      if (!pins) return prev;
      const nextPins = [...pins];
      nextPins.splice(index, 1);
      return {
        ...prev,
        [componentName]: nextPins
      };
    });
  };

  const handleGenerate = async () => {
    setError("");
    try {
      // Allow missing pins now
      // const missingPins = components.filter((component) => {
      //   if (!selections[component.name]) {
      //     return false;
      //   }
      //   const pins = pinAssignments[component.name];
      //   return !pins || pins.length === 0 || pins.some((pin) => pin.number.trim() === "");
      // });

      // if (missingPins.length > 0) {
      //   setError("Please enter pin numbers for all selected variants before generating config.");
      //   return;
      // }

      const selectionsPayload = Object.entries(selections).map(([componentName, variantId]) => ({
        componentName,
        variantId
      }));

      const selectionsWithPins = selectionsPayload.map((selection) => ({
        variantSnapshot: (variants[selection.componentName] ?? []).find(
          (variant) => variant._id === selection.variantId
        ),
        ...selection,
        pins: (pinAssignments[selection.componentName] ?? []).map((pin) => ({
          pinType: pin.pinType,
          ioType: pin.ioType,
          name: pin.name,
          number: pin.number.toString().trim() === "" ? -1 : Number(pin.number)
        }))
      }));

      const saveResponse = await fetch(`${API_URL}/api/systems/${systemId}/selections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections: selectionsWithPins })
      });

      if (!saveResponse.ok) {
        const message = await saveResponse.text();
        throw new Error(message || "Unable to save selections.");
      }

      const configResponse = await fetch(`${API_URL}/api/systems/${systemId}/config`, {
        method: "POST"
      });

      if (!configResponse.ok) {
        const message = await configResponse.text();
        throw new Error(message || "Unable to generate config.");
      }

      const text = await configResponse.text();
      setConfigText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate config.");
    }
  };

  const handleSuggestBudget = async (nextOffset = 0, append = false) => {
    setError("");
    setIsSuggesting(true);
    try {
      const response = await fetch(
        `${API_URL}/api/systems/${systemId}/budget-suggestions?budget=${encodeURIComponent(
          budget
        )}&limit=5&offset=${nextOffset}`
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload?.message) {
          setError(payload.message);
          if (payload.missing?.length) {
            setBudgetStep("variants");
          }
          return;
        }
        throw new Error("Unable to generate budget suggestions.");
      }
      const data = (await response.json()) as {
        minCost: number;
        suggestions: Array<{
          totalCost: number;
          selections: Array<{ componentName: string; variantId: string; name: string; price: number }>;
        }>;
        nextOffset: number;
        hasMore: boolean;
      };
      setMinCost(data.minCost);
      setSuggestions((prev) => (append ? [...prev, ...data.suggestions] : data.suggestions));
      setSuggestionOffset(data.nextOffset);
      setHasMoreSuggestions(data.hasMore);
      setBudgetStep("suggestions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate budget suggestions.");
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAiRecommend = async () => {
    setError("");
    setIsAiRecommending(true);
    try {
      // Build a system JSON from the components for the recommender
      const devices = components.map((c) => ({
        name: c.name,
        deviceType: c.deviceType,
        componentType: c.type || c.name,
        controllerName: "Controller",
      }));

      // Parse user constraints
      const bc = buildConstraints;
      const budgetMax = bc.budgetMax ? parseFloat(bc.budgetMax) : undefined;
      const budgetMin = bc.budgetMin ? parseFloat(bc.budgetMin) : undefined;
      const voltage = bc.voltage ? parseFloat(bc.voltage) : undefined;
      const perComponentBudget = budgetMax && devices.length > 0
        ? Math.round((budgetMax / devices.length) * 100) / 100
        : undefined;

      // Call our recommender API for each component
      const recByComponent: Record<string, AIRecommendation[]> = {};
      for (const device of devices) {
        // -----------------------------------------------------------
        // Normalize device type: handle both singular and plural forms
        // JSON may use "sensors", "actuators", "controllers", "tags"
        // -----------------------------------------------------------
        const dtRaw = device.deviceType.toLowerCase().replace(/\s+/g, "");
        const dt =
          dtRaw === "sensors" || dtRaw === "sensor" ? "sensor" :
          dtRaw === "actuators" || dtRaw === "actuator" ? "actuator" :
          dtRaw === "controllers" || dtRaw === "controller" ? "controller" :
          dtRaw === "tags" || dtRaw === "tag" ? "tag" :
          dtRaw === "power" ? "power" :
          dtRaw === "network" ? "network" :
          dtRaw; // fallback

        // -----------------------------------------------------------
        // Build keywords from the device NAME (not componentType which
        // is a class name like "Sensor" or "OccupancySensor").
        // Clean up: split on spaces, underscores, parens, hyphens.
        // -----------------------------------------------------------
        const nameTokens = device.name
          .replace(/[()_\-/]/g, " ")
          .toLowerCase()
          .split(/\s+/)
          .filter((t: string) => t.length > 2 && !["the", "and", "for", "with"].includes(t));

        // Also extract useful tokens from componentType if it's different from name
        const ctRaw = (device.componentType || "").replace(/[()_\-/]/g, " ").toLowerCase();
        const ctTokens = ctRaw
          .split(/\s+/)
          .filter((t: string) =>
            t.length > 2 &&
            // Skip generic class names that are useless as search keywords
            !["sensor", "actuator", "microcontroller", "controller", "module",
              "continuousenergysource", "occupancysensor", "smartcardreader",
              "the", "and", "for", "with"].includes(t)
          );

        const allKeywords = Array.from(new Set([...nameTokens, ...ctTokens]));

        const constraints: Record<string, unknown> = {
          keywords: allKeywords.length > 0 ? allKeywords : [device.name.toLowerCase()],
          limit: 10,
        };

        // Apply global constraints
        if (perComponentBudget) constraints.budgetMax = perComponentBudget;
        if (budgetMin) constraints.budgetMin = budgetMin / (devices.length || 1);
        if (voltage) constraints.voltage = voltage;
        if (bc.requiredInterfaces.length > 0) constraints.interfaces = bc.requiredInterfaces;

        // -----------------------------------------------------------
        // Map normalized device type to KB category + specialized logic
        // -----------------------------------------------------------
        if (dt === "sensor") {
          constraints.category = "sensors";
          // keywords from name are already good: "ultrasonic sensor" → ["ultrasonic", "sensor"]
        } else if (dt === "actuator") {
          constraints.category = "actuators";
        } else if (dt === "controller") {
          constraints.category = "controllers";
          const platform = bc.preferredPlatform;
          const cName = device.name.toLowerCase();
          if (cName.includes("esp32") || cName.includes("esp") || platform === "esp32") {
            constraints.keywords = ["esp32"];
            constraints.subcategory = "esp";
          } else if (
            cName.includes("atmega") || cName.includes("avr") ||
            cName.includes("uno") || cName.includes("mega") ||
            cName.includes("nano") || platform === "arduino"
          ) {
            constraints.keywords = ["arduino"];
            constraints.subcategory = "arduino";
          } else {
            // "any" or generic — prefer ESP32
            constraints.keywords = ["esp32"];
            constraints.subcategory = "esp";
          }
        } else if (dt === "power") {
          constraints.category = "power";
          // Add "supply" keyword to favour actual power supplies
          if (!allKeywords.some((k: string) => k.includes("supply") || k.includes("power"))) {
            constraints.keywords = [...allKeywords, "power", "supply"];
          }
        } else if (dt === "tag") {
          constraints.category = "tags";
          // Extract useful tag keywords: "Card Reader (rfid)" → "card", "reader", "rfid"
          if (!allKeywords.some((k: string) => ["rfid", "nfc", "reader"].includes(k))) {
            constraints.keywords = [...allKeywords, "rfid"];
          }
        } else if (dt === "network") {
          constraints.category = "controllers";
          const netType = device.componentType?.toLowerCase() || "";
          constraints.keywords = [netType || "wifi"];
          if (netType === "wifi") constraints.interfaces = ["WiFi"];
          else if (netType === "ble" || netType === "bluetooth") constraints.interfaces = ["BLE"];
        }

        const response = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(constraints),
        });

        if (response.ok) {
          const data = await response.json();
          recByComponent[device.name] = data.components ?? [];
        }
      }

      setAiRecommendations(recByComponent);

      // Inject ALL AI recommendations into the variant dropdowns so the user
      // can select them.  Each AI rec becomes a Variant object.  We place them
      // at the TOP of the list (highest score first), de-duped against backend.
      const mergedVariants: Record<string, Variant[]> = {};
      const allAiIds = new Set<string>();

      for (const component of components) {
        const aiRecs = recByComponent[component.name] ?? [];
        const backendVariants = variants[component.name] ?? [];

        // Convert every AI rec → Variant shape
        const aiVariants: Variant[] = aiRecs.map((rec) => {
          allAiIds.add(rec.id);
          return {
            _id: rec.id,
            name: rec.title,
            price: rec.price ?? 0,
            category: `${rec.category}/${rec.subcategory}`,
            vendorUrl: rec.purchaseUrl || "",
            pinType: "digital",
            componentId: rec.id,
          };
        });

        // De-dupe: keep AI version if _id collision
        const aiIdSet = new Set(aiVariants.map((v) => v._id));
        const deduped = backendVariants.filter((v) => !aiIdSet.has(v._id));
        mergedVariants[component.name] = [...aiVariants, ...deduped];
      }
      setVariants((prev) => ({ ...prev, ...mergedVariants }));
      setAiInjectedIds(allAiIds);

      // Auto-select the top AI pick for each component
      const nextSelections: Record<string, string> = {};
      const nextPins: Record<string, PinInput[]> = {};

      for (const component of components) {
        const aiRecs = recByComponent[component.name] ?? [];
        const merged = mergedVariants[component.name] ?? [];

        if (aiRecs.length > 0 && merged.length > 0) {
          const topRecId = aiRecs[0].id;
          const topVariant = merged.find((v) => v._id === topRecId);
          if (topVariant) {
            nextSelections[component.name] = topVariant._id;
            nextPins[component.name] = buildPinsForVariant(component, topVariant);
          } else {
            nextSelections[component.name] = merged[0]._id;
            nextPins[component.name] = buildPinsForVariant(component, merged[0]);
          }
        }
      }

      if (Object.keys(nextSelections).length > 0) {
        setSelections((prev) => ({ ...prev, ...nextSelections }));
        setPinAssignments((prev) => ({ ...prev, ...nextPins }));
      }

      setAiRecommendedSystem(systemId);
      setBudgetStep("variants");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI recommendation failed.");
    } finally {
      setIsAiRecommending(false);
    }
  };

  /** Select an AI recommendation directly — ensures it exists in variants, then selects it. */
  const selectAiRecommendation = (component: ComponentItem, rec: AIRecommendation) => {
    const recVariant: Variant = {
      _id: rec.id,
      name: rec.title,
      price: rec.price ?? 0,
      category: `${rec.category}/${rec.subcategory}`,
      vendorUrl: rec.purchaseUrl || "",
      pinType: "digital",
      componentId: rec.id,
    };

    // Ensure the variant exists in the dropdown list
    setVariants((prev) => {
      const existing = prev[component.name] ?? [];
      const alreadyExists = existing.some((v) => v._id === rec.id);
      if (alreadyExists) return prev;
      return { ...prev, [component.name]: [recVariant, ...existing] };
    });

    setAiInjectedIds((prev) => { const next = new Set(Array.from(prev)); next.add(rec.id); return next; });

    // Select it
    setSelections((prev) => ({ ...prev, [component.name]: rec.id }));
    setPinAssignments((prev) => ({
      ...prev,
      [component.name]: buildPinsForVariant(component, recVariant),
    }));
  };

  // ── LLM Review / Suggest handlers ──

  /** Build the context object the LLM service needs */
  const buildLlmContext = (): SystemContext => {
    const componentSelections = components.map((c) => {
      const variantId = selections[c.name];
      const variantList = variants[c.name] ?? [];
      const v = variantList.find((vv) => vv._id === variantId);
      return {
        name: c.name,
        deviceType: c.deviceType,
        selectedVariant: v?.name ?? null,
        price: v?.price ?? null,
        category: v?.category ?? null,
        interfaces: [] as string[], // we don't store interfaces on Variant objects
      };
    });
    return {
      systemName: systemId,
      components: componentSelections,
      constraints: {
        budgetMax: buildConstraints.budgetMax ? parseFloat(buildConstraints.budgetMax) : undefined,
        voltage: buildConstraints.voltage ? parseFloat(buildConstraints.voltage) : undefined,
        preferredPlatform: buildConstraints.preferredPlatform,
        requiredInterfaces: buildConstraints.requiredInterfaces.length > 0 ? buildConstraints.requiredInterfaces : undefined,
      },
    };
  };

  const openLlmModal = (action: "review" | "suggest") => {
    setLlmAction(action);
    setLlmError("");
    // If they already entered a key, skip the modal and go straight
    if (llmApiKey) {
      executeLlmAction(action);
    } else {
      setLlmModalOpen(true);
    }
  };

  const executeLlmAction = async (action?: "review" | "suggest") => {
    const act = action ?? llmAction;
    if (!llmApiKey.trim()) {
      setLlmError("Please enter an API key.");
      return;
    }
    setLlmModalOpen(false);
    setLlmLoading(true);
    setLlmError("");
    try {
      const config: LLMConfig = { provider: llmProvider, apiKey: llmApiKey.trim() };
      const ctx = buildLlmContext();
      if (act === "review") {
        const result = await llmReview(config, ctx);
        setLlmReviewResult(result);
        setLlmSuggestResult(null);
      } else {
        const result = await llmSuggest(config, ctx);
        setLlmSuggestResult(result);
        setLlmReviewResult(null);
      }
    } catch (err) {
      setLlmError(err instanceof Error ? err.message : "LLM request failed.");
    } finally {
      setLlmLoading(false);
    }
  };

  const applySuggestion = (selectionList: Array<{ componentName: string; variantId: string }>) => {
    const nextSelections: Record<string, string> = {};
    const nextPins: Record<string, PinInput[]> = {};
    for (const selection of selectionList) {
      if (selection.variantId === "PENDING") {
        continue;
      }
      nextSelections[selection.componentName] = selection.variantId;
      const component = components.find((item) => item.name === selection.componentName);
      if (component) {
        const variant = (variants[component.name] ?? []).find((item) => item._id === selection.variantId);
        nextPins[component.name] = buildPinsForVariant(component, variant);
      }
    }
    setSelections(nextSelections);
    setPinAssignments((prev) => ({ ...prev, ...nextPins }));
    setBudgetStep("variants");
  };

  const handleComponentDraftChange = (componentId: string, field: "name" | "deviceType", value: string) => {
    setComponentDrafts((prev) => ({
      ...prev,
      [componentId]: {
        name: prev[componentId]?.name ?? "",
        deviceType: prev[componentId]?.deviceType ?? "",
        [field]: value
      }
    }));
  };

  const handleAddComponent = async () => {
    try {
      const response = await fetch(`${API_URL}/api/systems/${systemId}/components`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Component", deviceType: "sensor" })
      });
      if (!response.ok) throw new Error("Failed to add component");
      await loadComponents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add component");
    }
  };

  const handleDeleteComponent = async (componentId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/systems/${systemId}/components/${componentId}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Failed to delete component");
      await loadComponents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete component");
    }
  };

  const handleSaveComponent = async (componentId: string) => {
    const draft = componentDrafts[componentId];
    if (!draft?.name || !draft?.deviceType) {
      setError("Component name and device type are required.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/systems/${systemId}/components`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          componentId,
          name: draft.name,
          deviceType: draft.deviceType
        })
      });
      if (!response.ok) {
        throw new Error("Unable to update component.");
      }
      setEditComponentId(null);
      setSelections({});
      await loadComponents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update component.");
    }
  };

  const handleManualChange = (
    componentName: string,
    field: string,
    value: string,
    deviceType?: string
  ) => {
    setManualForms((prev) => {
      const base =
        prev[componentName] ??
        ({
          name: "",
          price: "",
          category: deviceType ?? "",
          vendorUrl: "",
          pinType: "digital",
          pins: [
            {
              name: toPinName(componentName),
              pinType: "digital",
              ioType: deviceType ? ioForDevice(deviceType) : "input"
            }
          ]
        } as const);

      return {
        ...prev,
        [componentName]: {
          ...base,
          [field]: value
        }
      };
    });
  };

  const handleToggleCustomForm = (componentName: string, deviceType: string) => {
    setShowCustomForm((prev) => ({
      ...prev,
      [componentName]: !prev[componentName]
    }));
    setManualForms((prev) => {
      if (prev[componentName]) {
        return prev;
      }
      return {
        ...prev,
        [componentName]: {
          name: "",
          price: "",
          category: deviceType,
          vendorUrl: "",
          pinType: "digital",
          pins: [
            {
              name: toPinName(componentName),
              pinType: "digital",
              ioType: ioForDevice(deviceType)
            }
          ]
        }
      };
    });
  };

  const handleManualPinChange = (
    componentName: string,
    index: number,
    field: "name" | "pinType" | "ioType",
    value: string
  ) => {
    setManualForms((prev) => {
      const form = prev[componentName];
      if (!form) {
        return prev;
      }
      const nextPins = form.pins.map((pin, pinIndex) =>
        pinIndex === index ? { ...pin, [field]: value } : pin
      );
      return {
        ...prev,
        [componentName]: {
          ...form,
          pins: nextPins
        }
      };
    });
  };

  const handleManualAddPin = (componentName: string, deviceType: string) => {
    setManualForms((prev) => {
      const form = prev[componentName];
      if (!form) {
        return prev;
      }
      return {
        ...prev,
        [componentName]: {
          ...form,
          pins: [
            ...form.pins,
            {
              name: toPinName(componentName),
              pinType: "digital",
              ioType: ioForDevice(deviceType)
            }
          ]
        }
      };
    });
  };

  const handleManualRemovePin = (componentName: string, index: number) => {
    setManualForms((prev) => {
      const form = prev[componentName];
      if (!form) {
        return prev;
      }
      const nextPins = form.pins.filter((_, pinIndex) => pinIndex !== index);
      return {
        ...prev,
        [componentName]: {
          ...form,
          pins: nextPins.length > 0 ? nextPins : form.pins
        }
      };
    });
  };

  const handleManualSubmit = async (componentName: string, deviceType: string) => {
    setError("");
    const payload = manualForms[componentName];
    if (!payload) {
      setError("Please enter variant details.");
      return;
    }

    if (!payload.name.trim() || !Number.isFinite(Number(payload.price))) {
      setError("Variant name and a valid price are required.");
      return;
    }

    const variantPayload = {
      type: deviceType,
      name: payload.name.trim(),
      price: Number(payload.price),
      category: (payload.category || deviceType).trim(),
      vendorUrl: payload.vendorUrl.trim(),
      pinType: payload.pinType,
      componentId: `CUSTOM_${componentName.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase()}_${Date.now()}`,
      pins: payload.pins
        .map((pin) => ({
          pinType: pin.pinType,
          ioType: pin.ioType,
          name: pin.name.trim()
        }))
        .filter((pin) => pin.name.length > 0)
    };

    try {
      const response = await fetch(`${API_URL}/api/knowledgebase/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(variantPayload)
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to save custom variant.");
      }

      const customVariant = (await response.json()) as Variant;

      setVariants((prev) => {
        const list = prev[componentName] ?? [];
        const next = [...list, customVariant].sort((a, b) => a.price - b.price);
        return { ...prev, [componentName]: next };
      });

      setSelections((prev) => ({
        ...prev,
        [componentName]: customVariant._id
      }));

      const component = components.find((item) => item.name === componentName);
      if (component) {
        setPinAssignments((prev) => ({
          ...prev,
          [componentName]: buildPinsForVariant(component, customVariant)
        }));
      }

      setShowCustomForm((prev) => ({ ...prev, [componentName]: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save custom variant.");
    }
  };

  const downloadConfig = () => {
    const blob = new Blob([configText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `system-${systemId}.config`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isMissingPins = (componentName: string) => {
    if (!selections[componentName]) {
      return false;
    }
    const pins = pinAssignments[componentName];
    return !pins || pins.length === 0 || pins.some((pin) => pin.number.trim() === "");
  };

  const allSelected = useMemo(() => {
    if (components.length === 0) {
      return false;
    }
    return components.every((component) => selections[component.name]);
  }, [components, selections]);

  const hasMissingPins = useMemo(
    () => components.some((component) => isMissingPins(component.name)),
    [components, selections, pinAssignments]
  );

  const generateDisabled = !allSelected || hasMissingPins;
  const generateTitle = !allSelected
    ? "Select a variant for every component."
    : hasMissingPins
      ? "Fill in all pin numbers before generating."
      : "Generate config";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-ink/10 bg-white/90 px-5 py-4 shadow-[0_18px_45px_rgba(39,24,126,0.08)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">Build Workspace</p>
          <h1 className="font-display text-2xl text-ink">Select component variants</h1>
        </div>
        <div className="flex gap-2">
          {budgetStep === "variants" && (
            <>
              <Button variant="outline" onClick={handleAiRecommend} disabled={isAiRecommending}>
                <Sparkles className="w-4 h-4 mr-2" />
                {isAiRecommending ? "Analyzing..." : "AI Recommend"}
              </Button>
              <Button variant="outline" onClick={() => openLlmModal("review")} disabled={llmLoading}>
                <BrainCircuit className="w-4 h-4 mr-2" />
                {llmLoading && llmAction === "review" ? "Reviewing..." : "LLM Review"}
              </Button>
              <Button variant="outline" onClick={() => openLlmModal("suggest")} disabled={llmLoading}>
                <Lightbulb className="w-4 h-4 mr-2" />
                {llmLoading && llmAction === "suggest" ? "Suggesting..." : "LLM Suggest"}
              </Button>
              <Button variant="accent" onClick={handleAddComponent}>
                <Plus className="w-4 h-4 mr-2" />
                Add Component
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => window.history.back()}>
            Back to dashboard
          </Button>
        </div>
      </header>

      <section className="grid gap-4">
        {budgetStep === "choice" ? (
          <Card className="border-ink/10 bg-white/95">
            <CardHeader>
              <CardTitle>Build your system</CardTitle>
              <p className="mt-2 text-sm text-ink/70">
                Choose how you&apos;d like to select hardware components for this system.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setBudgetStep("constraints")}
                className="flex flex-col gap-2 rounded-2xl border-2 border-violet-200 bg-violet-50/50 p-5 text-left transition-colors hover:border-violet-400 hover:bg-violet-50"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-600" />
                  <span className="font-semibold text-ink">AI-Powered Recommendations</span>
                </div>
                <p className="text-xs text-ink/60">
                  Set constraints (budget, platform, voltage, interfaces) and let the recommender
                  find the best components from the knowledge base. You can edit selections after.
                </p>
              </button>
              <button
                onClick={() => setBudgetStep("variants")}
                className="flex flex-col gap-2 rounded-2xl border-2 border-ink/10 bg-white p-5 text-left transition-colors hover:border-ink/30"
              >
                <span className="font-semibold text-ink">Manual Selection</span>
                <p className="text-xs text-ink/60">
                  Browse and pick each component variant yourself from the knowledge base catalogue.
                </p>
              </button>
            </CardContent>
          </Card>
        ) : null}

        {budgetStep === "constraints" ? (
          <Card className="border-violet-200 bg-violet-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-600" />
                Configure Recommendation Constraints
              </CardTitle>
              <p className="mt-2 text-sm text-ink/70">
                Set your requirements before generating AI-powered recommendations.
              </p>
            </CardHeader>
            <CardContent className="grid gap-6">
              {/* Platform Preference */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                  Preferred Controller Platform
                </label>
                <div className="mt-2 flex gap-2">
                  {(["esp32", "arduino", "any"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setBuildConstraints((prev) => ({ ...prev, preferredPlatform: p }))}
                      className={`rounded-xl px-4 py-2 text-sm font-medium border transition-colors ${
                        buildConstraints.preferredPlatform === p
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white text-ink/70 border-ink/20 hover:border-violet-400"
                      }`}
                    >
                      {p === "esp32" ? "ESP32 (WiFi built-in)" : p === "arduino" ? "Arduino (AVR)" : "Any Platform"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget Range */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                    Min Budget (CAD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="No minimum"
                    className="mt-2 w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm"
                    value={buildConstraints.budgetMin}
                    onChange={(e) => setBuildConstraints((prev) => ({ ...prev, budgetMin: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                    Max Budget (CAD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="No maximum"
                    className="mt-2 w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm"
                    value={buildConstraints.budgetMax}
                    onChange={(e) => setBuildConstraints((prev) => ({ ...prev, budgetMax: e.target.value }))}
                  />
                </div>
              </div>

              {/* Operating Voltage */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                  Operating Voltage
                </label>
                <div className="mt-2 flex gap-2">
                  {["3.3", "5", ""].map((v) => (
                    <button
                      key={v || "any"}
                      onClick={() => setBuildConstraints((prev) => ({ ...prev, voltage: v }))}
                      className={`rounded-xl px-4 py-2 text-sm font-medium border transition-colors ${
                        buildConstraints.voltage === v
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white text-ink/70 border-ink/20 hover:border-violet-400"
                      }`}
                    >
                      {v ? `${v}V` : "Any"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Required Interfaces */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                  Required Interfaces
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["I2C", "SPI", "UART", "GPIO", "ADC", "PWM", "WiFi", "BLE", "USB"].map((iface) => (
                    <button
                      key={iface}
                      onClick={() =>
                        setBuildConstraints((prev) => ({
                          ...prev,
                          requiredInterfaces: prev.requiredInterfaces.includes(iface)
                            ? prev.requiredInterfaces.filter((i) => i !== iface)
                            : [...prev.requiredInterfaces, iface],
                        }))
                      }
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                        buildConstraints.requiredInterfaces.includes(iface)
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white text-ink/70 border-ink/20 hover:border-violet-400"
                      }`}
                    >
                      {iface}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-xl bg-white border border-ink/10 p-3 text-xs text-ink/60 space-y-1">
                <p><span className="font-semibold text-ink/80">Platform:</span> {buildConstraints.preferredPlatform === "esp32" ? "ESP32 (WiFi built-in)" : buildConstraints.preferredPlatform === "arduino" ? "Arduino (AVR)" : "Any"}</p>
                <p><span className="font-semibold text-ink/80">Budget:</span> {buildConstraints.budgetMin || "0"} – {buildConstraints.budgetMax || "∞"} CAD (total)</p>
                <p><span className="font-semibold text-ink/80">Voltage:</span> {buildConstraints.voltage ? `${buildConstraints.voltage}V` : "Any"}</p>
                <p><span className="font-semibold text-ink/80">Interfaces:</span> {buildConstraints.requiredInterfaces.length > 0 ? buildConstraints.requiredInterfaces.join(", ") : "None required"}</p>
                <p><span className="font-semibold text-ink/80">Components:</span> {components.length} devices to recommend</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="accent"
                  onClick={() => { setBudgetStep("variants"); handleAiRecommend(); }}
                  disabled={isAiRecommending}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {isAiRecommending ? "Analyzing KB..." : "Generate Recommendations"}
                </Button>
                <Button variant="outline" onClick={() => setBudgetStep("choice")}>
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {budgetStep === "budget" ? (
          <Card className="border-ink/10 bg-white/95">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Budget planning</CardTitle>
                <p className="mt-2 text-xs text-ink/60">
                  Set a budget to see viable component combinations.
                </p>
              </div>
              <div className="rounded-full border border-ink/10 bg-mist/80 px-3 py-1 text-xs font-semibold text-ink/70">
                USD
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                  Budget
                </label>
                <input
                  type="number"
                  min={0}
                  className="mt-2 w-full rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                />
                {minCost !== null && suggestions.length === 0 ? (
                  <p className="mt-2 text-xs text-ember">
                    Minimum viable total is ${minCost.toFixed(2)}.
                  </p>
                ) : null}
              </div>
              <Button variant="outline" onClick={() => handleSuggestBudget(0, false)} disabled={isSuggesting}>
                {isSuggesting ? "Calculating..." : "Suggest combinations"}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {budgetStep === "suggestions" && suggestions.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {suggestions.map((suggestion, index) => {
              const pendingSelections = suggestion.selections.filter((s) => s.variantId === "PENDING");
              const hasPending = pendingSelections.length > 0;

              return (
                <Card key={`${suggestion.totalCost}-${index}`} className="border-ink/10 bg-white/95">
                  <CardHeader>
                    <CardTitle>Option {index + 1}</CardTitle>
                    <p className="text-sm text-ink/70">Total: ${suggestion.totalCost.toFixed(2)}</p>
                    {hasPending ? (
                      <div className="mt-2 rounded-xl border border-ember/20 bg-ember/5 px-3 py-2 text-xs text-ember">
                        <span className="font-semibold block mb-1">Missing Components</span>
                        These components aren't in the catalog: {pendingSelections.map(s => s.componentName).join(", ")}.
                        They must be assigned manually.
                      </div>
                    ) : null}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-xs text-ink/70">
                    {suggestion.selections.map((selection) => {
                      const isPending = selection.variantId === "PENDING";
                      return (
                        <div key={selection.componentName} className={`rounded-xl border p-2 ${isPending ? 'border-ember/30 bg-ember/5 text-ember' : 'border-ink/10 bg-mist/70'}`}>
                          <p className="font-semibold text-ink">{selection.componentName}</p>
                          <p>{selection.name} · ${selection.price.toFixed(2)}</p>
                        </div>
                      );
                    })}
                    <Button
                      variant="accent"
                      className="mt-2"
                      onClick={() => applySuggestion(suggestion.selections)}
                    >
                      Use this suggestion
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {hasMoreSuggestions ? (
              <Card className="flex flex-col items-center justify-center border-ink/10 bg-white/95 p-6 text-center">
                <p className="text-sm text-ink/70">Need more options?</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => handleSuggestBudget(suggestionOffset, true)}
                  disabled={isSuggesting}
                >
                  {isSuggesting ? "Loading..." : "Load 5 more"}
                </Button>
              </Card>
            ) : null}
          </div>
        ) : null}

        {budgetStep === "suggestions" && suggestions.length === 0 && minCost !== null ? (
          <Card className="border-ink/10 bg-white/95">
            <CardHeader>
              <CardTitle>No viable combinations</CardTitle>
              <p className="mt-2 text-sm text-ember">Minimum viable total is ${minCost.toFixed(2)}.</p>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button variant="outline" onClick={() => setBudgetStep("budget")}>Adjust budget</Button>
              <Button variant="accent" onClick={() => setBudgetStep("variants")}>Select manually</Button>
            </CardContent>
          </Card>
        ) : null}

        {budgetStep === "variants" && isLoading ? (
          <Card>
            <CardContent className="py-10 text-center">Loading components...</CardContent>
          </Card>
        ) : null}

        {budgetStep === "variants" && !isLoading ? (
          <div className="grid gap-4">
            {components.map((component) => {
              const selectedVariant = (variants[component.name] ?? []).find(
                (variant) => variant._id === selections[component.name]
              );
              const assignedPins = pinAssignments[component.name] ?? [];

              return (
                <Card key={component.name} className="border-ink/10 bg-white/90">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle>{component.name}</CardTitle>
                      <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">
                        {component.deviceType}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full border border-ink/10 bg-mist/80 px-3 py-1 text-xs font-semibold text-ink/70">
                        Required
                      </div>
                      {isMissingPins(component.name) ? (
                        <div className="rounded-full border border-ember/40 bg-ember/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ember">
                          Pins required
                        </div>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
                    {editComponentId === component.id ? (
                      <div className="grid w-full gap-3 sm:grid-cols-2">
                        <input
                          className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                          value={componentDrafts[component.id]?.name ?? ""}
                          onChange={(event) =>
                            handleComponentDraftChange(component.id, "name", event.target.value)
                          }
                          placeholder="Component name"
                        />
                        <input
                          className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                          value={componentDrafts[component.id]?.deviceType ?? ""}
                          onChange={(event) =>
                            handleComponentDraftChange(component.id, "deviceType", event.target.value)
                          }
                          placeholder="Device type"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-ink/60">
                        Adjust name or device type if the system definition changes.
                      </p>
                    )}
                    <div className="flex gap-2">
                      {editComponentId === component.id ? (
                        <>
                          <Button variant="accent" onClick={() => handleSaveComponent(component.id)}>
                            Save
                          </Button>
                          <Button variant="outline" onClick={() => setEditComponentId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setEditComponentId(component.id)} title="Edit component">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-ember hover:bg-ember/10 hover:text-ember" onClick={() => handleDeleteComponent(component.id)} title="Remove component">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                        Variant selection
                      </label>
                      {(variants[component.name] ?? []).length > 0 ? (
                        <select
                          className="mt-2 w-full rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                          value={selections[component.name] ?? ""}
                          onChange={(event) => handleSelect(component, event.target.value)}
                        >
                          <option value="" disabled>
                            Select a variant
                          </option>
                          {(variants[component.name] ?? []).map((variant) => {
                            const isAi = aiInjectedIds.has(variant._id);
                            const pinCount = variant.pins?.length ?? 0;
                            const pinLabel = pinCount > 0
                              ? `${pinCount} pin${pinCount > 1 ? "s" : ""}`
                              : "1 pin";
                            const pinNames = (variant.pins ?? [])
                              .map((pin) => pin.name)
                              .filter((name) => Boolean(name))
                              .join(", ");
                            const pinSummary = pinNames ? `${pinLabel} (${pinNames})` : pinLabel;

                            return (
                              <option key={variant._id} value={variant._id}>
                                {isAi ? "★ " : ""}{variant.name} - ${variant.price}{isAi ? "" : ` · ${pinSummary}`}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <div className="mt-2 rounded-2xl border border-ember/40 bg-white/90 p-3 text-xs text-ember">
                          No variants found for {component.deviceType}. Add one below to continue.
                        </div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-ink/10 bg-mist/70 px-3 py-2 text-xs text-ink/70">
                      {selectedVariant ? (
                        <div className="flex flex-col gap-2">
                          <p>
                            {selectedVariant.category} | {selectedVariant.pinType}
                          </p>
                          {selectedVariant.vendorUrl ? (
                            <p className="break-all text-ink/70">{selectedVariant.vendorUrl}</p>
                          ) : null}
                          {selectedVariant.vendorUrl ? (
                            <Button variant="outline" size="sm" asChild>
                              <a href={selectedVariant.vendorUrl} target="_blank" rel="noreferrer">
                                Buy
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        "Select a variant to view details."
                      )}
                    </div>
                  </CardContent>
                  {/* AI Recommendation Panel — clickable items */}
                  {(aiRecommendations[component.name] ?? []).length > 0 && (
                    <CardContent className="border-t border-ink/10">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-violet-500" />
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">
                          AI Recommendations
                        </p>
                        <span className="text-[10px] text-ink/40 ml-auto">Click to select</span>
                      </div>
                      <div className="grid gap-2">
                        {(aiRecommendations[component.name] ?? []).slice(0, 5).map((rec, idx) => {
                          const isSelected = selections[component.name] === rec.id;
                          return (
                            <button
                              type="button"
                              key={rec.id}
                              onClick={() => selectAiRecommendation(component, rec)}
                              className={`flex items-center justify-between rounded-xl border p-2 text-xs text-left transition-colors ${
                                isSelected
                                  ? "border-violet-500 bg-violet-100 ring-2 ring-violet-300"
                                  : idx === 0
                                    ? "border-violet-300 bg-violet-50 hover:bg-violet-100"
                                    : "border-ink/10 bg-mist/50 hover:bg-mist"
                              }`}
                            >
                              <div className="flex-1">
                                <p className="font-semibold text-ink">
                                  {isSelected && <span className="text-violet-600 mr-1">✓</span>}
                                  {idx === 0 && !isSelected && <span className="text-violet-600 mr-1">★</span>}
                                  {rec.title}
                                </p>
                                <p className="text-ink/60 mt-0.5">
                                  {rec.category}/{rec.subcategory}
                                  {rec.price !== null && ` · $${rec.price.toFixed(2)}`}
                                  {` · Score: ${rec.score}`}
                                </p>
                                {rec.interfaces.length > 0 && (
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {rec.interfaces.map((iface) => (
                                      <span key={iface} className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">
                                        {iface}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                {rec.purchaseUrl && (
                                  <a
                                    href={rec.purchaseUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-violet-500 hover:text-violet-700"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}
                                {isSelected ? (
                                  <span className="rounded-lg bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                                    Selected
                                  </span>
                                ) : (
                                  <span className="rounded-lg border border-violet-300 px-2 py-0.5 text-[10px] font-medium text-violet-600">
                                    Use
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}

                  {selectedVariant ? (
                    <CardContent className="grid gap-3 border-t border-ink/10">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                          Pin assignments
                        </p>
                        <p className="text-xs text-ink/50">Enter board pin numbers</p>
                      </div>
                      {assignedPins.length > 0 && assignedPins.some((pin) => pin.number.trim() === "") ? (
                        <div className="rounded-2xl border border-ember/30 bg-white px-3 py-2 text-xs text-ember">
                          Missing pin numbers for this variant.
                        </div>
                      ) : null}
                      <div className="grid gap-2">
                        {assignedPins.map((pin, index) => (
                          <div
                            key={`${component.name}-pin-${index}`}
                            className="grid gap-2 rounded-2xl border border-haze bg-white p-3 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto] items-center"
                          >
                            <input
                              className="text-xs font-semibold text-ink/70 bg-transparent border-none p-0 outline-none"
                              value={pin.name}
                              onChange={(e) => {
                                setPinAssignments((prev) => {
                                  const cp = prev[component.name] ? [...prev[component.name]] : [];
                                  if(cp[index]) { cp[index] = {...cp[index], name: e.target.value}; }
                                  return { ...prev, [component.name]: cp };
                                })
                              }}
                              placeholder="Pin Name"
                            />
                            <select
                                className="text-xs text-ink/60 bg-transparent border-none p-0 outline-none"
                                value={pin.pinType}
                                onChange={(e) => {
                                    setPinAssignments((prev) => {
                                        const cp = prev[component.name] ? [...prev[component.name]] : [];
                                        if(cp[index]) { cp[index] = {...cp[index], pinType: e.target.value}; }
                                        return { ...prev, [component.name]: cp };
                                    })
                                }}
                            >
                                <option value="Digital">Digital</option>
                                <option value="Analog">Analog</option>
                                <option value="PWM">PWM</option>
                            </select>
                            <select
                                className="text-xs text-ink/60 bg-transparent border-none p-0 outline-none"
                                value={pin.ioType}
                                onChange={(e) => {
                                    setPinAssignments((prev) => {
                                        const cp = prev[component.name] ? [...prev[component.name]] : [];
                                        if(cp[index]) { cp[index] = {...cp[index], ioType: e.target.value}; }
                                        return { ...prev, [component.name]: cp };
                                    })
                                }}
                            >
                                <option value="Input">Input</option>
                                <option value="Output">Output</option>
                            </select>
                            <input
                              type="number"
                              min={0}
                              className="rounded-xl border border-haze bg-white px-3 py-2 text-xs"
                              placeholder="Pin #"
                              value={pin.number}
                              onChange={(event) =>
                                handlePinNumberChange(component.name, index, event.target.value)
                              }
                            />
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-ember hover:bg-ember/10 hover:text-ember" onClick={() => handleRemovePin(component.name, index)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={() => handleAddPin(component.name)} className="mt-2 text-xs flex items-center gap-1 justify-center border-dashed">
                          <Plus className="h-3 w-3" /> Add Pin
                        </Button>
                      </div>
                    </CardContent>
                  ) : null}
                  <CardContent className="grid gap-3 border-t border-ink/10">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                        Custom variant
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleCustomForm(component.name, component.deviceType)}
                      >
                        {showCustomForm[component.name] || (variants[component.name] ?? []).length === 0
                          ? "Hide"
                          : "Add"}
                      </Button>
                    </div>
                    {(showCustomForm[component.name] || (variants[component.name] ?? []).length === 0) ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                            placeholder="Variant name"
                            value={manualForms[component.name]?.name ?? ""}
                            onChange={(event) =>
                              handleManualChange(component.name, "name", event.target.value, component.deviceType)
                            }
                          />
                          <input
                            className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                            placeholder="Category"
                            value={manualForms[component.name]?.category ?? component.deviceType}
                            onChange={(event) =>
                              handleManualChange(component.name, "category", event.target.value, component.deviceType)
                            }
                          />
                          <input
                            className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                            placeholder="Vendor URL"
                            value={manualForms[component.name]?.vendorUrl ?? ""}
                            onChange={(event) =>
                              handleManualChange(component.name, "vendorUrl", event.target.value, component.deviceType)
                            }
                          />
                          <input
                            type="number"
                            min={0}
                            className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                            placeholder="Price"
                            value={manualForms[component.name]?.price ?? ""}
                            onChange={(event) =>
                              handleManualChange(component.name, "price", event.target.value, component.deviceType)
                            }
                          />
                          <select
                            className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                            value={manualForms[component.name]?.pinType ?? "digital"}
                            onChange={(event) =>
                              handleManualChange(component.name, "pinType", event.target.value, component.deviceType)
                            }
                          >
                            <option value="digital">Digital</option>
                            <option value="analog">Analog</option>
                          </select>
                          <div className="rounded-2xl border border-haze bg-mist p-3 sm:col-span-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                                Pins
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleManualAddPin(component.name, component.deviceType)}
                              >
                                Add pin
                              </Button>
                            </div>
                            <div className="mt-3 grid gap-2">
                              {(manualForms[component.name]?.pins ?? []).map((pin, index) => (
                                <div
                                  key={`${component.name}-manual-pin-${index}`}
                                  className="grid gap-2 rounded-2xl border border-haze bg-white p-3 sm:grid-cols-[1.2fr_1fr_1fr_auto]"
                                >
                                  <input
                                    className="rounded-xl border border-haze bg-white px-3 py-2 text-xs"
                                    placeholder="Pin name"
                                    value={pin.name}
                                    onChange={(event) =>
                                      handleManualPinChange(component.name, index, "name", event.target.value)
                                    }
                                  />
                                  <select
                                    className="rounded-xl border border-haze bg-white px-3 py-2 text-xs"
                                    value={pin.pinType}
                                    onChange={(event) =>
                                      handleManualPinChange(component.name, index, "pinType", event.target.value)
                                    }
                                  >
                                    <option value="digital">Digital</option>
                                    <option value="analog">Analog</option>
                                  </select>
                                  <select
                                    className="rounded-xl border border-haze bg-white px-3 py-2 text-xs"
                                    value={pin.ioType}
                                    onChange={(event) =>
                                      handleManualPinChange(component.name, index, "ioType", event.target.value)
                                    }
                                  >
                                    <option value="input">Input</option>
                                    <option value="output">Output</option>
                                  </select>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleManualRemovePin(component.name, index)}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => handleManualSubmit(component.name, component.deviceType)}
                        >
                          Save variant
                        </Button>
                      </>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-2xl border border-ember/30 bg-white px-4 py-3 text-sm text-ember">
          {error}
        </div>
      ) : null}

      {budgetStep === "variants" ? (
        <div className="flex flex-wrap gap-4">
          <Button
            variant="accent"
            disabled={generateDisabled}
            title={generateTitle}
            onClick={handleGenerate}
          >
            {configText ? "Regenerate Config" : "Generate Config"}
          </Button>
          {configText ? (
            <Button variant="outline" onClick={downloadConfig}>
              Download Config
            </Button>
          ) : null}
        </div>
      ) : null}

      {configText ? (
        <Card className="border-ink/10 bg-white/95">
          <CardHeader>
            <CardTitle>Generated Config</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-2xl bg-mist/80 p-4 text-sm text-ink">
              {configText}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      {/* ── LLM Review Result Panel ── */}
      {llmReviewResult && (
        <Card className="border-sky-200 bg-sky-50/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-sky-600" />
                LLM BOM Review
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
                  llmReviewResult.overallScore >= 80 ? "bg-emerald-100 text-emerald-700" :
                  llmReviewResult.overallScore >= 50 ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {llmReviewResult.overallScore}/100
                </div>
                <button onClick={() => setLlmReviewResult(null)} className="text-ink/40 hover:text-ink/70">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm text-ink/70">{llmReviewResult.summary}</p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {llmReviewResult.issues.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60 mb-2">Issues</p>
                <div className="grid gap-1.5">
                  {llmReviewResult.issues.map((issue, i) => (
                    <div key={i} className={`flex items-start gap-2 rounded-xl p-2.5 text-xs ${
                      issue.severity === "error" ? "bg-red-50 text-red-800" :
                      issue.severity === "warning" ? "bg-amber-50 text-amber-800" :
                      "bg-sky-50 text-sky-800"
                    }`}>
                      {issue.severity === "error" ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> :
                       issue.severity === "warning" ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> :
                       <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                      <span><strong>{issue.component}:</strong> {issue.issue}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {llmReviewResult.suggestions.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60 mb-2">Suggestions</p>
                <div className="grid gap-1.5">
                  {llmReviewResult.suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-xl bg-emerald-50 p-2.5 text-xs text-emerald-800">
                      <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span><strong>{s.component}:</strong> {s.suggestion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => openLlmModal("review")} disabled={llmLoading}>
                Re-run Review
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setLlmReviewResult(null); openLlmModal("suggest"); }} disabled={llmLoading}>
                Get Suggestions Instead
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── LLM Suggestion Result Panel ── */}
      {llmSuggestResult && (
        <Card className="border-violet-200 bg-violet-50/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-violet-600" />
                LLM Component Suggestions
              </CardTitle>
              <button onClick={() => setLlmSuggestResult(null)} className="text-ink/40 hover:text-ink/70">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-ink/70">{llmSuggestResult.rationale}</p>
            {llmSuggestResult.estimatedTotalCost && (
              <p className="text-sm font-semibold text-violet-700 mt-1">
                Estimated total: {llmSuggestResult.estimatedTotalCost}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {llmSuggestResult.suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-violet-200 bg-white p-3 text-sm">
                  <div className="flex-1">
                    <p className="font-semibold text-ink">{s.component}</p>
                    {s.currentSelection && (
                      <p className="text-xs text-ink/50 mt-0.5">Current: {s.currentSelection}</p>
                    )}
                    <p className="text-violet-700 font-medium mt-1">{s.recommended}</p>
                    <p className="text-xs text-ink/60 mt-0.5">{s.reason}</p>
                  </div>
                  {s.estimatedPrice && (
                    <span className="shrink-0 rounded-lg bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700">
                      {s.estimatedPrice}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-3">
              <Button variant="outline" size="sm" onClick={() => openLlmModal("suggest")} disabled={llmLoading}>
                Re-generate
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setLlmSuggestResult(null); openLlmModal("review"); }} disabled={llmLoading}>
                Review Current Selections Instead
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── LLM Error ── */}
      {llmError && (
        <div className="rounded-2xl border border-ember/30 bg-white px-4 py-3 text-sm text-ember flex items-center justify-between">
          <span>{llmError}</span>
          <button onClick={() => setLlmError("")} className="text-ember/50 hover:text-ember ml-3">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── LLM API Key Modal ── */}
      {llmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-violet-600" />
                {llmAction === "review" ? "LLM BOM Review" : "LLM Suggestions"}
              </h2>
              <button onClick={() => setLlmModalOpen(false)} className="text-ink/40 hover:text-ink/70">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-ink/60 mb-4">
              {llmAction === "review"
                ? "Use your own LLM API key to review the current selections for compatibility, quality, and cost efficiency."
                : "Use your own LLM API key to get expert component suggestions for each slot in your system."}
            </p>

            <div className="grid gap-4">
              {/* Provider selector */}
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1.5">Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "gemini"    as const, label: "Gemini",           sub: "Free tier", color: "blue"    },
                    { id: "groq"      as const, label: "Groq",             sub: "Free tier", color: "orange"  },
                    { id: "anthropic" as const, label: "Claude",           sub: "Anthropic",  color: "violet"  },
                    { id: "openai"    as const, label: "GPT-4o",           sub: "OpenAI",     color: "emerald" },
                  ] as const).map((p) => {
                    const selected = llmProvider === p.id;
                    const colors: Record<string, string> = {
                      blue:    selected ? "border-blue-500 bg-blue-50 text-blue-700"       : "border-ink/10 bg-white text-ink/60 hover:border-ink/20",
                      orange:  selected ? "border-orange-500 bg-orange-50 text-orange-700" : "border-ink/10 bg-white text-ink/60 hover:border-ink/20",
                      violet:  selected ? "border-violet-500 bg-violet-50 text-violet-700" : "border-ink/10 bg-white text-ink/60 hover:border-ink/20",
                      emerald: selected ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-ink/10 bg-white text-ink/60 hover:border-ink/20",
                    };
                    return (
                      <button
                        key={p.id}
                        onClick={() => setLlmProvider(p.id)}
                        className={`rounded-xl border-2 px-3 py-2 text-left text-sm font-medium transition-colors ${colors[p.color]}`}
                      >
                        {p.label}
                        <span className="block text-[10px] font-normal opacity-60">{p.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* API key input */}
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1.5">API Key</label>
                <input
                  type="password"
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  placeholder={
                    llmProvider === "anthropic" ? "sk-ant-..." :
                    llmProvider === "openai"    ? "sk-..." :
                    llmProvider === "gemini"    ? "AIza..." :
                    "gsk_..."
                  }
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  onKeyDown={(e) => { if (e.key === "Enter" && llmApiKey.trim()) executeLlmAction(); }}
                />
                <p className="mt-1 text-[11px] text-ink/40">
                  Your key is used for this session only and never stored or sent to our servers.
                  {(llmProvider === "gemini" || llmProvider === "groq") && (
                    <span className="font-medium text-ink/60">
                      {" "}Get a free key at{" "}
                      <a
                        href={llmProvider === "gemini" ? "https://aistudio.google.com/apikey" : "https://console.groq.com"}
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-violet-600 hover:text-violet-800"
                      >
                        {llmProvider === "gemini" ? "aistudio.google.com" : "console.groq.com"}
                      </a>
                    </span>
                  )}
                </p>
              </div>

              {/* Error inside modal */}
              {llmError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{llmError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setLlmModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="accent"
                disabled={!llmApiKey.trim() || llmLoading}
                onClick={() => executeLlmAction()}
              >
                {llmLoading
                  ? "Processing..."
                  : llmAction === "review"
                    ? "Review Selections"
                    : "Generate Suggestions"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
