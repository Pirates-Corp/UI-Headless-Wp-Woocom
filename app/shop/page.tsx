import type { Metadata } from "next";
import { ShopHeader } from "@/components/shop/shop-header";
import { ShopSortBar } from "@/components/shop/shop-sort-bar";
import { ShopProductGrid } from "@/components/shop/shop-product-grid";
import { ShopPagination } from "@/components/shop/shop-pagination";
import { ShopParamsSchema } from "@/lib/validation/schemas";
import { getProductsMeta, getCategories, getCategoryBySlug, getCurrencySettings, getProductTags, getProductBrands } from "@/lib/woocommerce/api";
import { productToEcommerceItem } from "@/lib/utils/gtm-items";
import { JsonLdScript } from "@/components/analytics/json-ld-script";
import { FireGTMEvent } from "@/components/analytics/fire-gtm-event";
import { t } from "@/lib/i18n";

interface ShopPageProps {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
}

export async function generateMetadata({ searchParams }: ShopPageProps): Promise<Metadata> {
  const params = ShopParamsSchema.parse(await searchParams);
  let title = t("shop.title");
  let description = t("shop.description");

  if (params.category) {
    const cat = await getCategoryBySlug(params.category);
    if (cat) {
      title = cat.name;
      if (cat.description) {
        description = cat.description.replace(/<[^>]*>?/gm, "");
      }
    }
  } else if (params.on_sale === "true") {
    title = t("shop.onSale");
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: "/shop",
    },
  };
}

// No revalidate — searchParams access forces dynamic (SSR) rendering on every request.
export const dynamic = "force-dynamic";

export default async function ShopPage({ searchParams }: ShopPageProps) {
  // Validate and sanitise URL params — invalid values fall back to undefined
  // so child components apply their own safe defaults.
  const params = ShopParamsSchema.parse(await searchParams);
  const currentPage = parseInt(params.page ?? "1");
  const activeOrderby = params.orderby ?? "date";
  const activeOrder = params.order ?? "desc";
  const onSale = params.on_sale === "true";

  const [productsMeta, categories, activeCategory, tags, brands, currencySettings] = await Promise.all([
    getProductsMeta({
      per_page: 12,
      page: currentPage,
      orderby: activeOrderby,
      order: activeOrder as "asc" | "desc",
      on_sale: onSale || undefined,
      category: params.category,
      brand: params.brand,
      tag: params.tag,
      min_price: params.min_price,
      max_price: params.max_price,
    }),
    getCategories({ hide_empty: true }).catch(() => []),
    params.category ? getCategoryBySlug(params.category).catch(() => null) : Promise.resolve(null),
    getProductTags({ hide_empty: true }).catch(() => []),
    getProductBrands({ hide_empty: true }).catch(() => []),
    getCurrencySettings(),
  ]);

  const { products, totalPages } = productsMeta;

  const listName = onSale
    ? "On Sale"
    : activeCategory
    ? `Category: ${activeCategory.name}`
    : params.category
    ? `Category: ${params.category}`
    : "Shop";

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: (currentPage - 1) * 12 + i + 1,
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/product/${p.slug}`,
      name: p.name,
    })),
  };

  const ecommerceItems = products.map((p, i) =>
    productToEcommerceItem(p, (currentPage - 1) * 12 + i)
  );

  const currency = products[0]?.prices.currency_code ?? "USD";

  return (
    <>
      <JsonLdScript data={itemListJsonLd} />
      <FireGTMEvent
        event="view_item_list"
        params={{ item_list_name: listName, currency, items: ecommerceItems }}
        ecommerce
      />
      <div className="container mx-auto px-4 md:px-6 py-10 md:py-14">
        <ShopHeader onSale={onSale} category={activeCategory} />
        <ShopSortBar
          searchParams={params}
          activeOrderby={activeOrderby}
          activeOrder={activeOrder}
          onSale={onSale}
          categories={categories}
          activeCategory={params.category}
          activeBrand={params.brand}
          brands={brands}
          activeTag={params.tag}
          tags={tags}
          currency={currencySettings}
        />
        <ShopProductGrid products={products} searchParams={params} />
        <ShopPagination currentPage={currentPage} totalPages={totalPages} searchParams={params} />
      </div>
    </>
  );
}

