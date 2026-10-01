"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useCheckoutStore } from "@/lib/store/checkout-store";
import { Input } from "@/components/ui/input";
import { CountryFlag } from "@/components/ui/country-flag";
import { getAvailableCountries } from "@/lib/actions/cart";
import {
  isSingleCountryFixed,
  getDefaultCountry,
} from "@/lib/config/countries";
import { t } from "@/lib/i18n";
import { ChevronDown, Search, Lock, Plus } from "lucide-react";
import type { BillingAddress, ShippingAddress, WooCountry } from "@/lib/woocommerce/types";

export interface AddressFieldsProps {
  namePrefix: "billing" | "shipping";
  /** When true, also renders company field (billing only). */
  showCompany?: boolean;
  /** When true, also renders email and phone fields (used for legacy or standalone forms). */
  showContactFields?: boolean;
  /** Optional custom address values (for account page or custom modals). Defaults to checkout store. */
  values?: Partial<BillingAddress | ShippingAddress>;
  /** Optional change handler for custom values. Defaults to checkout store updates. */
  onChange?: (field: string, value: string) => void;
  /** Optional blur handler. */
  onBlur?: (field: string) => void;
  /** External validation errors if any. */
  errors?: Record<string, string>;
}

interface CountryDropdownPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
  placement: "down" | "up";
}

// Resilient initial country state before server action completes
const DEFAULT_INITIAL_COUNTRIES: WooCountry[] = [
  {
    code: "IN",
    name: "India",
    states: [
      { code: "AP", name: "Andhra Pradesh" },
      { code: "AR", name: "Arunachal Pradesh" },
      { code: "AS", name: "Assam" },
      { code: "BR", name: "Bihar" },
      { code: "CT", name: "Chhattisgarh" },
      { code: "GA", name: "Goa" },
      { code: "GJ", name: "Gujarat" },
      { code: "HR", name: "Haryana" },
      { code: "HP", name: "Himachal Pradesh" },
      { code: "JH", name: "Jharkhand" },
      { code: "KA", name: "Karnataka" },
      { code: "KL", name: "Kerala" },
      { code: "MP", name: "Madhya Pradesh" },
      { code: "MH", name: "Maharashtra" },
      { code: "MN", name: "Manipur" },
      { code: "ML", name: "Meghalaya" },
      { code: "MZ", name: "Mizoram" },
      { code: "NL", name: "Nagaland" },
      { code: "OR", name: "Odisha" },
      { code: "PB", name: "Punjab" },
      { code: "RJ", name: "Rajasthan" },
      { code: "SK", name: "Sikkim" },
      { code: "TN", name: "Tamil Nadu" },
      { code: "TG", name: "Telangana" },
      { code: "TR", name: "Tripura" },
      { code: "UP", name: "Uttar Pradesh" },
      { code: "UT", name: "Uttarakhand" },
      { code: "WB", name: "West Bengal" },
      { code: "AN", name: "Andaman and Nicobar Islands" },
      { code: "CH", name: "Chandigarh" },
      { code: "DN", name: "Dadra and Nagar Haveli and Daman and Diu" },
      { code: "DL", name: "Delhi" },
      { code: "JK", name: "Jammu and Kashmir" },
      { code: "LA", name: "Ladakh" },
      { code: "LD", name: "Lakshadweep" },
      { code: "PY", name: "Puducherry" },
    ],
  },
];

