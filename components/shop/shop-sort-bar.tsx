"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { decodeHtml } from "@/lib/utils/format";
import { t } from "@/lib/i18n";
import type { CurrencySettings, WooBrand, WooCategory, WooTag } from "@/lib/woocommerce/types";
import { ShopFilterDrawer } from "@/components/shop/shop-filter-drawer";

interface SortOption {
  id: string;
  label: string;
  orderby?: string;
  order?: "asc" | "desc";
}

const SORT_OPTIONS: SortOption[] = [
  { id: "default", label: t("shop.sort.default") || "Default sorting" },
  { id: "popularity", label: t("shop.sort.popularity") || "Sort by popularity", orderby: "popularity", order: "desc" },
  { id: "rating", label: t("shop.sort.rating") || "Sort by average rating", orderby: "rating", order: "desc" },
  { id: "latest", label: t("shop.sort.latest") || "Sort by latest", orderby: "date", order: "desc" },
  { id: "price-asc", label: t("shop.sort.priceLow") || "Sort by price: low to high", orderby: "price", order: "asc" },
  { id: "price-desc", label: t("shop.sort.priceHigh") || "Sort by price: high to low", orderby: "price", order: "desc" },
];

interface ShopSortBarProps {
  searchParams: Record<string, string | undefined>;
  activeOrderby: string;
  activeOrder: string;
  onSale: boolean;
  categories: WooCategory[];
  brands: WooBrand[];
  tags: WooTag[];
  currency: CurrencySettings;
  activeCategory?: string;
  activeBrand?: string;
  activeTag?: string;
}

function formatPrice(value: string, currency: CurrencySettings) {
  const number = Number(value);
  const formatted = number.toLocaleString(undefined, {
    minimumFractionDigits: currency.minor_unit,
    maximumFractionDigits: currency.minor_unit,
  });
  return `${currency.prefix}${formatted}${currency.suffix}`;
}

