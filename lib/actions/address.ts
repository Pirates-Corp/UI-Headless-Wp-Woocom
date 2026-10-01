"use server";

import { getSessionUser } from "@/lib/auth/session";
import {
  fetchAddressBook,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "@/lib/woocommerce/address-book";
import { SavedAddressInputSchema, BillingSchema } from "@/lib/validation/schemas";
import type { AddressBook, BillingAddress, SavedAddress } from "@/lib/woocommerce/types";

/**
 * Returns WooCommerce customer REST API credentials and base customer URL.
 */
function getCustomerApiConfig(userId: number) {
  const ck = process.env.WC_CONSUMER_KEY;
  const cs = process.env.WC_CONSUMER_SECRET;
  if (!ck || !cs) {
    throw new Error("WC_CONSUMER_KEY / WC_CONSUMER_SECRET not set");
  }

  const protocol = process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL || "https";
  const host = process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST || "trjshop.com";
  const url = new URL(`${protocol}://${host}/wp-json/wc/v3/customers/${userId}`);
  url.searchParams.set("consumer_key", ck);
  url.searchParams.set("consumer_secret", cs);

  return { url: url.toString() };
}

/**
 * Fetches the saved address book for the authenticated session user.
 */
export async function getAddressBookAction(): Promise<{
  ok: boolean;
  error?: string;
  data?: AddressBook;
}> {
  try {
    const user = await getSessionUser();
    if (!user?.id || Number(user.id) <= 0) {
      return { ok: false, error: "Unauthorized" };
    }

    const addressBook = await fetchAddressBook(Number(user.id));
    return { ok: true, data: addressBook };
  } catch (err: unknown) {
    console.warn("[getAddressBookAction] Failed to retrieve address book:", err);
    return { ok: false, error: "Failed to retrieve address book." };
  }
}

/**
 * Creates or updates a matching address in the authenticated session user's address book.
 */
export async function createAddressAction(
  input: unknown
): Promise<{ ok: boolean; error?: string; data?: AddressBook }> {
  try {
    const user = await getSessionUser();
    if (!user?.id || Number(user.id) <= 0) {
      return { ok: false, error: "Unauthorized" };
    }

    const parseResult = SavedAddressInputSchema.safeParse(input);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      return {
        ok: false,
        error: firstIssue?.message || "Invalid address details.",
      };
    }

    const res = await createAddress(Number(user.id), parseResult.data);
    if (!res.success || !res.data) {
      return { ok: false, error: res.error || "Failed to save address." };
    }

    return { ok: true, data: res.data };
  } catch (err: unknown) {
    console.warn("[createAddressAction] Failed to create address:", err);
    return { ok: false, error: "Failed to save address." };
  }
}

/**
 * Updates a specific address entry in the authenticated session user's address book.
 */
export async function updateAddressAction(
  id: string,
  input: unknown
): Promise<{ ok: boolean; error?: string; data?: AddressBook }> {
  try {
    const user = await getSessionUser();
    if (!user?.id || Number(user.id) <= 0) {
      return { ok: false, error: "Unauthorized" };
    }

    if (!id || typeof id !== "string") {
      return { ok: false, error: "Missing address ID." };
    }

    const parseResult = SavedAddressInputSchema.partial().safeParse(input);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      return {
        ok: false,
        error: firstIssue?.message || "Invalid address update data.",
      };
    }

    const res = await updateAddress(Number(user.id), id, parseResult.data as Partial<SavedAddress>);
    if (!res.success || !res.data) {
      return { ok: false, error: res.error || "Failed to update address." };
    }

    return { ok: true, data: res.data };
  } catch (err: unknown) {
    console.warn("[updateAddressAction] Failed to update address:", err);
    return { ok: false, error: "Failed to update address." };
  }
}

/**
 * Deletes a specific address entry from the authenticated session user's address book.
 */
export async function deleteAddressAction(
  id: string
): Promise<{ ok: boolean; error?: string; data?: AddressBook }> {
  try {
    const user = await getSessionUser();
    if (!user?.id || Number(user.id) <= 0) {
      return { ok: false, error: "Unauthorized" };
    }

    if (!id || typeof id !== "string") {
      return { ok: false, error: "Missing address ID." };
    }

    const res = await deleteAddress(Number(user.id), id);
    if (!res.success || !res.data) {
      return { ok: false, error: res.error || "Failed to delete address." };
    }

    return { ok: true, data: res.data };
  } catch (err: unknown) {
    console.warn("[deleteAddressAction] Failed to delete address:", err);
    return { ok: false, error: "Failed to delete address." };
  }
}

