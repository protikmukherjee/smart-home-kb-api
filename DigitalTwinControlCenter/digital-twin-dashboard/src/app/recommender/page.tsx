"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlobalNavbar } from "@/components/GlobalNavbar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecommendedComponent {
  id: string;
  title: string;
  type: string;
  category: string;
  subcategory: string;
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

interface RecommendationResult {
  components: RecommendedComponent[];
  totalCandidates: number;
  appliedFilters: string[];
  elapsed: number;
}

interface KBStats {
  totalParts: number;
  categories: Record<string, number>;
  subcategories: Record<string, string[]>;
  priceRange: { min: number; max: number };
  interfaces: string[];
}

interface SystemDevice {
  name: string;
  deviceType: string;
  componentType: string;
  controllerName: string;
}

interface ComponentRecommendation {
  device: SystemDevice;
  recommendations: RecommendedComponent[];
  selectedIndex: number;
}

interface SystemBuildResult {
  systemName: string;
  components: ComponentRecommendation[];
  totalBudget: number | null;
  elapsed: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_INTERFACES = [
  "I2C", "SPI", "UART", "GPIO", "ADC", "DAC", "PWM", "OneWire",
  "BLE", "WiFi", "USB", "HDMI", "Ethernet", "CAN", "Serial", "NFC", "RFID",
];

const SAMPLE_SYSTEM_JSON = `{
  "systems": [
    {
      "name": "Smart Plant Monitor",
      "type": "Component_System",
      "physical entities": [
        {
          "name": "Plant Station",
          "controllers": [
            {
              "name": "ESP32 Controller",
              "logic unit": "Plant_Monitor",
              "devices": [
                {
                  "device type": "sensor",
                  "name": "Soil Moisture Sensor",
                  "type": "Soil_Moisture_Sensor"
                },
                {
                  "device type": "sensor",
                  "name": "Temperature Sensor",
                  "type": "Temperature_Sensor"
                },
                {
                  "device type": "actuator",
                  "name": "Water Pump",
                  "type": "Pump"
                }
              ],
              "network devices": [
                {
                  "name": "WiFi Module",
                  "type": "WiFi"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}`;

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function RecommenderPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<"build" | "search">("build");

  // KB stats
  const [stats, setStats] = useState<KBStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // === BUILD SYSTEM TAB STATE ===
  const [jsonInput, setJsonInput] = useState("");
  const [systemBudget, setSystemBudget] = useState("");
  const [systemVoltage, setSystemVoltage] = useState("");
  const [buildResult, setBuildResult] = useState<SystemBuildResult | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");
  const [enrichedConfig, setEnrichedConfig] = useState<string | null>(null);
  const [originalJson, setOriginalJson] = useState<Record<string, unknown> | null>(null);

  // === SEARCH TAB STATE ===
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [voltage, setVoltage] = useState("");
  const [selectedInterfaces, setSelectedInterfaces] = useState<string[]>([]);
  const [keywords, setKeywords] = useState("");
  const [resultLimit, setResultLimit] = useState(20);
  const [searchResult, setSearchResult] = useState<RecommendationResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // === LLM STATE ===
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [llmUserPrompt, setLlmUserPrompt] = useState("");
  const [llmReview, setLlmReview] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");

  // Expanded card
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load KB stats
  useEffect(() => {
    fetch("/api/recommend")
      .then((r) => r.json())
      .then((d: KBStats) => setStats(d))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  const availableSubcategories = useMemo(() => {
    if (!stats || !category) return [];
    return stats.subcategories[category] ?? [];
  }, [stats, category]);

  useEffect(() => setSubcategory(""), [category]);

  // ==========================================================================
  // BUILD SYSTEM HANDLERS
  // ==========================================================================

  const handleBuildSystem = useCallback(async () => {
    setBuildError("");
    setBuildResult(null);
    setEnrichedConfig(null);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonInput);
    } catch {
      setBuildError("Invalid JSON. Please paste a valid system JSON.");
      return;
    }

    setOriginalJson(parsed);
    setIsBuilding(true);

    try {
      const response = await fetch("/api/recommend/build-system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemJson: parsed,
          budget: systemBudget ? parseFloat(systemBudget) : undefined,
          voltage: systemVoltage ? parseFloat(systemVoltage) : undefined,
        }),
      });

      if (!response.ok) throw new Error("Build request failed.");
      const data = (await response.json()) as SystemBuildResult;
      setBuildResult(data);
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : "Build failed.");
    } finally {
      setIsBuilding(false);
    }
  }, [jsonInput, systemBudget, systemVoltage]);

  const handleChangeSelection = useCallback(
    (compIndex: number, recIndex: number) => {
      if (!buildResult) return;
      const next = { ...buildResult };
      next.components = [...next.components];
      next.components[compIndex] = {
        ...next.components[compIndex],
        selectedIndex: recIndex,
      };
      // Recalculate total budget
      let total: number | null = 0;
      for (const c of next.components) {
        const pick = c.recommendations[c.selectedIndex];
        if (pick?.price != null) {
          total! += pick.price;
        } else {
          total = null;
          break;
        }
      }
      next.totalBudget = total;
      setBuildResult(next);
      setEnrichedConfig(null);
    },
    [buildResult]
  );

  const handleGenerateConfig = useCallback(async () => {
    if (!buildResult || !originalJson) return;

    try {
      const response = await fetch("/api/recommend/build-system", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemJson: originalJson,
          components: buildResult.components,
        }),
      });
      if (!response.ok) throw new Error("Config generation failed.");
      const data = await response.json();
      setEnrichedConfig(JSON.stringify(data.config, null, 2));
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : "Config generation failed.");
    }
  }, [buildResult, originalJson]);

  const handleLoadSample = useCallback(() => {
    setJsonInput(SAMPLE_SYSTEM_JSON);
  }, []);

  // ==========================================================================
  // SEARCH HANDLERS
  // ==========================================================================

  const toggleInterface = useCallback((iface: string) => {
    setSelectedInterfaces((prev) =>
      prev.includes(iface) ? prev.filter((i) => i !== iface) : [...prev, iface]
    );
  }, []);

  const handleSearch = useCallback(async () => {
    setIsSearching(true);
    setSearchError("");
    setSearchResult(null);
    try {
      const body: Record<string, unknown> = { limit: resultLimit };
      if (category) body.category = category;
      if (subcategory) body.subcategory = subcategory;
      if (budgetMin) body.budgetMin = parseFloat(budgetMin);
      if (budgetMax) body.budgetMax = parseFloat(budgetMax);
      if (voltage) body.voltage = parseFloat(voltage);
      if (selectedInterfaces.length > 0) body.interfaces = selectedInterfaces;
      if (keywords.trim()) body.keywords = keywords.trim().split(/\s+/);

      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Search failed.");
      setSearchResult((await response.json()) as RecommendationResult);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setIsSearching(false);
    }
  }, [category, subcategory, budgetMin, budgetMax, voltage, selectedInterfaces, keywords, resultLimit]);

  // ==========================================================================
  // LLM REVIEW (works for both tabs)
  // ==========================================================================

  const llmComponents = useMemo(() => {
    if (activeTab === "build" && buildResult) {
      return buildResult.components
        .map((c) => c.recommendations[c.selectedIndex])
        .filter(Boolean);
    }
    if (activeTab === "search" && searchResult) {
      return searchResult.components;
    }
    return [];
  }, [activeTab, buildResult, searchResult]);

  const handleLLMReview = useCallback(async () => {
    if (!llmApiKey.trim()) { setLlmError("Please enter your API key."); return; }
    if (llmComponents.length === 0) { setLlmError("No components to review."); return; }
    setLlmLoading(true); setLlmError(""); setLlmReview("");
    try {
      const response = await fetch("/api/recommend/llm-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: llmApiKey, provider: llmProvider,
          model: llmModel || undefined,
          components: llmComponents,
          constraints: { budget: systemBudget || budgetMax, voltage: systemVoltage || voltage },
          userPrompt: llmUserPrompt || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "LLM review failed.");
      setLlmReview(data.review);
    } catch (err) {
      setLlmError(err instanceof Error ? err.message : "LLM review failed.");
    } finally { setLlmLoading(false); }
  }, [llmApiKey, llmProvider, llmModel, llmUserPrompt, llmComponents, systemBudget, budgetMax, systemVoltage, voltage]);

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  function renderComponentCard(comp: RecommendedComponent, idx: number) {
    const isExpanded = expandedId === comp.id;
    return (
      <div key={comp.id + idx} className="rounded-xl border border-ink/10 bg-white/90 p-4 transition hover:border-ink/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-mist text-xs font-bold text-ink/60">{idx + 1}</span>
            <div>
              <p className="text-sm font-semibold text-ink">{comp.title}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">{comp.category}/{comp.subcategory}</Badge>
                {comp.interfaces.map((i) => <Badge key={i} variant="secondary" className="text-[10px]">{i}</Badge>)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div>
              <p className="text-sm font-bold text-ink">{comp.price !== null ? `$${comp.price.toFixed(2)}` : "N/A"}</p>
              <p className="text-[10px] text-ink/50">Score: {comp.score}</p>
            </div>
            {comp.purchaseUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={comp.purchaseUrl} target="_blank" rel="noreferrer">Buy</a>
              </Button>
            )}
          </div>
        </div>
        {(comp.voltageRange.min !== null || comp.voltageRange.max !== null) && (
          <p className="mt-2 text-xs text-ink/60">
            Voltage: {comp.voltageRange.min !== null && comp.voltageRange.max !== null
              ? `${comp.voltageRange.min}V – ${comp.voltageRange.max}V`
              : comp.voltageRange.min !== null ? `≥ ${comp.voltageRange.min}V` : `≤ ${comp.voltageRange.max}V`}
          </p>
        )}
        {comp.matchReasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {comp.matchReasons.slice(0, 5).map((r, ri) => (
              <span key={ri} className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">{r}</span>
            ))}
          </div>
        )}
        <button type="button" className="mt-2 text-xs text-ink/50 hover:text-ink/80 transition" onClick={() => setExpandedId(isExpanded ? null : comp.id)}>
          {isExpanded ? "Hide details ▲" : "Show details ▼"}
        </button>
        {isExpanded && (
          <div className="mt-3 rounded-lg border border-ink/5 bg-mist/40 p-3 text-xs text-ink/70">
            {comp.description && <p className="mb-2">{comp.description}</p>}
            {Object.keys(comp.hardwareSpecs).length > 0 && (
              <div className="mt-2">
                <p className="font-semibold text-ink/80">Hardware Specs:</p>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-[11px]">{JSON.stringify(comp.hardwareSpecs, null, 2)}</pre>
              </div>
            )}
            <p className="mt-2 text-[10px] text-ink/40">KB Path: {comp.id}</p>
          </div>
        )}
      </div>
    );
  }

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================

  return (
    <div className="min-h-screen bg-mist/70">
      <GlobalNavbar />
      <div className="mx-auto w-full max-w-7xl space-y-6 px-6 pb-12 pt-8">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">ARC-Twin</p>
            <h1 className="font-display text-2xl text-ink">Hardware Recommender</h1>
          </div>
          {stats && !statsLoading && (
            <span className="rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink/70">
              {stats.totalParts.toLocaleString()} components in KB
            </span>
          )}
        </header>

        {/* Tab Switcher */}
        <div className="flex gap-1 rounded-xl border border-ink/10 bg-white/80 p-1 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("build")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeTab === "build" ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}
          >
            Build System
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeTab === "search" ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}
          >
            Search Components
          </button>
        </div>

        {/* ================================================================ */}
        {/* BUILD SYSTEM TAB                                                 */}
        {/* ================================================================ */}
        {activeTab === "build" && (
          <>
            {/* JSON Input */}
            <Card className="border-ink/10 bg-white/95">
              <CardHeader>
                <CardTitle>Import System JSON</CardTitle>
                <p className="mt-1 text-xs text-ink/60">
                  Paste your ArchML system JSON below. The recommender will analyze each component and suggest matching hardware from the knowledge base.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4">
                <textarea
                  className="min-h-[200px] rounded-xl border border-ink/20 bg-white/90 p-3 font-mono text-xs leading-relaxed"
                  placeholder="Paste your system JSON here..."
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Total Budget ($ CAD)</label>
                    <input type="number" min={0} step="0.01" className="h-10 rounded-xl border border-ink/20 bg-white/90 px-3 text-sm" placeholder="Optional" value={systemBudget} onChange={(e) => setSystemBudget(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Operating Voltage (V)</label>
                    <input type="number" min={0} step="0.1" className="h-10 rounded-xl border border-ink/20 bg-white/90 px-3 text-sm" placeholder="e.g. 5.0" value={systemVoltage} onChange={(e) => setSystemVoltage(e.target.value)} />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button className="h-10 rounded-xl bg-ink px-6 text-white hover:bg-ink/90" onClick={handleBuildSystem} disabled={isBuilding || !jsonInput.trim()}>
                      {isBuilding ? "Building..." : "Build System"}
                    </Button>
                    <Button variant="outline" className="h-10 rounded-xl" onClick={handleLoadSample}>
                      Load Sample
                    </Button>
                  </div>
                </div>
                {buildError && <p className="text-sm text-red-600">{buildError}</p>}
              </CardContent>
            </Card>

            {/* Build Results */}
            {buildResult && (
              <Card className="border-ink/10 bg-white/95">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>System: {buildResult.systemName}</CardTitle>
                      <p className="mt-1 text-xs text-ink/60">
                        {buildResult.components.length} components · Recommended in {buildResult.elapsed}ms
                        {buildResult.totalBudget !== null && (
                          <> · Estimated total: <strong>${buildResult.totalBudget.toFixed(2)} CAD</strong></>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="h-9 rounded-xl text-xs" onClick={handleGenerateConfig}>
                        Generate Config
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-5">
                  {buildResult.components.map((comp, compIdx) => {
                    const selected = comp.recommendations[comp.selectedIndex];
                    const hasRecs = comp.recommendations.length > 0;

                    return (
                      <div key={comp.device.name + compIdx} className="rounded-2xl border border-ink/10 bg-mist/30 p-4">
                        {/* Device header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white">
                              {compIdx + 1}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-ink">{comp.device.name}</p>
                              <p className="text-[10px] text-ink/50">
                                {comp.device.deviceType} · {comp.device.componentType} · Controller: {comp.device.controllerName}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {comp.recommendations.length} options found
                          </Badge>
                        </div>

                        {!hasRecs ? (
                          <p className="text-xs text-ink/50 italic">
                            No matching components found in the KB for this device type.
                          </p>
                        ) : (
                          <>
                            {/* Variant selector */}
                            <div className="mb-3">
                              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/50">
                                Selected Hardware
                              </label>
                              <select
                                className="w-full rounded-xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                                value={comp.selectedIndex}
                                onChange={(e) => handleChangeSelection(compIdx, Number(e.target.value))}
                              >
                                {comp.recommendations.map((rec, ri) => (
                                  <option key={rec.id} value={ri}>
                                    {rec.title} — {rec.price !== null ? `$${rec.price.toFixed(2)}` : "N/A"} — Score: {rec.score}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Selected component details */}
                            {selected && (
                              <div className="rounded-xl border border-ink/10 bg-white/90 p-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold text-ink">{selected.title}</p>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      <Badge variant="outline" className="text-[10px]">{selected.category}/{selected.subcategory}</Badge>
                                      {selected.interfaces.map((i) => <Badge key={i} variant="secondary" className="text-[10px]">{i}</Badge>)}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-ink">{selected.price !== null ? `$${selected.price.toFixed(2)}` : "N/A"}</p>
                                    {selected.purchaseUrl && (
                                      <a href={selected.purchaseUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline">
                                        Buy →
                                      </a>
                                    )}
                                  </div>
                                </div>
                                {selected.matchReasons.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {selected.matchReasons.slice(0, 4).map((r, ri) => (
                                      <span key={ri} className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">{r}</span>
                                    ))}
                                  </div>
                                )}
                                {selected.description && (
                                  <p className="mt-2 text-xs text-ink/60 line-clamp-2">{selected.description}</p>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Enriched Config Output */}
            {enrichedConfig && (
              <Card className="border-ink/10 bg-white/95">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Generated Configuration</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(enrichedConfig);
                      }}
                    >
                      Copy JSON
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-ink/10 bg-[#0f111a] p-4 overflow-hidden">
                    <pre className="max-h-[500px] overflow-auto text-xs font-mono leading-relaxed text-zinc-300">
                      <code>{enrichedConfig}</code>
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ================================================================ */}
        {/* SEARCH COMPONENTS TAB                                            */}
        {/* ================================================================ */}
        {activeTab === "search" && (
          <>
            <Card className="border-ink/10 bg-white/95">
              <CardHeader>
                <CardTitle>Constraints</CardTitle>
                <p className="mt-1 text-xs text-ink/60">Specify requirements to find matching components.</p>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Category</label>
                    <select className="h-10 rounded-xl border border-ink/20 bg-white/90 px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="">All categories</option>
                      {stats && Object.entries(stats.categories).sort(([, a], [, b]) => b - a).map(([cat, count]) => (
                        <option key={cat} value={cat}>{cat} ({count})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Subcategory</label>
                    <select className="h-10 rounded-xl border border-ink/20 bg-white/90 px-3 text-sm" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} disabled={!category}>
                      <option value="">All subcategories</option>
                      {availableSubcategories.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Operating Voltage (V)</label>
                    <input type="number" step="0.1" min={0} className="h-10 rounded-xl border border-ink/20 bg-white/90 px-3 text-sm" placeholder="e.g. 3.3 or 5.0" value={voltage} onChange={(e) => setVoltage(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Min Budget ($)</label>
                    <input type="number" min={0} step="0.01" className="h-10 rounded-xl border border-ink/20 bg-white/90 px-3 text-sm" placeholder="0.00" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Max Budget ($)</label>
                    <input type="number" min={0} step="0.01" className="h-10 rounded-xl border border-ink/20 bg-white/90 px-3 text-sm" placeholder="100.00" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} />
                  </div>
                  <div className="col-span-2 grid gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Keywords</label>
                    <input className="h-10 rounded-xl border border-ink/20 bg-white/90 px-3 text-sm" placeholder="e.g. temperature DHT waterproof" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Interfaces</label>
                  <div className="flex flex-wrap gap-2">
                    {KNOWN_INTERFACES.map((iface) => (
                      <button key={iface} type="button" onClick={() => toggleInterface(iface)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selectedInterfaces.includes(iface) ? "border-ink bg-ink text-white" : "border-ink/20 bg-white text-ink/70 hover:border-ink/40"}`}>
                        {iface}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Results</label>
                    <select className="h-10 rounded-xl border border-ink/20 bg-white/90 px-3 text-sm" value={resultLimit} onChange={(e) => setResultLimit(Number(e.target.value))}>
                      {[10, 20, 50, 100].map((n) => <option key={n} value={n}>Top {n}</option>)}
                    </select>
                  </div>
                  <Button className="h-10 rounded-xl bg-ink px-6 text-white hover:bg-ink/90" onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? "Searching..." : "Find Components"}
                  </Button>
                </div>
                {searchError && <p className="text-sm text-red-600">{searchError}</p>}
              </CardContent>
            </Card>

            {searchResult && (
              <Card className="border-ink/10 bg-white/95">
                <CardHeader>
                  <CardTitle>Recommendations ({searchResult.components.length})</CardTitle>
                  <p className="mt-1 text-xs text-ink/60">
                    Searched {searchResult.totalCandidates.toLocaleString()} components in {searchResult.elapsed}ms
                    {searchResult.appliedFilters.length > 0 && <> · Filters: {searchResult.appliedFilters.join(", ")}</>}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {searchResult.components.length === 0 ? (
                    <div className="rounded-xl border border-ink/10 bg-mist/60 px-4 py-6 text-center text-sm text-ink/70">No components match your constraints.</div>
                  ) : (
                    searchResult.components.map((comp, idx) => renderComponentCard(comp, idx))
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ================================================================ */}
        {/* AI HARDWARE ADVISOR (shared)                                     */}
        {/* ================================================================ */}
        {llmComponents.length > 0 && (
          <Card className="border-ink/10 bg-white/95">
            <CardHeader>
              <CardTitle>AI Hardware Advisor</CardTitle>
              <p className="mt-1 text-xs text-ink/60">
                Get expert analysis of the {activeTab === "build" ? "selected hardware" : "recommendations"} using your own LLM API key. Your key is never stored.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Provider</label>
                  <select className="h-10 rounded-xl border border-ink/20 bg-white/90 px-3 text-sm" value={llmProvider} onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">API Key</label>
                  <input type="password" className="h-10 rounded-xl border border-ink/20 bg-white/90 px-3 text-sm" placeholder={llmProvider === "openai" ? "sk-..." : "sk-ant-..."} value={llmApiKey} onChange={(e) => setLlmApiKey(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Model (optional)</label>
                  <input className="h-10 rounded-xl border border-ink/20 bg-white/90 px-3 text-sm" placeholder={llmProvider === "openai" ? "gpt-4o-mini" : "claude-sonnet-4-20250514"} value={llmModel} onChange={(e) => setLlmModel(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Additional question (optional)</label>
                <textarea className="min-h-[60px] rounded-xl border border-ink/20 bg-white/90 px-3 py-2 text-sm" placeholder="e.g. Are there any compatibility issues? What about power consumption?" value={llmUserPrompt} onChange={(e) => setLlmUserPrompt(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <Button className="h-10 rounded-xl bg-ink px-6 text-white hover:bg-ink/90" onClick={handleLLMReview} disabled={llmLoading}>
                  {llmLoading ? "Analyzing..." : "Get AI Review"}
                </Button>
                {llmLoading && <span className="text-xs text-ink/50">This may take 10–20 seconds...</span>}
              </div>
              {llmError && <p className="text-sm text-red-600">{llmError}</p>}
              {llmReview && (
                <div className="rounded-xl border border-ink/10 bg-mist/50 p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">AI Analysis</h3>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink/80">{llmReview}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
