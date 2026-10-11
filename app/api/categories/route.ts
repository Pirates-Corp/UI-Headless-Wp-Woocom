import { NextResponse } from "next/server";
import { getCategories } from "@/lib/woocommerce/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const hideEmpty = searchParams.get("hide_empty") === "true";
    const categories = await getCategories({ hide_empty: hideEmpty });
    // Filter out internal/uncategorized categories
    const activeCategories = categories.filter(
      (cat) => cat.slug !== "uncategorized"
    );
    return NextResponse.json({ categories: activeCategories });
  } catch (error) {
    console.error("[GET /api/categories] Error fetching categories:", error);
    return NextResponse.json({ categories: [] }, { status: 500 });
  }
}
