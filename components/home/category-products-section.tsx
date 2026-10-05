import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCategories, getProducts } from "@/lib/woocommerce/api";
import { decodeHtml } from "@/lib/utils/format";
import { CategoryProductCard } from "@/components/home/category-product-card";

export async function CategoryProductsSection() {
  const allCategories = await getCategories({ hide_empty: false }).catch(() => []);
  const categories = allCategories.filter((c) => c.slug !== "uncategorized");

  // Fetch top 4 products for each category in parallel
  const categorySections = await Promise.all(
    categories.map(async (cat) => {
      const products = await getProducts({
        category: cat.slug,
        per_page: 4,
      }).catch(() => []);
      return { category: cat, products };
    })
  );

  // Filter out any section with 0 products if needed
  const visibleSections = categorySections.filter((s) => s.products.length > 0);

  if (visibleSections.length === 0) {
    return null;
  }

  return (
    <section className="w-full bg-[#f8f2dc] py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-brand-brown/15">
      <div className="max-w-7xl mx-auto space-y-16 sm:space-y-20">
        {visibleSections.map(({ category: cat, products }) => {
          // Format category title matching design
          const rawName = decodeHtml(cat.name);
          const headingTitle =
            cat.slug === "home-decor" && !rawName.toLowerCase().includes("product")
              ? `${rawName} Products`
              : rawName;

          return (
            <div key={cat.id} className="space-y-6">
              {/* Category Header Row */}
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-serif text-3xl sm:text-4xl text-[#4a3821] font-medium tracking-tight">
                  {headingTitle}
                </h3>
                <Link
                  href={`/shop?category=${encodeURIComponent(cat.slug)}`}
                  className="group inline-flex items-center gap-1.5 text-sm font-medium text-[#4a3821] hover:text-black transition-colors"
                >
                  <span>View All</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>

              {/* Horizontal Divider Line */}
              <div className="border-b border-[#dfcfad] w-full" />

              {/* 4 Products Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 pt-2">
                {products.map((product) => (
                  <CategoryProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default CategoryProductsSection;
