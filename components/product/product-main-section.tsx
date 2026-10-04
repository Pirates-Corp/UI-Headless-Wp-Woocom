"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProductGallery } from "@/components/product-gallery";
import { ProductInfo } from "@/components/product/product-info";
import {
  findMatchedVariation,
  buildSelectionFromVariation,
  resolveNextSelection,
} from "@/lib/utils/product";
import type {
  WooProduct,
  WooProductReview,
  WooProductPrices,
  WooImage,
} from "@/lib/woocommerce/types";

export interface ProductMainSectionProps {
  product: WooProduct;
  initialVariationId?: number;
  initialVariationPrices?: WooProductPrices;
  initialVariationInStock?: boolean;
  initialVariationImage?: WooImage | null;
  reviews?: WooProductReview[];
}

export function ProductMainSection({
  product,
  initialVariationId,
  initialVariationPrices,
  initialVariationInStock,
  initialVariationImage,
  reviews = [],
}: ProductMainSectionProps) {
  const router = useRouter();

  const [selectedVariation, setSelectedVariation] = useState<
    Record<string, string>
  >(() => {
    if (product.type !== "variable") return {};

    if (initialVariationId) {
      const varObj = product.variations.find(
        (v) => v.id === initialVariationId,
      );
      if (varObj) return buildSelectionFromVariation(product, varObj);
    }

    const first = product.variations[0];
    return first ? buildSelectionFromVariation(product, first) : {};
  });

  // Sync state if initialVariationId changes (e.g. browser navigation)
  useEffect(() => {
    if (product.type === "variable" && initialVariationId) {
      const varObj = product.variations.find(
        (v) => v.id === initialVariationId,
      );
      if (varObj) {
        setSelectedVariation(buildSelectionFromVariation(product, varObj));
      }
    }
  }, [initialVariationId, product]);

  const matchedVariation = useMemo(() => {
    return product.type === "variable"
      ? findMatchedVariation(product, selectedVariation)
      : undefined;
  }, [product, selectedVariation]);

  function handleVariationChange(attrName: string, termSlug: string) {
    const next = resolveNextSelection(
      product,
      selectedVariation,
      attrName,
      termSlug,
    );
    setSelectedVariation(next);
    const matched = findMatchedVariation(product, next);
    if (matched) {
      router.push(`/product/${product.slug}/${matched.id}`, { scroll: false });
    }
  }

  // Determine active variation image:
  // 1. matchedVariation's custom image (if available)
  // 2. initialVariationImage (if provided initially)
  // 3. fallback to null (uses product images)
  const activeVariationImage = useMemo(() => {
    if (matchedVariation?.image?.src && matchedVariation.image.src.trim() !== "") {
      return matchedVariation.image;
    }
    if (initialVariationImage?.src && initialVariationImage.src.trim() !== "") {
      return initialVariationImage;
    }
    return null;
  }, [matchedVariation, initialVariationImage]);

  // Ensure variation image is part of gallery images so thumbnails and lightbox include it
  const galleryImages = useMemo(() => {
    const baseImages = (product.images || []).filter(
      (img) => Boolean(img?.src && img.src.trim() !== ""),
    );
    if (!activeVariationImage?.src) {
      return baseImages;
    }
    const exists = baseImages.some(
      (img) =>
        (img.id && activeVariationImage.id && img.id === activeVariationImage.id) ||
        img.src === activeVariationImage.src,
    );
    if (exists) {
      return baseImages;
    }
    return [activeVariationImage, ...baseImages];
  }, [product.images, activeVariationImage]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
      <ProductGallery
        images={galleryImages}
        productName={product.name}
        activeImage={activeVariationImage}
      />
      <ProductInfo
        product={product}
        initialVariationId={initialVariationId}
        initialVariationPrices={initialVariationPrices}
        initialVariationInStock={initialVariationInStock}
        reviews={reviews}
        selectedVariation={selectedVariation}
        onVariationChange={handleVariationChange}
      />
    </div>
  );
}
