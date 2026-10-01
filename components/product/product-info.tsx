"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AddToCartForm } from "@/components/add-to-cart-form";
import { StarRating } from "@/components/product/star-rating";
import { formatProductPrice, decodeHtml } from "@/lib/utils/format";
import { findMatchedVariation, buildSelectionFromVariation } from "@/lib/utils/product";
import type { WooProduct } from "@/lib/woocommerce/types";
import { Truck, RotateCcw, ShieldCheck, Award } from "lucide-react";
import { t } from "@/lib/i18n";

interface ProductInfoProps {
  product: WooProduct;
  initialVariationId?: number;
  initialVariationPrices?: WooProduct["prices"];
  initialVariationInStock?: boolean;
}


export function ProductInfo({ product, initialVariationId, initialVariationPrices, initialVariationInStock }: ProductInfoProps) {
  const router = useRouter();

  const [selectedVariation, setSelectedVariation] = useState<Record<string, string>>(() => {
    if (product.type !== "variable") return {};

    if (initialVariationId) {
      const varObj = product.variations.find((v) => v.id === initialVariationId);
      if (varObj) return buildSelectionFromVariation(product, varObj);
    }

    // Server didn't provide initialVariationId; fall back to first variation.
    const first = product.variations[0];
    return first ? buildSelectionFromVariation(product, first) : {};
  });

  function handleVariationChange(attrName: string, termSlug: string) {
    const next = { ...selectedVariation, [attrName]: termSlug };
    setSelectedVariation(next);
    const matched = findMatchedVariation(product, next);
    if (matched) {
      router.push(`/product/${product.slug}/${matched.id}`, { scroll: false });
    }
  }

  const displayPrices = initialVariationPrices ?? product.prices;
  const { current, regular, onSale } = formatProductPrice(displayPrices);

  // Resolve the currently matched variation to derive per-variation stock status.
  const matchedVariation = product.type === "variable"
    ? findMatchedVariation(product, selectedVariation)
    : undefined;

  // Stock priority: matched variation (parent array) → server-fetched initialVariationInStock → parent product.
  const variationInStock =
    product.type === "variable"
      ? (matchedVariation?.is_in_stock ?? initialVariationInStock ?? product.is_in_stock)
      : product.is_in_stock;

  const divisor = Math.pow(10, displayPrices.currency_minor_unit);
  const priceAmt = parseInt(displayPrices.price) / divisor;
  const regularAmt = parseInt(displayPrices.regular_price || displayPrices.price) / divisor;
  const savingsPct =
    onSale && regularAmt > 0 ? Math.round((1 - priceAmt / regularAmt) * 100) : 0;

  return (
    <div className="space-y-5">
      {product.categories[0] && (
        <p className="text-xs tracking-[0.25em] uppercase text-[var(--gold)] font-medium">
          {decodeHtml(product.categories[0].name)}
        </p>
      )}

      <div>
        <h1 className="text-3xl md:text-4xl font-heading font-bold leading-tight mb-3">
          {decodeHtml(product.name)}
        </h1>
        <StarRating rating={product.average_rating} count={product.review_count} />
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-2xl font-bold">
          {current}
        </span>
        {onSale && (
          <>
            <span className="text-base text-muted-foreground line-through">{regular}</span>
            <Badge className="bg-[var(--gold)] text-white border-0 hover:bg-[var(--gold)] text-[10px] tracking-wider uppercase">
              {t('product.savePct')} {savingsPct}%
            </Badge>
          </>
        )}
      </div>

      {!initialVariationPrices && product.prices.price_range && (
        <p className="text-sm text-muted-foreground">
          {t('product.priceFrom')}{" "}
          {
            formatProductPrice({
              ...product.prices,
              price: product.prices.price_range.min_amount,
            }).current
          }
          {" "}–{" "}
          {
            formatProductPrice({
              ...product.prices,
              price: product.prices.price_range.max_amount,
            }).current
          }
        </p>
      )}

      {/* Stock — use variation-level stock for variable products */}
      <div className="flex items-center gap-3">
        {variationInStock ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {t('product.inStock')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />
            {t('product.outOfStock')}
          </span>
        )}
        {product.low_stock_remaining && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Only {product.low_stock_remaining} left – order soon
          </span>
        )}
      </div>

      {/* Short description */}
      {product.short_description && (
        <div
          className="text-sm text-muted-foreground leading-relaxed prose dark:prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: product.short_description }}
        />
      )}

      <Separator className="border-border/50" />

      <AddToCartForm
        product={product}
        variationId={initialVariationId}
        selectedVariation={selectedVariation}
        onVariationChange={handleVariationChange}
        variationInStock={variationInStock}
      />

      {/* Contextual policy links */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <Link
          href="/legal/shipping-policy"
          className="flex items-start gap-2 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Truck className="mt-0.5 size-4 shrink-0 text-[var(--gold)]" aria-hidden="true" />
          <span>
            <span className="block text-xs font-medium">Shipping information</span>
            <span className="block text-[11px] text-muted-foreground">View delivery details</span>
          </span>
        </Link>
        <Link
          href="/legal/returns-refunds"
          className="flex items-start gap-2 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCcw className="mt-0.5 size-4 shrink-0 text-[var(--gold)]" aria-hidden="true" />
          <span>
            <span className="block text-xs font-medium">Returns &amp; refunds</span>
            <span className="block text-[11px] text-muted-foreground">View current policy</span>
          </span>
        </Link>
        <div className="flex items-start gap-2 p-1">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--gold)]" aria-hidden="true" />
          <span>
            <span className="block text-xs font-medium">Payment options</span>
            <span className="block text-[11px] text-muted-foreground">Shown at checkout</span>
          </span>
        </div>
        <div className="flex items-start gap-2 p-1">
          <Award className="mt-0.5 size-4 shrink-0 text-[var(--gold)]" aria-hidden="true" />
          <span>
            <span className="block text-xs font-medium">Product information</span>
            <span className="block text-[11px] text-muted-foreground">Review details before ordering</span>
          </span>
        </div>
      </div>
      {/* Meta */}
      <div className="space-y-1.5 pt-1">
        {product.sku && (
          <p className="text-xs text-muted-foreground">{t('product.sku')} {product.sku}</p>
        )}
        {product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {product.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className="text-[10px] tracking-wider uppercase font-medium"
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
