"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Image from "next/image";
import type { WooImage } from "@/lib/woocommerce/types";
import { cn } from "@/lib/utils";
import { ZoomIn, ChevronLeft, ChevronRight } from "lucide-react";
import { ProductLightbox } from "@/components/product/product-lightbox";

interface ProductGalleryProps {
  images: WooImage[];
  productName: string;
  activeImage?: WooImage | null;
}

export function ProductGallery({
  images: rawImages,
  productName,
  activeImage,
}: ProductGalleryProps) {
  const images = useMemo(() => {
    const seenIds = new Set<number>();
    const seenSrcs = new Set<string>();
    return (rawImages || [])
      .filter((img) => Boolean(img?.src && img.src.trim() !== ""))
      .filter((img) => {
        if (img.id && img.id > 0) {
          if (seenIds.has(img.id)) return false;
          seenIds.add(img.id);
        }
        if (img.src) {
          if (seenSrcs.has(img.src)) return false;
          seenSrcs.add(img.src);
        }
        return true;
      });
  }, [rawImages]);

  const [prevActiveSrc, setPrevActiveSrc] = useState(activeImage?.src || null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Adjust state during render when activeImage changes from parent (React recommended pattern)
  const currentActiveSrc = activeImage?.src || null;
  if (prevActiveSrc !== currentActiveSrc) {
    setPrevActiveSrc(currentActiveSrc);
    if (currentActiveSrc && images.length > 0) {
      const idx = images.findIndex(
        (img) =>
          (img.id && activeImage?.id && img.id === activeImage.id) ||
          img.src === currentActiveSrc,
      );
      if (idx !== -1) {
        setSelectedIndex(idx);
      }
    }
  }

  // Amazon-style hover zoom state (desktop)
  const ZOOM_FACTOR = 2.5;
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Mobile swipe gestures state
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isHorizontalGesture = useRef<boolean | null>(null);
  const hasMovedRef = useRef<boolean>(false);
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const safeIndex = selectedIndex < images.length ? selectedIndex : 0;
  const selectedImage = images[safeIndex] || images[0];

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    const el = thumbnailRefs.current[safeIndex];
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [safeIndex]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    if (containerSize.width !== rect.width || containerSize.height !== rect.height) {
      setContainerSize({ width: rect.width, height: rect.height });
    }

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const lw = rect.width / ZOOM_FACTOR;
    const lh = rect.height / ZOOM_FACTOR;

    // Clamp lens within bounds
    const x = Math.max(0, Math.min(rect.width - lw, mouseX - lw / 2));
    const y = Math.max(0, Math.min(rect.height - lh, mouseY - lh / 2));

    setZoomPos({ x, y });
  }, [containerSize.width, containerSize.height]);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      if (imageContainerRef.current) {
        const rect = imageContainerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
      setIsZooming(true);
      handleMouseMove(e);
    }
  }, [handleMouseMove]);

  const handleMouseLeave = useCallback(() => {
    setIsZooming(false);
  }, []);

  // Touch swipe handlers for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (images.length <= 1) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    isHorizontalGesture.current = null;
    hasMovedRef.current = false;
    setTouchDeltaX(0);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartX.current;
    const diffY = touch.clientY - touchStartY.current;

    // Detect gesture direction on initial movement
    if (isHorizontalGesture.current === null) {
      if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
        isHorizontalGesture.current = Math.abs(diffX) > Math.abs(diffY);
        if (isHorizontalGesture.current) {
          setIsSwiping(true);
        }
      }
    }

    if (isHorizontalGesture.current === true) {
      hasMovedRef.current = true;
      // Edge resistance when dragging beyond first or last slide
      let damped = diffX;
      if (
        (safeIndex === 0 && diffX > 0) ||
        (safeIndex === images.length - 1 && diffX < 0)
      ) {
        damped = diffX * 0.25;
      }
      setTouchDeltaX(damped);
    }
  };

  const handleTouchEnd = () => {
    if (isHorizontalGesture.current === true && Math.abs(touchDeltaX) > 40) {
      if (touchDeltaX < -40 && safeIndex < images.length - 1) {
        setSelectedIndex(safeIndex + 1);
      } else if (touchDeltaX > 40 && safeIndex > 0) {
        setSelectedIndex(safeIndex - 1);
      }
    }

    setIsSwiping(false);
    setTouchDeltaX(0);
    touchStartX.current = null;
    touchStartY.current = null;
    isHorizontalGesture.current = null;
    // Briefly preserve hasMoved to prevent triggering click immediately after drag
    window.setTimeout(() => {
      hasMovedRef.current = false;
    }, 60);
  };

  const handleTouchCancel = () => {
    setIsSwiping(false);
    setTouchDeltaX(0);
    touchStartX.current = null;
    touchStartY.current = null;
    isHorizontalGesture.current = null;
    hasMovedRef.current = false;
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const lightboxPrev = useCallback(() => {
    setLightboxIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const lightboxNext = useCallback(() => {
    setLightboxIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const goToPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (safeIndex > 0) {
      setSelectedIndex(safeIndex - 1);
    }
  };

  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (safeIndex < images.length - 1) {
      setSelectedIndex(safeIndex + 1);
    }
  };

  if (images.length === 0) {
    return (
      <div className="aspect-[3/4] rounded-lg bg-secondary flex items-center justify-center text-muted-foreground text-sm">
        No image available
      </div>
    );
  }

  return (
    <>
      <div className="relative space-y-3">
        {/* Main image gallery area — swipable on mobile, hover-zoom on desktop */}
        <div
          ref={imageContainerRef}
          className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-secondary group select-none touch-pan-y"
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          {/* Swipable Carousel Track */}
          <div
            className="flex h-full w-full will-change-transform"
            style={{
              transform: `translateX(calc(-${safeIndex * 100}% + ${touchDeltaX}px))`,
              transition: isSwiping ? "none" : "transform 320ms cubic-bezier(0.25, 1, 0.5, 1)",
            }}
          >
            {images.map((img, idx) => (
              <div
                key={img.id || `${img.src}-${idx}`}
                role="button"
                tabIndex={0}
                className="relative h-full w-full shrink-0 aspect-[3/4] cursor-pointer md:cursor-crosshair focus:outline-none"
                onClick={() => {
                  if (!hasMovedRef.current) {
                    openLightbox(idx);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openLightbox(idx);
                  }
                }}
                aria-label={`Open full-size view for image ${idx + 1} of ${images.length}`}
              >
                <Image
                  src={img.src}
                  alt={img.alt || `${productName} view ${idx + 1}`}
                  fill
                  className="object-cover select-none pointer-events-none"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority={idx === 0}
                  draggable={false}
                />
              </div>
            ))}
          </div>

          {/* Amazon-style Zoom Lens (Desktop only) */}
          {isZooming && containerSize.width > 0 && (
            <div
              className="absolute pointer-events-none border border-neutral-900/40 bg-neutral-900/20 backdrop-blur-[0.5px] shadow-sm hidden md:block"
              style={{
                left: `${zoomPos.x}px`,
                top: `${zoomPos.y}px`,
                width: `${containerSize.width / ZOOM_FACTOR}px`,
                height: `${containerSize.height / ZOOM_FACTOR}px`,
              }}
            />
          )}

          {/* Zoom hint icon in top-right corner on desktop */}
          {!isZooming && (
            <span className="absolute top-3 right-3 bg-black/40 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block">
              <ZoomIn className="h-4 w-4" aria-hidden="true" />
            </span>
          )}

          {/* Navigation Chevrons */}
          {images.length > 1 && (
            <>
              {safeIndex > 0 && (
                <button
                  type="button"
                  onClick={goToPrev}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white shadow-md backdrop-blur-xs transition-all z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {safeIndex < images.length - 1 && (
                <button
                  type="button"
                  onClick={goToNext}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white shadow-md backdrop-blur-xs transition-all z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </>
          )}

          {/* Image Counter Badge */}
          {images.length > 1 && (
            <span className="absolute bottom-3 right-3 bg-black/60 text-white text-[11px] font-medium rounded-full px-2.5 py-0.5 tabular-nums pointer-events-none select-none z-10">
              {safeIndex + 1} / {images.length}
            </span>
          )}

          {/* Mobile Swipe Pagination Dots */}
          {images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 md:hidden z-10 pointer-events-none">
              {images.map((_, dotIdx) => (
                <span
                  key={dotIdx}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    dotIdx === safeIndex ? "w-4 bg-white shadow-sm" : "w-1.5 bg-white/50"
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* Amazon-style Zoom Flyout Window (beside product image on desktop) */}
        {isZooming && containerSize.width > 0 && (
          <div
            className="hidden md:block absolute left-[calc(100%+1.5rem)] lg:left-[calc(100%+2.5rem)] top-0 overflow-hidden rounded-xl border border-border bg-white shadow-2xl z-40 pointer-events-none ring-1 ring-black/5"
            style={{
              width: `${containerSize.width}px`,
              height: `${containerSize.height}px`,
            }}
            aria-hidden="true"
          >
            <div
              className="relative w-full h-full overflow-hidden"
              style={{
                width: `${containerSize.width}px`,
                height: `${containerSize.height}px`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedImage.src}
                alt={selectedImage.alt || productName}
                className="absolute max-w-none object-cover"
                style={{
                  width: `${containerSize.width * ZOOM_FACTOR}px`,
                  height: `${containerSize.height * ZOOM_FACTOR}px`,
                  transform: `translate(-${zoomPos.x * ZOOM_FACTOR}px, -${zoomPos.y * ZOOM_FACTOR}px)`,
                }}
              />
            </div>
          </div>
        )}

        {/* Click to see full view hint */}
        <div className="text-center pt-0.5">
          <button
            type="button"
            onClick={() => openLightbox(safeIndex)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>Click to see full view</span>
          </button>
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label="Product images">
            {images.map((image, index) => (
              <button
                key={image.id || `${image.src}-${index}`}
                ref={(el) => {
                  thumbnailRefs.current[index] = el;
                }}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  "relative h-20 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  index === safeIndex
                    ? "border-[var(--gold)] opacity-100 ring-2 ring-primary/20 scale-[1.02]"
                    : "border-transparent opacity-55 hover:opacity-85 hover:border-border"
                )}
                aria-label={`View image ${index + 1} of ${images.length}`}
                aria-pressed={index === safeIndex}
              >
                <Image
                  src={image.thumbnail || image.src}
                  alt={image.alt || `${productName} view ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxOpen && (
        <ProductLightbox
          images={images}
          currentIndex={lightboxIndex}
          productName={productName}
          onClose={() => setLightboxOpen(false)}
          onPrev={lightboxPrev}
          onNext={lightboxNext}
        />
      )}
    </>
  );
}