/**
 * Sets a specific address entry as the default for the authenticated session user.
 */
export async function setDefaultAddressAction(
  id: string
): Promise<{ ok: boolean; error?: string; data?: AddressBook }> {
  try {
    const user = await getSessionUser();
    if (!user?.id || Number(user.id) <= 0) {
      return { ok: false, error: "Unauthorized" };
    }

    if (!id || typeof id !== "string") {
      return { ok: false, error: "Missing address ID." };
    }

    const res = await setDefaultAddress(Number(user.id), id);
    if (!res.success || !res.data) {
      return { ok: false, error: res.error || "Failed to set default address." };
    }

    return { ok: true, data: res.data };
  } catch (err: unknown) {
    console.warn("[setDefaultAddressAction] Failed to set default address:", err);
    return { ok: false, error: "Failed to set default address." };
  }
}

/**
 * Fetches the native single WooCommerce billing address for the authenticated session user.
 */
export async function getSavedBillingAction(): Promise<{
  ok: boolean;
  error?: string;
  data?: BillingAddress;
}> {
  try {
    const user = await getSessionUser();
    if (!user?.id || Number(user.id) <= 0) {
      return { ok: false, error: "Unauthorized" };
    }

    const { url } = getCustomerApiConfig(Number(user.id));
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[getSavedBillingAction] WooCommerce API failed with status ${res.status}`);
      return { ok: false, error: "Failed to fetch billing address." };
    }

    const json = (await res.json()) as {
      billing?: {
        first_name?: string;
        last_name?: string;
        company?: string;
        address_1?: string;
        address_2?: string;
        city?: string;
        state?: string;
        postcode?: string;
        country?: string;
        email?: string;
        phone?: string;
      };
    };

    const b = json.billing || {};
    const billing: BillingAddress = {
      first_name: b.first_name || "",
      last_name: b.last_name || "",
      company: b.company || "",
      address_1: b.address_1 || "",
      address_2: b.address_2 || "",
      city: b.city || "",
      state: b.state || "",
      postcode: b.postcode || "",
      country: b.country || "",
      email: b.email || user.email || "",
      phone: b.phone || "",
    };

    return { ok: true, data: billing };
  } catch (err: unknown) {
    console.warn("[getSavedBillingAction] Unexpected error fetching billing address:", err);
    return { ok: false, error: "Failed to fetch billing address." };
  }
}

/**
 * Saves the native single WooCommerce billing address for the authenticated session user.
 * Note: Modifies only the customer's billing address fields. Never alters username, password, or account email.
 */
export async function saveBillingAction(
  billing: unknown
): Promise<{ ok: boolean; error?: string; data?: BillingAddress }> {
  try {
    const user = await getSessionUser();
    if (!user?.id || Number(user.id) <= 0) {
      return { ok: false, error: "Unauthorized" };
    }

    const parseResult = BillingSchema.safeParse(billing);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      return {
        ok: false,
        error: firstIssue?.message || "Invalid billing address details.",
      };
    }

    const validBilling = parseResult.data;
    const { url } = getCustomerApiConfig(Number(user.id));

    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        billing: {
          first_name: validBilling.first_name,
          last_name: validBilling.last_name,
          company: validBilling.company || "",
          address_1: validBilling.address_1,
          address_2: validBilling.address_2 || "",
          city: validBilling.city,
          state: validBilling.state || "",
          postcode: validBilling.postcode,
          country: validBilling.country,
          email: validBilling.email,
          phone: validBilling.phone || "",
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn(`[saveBillingAction] WooCommerce API failed with status ${res.status}:`, errorText);
      return { ok: false, error: "Failed to save billing address." };
    }

    return { ok: true, data: validBilling };
  } catch (err: unknown) {
    console.warn("[saveBillingAction] Unexpected error saving billing address:", err);
    return { ok: false, error: "Failed to save billing address." };
  }
}
