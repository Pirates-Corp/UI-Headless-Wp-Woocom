"use client";

import { useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { WooProduct } from "@/lib/woocommerce/types";
import { formatProductPrice, decodeHtml, stripHtml } from "@/lib/utils/format";
import { useCartStore } from "@/lib/store/cart-store";
import { useBuyNowStore } from "@/lib/store/buy-now-store";
import { toast } from "sonner";
import { trackSelectItem, trackAddToCart } from "@/lib/utils/gtm-events";
import { productToEcommerceItem } from "@/lib/utils/gtm-items";
import { t } from "@/lib/i18n";

interface CategoryProductCardProps {
  product: WooProduct;
}

export function CategoryProductCard({ product }: CategoryProductCardProps) {
  const router = useRouter();
  const { addItem, openCart } = useCartStore();
  const [isAdding, startAddToCartTransition] = useTransition();
  const [isBuying, startBuyNowTransition] = useTransition();

  const { current } = formatProductPrice(product.prices);
  const image = product.images[0];
  // Second gallery image (if any) is revealed on hover
  const hoverImage = product.images[1];

  // Derive subtitle from short_description or primary category
  const rawDesc = product.short_description ? stripHtml(product.short_description).trim() : "";
  const subtitle = rawDesc || (product.categories[0] ? decodeHtml(product.categories[0].name) : "Artisanal 3D Sculpture");

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.type === "variable" || product.type === "grouped") {
      router.push(`/product/${product.slug}`);
      return;
    }

    startAddToCartTransition(async () => {
      const result = await addItem(product.id, 1);
      if (result.error) {
        toast.error(t("product.cantAddToCart"), { description: result.error });
      } else {
        trackAddToCart(productToEcommerceItem(product), product.prices.currency_code);
        toast.success(`${decodeHtml(product.name)} added to cart`);
        openCart();
      }
    });
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.type === "variable" || product.type === "grouped") {
      router.push(`/product/${product.slug}`);
      return;
    }

    startBuyNowTransition(async () => {
      const result = await useBuyNowStore.getState().startBuyNow(product.id, 1);
      if (result.error) {
        toast.error(t("product.cantAddToCart"), { description: result.error });
      } else {
        trackAddToCart(productToEcommerceItem(product), product.prices.currency_code);
        router.push("/checkout?buy_now=1");
      }
    });
  };

  return (
    <div className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between border border-black/5">
      {/* Product Image Area */}
      <Link
        href={`/product/${product.slug}`}
        className="relative aspect-square w-full overflow-hidden bg-white flex items-center justify-center p-3"
        onClick={() => trackSelectItem(productToEcommerceItem(product), "Home Category Grid", product.prices.currency_code)}
      >
        {image ? (
          <>
            <Image
              src={image.src}
              alt={image.alt || decodeHtml(product.name)}
              fill
              className={`object-contain p-2 group-hover:scale-105 transition-[opacity,scale] duration-500 ease-out motion-reduce:transition-none ${
                hoverImage ? "group-hover:opacity-0" : ""
              }`}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
            {hoverImage && (
              <Image
                src={hoverImage.src}
                alt=""
                aria-hidden="true"
                fill
                className="object-contain p-2 opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-[opacity,scale] duration-500 ease-out motion-reduce:transition-none"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
            )}
            {/* Glaze: a soft diagonal sheen that sweeps across the image on hover */}
            <span
              aria-hidden="true"
              data-testid="card-glaze"
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/2 -skew-x-12 -translate-x-[150%] bg-linear-to-r from-transparent via-white/60 to-transparent transition-transform duration-0 ease-out group-hover:translate-x-[350%] group-hover:duration-700 motion-reduce:hidden"
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">
            {t("product.noImageAlt")}
          </div>
        )}
      </Link>

      {/* Product Details & Actions */}
      <div className="p-5 pt-2 flex flex-col flex-1 justify-between">
        <div>
          {/* Title */}
          <Link
            href={`/product/${product.slug}`}
            className="block"
            onClick={() => trackSelectItem(productToEcommerceItem(product), "Home Category Grid", product.prices.currency_code)}
          >
            <h4 className="font-serif font-semibold text-lg text-neutral-900 leading-snug line-clamp-1 group-hover:text-[#423118] transition-colors">
              {decodeHtml(product.name)}
            </h4>
          </Link>

          {/* Subtitle */}
          <p className="text-xs text-[#8c7b69] mt-1 line-clamp-1 font-normal">
            {subtitle}
          </p>
        </div>

        {/* Price & Action Buttons */}
        <div className="pt-3 mt-auto space-y-3">
          {/* Price */}
          <div className="flex items-center justify-between">
            <span className="font-serif font-bold text-base sm:text-lg text-neutral-900 tracking-tight">
              {current}
            </span>
          </div>

          {/* Action Buttons: ADD TO CART & BUY NOW */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!product.is_purchasable || !product.is_in_stock || isAdding}
              className="border border-[#423118] text-[#423118] hover:bg-[#423118]/10 text-xs font-bold py-2 px-2 rounded-md transition-colors uppercase tracking-wider disabled:opacity-50 inline-flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
            >
              {isAdding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "ADD TO CART"
              )}
            </button>

            <button
              type="button"
              onClick={handleBuyNow}
              disabled={!product.is_purchasable || !product.is_in_stock || isBuying}
              className="bg-[#423118] hover:bg-[#2c200f] text-white text-xs font-bold py-2 px-2 rounded-md transition-colors uppercase tracking-wider disabled:opacity-50 inline-flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
            >
              {isBuying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "BUY NOW"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
