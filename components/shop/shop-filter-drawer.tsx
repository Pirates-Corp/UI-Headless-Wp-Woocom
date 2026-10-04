"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, X } from "lucide-react";
import { Slider } from "@base-ui/react/slider";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/defaultbutton";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CurrencySettings, WooBrand, WooCategory, WooTag } from "@/lib/woocommerce/types";

const PRICE_MAX = 5000;
const QUICK_RANGES = [
  { label: "Under", min: 0, max: 200 },
  { label: "200–500", min: 200, max: 500 },
  { label: "500–1,000", min: 500, max: 1000 },
  { label: "1,000–1,500", min: 1000, max: 1500 },
  { label: "1,500–2,000", min: 1500, max: 2000 },
  { label: "2,000–5,000", min: 2000, max: 5000 },
];

type PendingFilters = { min: string; max: string; category: string; brand: string; tag: string; onSale: boolean };

function money(value: number, currency: CurrencySettings) {
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: currency.minor_unit,
    maximumFractionDigits: currency.minor_unit,
  });
  return `${currency.prefix}${formatted}${currency.suffix}`;
}

function makeUrl(params: Record<string, string | undefined>, changes: Record<string, string | null>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, value);
  });
  Object.entries(changes).forEach(([key, value]) => {
    if (value === null || value === "") query.delete(key);
    else query.set(key, value);
  });
  query.delete("page");
  const serialized = query.toString();
  return `/shop${serialized ? `?${serialized}` : ""}`;
}

interface Props {
  searchParams: Record<string, string | undefined>;
  categories: WooCategory[];
  brands: WooBrand[];
  tags: WooTag[];
  currency: CurrencySettings;
  activeCategory?: string;
  activeBrand?: string;
  activeTag?: string;
  minPrice?: string;
  maxPrice?: string;
  onSale: boolean;
}

