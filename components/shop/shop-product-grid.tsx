import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { buttonVariants } from "@/components/ui/defaultbutton";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { WooProduct } from "@/lib/woocommerce/types";

interface ShopProductGridProps {
  products: WooProduct[];
  searchParams: {
    page?: string;
    orderby?: string;
    order?: string;
    on_sale?: string;
    category?: string;
    brand?: string;
    tag?: string;
    min_price?: string;
    max_price?: string;
  };
}

export function ShopProductGrid({ products, searchParams }: ShopProductGridProps) {
  if (products.length === 0) {
    const hasFilter = Boolean(
      searchParams.category ||
        searchParams.brand ||
        searchParams.on_sale === "true" ||
        searchParams.min_price !== undefined || searchParams.max_price !== undefined ||
        searchParams.tag !== undefined ||
        searchParams.page
    );

    const clearParams = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && !["category", "brand", "min_price", "max_price", "tag", "on_sale", "page"].includes(key)) {
        clearParams.set(key, value);
      }
    });
    const clearHref = `/shop${clearParams.toString() ? `?${clearParams.toString()}` : ""}`;

    return (
      <div className="col-span-full text-center py-24 border border-dashed border-border/60 rounded-xl my-6">
        <p className="text-base text-muted-foreground">{t("shop.noProducts")}</p>
        {hasFilter && (
          <Link
            href={clearHref}
            className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
          >
            {t("shop.clearFilters")}
          </Link>
        )}
      </div>
    );
  }

  return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