export function ShopSortBar({
  searchParams,
  activeOrderby,
  activeOrder,
  onSale,
  categories,
  brands,
  tags,
  currency,
  activeCategory,
  activeBrand,
  activeTag,
}: ShopSortBarProps) {
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (!sortDropdownRef.current?.contains(event.target as Node)) setIsSortOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIsSortOpen(false);
    }
    if (isSortOpen) {
      document.addEventListener("mousedown", handleOutside);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isSortOpen]);

  function buildUrl(changes: Record<string, string | undefined | null>) {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, value);
    });
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") params.delete(key);
      else params.set(key, value);
    });
    params.delete("page");
    const query = params.toString();
    return `/shop${query ? `?${query}` : ""}`;
  }

  const selectedSort = SORT_OPTIONS.find((option) => {
    if (option.id === "default") return !searchParams.orderby && !searchParams.order;
    return option.orderby === activeOrderby && option.order === activeOrder;
  }) ?? SORT_OPTIONS[0];
  const category = categories.find((item) => item.slug === activeCategory);
  const brand = brands.find((item) => item.slug === activeBrand);
  const tag = tags.find((item) => String(item.id) === activeTag);
  const hasFilters = Boolean(
    activeCategory ||
      activeBrand ||
      activeTag ||
      onSale ||
      searchParams.min_price !== undefined ||
      searchParams.max_price !== undefined,
  );

  return (
    <div className="mb-6 border-b border-border/50 pb-4">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div className="min-w-0 justify-self-start">
          <ShopFilterDrawer
            searchParams={searchParams}
            categories={categories}
            brands={brands}
            tags={tags}
            currency={currency}
            activeCategory={activeCategory}
            activeBrand={activeBrand}
            activeTag={activeTag}
            minPrice={searchParams.min_price}
            maxPrice={searchParams.max_price}
            onSale={onSale}
          />
        </div>

        <div className="relative order-2 col-span-2 min-w-0 lg:order-2 lg:col-span-1 lg:px-3">
          {hasFilters ? (
            <div className="-mx-1 min-w-0 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0">
              <div className="flex w-max items-center gap-2 lg:w-auto lg:flex-wrap" aria-label="Applied filters">
                {activeCategory && (
                  <Link
                    href={buildUrl({ category: null })}
                    title="Remove category filter"
                    aria-label={`Remove category filter: ${decodeHtml(category?.name ?? activeCategory)}`}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-accent px-3 text-xs hover:bg-accent/70"
                  >
                    <span>Category: <strong>{decodeHtml(category?.name ?? activeCategory)}</strong></span>
                    <X className="size-3.5" aria-hidden="true" />
                  </Link>
                )}
                {(searchParams.min_price !== undefined || searchParams.max_price !== undefined) && (
                  <Link
                    href={buildUrl({ min_price: null, max_price: null })}
                    title="Remove price filter"
                    aria-label="Remove price filter"
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-[var(--gold)]/40 bg-[var(--gold-light)]/20 px-3 text-xs"
                  >
                    <span>Price: <strong>{formatPrice(searchParams.min_price ?? "0", currency)} – {formatPrice(searchParams.max_price ?? "5000", currency)}</strong></span>
                    <X className="size-3.5" aria-hidden="true" />
                  </Link>
                )}
                {activeBrand && (
                  <Link
                    href={buildUrl({ brand: null })}
                    title="Remove brand filter"
                    aria-label={`Remove brand filter: ${decodeHtml(brand?.name ?? activeBrand)}`}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-accent px-3 text-xs hover:bg-accent/70"
                  >
                    <span>Brand: <strong>{decodeHtml(brand?.name ?? activeBrand)}</strong></span>
                    <X className="size-3.5" aria-hidden="true" />
                  </Link>
                )}
                {activeTag && (
                  <Link
                    href={buildUrl({ tag: null })}
                    title="Remove tag filter"
                    aria-label={`Remove tag filter: ${decodeHtml(tag?.name ?? activeTag)}`}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-accent px-3 text-xs hover:bg-accent/70"
                  >
                    <span>Tag: <strong>{decodeHtml(tag?.name ?? activeTag)}</strong></span>
                    <X className="size-3.5" aria-hidden="true" />
                  </Link>
                )}
                {onSale && (
                  <Link
                    href={buildUrl({ on_sale: null })}
                    title="Remove sale filter"
                    aria-label="Remove on sale filter"
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-accent px-3 text-xs hover:bg-accent/70"
                  >
                    On sale<X className="size-3.5" aria-hidden="true" />
                  </Link>
                )}
                <Link
                  href={buildUrl({ category: null, brand: null, min_price: null, max_price: null, tag: null, on_sale: null })}
                  className="shrink-0 px-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Clear filters
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <div ref={sortDropdownRef} className="relative order-1 ml-auto flex shrink-0 items-center gap-2 lg:order-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">Sort by</span>
          <button
            type="button"
            onClick={() => setIsSortOpen((value) => !value)}
            className="flex h-10 min-w-[132px] items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 text-sm hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-[150px]"
            aria-expanded={isSortOpen}
            aria-haspopup="menu"
            aria-label="Sort products"
          >
            <span className="truncate">{selectedSort.label.replace(/^Sort by /, "")}</span>
            <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isSortOpen && "rotate-180")} aria-hidden="true" />
          </button>
          {isSortOpen && (
            <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-border bg-popover p-1.5 shadow-xl">
              {SORT_OPTIONS.map((option) => {
                const selected = selectedSort.id === option.id;
                return (
                  <Link
                    key={option.id}
                    href={buildUrl({ orderby: option.orderby, order: option.order })}
                    role="menuitem"
                    aria-current={selected ? "true" : undefined}
                    onClick={() => setIsSortOpen(false)}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {option.label}
                    <Check className={cn("size-4", selected ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}