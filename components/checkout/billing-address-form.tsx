"use client";

import { useCheckoutStore } from "@/lib/store/checkout-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/defaultcard";
import { AddressFields } from "@/components/checkout/address-fields";
import { CreditCard } from "lucide-react";
import { t } from "@/lib/i18n";

export function BillingAddressForm() {
  const billingSameAsShipping = useCheckoutStore((s) => s.billingSameAsShipping);
  const setBillingSameAsShipping = useCheckoutStore((s) => s.setBillingSameAsShipping);

  return (
    <Card className="border-border/80 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <span>{t("checkout.billingTitle")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            name="billingSameAsShipping"
            value="1"
            checked={billingSameAsShipping}
            onChange={(e) => setBillingSameAsShipping(e.target.checked)}
            className="h-4 w-4 rounded border-input text-primary focus:ring-primary/30"
          />
          <span className="text-sm font-medium text-foreground">
            {t("checkout.billingSameAsShipping")}
          </span>
        </label>

        {!billingSameAsShipping && (
          <div className="mt-5 pt-4 border-t border-border/60 animate-in fade-in-50 duration-200">
            <AddressFields namePrefix="billing" showCompany={true} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
