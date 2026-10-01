"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WooProduct } from "@/lib/woocommerce/types";
import { useCartStore } from "@/lib/store/cart-store";
import { useBuyNowStore } from "@/lib/store/buy-now-store";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/defaultbutton";
import { cn } from "@/lib/utils";
import {
  sortTerms,
  matchesAttributeName,
  resolveTermSlug,
  findMatchedVariation,
} from "@/lib/utils/product";
import {
  ShoppingCart,
  ExternalLink,
  Check,
  ShoppingBag,
  Loader2,
} from "lucide-react";
import { WishlistButton } from "@/components/wishlist-button";
import { QuantityInput } from "@/components/ui/quantity-input";
import { trackAddToCart } from "@/lib/utils/gtm-events";
import { productToEcommerceItem } from "@/lib/utils/gtm-items";
import { formatProductPrice } from "@/lib/utils/format";
import { t } from "@/lib/i18n";

interface AddToCartFormProps {
  product: WooProduct;
  /** Server-resolved variation ID — the canonical ID to add to cart. */
  variationId?: number;
  selectedVariation: Record<string, string>;
  onVariationChange: (attr: string, value: string) => void;
  /** Whether the currently selected variation is in stock (for variable products). */
  variationInStock?: boolean;
}

/**
 * For a given attribute term slug, check if it participates in at least one
 * in-stock variation. Returns undefined when no stock data is available on the
 * variations array (i.e. the Store API didn't include it), which means we
 * can't determine availability and should not show OOS styling.
 */
function isTermInStock(
  attrName: string,
  termSlug: string,
  product: WooProduct,
): boolean | undefined {
  if (!product.variations || product.variations.length === 0) return undefined;
  const hasStockData = product.variations.some(
    (v) => v.is_in_stock !== undefined,
  );
  if (!hasStockData) return undefined;

  const targetAttr = product.attributes.find((a) =>
    matchesAttributeName(a, attrName),
  );
  if (!targetAttr) return undefined;

  const matching = product.variations.filter((v) =>
    v.attributes.some((va) => {
      if (!matchesAttributeName(targetAttr, va.name)) return false;
      if (!va.value || va.value === "") return true;
      const termSlugResolved = resolveTermSlug(targetAttr, va.value);
      return termSlugResolved === termSlug;
    }),
  );
  if (!matching.length) return false;
  return matching.some(
    (v) =>
      v.is_in_stock !== false ||
      Boolean(v.is_on_backorder) ||
      Boolean(v.backorders_allowed) ||
      Boolean(product.is_on_backorder) ||
      Boolean(product.backorders_allowed) ||
      (v.stock_quantity === null ||
        v.stock_quantity === undefined ||
        v.stock_quantity > 0),
  );
}

/**
 * Resolves the candidate variation for a given attribute term based on current selection,
 * and formats its price for the Amazon-style card.
 */
function getVariationPriceForTerm(
  product: WooProduct,
  currentSelection: Record<string, string>,
  attrName: string,
  termSlug: string,
): { current: string; regular: string; onSale: boolean } | null {
  if (product.type !== "variable") return null;

  // 1. Direct candidate matching: current selection with this attribute replaced by termSlug
  const candidateSelection = { ...currentSelection, [attrName]: termSlug };
  let candidateVar = findMatchedVariation(product, candidateSelection);

  // 2. If no exact match (e.g. invalid combination or partial selection), find any variation containing this term
  if (!candidateVar && product.variations && product.variations.length > 0) {
    const targetAttr = product.attributes.find((a) =>
      matchesAttributeName(a, attrName),
    );
    if (targetAttr) {
      candidateVar = product.variations.find((v) => {
        if (!v.attributes || v.attributes.length === 0) return false;
        const va = v.attributes.find((a) =>
          matchesAttributeName(targetAttr, a.name),
        );
        if (!va) return false;
        if (!va.value || va.value === "") return true;
        return resolveTermSlug(targetAttr, va.value) === termSlug;
      });
    }
  }

  if (candidateVar?.prices) {
    return formatProductPrice(candidateVar.prices);
  }

  // Fallback to base product prices if variation prices aren't individually defined
  if (product.prices) {
    return formatProductPrice(product.prices);
  }

  return null;
}

