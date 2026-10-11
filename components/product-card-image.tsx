import Image from "next/image";
import type { WooImage } from "@/lib/woocommerce/types";
import { cn } from "@/lib/utils";
import { decodeHtml } from "@/lib/utils/format";
import { t } from "@/lib/i18n";

export interface ProductCardImageProps {
  primaryImage?: WooImage | null;
  galleryImages?: WooImage[];
  alt: string;
  sizes?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  children?: React.ReactNode;
}

/**
 * Finds the next distinct, valid secondary image from the same product's gallery.
 * Returns null if no distinct alternate image exists.
 */
export function getSecondaryImage(
  primary?: WooImage | null,
  gallery?: WooImage[]
): WooImage | null {
  if (!gallery || gallery.length < 2 || !primary?.src) return null;

  const normalizeUrl = (url: string) =>
    url.trim().toLowerCase().replace(/^https?:/, "");
  const primaryUrl = normalizeUrl(primary.src);

  for (let i = 0; i < gallery.length; i++) {
    const candidate = gallery[i];
    if (!candidate || !candidate.src || !candidate.src.trim()) continue;
    if (primary.id && candidate.id && primary.id === candidate.id) continue;
    if (normalizeUrl(candidate.src) === primaryUrl) continue;
    return candidate;
  }

  return null;
}

export function ProductCardImage({
  primaryImage,
  galleryImages,
  alt,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw",
  className,
  imageClassName,
  priority = false,
  children,
}: ProductCardImageProps) {
  if (!primaryImage || !primaryImage.src) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center text-muted-foreground text-sm",
          className
        )}
      >
        {t("product.noImageAlt")}
      </div>
    );
  }

  const secondaryImage = getSecondaryImage(primaryImage, galleryImages);
  const primaryAlt = primaryImage.alt ? decodeHtml(primaryImage.alt) : alt;
  const secondaryAlt = secondaryImage?.alt
    ? decodeHtml(secondaryImage.alt)
    : `${alt} alternate view`;

  return (
    <div
      className={cn(
        "product-image-viewport",
        secondaryImage ? "has-secondary" : "",
        className
      )}
    >
      {/* Primary Image Face */}
      <div className="product-image-face product-image-primary">
        <Image
          src={primaryImage.src}
          alt={primaryAlt}
          fill
          className={imageClassName}
          sizes={sizes}
          priority={priority}
        />
      </div>

      {/* Secondary Image Face (rendered only when a distinct alternate gallery image exists) */}
      {secondaryImage && (
        <div
          className="product-image-face product-image-secondary"
          aria-hidden="true"
        >
          <Image
            src={secondaryImage.src}
            alt={secondaryAlt}
            fill
            className={imageClassName}
            sizes={sizes}
            loading="lazy"
          />
        </div>
      )}

      {/* Flowing Liquid-Glass Reflection Layers */}
      <div
        aria-hidden="true"
        data-testid="card-glaze"
        className="product-image-liquid-glass"
      >
        <span className="liquid-glass-layer liquid-glass-specular" />
        <span className="liquid-glass-layer liquid-glass-ambient" />
      </div>

      {children}
    </div>
  );
}
