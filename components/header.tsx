"use client";

import { useState, useEffect, useRef } from "react";
import { useUIStore } from "@/lib/store/ui-store";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, ChevronDown, ChevronRight, Layers } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { CartSheet } from "@/components/cart-sheet";
import { WishlistIcon } from "@/components/wishlist-icon";
import { UserNav } from "@/components/auth/user-nav";
import { Button } from "@/components/ui/defaultbutton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { decodeHtml } from "@/lib/utils/format";
import type { WooCategory } from "@/lib/woocommerce/types";

interface HeaderProps {
  initialCategories?: WooCategory[];
}

function Logo() {
  return (
    <Link
      href="/"
      className="shrink-0 flex items-center select-none py-1"
      aria-label="Clay Brush Studio Home"
    >
      <Image
        src="/assets/brand/logo-dark.svg"
        alt="Clay Brush Studio"
        width={145}
        height={100}
        className="h-10 sm:h-12 w-auto object-contain"
        priority
      />
    </Link>
  );
}

export function Header({ initialCategories = [] }: HeaderProps) {
  const isMobileMenuOpen = useUIStore((s) => s.isMobileMenuOpen);
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);
  const pathname = usePathname();

  // Dynamic WooCommerce categories
  const [categories, setCategories] =
    useState<WooCategory[]>(initialCategories);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileStoreOpen, setIsMobileStoreOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch categories if not passed or empty
  useEffect(() => {
    if (categories.length === 0) {
      fetch("/api/categories")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.categories) && data.categories.length > 0) {
            setCategories(data.categories);
          }
        })
        .catch((err) => {
          console.error("[Header] Failed to fetch dynamic categories:", err);
        });
    }
  }, [categories.length]);

  // Close desktop dropdown on outside click or escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsDropdownOpen(false);
    }, 180);
  };

  const isStoreActive =
    pathname === "/shop" ||
    pathname.startsWith("/shop?") ||
    pathname.startsWith("/category/");

  return (
    <header className="sticky top-0 z-50 w-full border-b border-brand-brown/15 bg-brand-yellow">
      <div className="container mx-auto flex flex-wrap md:flex-nowrap items-center justify-between gap-x-3 gap-y-2.5 px-4 py-2.5 md:py-0 md:h-18 lg:h-18 lg:px-8">
        {/* Left: Logo + Desktop Nav */}
        <div className="flex items-center gap-4 sm:gap-6 lg:gap-10 order-1">
          <Logo />
          <nav
            className="hidden lg:flex items-center gap-7 text-sm"
            aria-label="Main navigation"
          >
            {/* Home Link */}
            <Link
              href="/"
              className={cn(
                "relative py-1 font-medium transition-colors duration-200 tracking-wide",
                pathname === "/"
                  ? "text-brand-brown font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-brown"
                  : "text-brand-brown/75 hover:text-brand-brown after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-brown after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200",
              )}
            >
              Home
            </Link>

            {/* Store with Dynamic Category Dropdown */}
            <div
              ref={dropdownRef}
              className="relative"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className="flex items-center gap-1">
                <Link
                  href="/shop"
                  className={cn(
                    "relative py-1 font-medium transition-colors duration-200 tracking-wide flex items-center gap-1",
                    isStoreActive
                      ? "text-brand-brown font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-brown"
                      : "text-brand-brown/75 hover:text-brand-brown after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-brown after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200",
                  )}
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="true"
                >
                  Store
                </Link>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className="p-0.5 text-brand-brown/75 hover:text-brand-brown rounded transition-colors focus:outline-none"
                  aria-label="Toggle store categories"
                >
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 transition-transform duration-200",
                      isDropdownOpen && "rotate-180",
                    )}
                  />
                </button>
              </div>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div
                  className="absolute top-full left-0 mt-2 w-64 rounded-xl border border-brand-brown/15 bg-white/95 backdrop-blur-md p-2 shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150 z-50 text-brand-brown"
                  role="menu"
                  aria-label="Store Categories"
                >
                  {/* All Products */}
                  <Link
                    href="/shop"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-brand-yellow/30 text-brand-brown"
                    role="menuitem"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-brand-brown/70" />
                      <span>All 3D Prints</span>
                    </div>
                    <span className="text-xs text-brand-brown/50">
                      Browse all
                    </span>
                  </Link>

                  {/* Divider */}
                  {categories.length > 0 && (
                    <div className="my-1.5 border-t border-brand-brown/10" />
                  )}

                  {/* Dynamic WordPress WooCommerce Categories */}
                  <div className="max-h-80 overflow-y-auto space-y-0.5">
                    {categories.map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/shop?category=${encodeURIComponent(cat.slug)}`}
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-brand-yellow/30 text-brand-brown/90 hover:text-brand-brown group"
                        role="menuitem"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {cat.image?.src ? (
                            <Image
                              src={cat.image.src}
                              alt=""
                              width={24}
                              height={24}
                              className="w-6 h-6 rounded-full object-cover shrink-0 bg-[#f5ebdb]"
                            />
                          ) : (
                            <span className="w-6 h-6 rounded-full bg-brand-brown/10 text-[11px] font-medium flex items-center justify-center shrink-0">
                              {cat.name.slice(0, 1)}
                            </span>
                          )}
                          <span className="font-medium group-hover:translate-x-0.5 transition-transform truncate">
                            {decodeHtml(cat.name)}
                          </span>
                        </div>
                        {cat.count > 0 && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-brown/10 text-brand-brown/70 group-hover:bg-brand-brown group-hover:text-brand-yellow transition-colors shrink-0 ml-2">
                            {cat.count}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* About Link */}
            <Link
              href="/about"
              className={cn(
                "relative py-1 font-medium transition-colors duration-200 tracking-wide",
                pathname === "/about"
                  ? "text-brand-brown font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-brown"
                  : "text-brand-brown/75 hover:text-brand-brown after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-brown after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200",
              )}
            >
              About
            </Link>

            {/* Contact Link */}
            <Link
              href="/contact"
              className={cn(
                "relative py-1 font-medium transition-colors duration-200 tracking-wide",
                pathname === "/contact"
                  ? "text-brand-brown font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-brown"
                  : "text-brand-brown/75 hover:text-brand-brown after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-brown after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200",
              )}
            >
              Contact
            </Link>
          </nav>
        </div>

        {/* Center/Right: Search Bar
            - Desktop: order-2, max-w-sm xl:max-w-md
            - Tablet: order-2, max-w-xs md:max-w-sm, inline with Logo and Actions
            - Mobile: order-3, full width below Logo/Actions row
        */}
        <div className="w-full md:w-auto md:flex-1 md:max-w-xs lg:max-w-sm xl:max-w-md order-3 md:order-2 md:mx-3 lg:mx-4">
          <SearchBar
            placeholder="Search.."
            inputClassName=" bg-white border-brand-brown/15 text-brand-brown placeholder:text-brand-brown/50 focus-visible:ring-brand-brown/30 shadow-none h-9.5 md:h-10 pl-9"
          />
        </div>

        {/* Actions (Wishlist, Cart, User, Mobile Hamburger) - order-2 on mobile, order-3 on tablet/desktop */}
        <div className="flex items-center gap-1 sm:gap-2 order-2 md:order-3 text-brand-brown [&_a]:text-brand-brown [&_button]:text-brand-brown [&_svg]:text-brand-brown [&_a:hover]:text-brand-brown [&_button:hover]:text-brand-brown [&_a:hover]:bg-brand-brown/10 [&_button:hover]:bg-brand-brown/10 [&_span.rounded-full]:bg-brand-brown [&_span.rounded-full]:text-brand-yellow">
          <ThemeToggle />
          <WishlistIcon />
          <CartSheet />
          <UserNav />

          {/* Mobile hamburger */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden text-brand-brown hover:bg-brand-brown/10"
                  aria-label="Open menu"
                />
              }
            >
              <Menu className="h-5 w-5 text-brand-brown" />
            </SheetTrigger>

            <SheetContent
              side="right"
              className="flex flex-col gap-0 p-0 bg-brand-yellow text-brand-brown border-l border-brand-brown/15"
            >
              {/* Sheet header */}
              <SheetHeader className="border-b border-brand-brown/15 px-5 py-4">
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>

              {/* Nav links */}
              <nav
                className="flex flex-col px-2 py-3 overflow-y-auto"
                aria-label="Mobile navigation"
              >
                {/* Home */}
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium transition-colors",
                    pathname === "/"
                      ? "bg-brand-brown/10 text-brand-brown font-semibold"
                      : "text-brand-brown/80 hover:bg-brand-brown/10 hover:text-brand-brown",
                  )}
                >
                  Home
                </Link>

                {/* Store with Accordion for Categories */}
                <div className="flex flex-col">
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-md px-3 py-3 text-base font-medium transition-colors",
                      isStoreActive
                        ? "bg-brand-brown/10 text-brand-brown font-semibold"
                        : "text-brand-brown/80 hover:bg-brand-brown/10 hover:text-brand-brown",
                    )}
                  >
                    <Link
                      href="/shop"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex-1"
                    >
                      Store
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMobileStoreOpen((prev) => !prev);
                      }}
                      className="p-1 hover:bg-brand-brown/10 rounded"
                      aria-label="Toggle store categories"
                    >
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform duration-200 text-brand-brown/70",
                          isMobileStoreOpen && "rotate-180",
                        )}
                      />
                    </button>
                  </div>

                  {/* Submenu of categories */}
                  {isMobileStoreOpen && (
                    <div className="pl-4 pr-2 py-1 space-y-1 border-l-2 border-brand-brown/20 ml-4 mb-2 animate-in fade-in duration-200">
                      <Link
                        href="/shop"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-brand-brown hover:bg-brand-brown/10"
                      >
                        <span>All 3D Prints</span>
                        <ChevronRight className="h-3.5 w-3.5 text-brand-brown/50" />
                      </Link>
                      {categories.map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/shop?category=${encodeURIComponent(cat.slug)}`}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-brand-brown/85 hover:text-brand-brown hover:bg-brand-brown/10"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {cat.image?.src && (
                              <Image
                                src={cat.image.src}
                                alt=""
                                width={22}
                                height={22}
                                className="w-5 h-5 rounded-full object-cover shrink-0 bg-[#f5ebdb]"
                              />
                            )}
                            <span className="truncate">
                              {decodeHtml(cat.name)}
                            </span>
                          </div>
                          {cat.count > 0 && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-brown/10 text-brand-brown/70 shrink-0 ml-2">
                              {cat.count}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* About */}
                <Link
                  href="/about"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium transition-colors",
                    pathname === "/about"
                      ? "bg-brand-brown/10 text-brand-brown font-semibold"
                      : "text-brand-brown/80 hover:bg-brand-brown/10 hover:text-brand-brown",
                  )}
                >
                  About
                </Link>

                {/* Contact */}
                <Link
                  href="/contact"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium transition-colors",
                    pathname === "/contact"
                      ? "bg-brand-brown/10 text-brand-brown font-semibold"
                      : "text-brand-brown/80 hover:bg-brand-brown/10 hover:text-brand-brown",
                  )}
                >
                  Contact
                </Link>
              </nav>

              {/* Mobile Account Section */}
              <div className="mt-auto border-t border-brand-brown/15 p-4 space-y-2">
                <Link
                  href="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-brand-brown text-brand-yellow text-sm font-medium hover:bg-brand-brown/90 transition-colors"
                >
                  My Account
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
