import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BillingAddress, ShippingAddress } from "@/lib/woocommerce/types";
import {
  getDefaultCountry,
  isCountryAllowed,
  isSingleCountryFixed,
} from "@/lib/config/countries";

const emptyBilling: BillingAddress = {
  first_name: "",
  last_name: "",
  company: "",
  address_1: "",
  address_2: "",
  city: "",
  state: "",
  postcode: "",
  country: getDefaultCountry(),
  email: "",
  phone: "",
};

const emptyShipping: ShippingAddress = {
  first_name: "",
  last_name: "",
  company: "",
  address_1: "",
  address_2: "",
  city: "",
  state: "",
  postcode: "",
  country: getDefaultCountry(),
};

interface CheckoutState {
  billing: BillingAddress;
  shipping: ShippingAddress;
  billingSameAsShipping: boolean;
  selectedPaymentMethod: string;
  updateBilling: (field: keyof BillingAddress, value: string) => void;
  updateShipping: (field: keyof ShippingAddress, value: string) => void;
  setBillingSameAsShipping: (value: boolean) => void;
  setSelectedPaymentMethod: (method: string) => void;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set) => ({
      billing: { ...emptyBilling },
      shipping: { ...emptyShipping },
      billingSameAsShipping: true,
      selectedPaymentMethod: "",

      updateBilling: (field, value) =>
        set((state) => ({ billing: { ...state.billing, [field]: value } })),

      updateShipping: (field, value) =>
        set((state) => ({ shipping: { ...state.shipping, [field]: value } })),

      setBillingSameAsShipping: (value) => set({ billingSameAsShipping: value }),

      setSelectedPaymentMethod: (method) => set({ selectedPaymentMethod: method }),

      reset: () =>
        set({
          billing: { ...emptyBilling },
          shipping: { ...emptyShipping },
          billingSameAsShipping: true,
          selectedPaymentMethod: "",
        }),
    }),
    {
      name: "checkout-store",
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const state = (persistedState || {}) as Record<string, unknown>;
        if (version < 2) {
          const oldSameAsShipping =
            typeof state.sameAsShipping === "boolean" ? state.sameAsShipping : true;
          state.billingSameAsShipping = oldSameAsShipping;
          delete state.sameAsShipping;

          const billing = (state.billing || {}) as Record<string, string>;
          const shipping = (state.shipping || {}) as Record<string, string>;
          if (!shipping.address_1 && billing.address_1) {
            state.shipping = {
              first_name: billing.first_name || "",
              last_name: billing.last_name || "",
              company: billing.company || "",
              address_1: billing.address_1 || "",
              address_2: billing.address_2 || "",
              city: billing.city || "",
              state: billing.state || "",
              postcode: billing.postcode || "",
              country: billing.country || getDefaultCountry(),
            };
          }
        }
        return state as unknown as CheckoutState;
      },
      // Only persist data fields, not the action functions
      partialize: (state) => ({
        billing: state.billing,
        shipping: state.shipping,
        billingSameAsShipping: state.billingSameAsShipping,
        selectedPaymentMethod: state.selectedPaymentMethod,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (isSingleCountryFixed()) {
          state.billing.country = "IN";
          state.shipping.country = "IN";
        } else {
          if (!isCountryAllowed(state.billing.country)) {
            state.billing.country = getDefaultCountry();
          }
          if (!isCountryAllowed(state.shipping.country)) {
            state.shipping.country = getDefaultCountry();
          }
        }
      },
    }
  )
);
