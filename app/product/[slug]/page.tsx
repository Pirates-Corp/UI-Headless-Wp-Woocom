import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, getProducts, getVariationData, getProductReviewsFromServer } from "@/lib/woocommerce/api";
import type { WooProduct } from "@/lib/woocommerce/types";
import { sortTerms } from "@/lib/utils/product";
import { stripHtml } from "@/lib/utils/format";
import { ProductPageLayout } from "@/components/product/product-page-layout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  image?: WooProduct["images"][0] | null;
} | null> {
  if (
    (!product.is_in_stock &&
      !product.is_on_backorder &&
      !product.backorders_allowed) ||
    product.type !== "variable" ||
    !product.variations.length
  ) {
    return null;
  }

  // Pick first in-stock or backordered variation, or fallback to the first available variation
  const inStockVar = product.variations.find(
    (v) =>
      v.is_in_stock !== false ||
      Boolean(v.is_on_backorder) ||
      Boolean(v.backorders_allowed) ||
      Boolean(product.is_on_backorder) ||
      Boolean(product.backorders_allowed),
  );
  const chosenVar = inStockVar || product.variations[0];
  if (!chosenVar) return null;

  let prices = chosenVar.prices;
  let isInStock =
    chosenVar.is_in_stock ??
    (Boolean(chosenVar.is_on_backorder) ||
      Boolean(chosenVar.backorders_allowed) ||
      Boolean(product.is_on_backorder) ||
      Boolean(product.backorders_allowed) ||
      true);
  let image = chosenVar.image ?? null;

  if (!prices) {
    const varData = await getVariationData(product.id, chosenVar.id);
    if (varData) {
      prices = varData.prices ?? undefined;
      isInStock =
        varData.is_in_stock ||
        Boolean(varData.is_on_backorder) ||
        Boolean(varData.backorders_allowed) ||
        Boolean(product.is_on_backorder) ||
        Boolean(product.backorders_allowed);
      image = varData.image ?? null;
    }
  }

  return {
    variationId: chosenVar.id,
    prices,
    isInStock,
    image,
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
      initialVariationImage={initialVariation?.image}
      reviews={reviews}
    />
  );
}
