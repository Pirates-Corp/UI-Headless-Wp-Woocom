"use client";

import { formatPrice } from "@/lib/utils/format";
import { Button } from "@/components/ui/defaultbutton";
import { Loader2, ShieldCheck } from "lucide-react";
import type { WooCart } from "@/lib/woocommerce/types";
import { t } from "@/lib/i18n";

interface MobileCheckoutBarProps {
  cart: WooCart;
  isPending: boolean;
  isUpdatingAddress: boolean;
  isSelectingShipping: boolean;
  isStripeMethod: boolean;
  isRazorpayMethod: boolean;
}

export function MobileCheckoutBar({
  cart,
  isPending,
  isUpdatingAddress,
  isSelectingShipping,
  isStripeMethod,
  isRazorpayMethod,
}: MobileCheckoutBarProps) {
  const isDisabled = isPending || isUpdatingAddress || isSelectingShipping;
  const isFree = !cart.needs_payment || parseInt(cart.totals?.total_price || "0") <= 0;

  const buttonText = isPending
    ? t("checkout.processing")
    : isUpdatingAddress
    ? t("checkout.recalculating")
    : isFree
    ? t("checkout.freeOrder")
    : isStripeMethod
    ? t("checkout.payWithStripe")
    : isRazorpayMethod
    ? t("checkout.payWithRazorpay")
    : t("checkout.placeOrder");

  const formattedTotal = formatPrice(
    cart.totals.total_price,
    cart.totals.currency_minor_unit,
    cart.totals.currency_prefix,
    cart.totals.currency_suffix
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.12)] p-3.5 sm:p-4 lg:hidden pb-[max(0.875rem,env(safe-area-inset-bottom))] transition-all animate-in slide-in-from-bottom duration-300">
      <div className="container mx-auto flex items-center justify-between gap-3 max-w-lg">
        {/* Price & Summary Info */}
        <div className="flex flex-col min-w-0 pr-1">
          <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <span>{t("orderConfirmation.total")}</span>
            <span className="inline-flex items-center text-primary/80">
              <ShieldCheck className="h-3 w-3 inline ml-0.5" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-heading text-foreground tracking-tight truncate">
            {formattedTotal}
          </div>
        </div>

        {/* Action Button */}
        <Button
          type="submit"
          size="lg"
          disabled={isDisabled}
          className="shrink-0 min-w-[150px] sm:min-w-[190px] font-semibold text-sm shadow-md"
        >
          {isPending || isUpdatingAddress || isSelectingShipping ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{buttonText}</span>
            </span>
          ) : (
            buttonText
          )}
        </Button>
      </div>
    </div>
  );
}
