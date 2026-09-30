import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, getProducts, getVariationData, getProductReviewsFromServer } from "@/lib/woocommerce/api";
import type { WooProduct } from "@/lib/woocommerce/types";
import { sortTerms } from "@/lib/utils/product";
import { stripHtml } from "@/lib/utils/format";
import { ProductPageLayout } from "@/components/product/product-page-layout";

export const revalidate = 3600;

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await getProduct(slug);
    const description = stripHtml(
      product.short_description || product.description
    ).slice(0, 160);
    return {
      title: product.name,
      description,
      openGraph: {
        title: product.name,
        description,
        images: product.images[0]
          ? [{ url: product.images[0].src, width: 1200, height: 1500, alt: product.name }]
          : [],
      },
    };
  } catch {
    return { title: "Product Not Found" };
  }
}

export async function generateStaticParams() {
  try {
    const allSlugs: { slug: string }[] = [];
    let page = 1;
    while (true) {
      const products = await getProducts({ per_page: 100, page });
      if (!products.length) break;
      allSlugs.push(...products.map((p) => ({ slug: p.slug })));
      if (products.length < 100) break;
      page++;
    }
    return allSlugs;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * For variable products, walk the sorted variations sequentially and return
 * the first in-stock one's data. Falls back to the first variation if all are
 * OOS. Returns null for non-variable or OOS parent products.
 */
async function resolveInitialVariation(product: WooProduct): Promise<{
  variationId: number;
  prices: WooProduct["prices"] | undefined;
  isInStock: boolean;
} | null> {
  if (!product.is_in_stock || product.type !== "variable" || !product.variations.length) {
    return null;
  }

  // Pick first in-stock variation, or fallback to the first available variation
  const inStockVar = product.variations.find((v) => v.is_in_stock !== false);
  const chosenVar = inStockVar || product.variations[0];
  if (!chosenVar) return null;

  let prices = chosenVar.prices;
  let isInStock = chosenVar.is_in_stock ?? true;

  if (!prices) {
    const varData = await getVariationData(product.id, chosenVar.id);
    if (varData) {
      prices = varData.prices ?? undefined;
      isInStock = varData.is_in_stock;
    }
  }

  return {
    variationId: chosenVar.id,
    prices,
    isInStock,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  let product;
  try {
    product = await getProduct(slug);
  } catch {
    notFound();
  }

  const [initialVariation, reviews] = await Promise.all([
    resolveInitialVariation(product),
    getProductReviewsFromServer({ productId: product.id }),
  ]);

  return (
    <ProductPageLayout
      product={product}
      initialVariationId={initialVariation?.variationId}
      initialVariationPrices={initialVariation?.prices}
      initialVariationInStock={initialVariation?.isInStock}
      reviews={reviews}
    />
  );
}
