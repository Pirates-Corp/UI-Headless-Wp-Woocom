"use server";

import { getCategories } from "@/lib/woocommerce/api";
import type { WooCategory } from "@/lib/woocommerce/types";

export async function getShopCategoriesAction(): Promise<WooCategory[]> {
  try {
    const categories = await getCategories({ hide_empty: false });
    return categories.filter(
      (cat) => cat.slug !== "uncategorized"
    );
  } catch (error) {
    console.error("[getShopCategoriesAction] Failed to load categories:", error);
    return [];
  }
}
