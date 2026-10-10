import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, getVariationData } from "@/lib/woocommerce/api";
import { stripHtml } from "@/lib/utils/format";
import { ProductPageLayout } from "@/components/product/product-page-layout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ slug: string; variationId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await getProduct(slug);
    const description = stripHtml(
      product.short_description || product.description
    ).slice(0, 160);
    return {
      title: product.name,
      description,
      alternates: { canonical: `/product/${slug}` },
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

export default async function ProductVariationPage({ params }: Props) {
  const { slug, variationId } = await params;

  let product;
  try {
    product = await getProduct(slug);
  } catch {
    notFound();
  }

  const vid = parseInt(variationId, 10);
  if (isNaN(vid) || !product.variations.some((v) => v.id === vid)) {
    notFound();
  }

  const matchedVar = product.variations.find((v) => v.id === vid);
  // Reviews are fetched inside <ProductReviewsSection> (streamed), not here.
  const variationData = matchedVar?.prices ? null : await getVariationData(product.id, vid);

  const prices = matchedVar?.prices || variationData?.prices || undefined;
  const inStock = matchedVar?.is_in_stock ?? variationData?.is_in_stock ?? product.is_in_stock;
  const image = matchedVar?.image || variationData?.image || null;

  return (
    <ProductPageLayout
      product={product}
      initialVariationId={vid}
      initialVariationPrices={prices}
      initialVariationInStock={inStock}
      initialVariationImage={image}
    />
  );
}