export function AddToCartForm({
  product,
  variationId,
  selectedVariation,
  onVariationChange,
  variationInStock,
}: AddToCartFormProps) {
  const router = useRouter();
  const { addItem, openCart } = useCartStore();
  const [quantity, setQuantity] = useState(product.add_to_cart.minimum || 1);
  const [isPending, startTransition] = useTransition();
  const [isBuyNowPending, startBuyNowTransition] = useTransition();
  const [justAdded, setJustAdded] = useState(false);

  const matched =
    product.type === "variable"
      ? findMatchedVariation(product, selectedVariation)
      : undefined;

  const targetStockQuantity =
    product.type === "variable"
      ? (matched ? matched.stock_quantity : product.stock_quantity)
      : product.stock_quantity;

  const targetBackordersAllowed =
    product.type === "variable"
      ? Boolean(matched?.backorders_allowed || product.backorders_allowed)
      : Boolean(product.backorders_allowed);

  const isBackorder = Boolean(
    (product.type === "variable"
      ? (matched
          ? Boolean(
              matched.is_on_backorder ||
              (matched.stock_quantity !== null &&
                matched.stock_quantity !== undefined &&
                matched.stock_quantity <= 0 &&
                targetBackordersAllowed) ||
              (matched.stock_quantity === null && product.is_on_backorder)
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

  const min = product.add_to_cart.minimum || 1;
  const availableStock = targetBackordersAllowed
    ? (product.add_to_cart.maximum || 99)
    : (targetStockQuantity ??
      product.add_to_cart.maximum ??
      99);
  const max = Math.max(
    min,
    Math.min(product.add_to_cart.maximum || 99, availableStock),
  );

  // Use variation-level stock when available, fall back to parent product.
  const isInStock =
    isBackorder ||
    targetBackordersAllowed ||
    (product.type === "variable"
      ? (matched
          ? matched.is_in_stock !== false &&
            (matched.stock_quantity === null ||
              matched.stock_quantity === undefined ||
              matched.stock_quantity > 0)
          : (variationInStock ?? product.is_in_stock))
      : product.is_in_stock &&
        (product.stock_quantity === null ||
          product.stock_quantity === undefined ||
          product.stock_quantity > 0));

  function handleAddToCart() {
    if (product.type === "external") {
      window.open(product.external_url, "_blank", "noopener,noreferrer");
      return;
    }

    // For variable products, ensure all attributes are selected
    if (product.type === "variable" && product.attributes.length > 0) {
      const variationAttrs = product.attributes.filter((a) => a.has_variations);
      const allSelected = variationAttrs.every((attr) =>
        Boolean(selectedVariation[attr.name]),
      );
      if (!allSelected) {
        toast.error(t("product.selectAllOptions"));
        return;
      }
    }

    startTransition(async () => {
      // For variable products the Store API requires the variation's own ID.
      const matched = findMatchedVariation(product, selectedVariation);
      const targetVariationId = matched?.id ?? variationId;
      const idToAdd =
        product.type === "variable" && targetVariationId
          ? targetVariationId
          : product.id;

      const result = await addItem(idToAdd, quantity);
      if (result.error) {
        toast.error(t("product.cantAddToCart"), { description: result.error });
        router?.refresh?.();
      } else {
        trackAddToCart(
          {
            ...productToEcommerceItem(product),
            item_id: String(idToAdd),
            quantity,
          },
          product.prices.currency_code,
        );
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 2000);
        setQuantity(product.add_to_cart.minimum || 1);
        openCart();
      }
    });
  }

  function handleBuyNow() {
    if (product.type === "external") {
      window.open(product.external_url, "_blank", "noopener,noreferrer");
      return;
    }

    // For variable products, ensure all attributes are selected
    if (product.type === "variable" && product.attributes.length > 0) {
      const variationAttrs = product.attributes.filter((a) => a.has_variations);
      const allSelected = variationAttrs.every((attr) =>
        Boolean(selectedVariation[attr.name]),
      );
      if (!allSelected) {
        toast.error(t("product.selectAllOptions"));
        return;
      }
    }

    startBuyNowTransition(async () => {
      const matched = findMatchedVariation(product, selectedVariation);
      const targetVariationId = matched?.id ?? variationId;
      const idToAdd =
        product.type === "variable" && targetVariationId
          ? targetVariationId
          : product.id;

      const result = await useBuyNowStore
        .getState()
        .startBuyNow(idToAdd, quantity, undefined);

      if (result.error) {
        toast.error(t("product.cantAddToCart"), { description: result.error });
        router?.refresh?.();
      } else {
        trackAddToCart(
          {
            ...productToEcommerceItem(product),
            item_id: String(idToAdd),
            quantity,
          },
          product.prices.currency_code,
        );
        setQuantity(product.add_to_cart.minimum || 1);
        router.push("/checkout?buy_now=1");
      }
    });
  }

  // External product
  if (product.type === "external") {
    return (
      <Button size="lg" className="w-full" onClick={handleAddToCart}>
        <ExternalLink className="mr-2 h-4 w-4" />
        {product.button_text || t("product.buyProduct")}
      </Button>
    );
  }

  // Grouped product — show links to individual products
  if (product.type === "grouped") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {t("product.groupedHint")}
        </p>
        <a
          href="/shop"
          className={cn(
            buttonVariants({ size: "lg", variant: "outline" }),
            "w-full",
          )}
        >
          {t("product.browseProducts")}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Variable product options */}
      {product.type === "variable" &&
        product.attributes
          .filter((attr) => attr.has_variations)
          .map((attr, attrIdx, variationAttrs) => {
            const isLastAttr = attrIdx === variationAttrs.length - 1;
            const sorted = sortTerms(attr.terms);
            const selectedTerm = sorted.find(
              (term) => term.slug === selectedVariation[attr.name],
            );
            return (
              <div key={attr.name} className="space-y-2">
                <p className="text-sm font-normal text-foreground">
                  <span className="text-muted-foreground">{attr.name}:</span>{" "}
                  <span className="font-bold text-foreground">
                    {selectedTerm?.name ?? ""}
                  </span>
                </p>
                <div
                  className="flex flex-wrap gap-2.5"
                  role="group"
                  aria-label={`Select ${attr.name}`}
                >
                  {sorted.map((term) => {
                    const isSelected =
                      selectedVariation[attr.name] === term.slug;
                    const termStock = isTermInStock(
                      attr.name,
                      term.slug,
                      product,
                    );
                    const termIsOos = termStock === false;

                    if (!isLastAttr) {
                      return (
                        <button
                          key={term.slug}
                          type="button"
                          onClick={() => onVariationChange(attr.name, term.slug)}
                          aria-pressed={isSelected}
                          title={termIsOos ? "Out of stock" : undefined}
                          className={cn(
                            "relative flex items-center justify-center rounded-md px-3.5 py-1.5 text-sm font-medium transition-all duration-150 cursor-pointer min-h-[38px]",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                            isSelected
                              ? "border-2 border-[#007185] dark:border-sky-500 bg-[#edf5f8] dark:bg-sky-950/40 text-foreground font-bold shadow-xs"
                              : "border border-zinc-300 dark:border-zinc-700 bg-card text-foreground/90 hover:border-zinc-400 dark:hover:border-zinc-500 hover:shadow-xs",
                            termIsOos &&
                              !isSelected &&
                              "opacity-60 border-dashed bg-muted/30 text-muted-foreground",
                            termIsOos && "line-through",
                          )}
                        >
                          <span>{term.name}</span>
                        </button>
                      );
                    }

                    const priceInfo = getVariationPriceForTerm(
                      product,
                      selectedVariation,
                      attr.name,
                      term.slug,
                    );

                    return (
                      <button
                        key={term.slug}
                        type="button"
                        onClick={() => onVariationChange(attr.name, term.slug)}
                        aria-pressed={isSelected}
                        title={termIsOos ? "Out of stock" : undefined}
                        className={cn(
                          "group relative flex flex-col rounded-md text-left transition-all duration-150 overflow-hidden cursor-pointer",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                          "min-w-[105px] max-w-full",
                          isSelected
                            ? "border-2 border-[#007185] dark:border-sky-500 shadow-xs bg-card"
                            : "border border-zinc-300 dark:border-zinc-700 bg-card hover:border-zinc-400 dark:hover:border-zinc-500 hover:shadow-xs",
                          termIsOos &&
                            !isSelected &&
                            "opacity-60 border-dashed bg-muted/30",
                        )}
                      >
                        {/* Header: Term Name */}
                        <div
                          className={cn(
                            "px-3 py-1.5 text-xs sm:text-sm font-bold border-b transition-colors",
                            isSelected
                              ? "bg-[#edf5f8] dark:bg-sky-950/40 text-foreground border-[#007185]/20 dark:border-sky-500/30"
                              : "bg-muted/30 dark:bg-muted/20 text-foreground/90 border-border/60 group-hover:bg-muted/50",
                            termIsOos && "line-through text-muted-foreground",
                          )}
                        >
                          <span className="truncate block">{term.name}</span>
                        </div>

                        {/* Body: Price Information */}
                        <div className="px-3 py-2 flex flex-col justify-center min-h-[46px]">
                          {priceInfo ? (
                            <>
                              <span
                                className={cn(
                                  "text-sm font-bold tracking-tight",
                                  isSelected
                                    ? "text-foreground"
                                    : "text-foreground/90 group-hover:text-foreground",
                                  termIsOos &&
                                    "text-muted-foreground font-normal",
                                )}
                              >
                                {priceInfo.current}
                              </span>
                              {priceInfo.onSale &&
                                priceInfo.regular &&
                                priceInfo.current !== priceInfo.regular && (
                                  <span className="text-[11px] text-muted-foreground line-through leading-tight">
                                    {priceInfo.regular}
                                  </span>
                                )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground font-normal">
                              {termIsOos ? t("product.outOfStock") : "—"}
                            </span>
                          )}

                          {termIsOos && (
                            <span className="text-[10px] text-destructive font-medium mt-0.5">
                              {t("product.outOfStock")}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

      {/* Quantity */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">
          {t("product.quantity")}
        </label>
        <QuantityInput
          value={quantity}
          min={min}
          max={max}
          onDecrement={() => setQuantity(Math.max(min, quantity - 1))}
          onIncrement={() => setQuantity(Math.min(max, quantity + 1))}
        />
      </div>

      {/* Actions: Add to Cart + Buy Now + Wishlist */}
      <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
        <div className="flex items-center gap-2.5 flex-1 w-full">
          <Button
            size="lg"
            variant="outline"
            className="flex-1 h-11 sm:h-12 transition-all border-border hover:border-foreground/40 font-semibold text-sm sm:text-base rounded-xl shadow-xs"
            onClick={handleAddToCart}
            disabled={
              !product.is_purchasable ||
              !isInStock ||
              isPending ||
              isBuyNowPending
            }
            aria-live="polite"
          >
            {justAdded ? (
              <>
                <Check className="mr-2 h-4 w-4 text-emerald-500" />
                {t("product.added")}
              </>
            ) : isPending ? (
              <>
                <ShoppingCart className="mr-2 h-4 w-4 animate-bounce" />
                {t("product.adding")}
              </>
            ) : !isInStock ? (
              t("product.outOfStock")
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                {t("product.addToCart")}
              </>
            )}
          </Button>

          <div className="sm:hidden shrink-0">
            <WishlistButton
              product={product}
              className="h-11 w-11 rounded-xl border border-border hover:border-foreground/40 shrink-0 bg-background hover:bg-accent flex items-center justify-center shadow-xs"
            />
          </div>
        </div>

        <Button
          size="lg"
          className="w-full sm:flex-1 h-11 sm:h-12 transition-all bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm sm:text-base rounded-xl shadow-sm"
          onClick={handleBuyNow}
          disabled={
            !product.is_purchasable ||
            !isInStock ||
            isPending ||
            isBuyNowPending
          }
        >
          {isBuyNowPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("product.buyingNow")}
            </>
          ) : (
            <>
              <ShoppingBag className="mr-2 h-4 w-4" />
              {t("product.buyNow")}
            </>
          )}
        </Button>

        <div className="hidden sm:block shrink-0">
          <WishlistButton
            product={product}
            className="h-11 sm:h-12 w-11 sm:w-12 rounded-xl border border-border hover:border-foreground/40 shrink-0 bg-background hover:bg-accent flex items-center justify-center shadow-xs"
          />
        </div>
      </div>
    </div>
  );
}
