import Link from "next/link";
import Image from "next/image";
import { getCategories } from "@/lib/woocommerce/api";
import { decodeHtml } from "@/lib/utils/format";

export async function CategoriesSection() {
  const rawCategories = await getCategories({ hide_empty: false }).catch(() => []);
  const categories = rawCategories.filter((cat) => cat.slug !== "uncategorized");

  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="w-full bg-[#0a0a0a] py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-neutral-900">
      <div className="max-w-5xl mx-auto">
        {/* Section Heading */}
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-white font-normal tracking-wide">
            Shop by Category
          </h2>
          <div className="w-16 h-0.5 bg-[#c8a97e] mx-auto mt-4 mb-10 sm:mb-12" />
        </div>

        {/* Dynamic Category Cards using WooCommerce Images */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/shop?category=${encodeURIComponent(cat.slug)}`}
              className="group bg-white rounded-3xl p-6 sm:p-8 flex items-center gap-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              {/* Circular Badge with WordPress WooCommerce Category Image */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#fdf3d6] p-1.5 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300 shadow-inner">
                <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-[#f5ebdb] relative">
                  {cat.image?.src ? (
                    <Image
                      src={cat.image.src}
                      alt={cat.image.alt || decodeHtml(cat.name)}
                      width={120}
                      height={120}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-serif font-bold text-xl text-[#4c3b28]">
                      {cat.name.slice(0, 1)}
                    </span>
                  )}
                </div>
              </div>

              {/* Category Title */}
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl sm:text-3xl font-serif font-medium text-neutral-900 tracking-wide group-hover:text-brand-brown transition-colors">
                  {decodeHtml(cat.name)}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
