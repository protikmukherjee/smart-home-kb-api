/**
 * LLM Service — Review & Suggest using user-provided API keys.
 *
 * Supports:
 *   - Anthropic (Claude)
 *   - OpenAI (GPT-4o)
 *   - Google Gemini (free tier)
 *   - Groq (free tier — Llama 3 / Mixtral)
 *
 * Two main actions:
 *   1. reviewSelections  — analyse the current BOM and flag compatibility issues
 *   2. generateSuggestions — given the architecture, suggest ideal components
 *
 * API keys are held in memory only (session-scoped).  All calls go directly
 * from the **browser** to the provider's public API — no backend proxy needed.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LLMProvider = "anthropic" | "openai" | "gemini" | "groq";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string; // override default model
}

export interface ComponentSelection {
  name: string;
  deviceType: string;
  selectedVariant: string | null;   // variant name / title
  price: number | null;
  category: string | null;
  interfaces: string[];
}

export interface SystemContext {
  systemName: string;
  components: ComponentSelection[];
  constraints: {
    budgetMax?: number;
    voltage?: number;
    preferredPlatform?: string;
    requiredInterfaces?: string[];
  };
}

export interface LLMReviewResult {
  summary: string;
  issues: Array<{ component: string; issue: string; severity: "error" | "warning" | "info" }>;
  suggestions: Array<{ component: string; suggestion: string }>;
  overallScore: number; // 0-100
}

export interface LLMSuggestionResult {
  suggestions: Array<{
    component: string;
    currentSelection: string | null;
    recommended: string;
    reason: string;
    estimatedPrice?: string;
  }>;
  rationale: string;
  estimatedTotalCost?: string;
}

// ---------------------------------------------------------------------------
// Default Models
// ---------------------------------------------------------------------------

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
};

// ---------------------------------------------------------------------------
// Prompt Builders
// ---------------------------------------------------------------------------

function buildReviewPrompt(ctx: SystemContext): string {
  const componentList = ctx.components
    .map(
      (c) =>
        `- ${c.name} (${c.deviceType}): ${c.selectedVariant ?? "NOT SELECTED"}` +
        (c.price != null ? ` — $${c.price.toFixed(2)}` : "") +
        (c.interfaces.length ? ` [${c.interfaces.join(", ")}]` : "")
    )
    .join("\n");

  const constraintLines: string[] = [];
  if (ctx.constraints.budgetMax) constraintLines.push(`Budget max: $${ctx.constraints.budgetMax}`);
  if (ctx.constraints.voltage) constraintLines.push(`Target voltage: ${ctx.constraints.voltage}V`);
  if (ctx.constraints.preferredPlatform) constraintLines.push(`Preferred platform: ${ctx.constraints.preferredPlatform}`);
  if (ctx.constraints.requiredInterfaces?.length) constraintLines.push(`Required interfaces: ${ctx.constraints.requiredInterfaces.join(", ")}`);

  return `You are an expert IoT hardware engineer reviewing a Bill of Materials (BOM) for an IoT system.

System: "${ctx.systemName}"

Components selected:
${componentList}

${constraintLines.length ? "Constraints:\n" + constraintLines.join("\n") : ""}

Review the selections and respond with ONLY valid JSON (no markdown fences, no extra text) in this exact structure:
{
  "summary": "2-3 sentence overall assessment",
  "issues": [
    {"component": "component name", "issue": "description of the issue", "severity": "error|warning|info"}
  ],
  "suggestions": [
    {"component": "component name", "suggestion": "what to improve or swap"}
  ],
  "overallScore": 75
}

Focus on:
1. Voltage compatibility between components and the controller
2. Interface compatibility (I2C, SPI, GPIO availability)
3. Missing components (e.g. level shifters, pull-up resistors, power regulators)
4. Cost efficiency — are there cheaper alternatives that work just as well?
5. Component quality — are these reliable, community-proven parts?
6. Whether any selections are NOT SELECTED and need attention

overallScore: 0 = critical issues, 100 = perfect BOM. Be realistic.`;
}

function buildSuggestionPrompt(ctx: SystemContext): string {
  const componentList = ctx.components
    .map(
      (c) =>
        `- ${c.name} (${c.deviceType}): ${c.selectedVariant ? `currently "${c.selectedVariant}"` : "NO SELECTION YET"}`
    )
    .join("\n");

  const constraintLines: string[] = [];
  if (ctx.constraints.budgetMax) constraintLines.push(`Budget max: $${ctx.constraints.budgetMax}`);
  if (ctx.constraints.voltage) constraintLines.push(`Target voltage: ${ctx.constraints.voltage}V`);
  if (ctx.constraints.preferredPlatform) constraintLines.push(`Preferred platform: ${ctx.constraints.preferredPlatform}`);
  if (ctx.constraints.requiredInterfaces?.length) constraintLines.push(`Required interfaces: ${ctx.constraints.requiredInterfaces.join(", ")}`);

  return `You are an expert IoT hardware engineer. Given the system architecture below, suggest the BEST real-world component for each slot.

System: "${ctx.systemName}"

Components needed:
${componentList}

${constraintLines.length ? "Constraints:\n" + constraintLines.join("\n") : ""}

Respond with ONLY valid JSON (no markdown fences, no extra text) in this exact structure:
{
  "suggestions": [
    {
      "component": "component name from the list above",
      "currentSelection": "what is currently selected or null",
      "recommended": "exact product name (e.g. 'DHT22 Temperature & Humidity Sensor')",
      "reason": "why this is the best choice",
      "estimatedPrice": "$X.XX"
    }
  ],
  "rationale": "2-3 sentences explaining the overall selection strategy",
  "estimatedTotalCost": "$XX.XX"
}

Requirements:
- Suggest REAL, purchasable components (not generic descriptions)
- Prefer community-proven parts (ESP32 DevKit, DHT22, BH1750, HC-SR04, etc.)
- Ensure voltage compatibility (3.3V or 5V logic level)
- Ensure interface compatibility with the controller
- Stay within budget if specified
- For controllers, prefer ESP32 for WiFi-enabled IoT unless Arduino is specified`;
}

// ---------------------------------------------------------------------------
// Provider API Calls
// ---------------------------------------------------------------------------

async function callAnthropic(
  config: LLMConfig,
  prompt: string
): Promise<string> {
  const model = config.model || DEFAULT_MODELS.anthropic;

  // Anthropic requires CORS proxy or direct API call.
  // The Messages API supports browser calls if the key owner allows it.
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401) throw new Error("Invalid Anthropic API key. Please check and try again.");
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  // data.content is an array of content blocks
  const text = data.content
    ?.filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  return text || "";
}

async function callOpenAI(
  config: LLMConfig,
  prompt: string
): Promise<string> {
  const model = config.model || DEFAULT_MODELS.openai;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [
        { role: "system", content: "You are an expert IoT hardware engineer. Respond with ONLY valid JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401) throw new Error("Invalid OpenAI API key. Please check and try again.");
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callGemini(
  config: LLMConfig,
  prompt: string
): Promise<string> {
  const model = config.model || DEFAULT_MODELS.gemini;

  // Gemini uses the generativeai REST endpoint with the key as a query param
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.3,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 400 && err.includes("API_KEY_INVALID"))
      throw new Error("Invalid Gemini API key. Please check and try again.");
    throw new Error(`Gemini API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  // Gemini response: candidates[0].content.parts[0].text
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGroq(
  config: LLMConfig,
  prompt: string
): Promise<string> {
  const model = config.model || DEFAULT_MODELS.groq;

  // Groq uses an OpenAI-compatible chat completions API
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0.3,
      messages: [
        { role: "system", content: "You are an expert IoT hardware engineer. Respond with ONLY valid JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401) throw new Error("Invalid Groq API key. Please check and try again.");
    throw new Error(`Groq API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callLLM(config: LLMConfig, prompt: string): Promise<string> {
  switch (config.provider) {
    case "anthropic": return callAnthropic(config, prompt);
    case "openai":    return callOpenAI(config, prompt);
    case "gemini":    return callGemini(config, prompt);
    case "groq":      return callGroq(config, prompt);
    default:          throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// ---------------------------------------------------------------------------
// Parse helpers — handle markdown fences and garbage around JSON
// ---------------------------------------------------------------------------

function extractJSON(raw: string): string {
  // Strip markdown code fences if present
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Try to find the outermost { ... }
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1);
  }
  return raw.trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function reviewSelections(
  config: LLMConfig,
  ctx: SystemContext
): Promise<LLMReviewResult> {
  const prompt = buildReviewPrompt(ctx);
  const raw = await callLLM(config, prompt);
  try {
    const parsed = JSON.parse(extractJSON(raw));
    return {
      summary: parsed.summary ?? "No summary provided.",
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      overallScore: typeof parsed.overallScore === "number" ? parsed.overallScore : 50,
    };
  } catch {
    // If JSON parsing fails, return the raw text as summary
    return {
      summary: raw.slice(0, 500),
      issues: [],
      suggestions: [],
      overallScore: 0,
    };
  }
}

export async function generateSuggestions(
  config: LLMConfig,
  ctx: SystemContext
): Promise<LLMSuggestionResult> {
  const prompt = buildSuggestionPrompt(ctx);
  const raw = await callLLM(config, prompt);
  try {
    const parsed = JSON.parse(extractJSON(raw));
    return {
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      rationale: parsed.rationale ?? "No rationale provided.",
      estimatedTotalCost: parsed.estimatedTotalCost,
    };
  } catch {
    return {
      suggestions: [],
      rationale: raw.slice(0, 500),
    };
  }
}
