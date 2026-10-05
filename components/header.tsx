"use client";

import { useUIStore } from "@/lib/store/ui-store";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
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

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Store" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

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

export function Header() {
  const isMobileMenuOpen = useUIStore((s) => s.isMobileMenuOpen);
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-brand-brown/15 bg-brand-yellow">
      <div className="container mx-auto flex flex-wrap md:flex-nowrap items-center justify-between gap-x-3 gap-y-2.5 px-4 py-2.5 md:py-0 md:h-18 lg:h-20 lg:px-8">
        {/* Left: Logo + Desktop Nav */}
        <div className="flex items-center gap-4 sm:gap-6 lg:gap-10 order-1">
          <Logo />
          <nav
            className="hidden lg:flex items-center gap-7 text-sm"
            aria-label="Main navigation"
          >
            {NAV_LINKS.map(({ href, label }) => {
              const isActive =
                href === "/"
                  ? pathname === "/"
                  : pathname === href ||
                    pathname.startsWith(href + "/") ||
                    pathname.startsWith(href + "?");

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative py-1 font-medium transition-colors duration-200 tracking-wide",
                    isActive
                      ? "text-brand-brown font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-brown"
                      : "text-brand-brown/75 hover:text-brand-brown after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-brown after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200"
                  )}
                >
                  {label}
                </Link>
              );
            })}
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
            inputClassName="rounded-full bg-white border-brand-brown/15 text-brand-brown placeholder:text-brand-brown/50 focus-visible:ring-brand-brown/30 shadow-none h-9.5 md:h-10 pl-9"
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
                className="flex flex-col px-2 py-3"
                aria-label="Mobile navigation"
              >
                {NAV_LINKS.map(({ href, label }) => {
                  const isActive =
                    href === "/"
                      ? pathname === "/"
                      : pathname === href ||
                        pathname.startsWith(href + "/") ||
                        pathname.startsWith(href + "?");

                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium transition-colors",
                        isActive
                          ? "bg-brand-brown/10 text-brand-brown font-semibold"
                          : "text-brand-brown/80 hover:bg-brand-brown/10 hover:text-brand-brown"
                      )}
                    >
                      {label}
                    </Link>
                  );
                })}
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
