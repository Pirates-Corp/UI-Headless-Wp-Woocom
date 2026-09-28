"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { ChevronDown, Check, X, Tag } from "lucide-react";
import type { WooCategory } from "@/lib/woocommerce/types";

interface SortOption {
  id: string;
  label: string;
  orderby?: string;
  order?: "asc" | "desc";
}

const SORT_OPTIONS: SortOption[] = [
  { id: "default", label: t("shop.sort.default") || "Default sorting", orderby: undefined, order: undefined },
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
  categories?: WooCategory[];
  activeCategory?: string;
}

export function ShopSortBar({
  searchParams,
  activeOrderby,
  activeOrder,
  onSale,
  categories = [],
  activeCategory,
}: ShopSortBarProps) {
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSortOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSortOpen(false);
      }
    }

    if (isSortOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSortOpen]);

  function buildUrl(changes: Record<string, string | undefined | null>) {
    const p = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v !== undefined && v !== "") {
        p.set(k, v);
      }
    });
    Object.entries(changes).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") {
        p.delete(k);
      } else {
        p.set(k, v);
      }
    });
    // Reset page to 1 whenever filters or sorting change
    if (!changes.page) {
      p.delete("page");
    }
    const qs = p.toString();
    return `/shop${qs ? `?${qs}` : ""}`;
  }

  // Determine current active sort option
  const currentOption =
    SORT_OPTIONS.find((opt) => {
      if (!searchParams.orderby && opt.id === "default") return true;
      if (
        searchParams.orderby === opt.orderby &&
        (opt.order === undefined || searchParams.order === opt.order)
      ) {
        return true;
      }
      return false;
    }) ?? SORT_OPTIONS[0];

  const activeCategoryObj = categories.find((c) => c.slug === activeCategory);
  const hasActiveFilters = Boolean(activeCategory || onSale || (searchParams.orderby && searchParams.orderby !== "date"));

  return (
    <div className="space-y-4 mb-8 pb-6 border-b border-border/50">
      {/* Main Bar: Categories on Left, Sale + Sort Dropdown on Right */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Category Navigation Pills */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none min-w-0">
            <span className="text-xs text-muted-foreground tracking-wider uppercase shrink-0 mr-1 font-medium">
              Category:
            </span>
            <Link
              href={buildUrl({ category: null })}
              className={cn(
                "text-xs px-3.5 py-1.5 rounded-full border transition-all duration-200 shrink-0 font-medium",
                !activeCategory
                  ? "bg-foreground text-background border-foreground shadow-xs"
                  : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
              )}
            >
              All
            </Link>
            {categories.map((cat) => {
              const isCatActive = activeCategory === cat.slug;
              return (
                <Link
                  key={cat.id}
                  href={buildUrl({ category: isCatActive ? null : cat.slug })}
                  className={cn(
                    "text-xs px-3.5 py-1.5 rounded-full border transition-all duration-200 shrink-0 flex items-center gap-1.5",
                    isCatActive
                      ? "bg-foreground text-background border-foreground font-medium shadow-xs"
                      : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
                  )}
                >
                  <span>{cat.name}</span>
                  {cat.count !== undefined && (
                    <span
                      className={cn(
                        "text-[10px] opacity-70",
                        isCatActive ? "text-background/80" : "text-muted-foreground"
                      )}
                    >
                      ({cat.count})
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* Right: Show Sale Only + Sort Dropdown */}
        <div className="flex items-center gap-2.5 shrink-0 ml-auto md:ml-0">
          {/* Sale toggle */}
          {!onSale ? (
            <Link
              href={buildUrl({ on_sale: "true" })}
              className="text-xs px-3.5 py-2 rounded-lg border border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground transition-colors shrink-0 flex items-center gap-1.5"
            >
              <Tag className="h-3.5 w-3.5 opacity-70" />
              <span>{t("shop.showSaleOnly")}</span>
            </Link>
          ) : (
            <Link
              href={buildUrl({ on_sale: null })}
              className="text-xs px-3.5 py-2 rounded-lg border border-[var(--gold)] text-[var(--gold)] bg-[var(--gold-light)]/15 hover:bg-[var(--gold-light)]/25 transition-colors shrink-0 flex items-center gap-1.5 font-medium"
            >
              <Tag className="h-3.5 w-3.5" />
              <span>{t("shop.clearOnSale")}</span>
              <X className="h-3 w-3 ml-0.5" />
            </Link>
          )}

          {/* Sort Dropdown Menu */}
          <div className="relative" ref={sortDropdownRef}>
            <button
              type="button"
              onClick={() => setIsSortOpen((prev) => !prev)}
              className={cn(
                "flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 border min-w-[170px] sm:min-w-[200px] cursor-pointer",
                isSortOpen
                  ? "bg-accent border-foreground/30 text-foreground shadow-xs"
                  : "border-border bg-background hover:bg-accent/60 text-foreground hover:border-foreground/40"
              )}
              aria-expanded={isSortOpen}
              aria-haspopup="listbox"
              aria-label="Sort products"
            >
              <span className="truncate">{currentOption.label}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
                  isSortOpen && "rotate-180 text-foreground"
                )}
              />
            </button>

            {/* Dropdown Menu List */}
            {isSortOpen && (
              <div
                role="listbox"
                className="absolute right-0 mt-1.5 w-56 sm:w-60 origin-top-right rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md p-1.5 shadow-xl ring-1 ring-black/5 dark:ring-white/10 z-50 animate-in fade-in-0 zoom-in-95 duration-150"
              >
                {SORT_OPTIONS.map((opt) => {
                  const isSelected = currentOption.id === opt.id;
                  return (
                    <Link
                      key={opt.id}
                      href={buildUrl({ orderby: opt.orderby, order: opt.order })}
                      onClick={() => setIsSortOpen(false)}
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm transition-colors group cursor-pointer",
                        isSelected
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Filter Chips / Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
            Active filters:
          </span>
          {activeCategory && (
            <Link
              href={buildUrl({ category: null })}
              className="inline-flex items-center gap-1.5 text-xs bg-accent hover:bg-accent/80 text-foreground px-2.5 py-1 rounded-md border border-border transition-colors"
              title="Remove category filter"
            >
              <span>Category: <strong>{activeCategoryObj?.name || activeCategory}</strong></span>
              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </Link>
          )}
          {onSale && (
            <Link
              href={buildUrl({ on_sale: null })}
              className="inline-flex items-center gap-1.5 text-xs bg-[var(--gold-light)]/20 hover:bg-[var(--gold-light)]/30 text-[var(--gold)] px-2.5 py-1 rounded-md border border-[var(--gold)]/30 transition-colors"
              title="Remove sale filter"
            >
              <span><strong>On Sale</strong></span>
              <X className="h-3 w-3" />
            </Link>
          )}
          {searchParams.orderby && searchParams.orderby !== "date" && (
            <Link
              href={buildUrl({ orderby: null, order: null })}
              className="inline-flex items-center gap-1.5 text-xs bg-accent hover:bg-accent/80 text-foreground px-2.5 py-1 rounded-md border border-border transition-colors"
              title="Reset sort to default"
            >
              <span>Sort: <strong>{currentOption.label}</strong></span>
              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </Link>
          )}
          <Link
            href="/shop"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 ml-1"
          >
            Clear all
          </Link>
        </div>
      )}
    </div>
  );
}
