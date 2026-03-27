import { NextRequest, NextResponse } from "next/server";
import {
  recommend,
  getKBStats,
  type RecommendationConstraints,
} from "@/lib/recommenderService";

/**
 * POST /api/recommend
 *
 * Accepts a JSON body with recommendation constraints and returns
 * a ranked list of matching hardware components from the KB.
 *
 * Body:
 *   {
 *     category?: string,
 *     subcategory?: string,
 *     budgetMin?: number,
 *     budgetMax?: number,
 *     voltage?: number,
 *     interfaces?: string[],
 *     keywords?: string[],
 *     limit?: number
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RecommendationConstraints;

    const result = await recommend({
      category: body.category || undefined,
      subcategory: body.subcategory || undefined,
      budgetMin: body.budgetMin ?? undefined,
      budgetMax: body.budgetMax ?? undefined,
      voltage: body.voltage ?? undefined,
      interfaces: body.interfaces?.length ? body.interfaces : undefined,
      keywords: body.keywords?.length ? body.keywords : undefined,
      limit: body.limit ?? 20,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Recommendation error:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recommend
 *
 * Returns KB statistics (categories, subcategories, price range, interfaces)
 * for populating the filter UI.
 */
export async function GET() {
  try {
    const stats = await getKBStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("KB stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch KB statistics" },
      { status: 500 }
    );
  }
}