export function ShopFilterDrawer({
  searchParams, categories, brands, tags, currency, activeCategory, activeBrand, activeTag, minPrice, maxPrice, onSale,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const appliedFilters: PendingFilters = {
    min: minPrice ?? "0", max: maxPrice ?? String(PRICE_MAX), category: activeCategory ?? "", brand: activeBrand ?? "", tag: activeTag ?? "", onSale,
  };
  const appliedKey = JSON.stringify(appliedFilters);
  const [draft, setDraft] = useState({ key: appliedKey, value: appliedFilters });
  const pending = draft.key === appliedKey ? draft.value : appliedFilters;
  const [priceError, setPriceError] = useState("");
  function setPending(next: PendingFilters | ((current: PendingFilters) => PendingFilters)) {
    setDraft({ key: appliedKey, value: typeof next === "function" ? next(pending) : next });
  }

  const minNum = pending.min === "" ? 0 : Number(pending.min);
  const maxNum = pending.max === "" ? PRICE_MAX : Number(pending.max);
  const sliderRange = useMemo(() => [
    Math.min(
      Math.max(0, Math.min(PRICE_MAX, Number.isFinite(minNum) ? minNum : 0)),
      Math.max(0, Math.min(PRICE_MAX, Number.isFinite(maxNum) ? maxNum : PRICE_MAX)),
    ),
    Math.max(
      Math.max(0, Math.min(PRICE_MAX, Number.isFinite(minNum) ? minNum : 0)),
      Math.max(0, Math.min(PRICE_MAX, Number.isFinite(maxNum) ? maxNum : PRICE_MAX)),
    ),
  ] as [number, number], [minNum, maxNum]);
  const selectedQuickRange = QUICK_RANGES.find((range) => Number(pending.min) === range.min && Number(pending.max) === range.max);

  function updatePrice(min: string, max: string) {
    setPending((current) => ({ ...current, min, max }));
    setPriceError("");
  }

  function applyFilters() {
    const min = pending.min === "" ? undefined : Number(pending.min);
    const max = pending.max === "" ? undefined : Number(pending.max);
    if ((min !== undefined && (!Number.isFinite(min) || min < 0 || min > PRICE_MAX)) ||
      (max !== undefined && (!Number.isFinite(max) || max < 0 || max > PRICE_MAX))) {
      setPriceError(`Enter a price between ${money(0, currency)} and ${money(PRICE_MAX, currency)}.`);
      return;
    }
    const precision = (value: string) => value.split(".")[1]?.length ?? 0;
    if ((pending.min !== "" && precision(pending.min) > currency.minor_unit) ||
      (pending.max !== "" && precision(pending.max) > currency.minor_unit)) {
      setPriceError(`Use no more than ${currency.minor_unit} decimal places for this currency.`);
      return;
    }
    if (min !== undefined && max !== undefined && min > max) {
      setPriceError("Minimum price must be less than or equal to maximum price.");
      return;
    }

    router.push(makeUrl(searchParams, {
      min_price: min === undefined ? null : String(min),
      max_price: max === undefined ? null : String(max),
      category: pending.category || null,
      brand: pending.brand || null,
      tag: pending.tag || null,
      on_sale: pending.onSale ? "true" : null,
    }));
    setOpen(false);
  }

  function clearAll() {
    setPending({ min: "0", max: String(PRICE_MAX), category: "", brand: "", tag: "", onSale: false });
    setPriceError("");
    router.push(makeUrl(searchParams, { min_price: null, max_price: null, category: null, brand: null, tag: null, on_sale: null }));
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (nextOpen) {
        setPending({ min: minPrice ?? "0", max: maxPrice ?? String(PRICE_MAX), category: activeCategory ?? "", brand: activeBrand ?? "", tag: activeTag ?? "", onSale });
        setPriceError("");
      }
    }}>
      <SheetTrigger render={<Button type="button" variant="outline" className="h-10 border-[var(--gold)] text-foreground"><Filter aria-hidden="true" /> All Filters</Button>} />
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="inset-x-0 bottom-0 top-auto h-[min(88dvh,780px)] w-full max-w-none gap-0 rounded-t-2xl border bg-background p-0 pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:left-auto md:right-0 md:top-0 md:h-dvh md:w-[min(440px,92vw)] md:max-w-none md:rounded-none md:border-l md:border-t-0"
      >
        <SheetHeader className="flex-row items-center justify-between border-b px-5 py-4">
          <SheetTitle className="text-lg">Filters</SheetTitle>
          <SheetClose render={<button type="button" className="rounded-md p-2 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close filters"><X className="size-5" aria-hidden="true" /></button>} />
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5" aria-label="Product filters">
          <section className="border-b py-4" aria-labelledby="filter-price-title">
            <h3 id="filter-price-title" className="mb-4 font-medium">Price</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs text-muted-foreground">Minimum
                <Input aria-label="Minimum price" type="number" min="0" max={PRICE_MAX} step={10 ** -currency.minor_unit} value={pending.min} onChange={(event) => updatePrice(event.target.value, pending.max)} className="h-10 text-foreground" />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">Maximum
                <Input aria-label="Maximum price" type="number" min="0" max={PRICE_MAX} step={10 ** -currency.minor_unit} value={pending.max} onChange={(event) => updatePrice(pending.min, event.target.value)} className="h-10 text-foreground" />
              </label>
            </div>
            <div className="px-2 pt-5">
              <Slider.Root
                value={sliderRange}
                min={0}
                max={PRICE_MAX}
                step={10 ** -currency.minor_unit}
                onValueChange={(value) => updatePrice(String(value[0]), String(value[1]))}
                className="flex h-8 w-full touch-none items-center"
              >
                <Slider.Control className="relative flex h-5 w-full items-center">
                  <Slider.Track className="relative h-1 w-full rounded-full bg-border">
                    <Slider.Indicator className="absolute h-full rounded-full bg-[var(--gold)]" />
                  </Slider.Track>
                  <Slider.Thumb aria-label="Minimum price" className="size-5 rounded-full border-2 border-background bg-[var(--gold)] shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <Slider.Thumb aria-label="Maximum price" className="size-5 rounded-full border-2 border-background bg-[var(--gold)] shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </Slider.Control>
              </Slider.Root>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{money(0, currency)}</span><span>{money(PRICE_MAX, currency)}</span></div>
            </div>
            <p className="mt-5 text-sm font-medium">Quick Ranges</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {QUICK_RANGES.map((range) => {
                const isSelected = selectedQuickRange?.label === range.label;
                return <button key={range.label} type="button" aria-pressed={isSelected} onClick={() => updatePrice(String(range.min), String(range.max))} className={cn("min-h-10 rounded-full border px-3 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", isSelected ? "border-[var(--gold)] bg-[var(--gold-light)]/30 text-foreground" : "border-border hover:border-[var(--gold)]")}>{range.label === "Under" ? `Under ${money(range.max, currency)}` : `${money(range.min, currency)} – ${money(range.max, currency)}`}</button>;
              })}
            </div>
            {priceError && <p className="mt-3 text-sm text-destructive" role="alert">{priceError}</p>}
          </section>

          <section className="border-b py-4" aria-labelledby="filter-category-title">
            <label id="filter-category-title" htmlFor="shop-category" className="mb-2 block font-medium">Category</label>
            <select id="shop-category" value={pending.category} onChange={(event) => setPending((current) => ({ ...current, category: event.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">All categories</option>
              {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
            </select>
          </section>

          {brands.length > 0 && <section className="border-b py-4" aria-labelledby="filter-brand-title">
            <label id="filter-brand-title" htmlFor="shop-brand" className="mb-2 block font-medium">Brand</label>
            <select id="shop-brand" value={pending.brand} onChange={(event) => setPending((current) => ({ ...current, brand: event.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">All brands</option>
              {brands.map((brand) => <option key={brand.id} value={brand.slug}>{brand.name}</option>)}
            </select>
          </section>}
          {tags.length > 0 && <section className="border-b py-4" aria-labelledby="filter-tag-title">
            <label id="filter-tag-title" htmlFor="shop-tag" className="mb-2 block font-medium">Tag</label>
            <select id="shop-tag" value={pending.tag} onChange={(event) => setPending((current) => ({ ...current, tag: event.target.value }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">All tags</option>
              {tags.map((tag) => <option key={tag.id} value={String(tag.id)}>{tag.name}</option>)}
            </select>
          </section>}

          <label className="flex cursor-pointer items-center gap-3 py-4 font-medium">
            <input type="checkbox" checked={pending.onSale} onChange={(event) => setPending((current) => ({ ...current, onSale: event.target.checked }))} className="size-4 accent-[var(--gold)]" />
            On sale
          </label>
        </div>

        <div className="mt-auto flex gap-3 border-t bg-background px-5 py-4">
          <Button type="button" variant="outline" className="flex-1" onClick={clearAll}>Clear All</Button>
          <Button type="button" className="flex-1" onClick={applyFilters}>Apply Filters</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
