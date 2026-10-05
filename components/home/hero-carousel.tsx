"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const HERO_SLIDES = [
  {
    src: "/assets/hero-section/claybrushstudio1.png",
    alt: "Clay Brush Studio - 3D Printed Art & Sculptures 1",
  },
  {
    src: "/assets/hero-section/claybrushstudio2.png",
    alt: "Clay Brush Studio - 3D Printed Art & Sculptures 2",
  },
  {
    src: "/assets/hero-section/claybrushstudio3.png",
    alt: "Clay Brush Studio - 3D Printed Art & Sculptures 3",
  },
  {
    src: "/assets/hero-section/claybrushstudio4.png",
    alt: "Clay Brush Studio - 3D Printed Art & Sculptures 4",
  },
  {
    src: "/assets/hero-section/claybrushstudio5.png",
    alt: "Clay Brush Studio - 3D Printed Art & Sculptures 5",
  },
] as const;

const AUTOPLAY_INTERVAL = 5000;

export function HeroCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Swipe gesture tracking
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const hasDragged = useRef(false);

  const totalSlides = HERO_SLIDES.length;

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  // Autoplay
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      goToNext();
    }, AUTOPLAY_INTERVAL);

    return () => clearInterval(timer);
  }, [isPaused, goToNext]);

  // Touch handlers for mobile swiping
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    hasDragged.current = false;
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;

    // If movement is horizontal and significant, mark as dragged to avoid triggering click
    if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
      hasDragged.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsPaused(false);
    if (touchStartX.current === null) return;

    const endX = e.changedTouches[0].clientX;
    const diffX = endX - touchStartX.current;

    // Minimum swipe threshold of 40px
    if (diffX < -40) {
      goToNext();
    } else if (diffX > 40) {
      goToPrev();
    }

    touchStartX.current = null;
    touchStartY.current = null;

    // Reset drag flag shortly after to allow subsequent deliberate clicks
    setTimeout(() => {
      hasDragged.current = false;
    }, 100);
  };

  // Prevent link click when swiping
  const handleLinkClick = (e: React.MouseEvent) => {
    if (hasDragged.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      goToPrev();
    } else if (e.key === "ArrowRight") {
      goToNext();
    }
  };

  return (
    <div
      className="relative w-full aspect-[1792/1024] md:aspect-auto md:h-[calc(100vh-5rem)] md:max-h-[calc(100dvh-5rem)] overflow-hidden select-none bg-[#f6eedf] group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      role="region"
      aria-roledescription="carousel"
      aria-label="Clay Brush Studio Hero Carousel"
      tabIndex={0}
    >
      {/* Slides Track */}
      <div
        className="flex h-full w-full transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {HERO_SLIDES.map((slide, index) => (
          <div
            key={slide.src}
            className="relative min-w-full w-full h-full flex-shrink-0 flex items-center justify-center overflow-hidden bg-[#f6eedf]"
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${totalSlides}`}
          >
            <Link
              href="/shop"
              onClick={handleLinkClick}
              className="block relative w-full h-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
              tabIndex={index === currentIndex ? 0 : -1}
              aria-label={`Shop Clay Brush Studio - Slide ${index + 1}`}
            >
              {/* Ambient backdrop on wide screens to extend the artwork seamlessly */}
              <Image
                src={slide.src}
                alt=""
                fill
                priority={index === 0}
                aria-hidden="true"
                className="hidden md:block object-cover w-full h-full blur-3xl opacity-85 scale-125 pointer-events-none"
              />
              {/* Primary slide image: fits fully in mobile view and fits viewport height on desktop */}
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                priority={index === 0}
                sizes="(max-width: 768px) 100vw, 100vw"
                className="object-cover md:object-contain w-full h-full select-none relative z-10"
                draggable={false}
              />
            </Link>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          goToPrev();
        }}
        aria-label="Previous slide"
        className="absolute left-2 sm:left-4 md:left-6 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-black/40 hover:bg-black/75 text-white backdrop-blur-md border border-white/20 shadow-lg transition-all opacity-70 group-hover:opacity-100 hover:scale-110 active:scale-95 cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4 sm:w-6 sm:h-6" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          goToNext();
        }}
        aria-label="Next slide"
        className="absolute right-2 sm:right-4 md:right-6 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-black/40 hover:bg-black/75 text-white backdrop-blur-md border border-white/20 shadow-lg transition-all opacity-70 group-hover:opacity-100 hover:scale-110 active:scale-95 cursor-pointer"
      >
        <ChevronRight className="w-4 h-4 sm:w-6 sm:h-6" />
      </button>

      {/* Pagination Indicators */}
      <div
        className="absolute bottom-2.5 sm:bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/15"
        role="tablist"
        aria-label="Carousel slide controls"
      >
        {HERO_SLIDES.map((_, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={index === currentIndex}
            aria-label={`Go to slide ${index + 1}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCurrentIndex(index);
            }}
            className={cn(
              "transition-all duration-300 rounded-full cursor-pointer",
              index === currentIndex
                ? "w-5 sm:w-7 h-1.5 sm:h-2 bg-brand-yellow shadow-sm"
                : "w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/60 hover:bg-white"
            )}
          />
        ))}
      </div>
    </div>
  );
}
