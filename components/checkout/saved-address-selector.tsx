"use client";

import type { SavedAddress } from "@/lib/woocommerce/types";
import { Badge } from "@/components/ui/badge";
import { Check, Plus, MapPin } from "lucide-react";
import { t } from "@/lib/i18n";

interface SavedAddressSelectorProps {
  addresses: SavedAddress[];
  selectedId: string;
  onSelect: (addressId: string) => void;
}

export function SavedAddressSelector({
  addresses,
  selectedId,
  onSelect,
}: SavedAddressSelectorProps) {
  if (!addresses || addresses.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <MapPin className="h-4 w-4 text-primary" />
        <span>{t("checkout.savedAddresses")}</span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {addresses.map((addr) => {
          const isSelected = selectedId === addr.id;
          const formattedAddress = [
            addr.address_1,
            addr.address_2,
            addr.city,
            addr.state,
            addr.postcode,
            addr.country,
          ]
            .filter(Boolean)
            .join(", ");

          return (
            <div
              key={addr.id}
              onClick={() => onSelect(addr.id)}
              className={`relative rounded-xl border p-4 cursor-pointer transition-all duration-200 flex flex-col justify-between select-none ${
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/40 shadow-sm"
                  : "border-border/70 bg-card hover:border-border hover:bg-accent/40"
              }`}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(addr.id);
                }
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">
                      {addr.label || "Address"}
                    </span>
                    {addr.is_default && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary font-medium border-primary/20">
                        {t("account.addresses.defaultBadge")}
                      </Badge>
                    )}
                  </div>
                  <div
                    className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                  </div>
                </div>

                <p className="text-xs font-medium text-foreground">
                  {addr.first_name} {addr.last_name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {formattedAddress}
                </p>
                {addr.phone && (
                  <p className="text-[11px] text-muted-foreground/80 mt-1">
                    {addr.phone}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Use a new address card */}
        <div
          onClick={() => onSelect("new")}
          className={`relative rounded-xl border border-dashed p-4 cursor-pointer transition-all duration-200 flex items-center justify-center select-none min-h-[90px] ${
            selectedId === "new"
              ? "border-primary bg-primary/5 ring-1 ring-primary/40 shadow-sm"
              : "border-border hover:border-primary/50 hover:bg-accent/40"
          }`}
          role="radio"
          aria-checked={selectedId === "new"}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect("new");
            }
          }}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <div className={`p-1.5 rounded-full ${selectedId === "new" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              <Plus className="h-4 w-4" />
            </div>
            <span>{t("checkout.useNewAddress")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
