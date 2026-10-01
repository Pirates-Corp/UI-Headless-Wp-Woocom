"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/defaultcard";
import { AddressFields } from "@/components/checkout/address-fields";
import { SavedAddressSelector } from "@/components/checkout/saved-address-selector";
import { useCheckoutStore } from "@/lib/store/checkout-store";
import { useAuthStore } from "@/lib/store/auth-store";
import { getDefaultCountry } from "@/lib/config/countries";
import { Truck } from "lucide-react";
import { t } from "@/lib/i18n";
import type { SavedAddress } from "@/lib/woocommerce/types";

interface DeliveryAddressFormProps {
  savedAddresses?: SavedAddress[];
  selectedAddressId?: string;
  onSelectSavedAddress?: (addressId: string) => void;
  saveAddressChecked?: boolean;
  setSaveAddressChecked?: (val: boolean) => void;
  makeDefaultChecked?: boolean;
  setMakeDefaultChecked?: (val: boolean) => void;
  addressLabel?: string;
  setAddressLabel?: (val: string) => void;
}

export function DeliveryAddressForm({
  savedAddresses = [],
  selectedAddressId = "new",
  onSelectSavedAddress,
  saveAddressChecked = true,
  setSaveAddressChecked,
  makeDefaultChecked = false,
  setMakeDefaultChecked,
  addressLabel = "Home",
  setAddressLabel,
}: DeliveryAddressFormProps) {
  const { isAuthenticated } = useAuthStore();
  const shipping = useCheckoutStore((s) => s.shipping);
  const updateShipping = useCheckoutStore((s) => s.updateShipping);

  const handleSelect = (id: string) => {
    if (onSelectSavedAddress) {
      onSelectSavedAddress(id);
    }
    if (id === "new") {
      updateShipping("first_name", "");
      updateShipping("last_name", "");
      updateShipping("company", "");
      updateShipping("address_1", "");
      updateShipping("address_2", "");
      updateShipping("city", "");
      updateShipping("state", "");
      updateShipping("postcode", "");
      updateShipping("country", getDefaultCountry());
    } else {
      const found = savedAddresses.find((a) => a.id === id);
      if (found) {
        updateShipping("first_name", found.first_name);
        updateShipping("last_name", found.last_name);
        updateShipping("company", found.company || "");
        updateShipping("address_1", found.address_1);
        updateShipping("address_2", found.address_2 || "");
        updateShipping("city", found.city);
        updateShipping("state", found.state || "");
        updateShipping("postcode", found.postcode);
        updateShipping("country", found.country || getDefaultCountry());
      }
    }
  };

  const isUsingSavedAddress =
    isAuthenticated && savedAddresses.length > 0 && selectedAddressId !== "new";

  return (
    <Card className="border-border/80 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          <span>{t("checkout.deliveryTitle")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isAuthenticated && savedAddresses.length > 0 && (
          <SavedAddressSelector
            addresses={savedAddresses}
            selectedId={selectedAddressId}
            onSelect={handleSelect}
          />
        )}

        {/* When using a saved address, render hidden inputs so form submission carries shipping data */}
        {isUsingSavedAddress ? (
          <>
            <input type="hidden" name="shipping_first_name" value={shipping.first_name || ""} />
            <input type="hidden" name="shipping_last_name" value={shipping.last_name || ""} />
            <input type="hidden" name="shipping_company" value={shipping.company || ""} />
            <input type="hidden" name="shipping_address_1" value={shipping.address_1 || ""} />
            <input type="hidden" name="shipping_address_2" value={shipping.address_2 || ""} />
            <input type="hidden" name="shipping_city" value={shipping.city || ""} />
            <input type="hidden" name="shipping_state" value={shipping.state || ""} />
            <input type="hidden" name="shipping_postcode" value={shipping.postcode || ""} />
            <input type="hidden" name="shipping_country" value={shipping.country || ""} />
          </>
        ) : (
          /* When entering a new address, show the address form fields and save checkbox */
          <div className={savedAddresses.length > 0 ? "mt-4 pt-4 border-t border-border/60 animate-in fade-in-50 duration-200" : ""}>
            <AddressFields namePrefix="shipping" showCompany={false} />

            {isAuthenticated && (
              <div className="mt-5 pt-4 border-t border-border/60 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="saveAddress"
                    value="1"
                    checked={saveAddressChecked}
                    onChange={(e) => setSaveAddressChecked?.(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary/30"
                  />
                  <span className="text-xs sm:text-sm font-medium text-foreground">
                    {t("checkout.saveToAddressBook")}
                  </span>
                </label>

                {saveAddressChecked && (
                  <div className="pl-6 space-y-2.5 animate-in fade-in-50 duration-200">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        name="makeDefault"
                        value="1"
                        checked={makeDefaultChecked}
                        onChange={(e) => setMakeDefaultChecked?.(e.target.checked)}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary/30"
                      />
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        {t("checkout.makeDefaultAddress")}
                      </span>
                    </label>
                    {setAddressLabel && (
                      <input
                        type="hidden"
                        name="addressLabel"
                        value={addressLabel}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
