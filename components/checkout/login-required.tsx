"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { buttonVariants } from "@/components/ui/defaultbutton";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

interface LoginRequiredProps {
  returnUrl: string;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }
  const media = window.matchMedia("(min-width: 768px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return true;
  }
  return window.matchMedia("(min-width: 768px)").matches;
}

function getServerSnapshot(): boolean {
  return true;
}

export function LoginRequired({ returnUrl }: LoginRequiredProps) {
  const isDesktop = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [drawerOpen, setDrawerOpen] = useState(true);

  const loginHref = `/login?returnUrl=${encodeURIComponent(returnUrl)}`;
  const registerHref = `/register?returnUrl=${encodeURIComponent(returnUrl)}`;

  return (
    <>
      <div className="container mx-auto px-4 py-16 text-center">
        <LogIn className="mx-auto h-16 w-16 text-muted-foreground" />
        <h1 className="text-3xl font-heading font-bold mt-4">
          {t("checkout.loginRequiredTitle")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          {t("checkout.loginRequiredHint")}
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={loginHref}
            className={cn(buttonVariants({ size: "lg" }), "bg-brand-brown text-brand-yellow hover:bg-brand-brown/90 shadow-none gap-2 font-medium")}
          >
            {t("checkout.loginRequiredLogin")}
          </Link>
          <Link
            href={registerHref}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-brand-brown/30 text-brand-brown hover:bg-brand-yellow hover:border-brand-brown gap-2 font-medium")}
          >
            {t("checkout.loginRequiredSignup")}
          </Link>
        </div>
      </div>

      {!isDesktop && (
        <Drawer
          open={!isDesktop && drawerOpen}
          onOpenChange={setDrawerOpen}
        >
          <DrawerContent className="pb-[env(safe-area-inset-bottom)]">
            <DrawerHeader className="items-center text-center">
              <LogIn className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
              <DrawerTitle className="text-xl">
                {t("checkout.loginRequiredTitle")}
              </DrawerTitle>
              <DrawerDescription className="text-sm text-muted-foreground mt-1">
                {t("checkout.loginRequiredHint")}
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter className="gap-2">
              <Link
                href={loginHref}
                className={cn(buttonVariants({ size: "lg" }), "w-full")}
              >
                {t("checkout.loginRequiredLogin")}
              </Link>
              <Link
                href={registerHref}
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
              >
                {t("checkout.loginRequiredSignup")}
              </Link>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}
