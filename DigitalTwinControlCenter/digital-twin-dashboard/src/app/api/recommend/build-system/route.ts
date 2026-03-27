import { NextRequest, NextResponse } from "next/server";
import {
  buildSystem,
  generateEnrichedConfig,
  type ComponentRecommendation,
} from "@/lib/recommenderService";

/**
 * POST /api/recommend/build-system
 *
 * Accepts a system JSON (ArchML format) and returns hardware recommendations
 * for every component in the system.
 *
 * Body:
 *   {
 *     systemJson: object,    // The full system JSON
 *     budget?: number,       // Optional total budget in CAD
 *     voltage?: number       // Optional operating voltage (e.g., 5.0)
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.systemJson || typeof body.systemJson !== "object") {
      return NextResponse.json(
        { error: "systemJson is required and must be a JSON object." },
        { status: 400 }
      );
    }

    const result = await buildSystem(body.systemJson, {
      budget: body.budget ?? undefined,
      voltage: body.voltage ?? undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Build system error:", error);
    return NextResponse.json(
      { error: "Failed to build system recommendations" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/recommend/build-system
 *
 * Generates an enriched config JSON with the selected hardware injected.
 *
 * Body:
 *   {
 *     systemJson: object,
 *     components: ComponentRecommendation[]
 *   }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.systemJson || !body.components) {
      return NextResponse.json(
        { error: "systemJson and components are required." },
        { status: 400 }
      );
    }

    const enriched = generateEnrichedConfig(
      body.systemJson as Record<string, unknown>,
      body.components as ComponentRecommendation[]
    );

    return NextResponse.json({ config: enriched });
  } catch (error) {
    console.error("Config generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate enriched config" },
      { status: 500 }
    );
  }
}
