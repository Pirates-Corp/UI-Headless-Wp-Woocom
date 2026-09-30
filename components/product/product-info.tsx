"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AddToCartForm } from "@/components/add-to-cart-form";
import { StarRating } from "@/components/product/star-rating";
import { formatProductPrice, decodeHtml } from "@/lib/utils/format";
import {
  findMatchedVariation,
  buildSelectionFromVariation,
  resolveNextSelection,
} from "@/lib/utils/product";
import type { WooProduct, WooProductReview } from "@/lib/woocommerce/types";
import { Truck, RotateCcw, ShieldCheck, Award, Info } from "lucide-react";
import { t } from "@/lib/i18n";

interface ProductInfoProps {
  product: WooProduct;
  initialVariationId?: number;
  initialVariationPrices?: WooProduct["prices"];
  initialVariationInStock?: boolean;
  reviews?: WooProductReview[];
  selectedVariation?: Record<string, string>;
  onVariationChange?: (attrName: string, termSlug: string) => void;
}

export function ProductInfo({
  product,
  initialVariationId,
  initialVariationPrices,
  initialVariationInStock,
  reviews = [],
  selectedVariation: controlledSelectedVariation,
  onVariationChange: controlledOnVariationChange,
}: ProductInfoProps) {
  const router = useRouter();

  const effectiveRating = useMemo(() => {
    if (reviews && reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
      return (sum / reviews.length).toFixed(1);
    }
    return product.average_rating || "0";
  }, [reviews, product.average_rating]);

  const effectiveCount = reviews && reviews.length > 0
    ? reviews.length
    : product.review_count || 0;

  const [internalSelectedVariation, setInternalSelectedVariation] = useState<Record<string, string>>(() => {
    if (product.type !== "variable") return {};

    if (initialVariationId) {
      const varObj = product.variations.find((v) => v.id === initialVariationId);
      if (varObj) return buildSelectionFromVariation(product, varObj);
    }

    // Server didn't provide initialVariationId; fall back to first variation.
    const first = product.variations[0];
    return first ? buildSelectionFromVariation(product, first) : {};
  });

  const selectedVariation = controlledSelectedVariation ?? internalSelectedVariation;

  // Resolve the currently matched variation to derive prices, stock, and ID in real-time
  const matchedVariation = useMemo(() => {
    return product.type === "variable"
      ? findMatchedVariation(product, selectedVariation)
      : undefined;
  }, [product, selectedVariation]);

  const activeVariationId = matchedVariation?.id ?? initialVariationId;

  function handleVariationChange(attrName: string, termSlug: string) {
    if (controlledOnVariationChange) {
      controlledOnVariationChange(attrName, termSlug);
      return;
    }
    const next = resolveNextSelection(product, selectedVariation, attrName, termSlug);
    setInternalSelectedVariation(next);
    const matched = findMatchedVariation(product, next);
    if (matched) {
      router.push(`/product/${product.slug}/${matched.id}`, { scroll: false });
    }
  }

  // Priority: matched variation prices → server initialVariationPrices → parent product prices
  const displayPrices = matchedVariation?.prices ?? initialVariationPrices ?? product.prices;
  const { current, regular, onSale } = formatProductPrice(displayPrices);

  const targetStockQuantity =
    product.type === "variable"
      ? (matchedVariation ? matchedVariation.stock_quantity : product.stock_quantity)
      : product.stock_quantity;

  const targetBackordersAllowed =
    product.type === "variable"
      ? Boolean(matchedVariation?.backorders_allowed || product.backorders_allowed)
      : Boolean(product.backorders_allowed);

  const isOnBackorder = Boolean(
    (product.type === "variable"
      ? (matchedVariation
          ? Boolean(
              matchedVariation.is_on_backorder ||
              (matchedVariation.stock_quantity !== null &&
                matchedVariation.stock_quantity !== undefined &&
                matchedVariation.stock_quantity <= 0 &&
                targetBackordersAllowed) ||
              (matchedVariation.stock_quantity === null && product.is_on_backorder)
            )
          : Boolean(product.is_on_backorder))
      : Boolean(
          product.is_on_backorder ||
          (product.stock_quantity !== null &&
            product.stock_quantity !== undefined &&
            product.stock_quantity <= 0 &&
            product.backorders_allowed)
        )) &&
    (targetStockQuantity === null ||
      targetStockQuantity === undefined ||
      targetStockQuantity <= 0)
  );

  // Stock priority: matched variation → server-fetched initialVariationInStock → parent product
  const variationInStock =
    isOnBackorder ||
    targetBackordersAllowed ||
    (product.type === "variable"
      ? (matchedVariation
          ? matchedVariation.is_in_stock !== false &&
            (matchedVariation.stock_quantity === null ||
              matchedVariation.stock_quantity === undefined ||
              matchedVariation.stock_quantity > 0)
          : (initialVariationInStock ?? product.is_in_stock))
      : product.is_in_stock &&
        (product.stock_quantity === null ||
          product.stock_quantity === undefined ||
          product.stock_quantity > 0));

  const lowStockRemaining =
    !isOnBackorder && product.type === "variable"
      ? matchedVariation
        ? (matchedVariation.low_stock_remaining ??
          (matchedVariation.stock_quantity !== null &&
          matchedVariation.stock_quantity !== undefined &&
          matchedVariation.stock_quantity > 0 &&
          matchedVariation.stock_quantity <= 3
            ? matchedVariation.stock_quantity
            : null))
        : product.low_stock_remaining
      : (!isOnBackorder ? product.low_stock_remaining : null);

  const divisor = Math.pow(10, displayPrices.currency_minor_unit);
  const priceAmt = parseInt(displayPrices.price) / divisor;
  const regularAmt = parseInt(displayPrices.regular_price || displayPrices.price) / divisor;
  const savingsPct =
    onSale && regularAmt > priceAmt ? Math.round((1 - priceAmt / regularAmt) * 100) : 0;

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
        <StarRating rating={effectiveRating} count={effectiveCount} />
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-2xl font-bold">
          {current}
        </span>
        {onSale && savingsPct > 0 && (
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
      <div className="space-y-2.5">
        <div className="flex items-center gap-3">
          {isOnBackorder ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              Available on backorder
            </span>
          ) : variationInStock ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              {t('product.inStock')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" />
              {t('product.outOfStock')}
            </span>
          )}
          {!isOnBackorder && variationInStock && lowStockRemaining !== null && lowStockRemaining !== undefined && lowStockRemaining > 0 && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Only {lowStockRemaining} {lowStockRemaining === 1 ? "item" : "items"} left – order soon
            </span>
          )}
        </div>

        {isOnBackorder && (
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <span>
              This item is currently on backorder. You can place your order now, and it will be fulfilled and dispatched as soon as new stock is available.
            </span>
          </div>
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
        variationId={activeVariationId}
        selectedVariation={selectedVariation}
        onVariationChange={handleVariationChange}
        variationInStock={variationInStock}
      />

      {/* Trust badges */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        {([
          { Icon: Truck, label: t('product.freeShipping'), sub: t('product.freeShippingSub') },
          { Icon: RotateCcw, label: t('product.returns'), sub: t('product.returnsSub') },
          { Icon: ShieldCheck, label: t('product.secureCheckout'), sub: t('product.secureCheckoutSub') },
          { Icon: Award, label: t('product.authenticity'), sub: t('product.authenticitySub') },
        ] as const).map(({ Icon, label, sub }) => (
          <div key={label} className="flex items-start gap-2">
            <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[var(--gold)]" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium">{label}</p>
              <p className="text-[11px] text-muted-foreground">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Meta */}
      <div className="space-y-1.5 pt-1">
        {(matchedVariation?.sku || product.sku) && (
          <p className="text-xs text-muted-foreground">{t('product.sku')} {matchedVariation?.sku || product.sku}</p>
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
