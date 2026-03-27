"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlobalNavbar } from "@/components/GlobalNavbar";
import { fetchReplacementSuggestions, type ReplacementSuggestion } from "@/lib/faultEngine";

const API_URL = process.env.NEXT_PUBLIC_DEV_API_URL ?? "http://localhost:4001";

type KnowledgebaseVariant = {
  _id: string;
  type: string;
  name: string;
  price: number;
  category?: string;
  vendorUrl?: string;
  pinType: string;
  componentId: string;
  pins?: Array<{ pinType: string; ioType: string; name: string }>;
};

type ExistingSelection = {
  componentName: string;
  variantId: string;
  pinType: string;
  componentId: string;
  variantSnapshot?: unknown;
  pins?: Array<{ pinType: string; ioType: string; name: string; number: number }>;
};

type SystemDetailResponse = {
  id: string;
  name: string;
  components: Array<{ id: string; name: string; deviceType: string }>;
  selections: ExistingSelection[];
};

export default function FaultReplacementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const systemName = searchParams.get("systemName") ?? "";
  const componentName = searchParams.get("componentName") ?? "";
  const sourceSystemId = searchParams.get("sourceSystemId") ?? "";
  const componentType = searchParams.get("componentType") ?? "";

  const [variants, setVariants] = useState<KnowledgebaseVariant[]>([]);
  const [isLoadingVariants, setIsLoadingVariants] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [pinNumber, setPinNumber] = useState("1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [generatedConfig, setGeneratedConfig] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<ReplacementSuggestion[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Auto-fetch AI replacement suggestions from KB on mount
  useEffect(() => {
    if (!componentName) return;
    setIsLoadingAi(true);
    fetchReplacementSuggestions(componentName, componentType || undefined)
      .then((suggestions) => setAiSuggestions(suggestions))
      .catch(() => setAiSuggestions([]))
      .finally(() => setIsLoadingAi(false));
  }, [componentName, componentType]);

  useEffect(() => {
    const loadVariants = async () => {
      if (!componentType) {
        setIsLoadingVariants(false);
        setError("Missing component type for replacement.");
        return;
      }

      try {
        setError("");
        setIsLoadingVariants(true);
        const response = await fetch(
          `${API_URL}/api/knowledgebase/variants?type=${encodeURIComponent(componentType)}`
        );

        if (!response.ok) {
          throw new Error("Unable to load replacement components from knowledgebase.");
        }

        const data = (await response.json()) as KnowledgebaseVariant[];
        setVariants(data);
        if (data.length > 0) {
          setSelectedVariantId(data[0]._id);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load replacement components from knowledgebase."
        );
      } finally {
        setIsLoadingVariants(false);
      }
    };

    loadVariants();
  }, [componentType]);

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant._id === selectedVariantId),
    [variants, selectedVariantId]
  );

  const handleGenerateUpdatedConfig = async () => {
    if (!sourceSystemId || !componentName || !selectedVariant) {
      setError("Missing replacement details.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setMessage("");

    try {
      let targetSystemId = sourceSystemId;
      let systemResponse = await fetch(`${API_URL}/api/systems/${targetSystemId}`);

      if (!systemResponse.ok) {
        const listResponse = await fetch(`${API_URL}/api/runtime/systems`);
        if (listResponse.ok) {
          const list = await listResponse.json() as { id: string, name: string, sourceSystemId?: string }[];
          const match = list.find(s => s.name === systemName || s.sourceSystemId === sourceSystemId);
          if (match) {
            targetSystemId = match.sourceSystemId || match.id;
            systemResponse = await fetch(`${API_URL}/api/systems/${targetSystemId}`);
          }
        }
      }

      if (!systemResponse.ok) {
        throw new Error("Unable to load current system selections.");
      }

      const system = (await systemResponse.json()) as SystemDetailResponse;
      const nextSelections: ExistingSelection[] = [...(system.selections ?? [])];

      const parsedPinNumber = Number(pinNumber);
      const basePinNumber = Number.isFinite(parsedPinNumber) && parsedPinNumber > 0 ? parsedPinNumber : 1;

      const replacementPins =
        selectedVariant.pins && selectedVariant.pins.length > 0
          ? selectedVariant.pins.map((pin, index) => ({
            pinType: pin.pinType ?? selectedVariant.pinType ?? "digital",
            ioType: pin.ioType ?? "input",
            name: pin.name ?? `${componentName}_pin_${index + 1}`,
            number: basePinNumber + index
          }))
          : [
            {
              pinType: selectedVariant.pinType ?? "digital",
              ioType: "input",
              name: `${componentName}_pin`,
              number: basePinNumber
            }
          ];

      const replacementSelection: ExistingSelection = {
        componentName,
        variantId: selectedVariant._id,
        variantSnapshot: selectedVariant,
        pinType: selectedVariant.pinType,
        componentId: selectedVariant.componentId,
        pins: replacementPins
      };

      const existingIndex = nextSelections.findIndex(
        (selection) => selection.componentName === componentName
      );

      if (existingIndex >= 0) {
        nextSelections[existingIndex] = replacementSelection;
      } else {
        nextSelections.push(replacementSelection);
      }

      const saveSelectionsResponse = await fetch(`${API_URL}/api/systems/${targetSystemId}/selections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections: nextSelections })
      });

      if (!saveSelectionsResponse.ok) {
        const payload = await saveSelectionsResponse.json().catch(() => null);
        throw new Error(payload?.message ?? "Unable to save replacement selection.");
      }

      const generateConfigResponse = await fetch(`${API_URL}/api/systems/${targetSystemId}/config`, {
        method: "POST"
      });

      if (!generateConfigResponse.ok) {
        const payload = await generateConfigResponse.json().catch(() => null);
        throw new Error(payload?.message ?? "Unable to generate updated config.");
      }

      const text = await generateConfigResponse.text();
      setGeneratedConfig(text);

      setMessage("Replacement applied and updated config generated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate updated config.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-mist/70">
      <GlobalNavbar />
      <div className="space-y-6 pt-8 pb-12 w-full max-w-4xl px-8 mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">Fault Replacement</p>
            <h1 className="font-display text-2xl text-ink">Replace Faulty Component</h1>
          </div>
          <Button variant="outline" onClick={() => router.push("/")}>Back to Dashboard</Button>
        </div>

        <Card className="border-ink/10 bg-white/95">
          <CardHeader>
            <CardTitle>Fault Context</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div><strong>System:</strong> {systemName || "Unknown"}</div>
            <div><strong>Component:</strong> {componentName || "Unknown"}</div>
            <div><strong>Component Type:</strong> {componentType || "Unknown"}</div>
            <div><strong>Source System ID:</strong> {sourceSystemId || "Unknown"}</div>
          </CardContent>
        </Card>

        {/* AI-Powered KB Suggestions */}
        <Card className="border-violet-200 bg-violet-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <svg className="h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
              AI Replacement Suggestions
            </CardTitle>
            <p className="text-sm text-ink/60 mt-1">
              Recommendations from the IoT Knowledge Base for replacing <strong>{componentName}</strong>
            </p>
          </CardHeader>
          <CardContent>
            {isLoadingAi ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Searching knowledge base for replacements...</p>
            ) : aiSuggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No AI suggestions found for this component type.</p>
            ) : (
              <div className="space-y-2">
                {aiSuggestions.map((sug, idx) => (
                  <div
                    key={sug.id}
                    className={`flex items-center justify-between rounded-xl border p-3 text-sm transition-colors ${
                      idx === 0
                        ? "border-violet-300 bg-violet-50"
                        : "border-ink/10 bg-white"
                    }`}
                  >
                    <div className="flex-1">
                      <p className="font-semibold">
                        {idx === 0 && <span className="text-violet-600 mr-1">★</span>}
                        {sug.title}
                      </p>
                      <p className="text-xs text-ink/60 mt-0.5">
                        {sug.category}/{sug.subcategory}
                        {sug.price !== null && ` · $${sug.price.toFixed(2)}`}
                        {` · Score: ${sug.score}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      {sug.purchaseUrl && (
                        <a
                          href={sug.purchaseUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-violet-200 px-2 py-1 text-xs text-violet-600 hover:bg-violet-100"
                        >
                          Buy
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-ink/10 bg-white/95">
          <CardHeader>
            <CardTitle>Replacement Selection</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {isLoadingVariants ? (
              <p className="text-sm text-muted-foreground">Loading replacement components...</p>
            ) : variants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No replacement variants found in knowledgebase.</p>
            ) : (
              <>
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Variant</label>
                  <select
                    className="rounded-xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                    value={selectedVariantId}
                    onChange={(event) => setSelectedVariantId(event.target.value)}
                  >
                    {variants.map((variant) => (
                      <option key={variant._id} value={variant._id}>
                        {variant.name} · ${variant.price} · {variant.pinType}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedVariant ? (
                  <div className="rounded-xl border border-ink/10 bg-mist/50 p-3 text-xs">
                    <p><strong>Category:</strong> {selectedVariant.category ?? "N/A"}</p>
                    <p><strong>Component ID:</strong> {selectedVariant.componentId}</p>
                    <p><strong>Pins:</strong> {selectedVariant.pins?.map((pin) => pin.name).join(", ") || "default pin"}</p>
                    {selectedVariant.vendorUrl ? (
                      <p><strong>Vendor:</strong> {selectedVariant.vendorUrl}</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">Start Pin Number</label>
                  <input
                    type="number"
                    min={1}
                    className="rounded-xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                    value={pinNumber}
                    onChange={(event) => setPinNumber(event.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="accent"
                    disabled={isGenerating || !selectedVariantId}
                    onClick={handleGenerateUpdatedConfig}
                  >
                    {isGenerating ? "Generating..." : "Generate Updated Config"}
                  </Button>
                  <Badge variant="outline">Only faulty component is replaced</Badge>
                </div>
              </>
            )}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {message ? <p className="text-sm text-green-600">{message}</p> : null}

            {generatedConfig && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-ink mb-3">Generated Configuration</h3>
                <div className="relative rounded-xl border border-ink/10 bg-[#0f111a] p-4 overflow-hidden">
                  <pre className="overflow-x-auto text-xs font-mono leading-relaxed text-zinc-300">
                    <code>{generatedConfig}</code>
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