export function AddressFields({
  namePrefix,
  showCompany = false,
  showContactFields = false,
  values: propValues,
  onChange: propOnChange,
  onBlur: propOnBlur,
  errors: externalErrors = {},
}: AddressFieldsProps) {
  const storeBilling = useCheckoutStore((s) => s.billing);
  const storeShipping = useCheckoutStore((s) => s.shipping);
  const updateBilling = useCheckoutStore((s) => s.updateBilling);
  const updateShipping = useCheckoutStore((s) => s.updateShipping);

  const address = propValues
    ? propValues
    : namePrefix === "billing"
    ? storeBilling
    : storeShipping;

  const update = useCallback(
    (f: string, v: string) => {
      if (propOnChange) {
        propOnChange(f, v);
      } else if (namePrefix === "billing") {
        updateBilling(f as keyof BillingAddress, v);
      } else {
        updateShipping(f as keyof ShippingAddress, v);
      }
    },
    [namePrefix, propOnChange, updateBilling, updateShipping]
  );

  const htmlId = (f: string) => `${namePrefix}_${f}`;

  const isIndiaFixed = isSingleCountryFixed();
  const defaultCountry = getDefaultCountry();

  // Apt field toggle (auto-open if already has value or user clicks expand)
  const [aptOpen, setAptOpen] = useState(false);
  const isAptOpen = aptOpen || Boolean(address.address_2);

  // Client inline blur validation errors
  const [touchedErrors, setTouchedErrors] = useState<Record<string, string>>({});

  const validateField = useCallback(
    (field: string, value: string) => {
      let error = "";
      const trimmed = value.trim();

      if (field === "first_name" && !trimmed) {
        error = "First name is required";
      } else if (field === "last_name" && !trimmed) {
        error = "Last name is required";
      } else if (field === "address_1" && !trimmed) {
        error = "Address is required";
      } else if (field === "city" && !trimmed) {
        error = "City is required";
      } else if (field === "postcode") {
        if (!trimmed) {
          error = "Postcode is required";
        } else if (address.country === "IN" && !/^\d{6}$/.test(trimmed)) {
          error = "Postcode must be exactly 6 digits";
        }
      } else if (field === "email" && showContactFields) {
        if (!trimmed) {
          error = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          error = "Please enter a valid email address";
        }
      }

      setTouchedErrors((prev) => {
        if (error) {
          return { ...prev, [field]: error };
        }
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    },
    [address.country, showContactFields]
  );

  const handleBlur = (fieldName: string) => {
    const val = (address as Record<string, string>)[fieldName] ?? "";
    validateField(fieldName, val);
    if (propOnBlur) propOnBlur(fieldName);
  };

  // Country options loaded server-authoritatively
  const [countries, setCountries] = useState<WooCountry[]>(DEFAULT_INITIAL_COUNTRIES);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState<CountryDropdownPosition | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null);
  const dropdownPanelRef = useRef<HTMLDivElement>(null);

  // Fetch available countries from server action
  useEffect(() => {
    let mounted = true;
    getAvailableCountries()
      .then((data) => {
        if (mounted && Array.isArray(data) && data.length > 0) {
          setCountries(data);
        }
      })
      .catch((err) => {
        console.warn("[AddressFields] Failed to load countries from server:", err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const updateDropdownPosition = useCallback(() => {
    const trigger = dropdownTriggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const maxPanelHeight = Math.min(window.innerHeight * 0.7, 448);
    const availableWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
    const width = Math.min(rect.width, availableWidth);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding)
    );
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;

    const placement =
      spaceBelow < Math.min(maxPanelHeight, 180) && spaceAbove > spaceBelow ? "up" : "down";
    const availableSpace = placement === "up" ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(maxPanelHeight, availableSpace));

    setDropdownPosition({
      left,
      width,
      ...(placement === "up"
        ? { bottom: Math.max(viewportPadding, window.innerHeight - rect.top + viewportPadding) }
        : { top: Math.max(viewportPadding, rect.bottom + viewportPadding) }),
      maxHeight,
      placement,
    });
  }, []);

  const closeCountryDropdown = useCallback(() => {
    setIsDropdownOpen(false);
    setSearchQuery("");
    setDropdownPosition(null);
  }, []);

  // Ensure current country is set to a valid allowed default
  const selectedCountryCode = address.country || defaultCountry;
  useEffect(() => {
    if (isIndiaFixed && address.country !== "IN") {
      update("country", "IN");
    } else if (!address.country) {
      update("country", defaultCountry);
    }
  }, [isIndiaFixed, address.country, defaultCountry, update]);

  // Handle outside click to close country dropdown
  useEffect(() => {
    if (!isDropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        !dropdownPanelRef.current?.contains(target)
      ) {
        closeCountryDropdown();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen, closeCountryDropdown]);

  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && dropdownPanelRef.current?.contains(target)) {
        return;
      }
      closeCountryDropdown();
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", closeCountryDropdown);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", closeCountryDropdown);
    };
  }, [isDropdownOpen, closeCountryDropdown]);

  const currentCountryObj = useMemo(() => {
    return (
      countries.find((c) => c.code.toUpperCase() === selectedCountryCode.toUpperCase()) || {
        code: selectedCountryCode,
        name: selectedCountryCode === "IN" ? "India" : selectedCountryCode,
        states: [],
      }
    );
  }, [countries, selectedCountryCode]);

  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countries, searchQuery]);

  function handleSelectCountry(country: WooCountry) {
    update("country", country.code);
    if (address.state) {
      const validState = country.states?.some(
        (s) => s.code.toUpperCase() === address.state?.toUpperCase()
      );
      if (!validState) {
        update("state", "");
      }
    }
    closeCountryDropdown();
  }

  function handlePostcodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (selectedCountryCode === "IN") {
      const sanitized = val.replace(/\D/g, "").slice(0, 6);
      update("postcode", sanitized);
      if (touchedErrors.postcode) {
        validateField("postcode", sanitized);
      }
    } else {
      update("postcode", val);
      if (touchedErrors.postcode) {
        validateField("postcode", val);
      }
    }
  }

  const isNumericPostcode = selectedCountryCode === "IN";

  function field(fieldName: string) {
    const errorMsg = externalErrors[fieldName] || touchedErrors[fieldName];
    return {
      id: htmlId(fieldName),
      name: htmlId(fieldName),
      value: (address as Record<string, string>)[fieldName] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        update(fieldName, e.target.value);
        if (touchedErrors[fieldName]) {
          validateField(fieldName, e.target.value);
        }
      },
      onBlur: () => handleBlur(fieldName),
      "aria-invalid": Boolean(errorMsg),
    };
  }

  const shouldShowCompany = showCompany || (namePrefix === "billing" && !showContactFields);

  return (
    <div className="space-y-4">
      {/* 1. Country / Region (Full Width First) */}
      <div>
        <label htmlFor={htmlId("country")} className="text-sm font-medium mb-1 block text-foreground">
          {t("checkout.fields.country")}
        </label>

        <input type="hidden" id={htmlId("country")} name={htmlId("country")} value={selectedCountryCode} />

        {isIndiaFixed ? (
          <div
            className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm text-foreground select-none cursor-not-allowed opacity-90 dark:bg-muted/20"
            aria-disabled="true"
            title={t("checkout.fields.fixedCountryHint")}
          >
            <div className="flex items-center gap-2.5">
              <CountryFlag countryCode="IN" />
              <span className="font-medium text-foreground">India</span>
            </div>
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-background/80 dark:bg-card px-2 py-0.5 rounded border border-border/50">
              <Lock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              {t("checkout.fields.fixedCountryHint")}
            </span>
          </div>
        ) : (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              ref={dropdownTriggerRef}
              onClick={() => {
                if (isDropdownOpen) {
                  closeCountryDropdown();
                } else {
                  updateDropdownPosition();
                  setIsDropdownOpen(true);
                }
              }}
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
              className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <div className="flex items-center gap-2.5 truncate">
                <CountryFlag countryCode={currentCountryObj.code} />
                <span className="truncate font-medium">{currentCountryObj.name || selectedCountryCode}</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                  isDropdownOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            {isDropdownOpen &&
              dropdownPosition &&
              createPortal(
                <div
                  ref={dropdownPanelRef}
                  className="fixed z-[100] flex min-w-0 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg transition-all animate-in fade-in-0 zoom-in-95"
                  style={{
                    left: `${dropdownPosition.left}px`,
                    width: `${dropdownPosition.width}px`,
                    ...(dropdownPosition.placement === "up"
                      ? { bottom: `${dropdownPosition.bottom}px` }
                      : { top: `${dropdownPosition.top}px` }),
                    maxHeight: `${dropdownPosition.maxHeight}px`,
                  }}
                  role="listbox"
                >
                  <div className="flex shrink-0 items-center border-b border-border bg-muted/20 px-2.5 py-1.5">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground mr-2" aria-hidden="true" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t("checkout.fields.searchCountry")}
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Escape") closeCountryDropdown();
                      }}
                    />
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-1">
                    {filteredCountries.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                        {t("checkout.fields.noCountriesFound")}
                      </div>
                    ) : (
                      filteredCountries.map((c) => {
                        const isSelected = c.code.toUpperCase() === selectedCountryCode.toUpperCase();
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => handleSelectCountry(c)}
                            role="option"
                            aria-selected={isSelected}
                            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-left transition-colors ${
                              isSelected
                                ? "bg-primary text-primary-foreground font-medium"
                                : "hover:bg-accent hover:text-accent-foreground"
                            }`}
                          >
                            <CountryFlag countryCode={c.code} />
                            <span className="truncate">{c.name}</span>
                            <span
                              className={`ml-auto text-xs ${
                                isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                              }`}
                            >
                              {c.code}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>,
                document.body
              )}
          </div>
        )}
      </div>

      {/* 2. Name fields (2 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={htmlId("first_name")} className="text-sm font-medium mb-1 block text-foreground">
            {t("checkout.fields.firstName")}
          </label>
          <Input
            {...field("first_name")}
            autoComplete="given-name"
            placeholder={t("checkout.fields.firstNamePlaceholder")}
          />
          {(externalErrors.first_name || touchedErrors.first_name) && (
            <p className="text-xs text-destructive mt-1 font-medium">
              {externalErrors.first_name || touchedErrors.first_name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={htmlId("last_name")} className="text-sm font-medium mb-1 block text-foreground">
            {t("checkout.fields.lastName")}
          </label>
          <Input
            {...field("last_name")}
            autoComplete="family-name"
            placeholder={t("checkout.fields.lastNamePlaceholder")}
          />
          {(externalErrors.last_name || touchedErrors.last_name) && (
            <p className="text-xs text-destructive mt-1 font-medium">
              {externalErrors.last_name || touchedErrors.last_name}
            </p>
          )}
        </div>
      </div>

      {/* Company (Billing Form Only) */}
      {shouldShowCompany && (
        <div>
          <label htmlFor={htmlId("company")} className="text-sm font-medium mb-1 block text-foreground">
            {t("checkout.fields.company")}
          </label>
          <Input
            {...field("company")}
            autoComplete="organization"
            placeholder={t("checkout.fields.companyPlaceholder")}
          />
        </div>
      )}

      {/* Standalone contact fields if explicitly enabled */}
      {showContactFields && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={htmlId("email")} className="text-sm font-medium mb-1 block text-foreground">
              {t("checkout.fields.email")}
            </label>
            <Input
              {...field("email")}
              type="email"
              autoComplete="email"
              placeholder={t("checkout.fields.emailPlaceholder")}
            />
            {(externalErrors.email || touchedErrors.email) && (
              <p className="text-xs text-destructive mt-1 font-medium">
                {externalErrors.email || touchedErrors.email}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={htmlId("phone")} className="text-sm font-medium mb-1 block text-foreground">
              {t("checkout.fields.phone")}
            </label>
            <Input
              {...field("phone")}
              type="tel"
              autoComplete="tel"
              placeholder={t("checkout.fields.phonePlaceholder")}
            />
          </div>
        </div>
      )}

      {/* 3. Address Line 1 (Full Width) */}
      <div>
        <label htmlFor={htmlId("address_1")} className="text-sm font-medium mb-1 block text-foreground">
          {t("checkout.fields.address1")}
        </label>
        <Input
          {...field("address_1")}
          autoComplete="address-line1"
          placeholder={t("checkout.fields.streetPlaceholder")}
        />
        {(externalErrors.address_1 || touchedErrors.address_1) && (
          <p className="text-xs text-destructive mt-1 font-medium">
            {externalErrors.address_1 || touchedErrors.address_1}
          </p>
        )}
      </div>

      {/* 4. Expandable Address Line 2 */}
      {isAptOpen ? (
        <div className="animate-in fade-in-50 duration-200">
          <label htmlFor={htmlId("address_2")} className="text-sm font-medium mb-1 block text-foreground">
            {t("checkout.fields.address2")}
          </label>
          <Input
            {...field("address_2")}
            autoComplete="address-line2"
            placeholder={t("checkout.fields.aptPlaceholder")}
          />
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setAptOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors focus:outline-none focus-visible:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t("checkout.addApartment")}</span>
          </button>
        </div>
      )}

      {/* 5. Postcode + City + State/Province (3 columns on desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Postcode */}
        <div>
          <label htmlFor={htmlId("postcode")} className="text-sm font-medium mb-1 block text-foreground">
            {t("checkout.fields.postcode")}
          </label>
          <Input
            id={htmlId("postcode")}
            name={htmlId("postcode")}
            type="text"
            autoComplete="postal-code"
            inputMode={isNumericPostcode ? "numeric" : undefined}
            maxLength={isNumericPostcode ? 6 : undefined}
            value={address.postcode ?? ""}
            onChange={handlePostcodeChange}
            onBlur={() => handleBlur("postcode")}
            placeholder={t("checkout.fields.postcodePlaceholder")}
            aria-invalid={Boolean(externalErrors.postcode || touchedErrors.postcode)}
          />
          {(externalErrors.postcode || touchedErrors.postcode) && (
            <p className="text-xs text-destructive mt-1 font-medium">
              {externalErrors.postcode || touchedErrors.postcode}
            </p>
          )}
        </div>

        {/* City */}
        <div>
          <label htmlFor={htmlId("city")} className="text-sm font-medium mb-1 block text-foreground">
            {t("checkout.fields.city")}
          </label>
          <Input
            {...field("city")}
            autoComplete="address-level2"
            placeholder={t("checkout.fields.cityPlaceholder")}
          />
          {(externalErrors.city || touchedErrors.city) && (
            <p className="text-xs text-destructive mt-1 font-medium">
              {externalErrors.city || touchedErrors.city}
            </p>
          )}
        </div>

        {/* State / Province */}
        <div>
          <label htmlFor={htmlId("state")} className="text-sm font-medium mb-1 block text-foreground">
            {t("checkout.fields.state")}
          </label>

          {currentCountryObj.states && currentCountryObj.states.length > 0 ? (
            <select
              id={htmlId("state")}
              name={htmlId("state")}
              autoComplete="address-level1"
              value={address.state ?? ""}
              onChange={(e) => update("state", e.target.value)}
              onBlur={() => handleBlur("state")}
              className="flex h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark] dark:bg-input/30"
            >
              <option value="" className="bg-background text-foreground dark:bg-popover dark:text-popover-foreground">
                {t("checkout.fields.selectState")}
              </option>
              {currentCountryObj.states.map((s) => (
                <option
                  key={s.code}
                  value={s.code}
                  className="bg-background text-foreground dark:bg-popover dark:text-popover-foreground"
                >
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <Input
              {...field("state")}
              autoComplete="address-level1"
              placeholder={t("checkout.fields.statePlaceholder")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
