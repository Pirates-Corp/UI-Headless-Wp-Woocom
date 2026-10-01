import type { BillingAddress, ShippingAddress } from "@/lib/woocommerce/types";

export interface EffectiveAddressesInput {
  shipping: ShippingAddress;
  billing: BillingAddress;
  billingSameAsShipping: boolean;
}

export interface EffectiveAddressesResult {
  billing: BillingAddress;
  shipping: ShippingAddress;
}

/**
 * Derives effective shipping and billing addresses for WooCommerce checkout.
 *
 * Rules:
 * - Shipping address always comes from the Delivery form (`shipping`).
 * - If `billingSameAsShipping` is true:
 *   Billing address mirrors delivery fields (first_name, last_name, address_1, address_2,
 *   city, state, postcode, country, company) while retaining `billing.email` and `billing.phone` (from Contact).
 * - If `billingSameAsShipping` is false:
 *   Billing address comes directly from the separate Billing form (`billing`).
 */
export function getEffectiveAddresses({
  shipping,
  billing,
  billingSameAsShipping,
}: EffectiveAddressesInput): EffectiveAddressesResult {
  const effectiveShipping: ShippingAddress = {
    first_name: shipping?.first_name ?? "",
    last_name: shipping?.last_name ?? "",
    company: shipping?.company ?? "",
    address_1: shipping?.address_1 ?? "",
    address_2: shipping?.address_2 ?? "",
    city: shipping?.city ?? "",
    state: shipping?.state ?? "",
    postcode: shipping?.postcode ?? "",
    country: shipping?.country ?? "",
  };

  const effectiveBilling: BillingAddress = billingSameAsShipping
    ? {
        first_name: shipping?.first_name ?? "",
        last_name: shipping?.last_name ?? "",
        company: billing?.company || shipping?.company || "",
        address_1: shipping?.address_1 ?? "",
        address_2: shipping?.address_2 ?? "",
        city: shipping?.city ?? "",
        state: shipping?.state ?? "",
        postcode: shipping?.postcode ?? "",
        country: shipping?.country ?? "",
        email: billing?.email ?? "",
        phone: billing?.phone ?? "",
      }
    : {
        first_name: billing?.first_name ?? "",
        last_name: billing?.last_name ?? "",
        company: billing?.company ?? "",
        address_1: billing?.address_1 ?? "",
        address_2: billing?.address_2 ?? "",
        city: billing?.city ?? "",
        state: billing?.state ?? "",
        postcode: billing?.postcode ?? "",
        country: billing?.country ?? "",
        email: billing?.email ?? "",
        phone: billing?.phone ?? "",
      };

  return {
    billing: effectiveBilling,
    shipping: effectiveShipping,
  };
}
