import "server-only";

import type { AddressBook, SavedAddress } from "@/lib/woocommerce/types";

/**
 * Derives WordPress/WooCommerce root URL using environment variables.
 */
function getBaseUrl(): string {
  const protocol = process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL || "https";
  const host = process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST || "trjshop.com";
  return `${protocol}://${host}`.replace(/\/+$/, "");
}

/**
 * Retrieves the secret AUTH_KEY for internal custom endpoints.
 */
function getCartAuthKey(): string {
  const key = process.env.MYAPP_CART_AUTH_KEY;
  if (!key) {
    throw new Error("MYAPP_CART_AUTH_KEY environment variable is not configured");
  }
  return key;
}

/**
 * Common headers for internal REST calls.
 */
function getHeaders(authKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-auth-key": authKey,
  };
}

/**
 * Fetches a customer's address book from WordPress REST endpoint.
 */
export async function fetchAddressBook(userId: number): Promise<AddressBook> {
  try {
    const authKey = getCartAuthKey();
    const queryParams = new URLSearchParams({
      user_id: String(userId),
      AUTH_KEY: authKey,
    });
    const url = `${getBaseUrl()}/wp-json/myapp/v1/addresses?${queryParams.toString()}`;

    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders(authKey),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn(`[fetchAddressBook] WordPress endpoint failed with status ${res.status}:`, errorText);
      return { addresses: [], default_id: null };
    }

    const json = (await res.json()) as AddressBook;
    return {
      addresses: Array.isArray(json?.addresses) ? json.addresses : [],
      default_id: json?.default_id ?? null,
    };
  } catch (error: unknown) {
    console.warn("[fetchAddressBook] Unexpected error fetching address book:", error);
    return { addresses: [], default_id: null };
  }
}

/**
 * Creates or de-duplicates a saved address for a customer.
 */
export async function createAddress(
  userId: number,
  input: Omit<SavedAddress, "id" | "created_at" | "updated_at">
): Promise<{ success: boolean; data?: AddressBook; error?: string }> {
  try {
    const authKey = getCartAuthKey();
    const url = `${getBaseUrl()}/wp-json/myapp/v1/addresses`;

    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(authKey),
      body: JSON.stringify({
        user_id: userId,
        AUTH_KEY: authKey,
        ...input,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errJson = (await res.json().catch(() => null)) as { message?: string; code?: string } | null;
      const message = errJson?.message || `Address creation failed with status ${res.status}`;
      console.warn(`[createAddress] WordPress endpoint failed with status ${res.status}:`, message);
      return { success: false, error: message };
    }

    const json = (await res.json()) as AddressBook;
    return { success: true, data: json };
  } catch (error: unknown) {
    console.warn("[createAddress] Unexpected error creating address:", error);
    return { success: false, error: "Failed to save address." };
  }
}

/**
 * Updates an existing saved address for a customer.
 */
export async function updateAddress(
  userId: number,
  id: string,
  input: Partial<SavedAddress>
): Promise<{ success: boolean; data?: AddressBook; error?: string }> {
  try {
    const authKey = getCartAuthKey();
    const url = `${getBaseUrl()}/wp-json/myapp/v1/addresses/${encodeURIComponent(id)}`;

    const res = await fetch(url, {
      method: "PUT",
      headers: getHeaders(authKey),
      body: JSON.stringify({
        user_id: userId,
        AUTH_KEY: authKey,
        ...input,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errJson = (await res.json().catch(() => null)) as { message?: string } | null;
      const message = errJson?.message || `Address update failed with status ${res.status}`;
      console.warn(`[updateAddress] WordPress endpoint failed with status ${res.status}:`, message);
      return { success: false, error: message };
    }

    const json = (await res.json()) as AddressBook;
    return { success: true, data: json };
  } catch (error: unknown) {
    console.warn("[updateAddress] Unexpected error updating address:", error);
    return { success: false, error: "Failed to update address." };
  }
}

/**
 * Deletes a saved address for a customer.
 */
export async function deleteAddress(
  userId: number,
  id: string
): Promise<{ success: boolean; data?: AddressBook; error?: string }> {
  try {
    const authKey = getCartAuthKey();
    const queryParams = new URLSearchParams({
      user_id: String(userId),
      AUTH_KEY: authKey,
    });
    const url = `${getBaseUrl()}/wp-json/myapp/v1/addresses/${encodeURIComponent(id)}?${queryParams.toString()}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: getHeaders(authKey),
      cache: "no-store",
    });

    if (!res.ok) {
      const errJson = (await res.json().catch(() => null)) as { message?: string } | null;
      const message = errJson?.message || `Address deletion failed with status ${res.status}`;
      console.warn(`[deleteAddress] WordPress endpoint failed with status ${res.status}:`, message);
      return { success: false, error: message };
    }

    const json = (await res.json()) as AddressBook;
    return { success: true, data: json };
  } catch (error: unknown) {
    console.warn("[deleteAddress] Unexpected error deleting address:", error);
    return { success: false, error: "Failed to delete address." };
  }
}

/**
 * Sets a saved address as the customer's default shipping address.
 */
export async function setDefaultAddress(
  userId: number,
  id: string
): Promise<{ success: boolean; data?: AddressBook; error?: string }> {
  try {
    const authKey = getCartAuthKey();
    const url = `${getBaseUrl()}/wp-json/myapp/v1/addresses/${encodeURIComponent(id)}/default`;

    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(authKey),
      body: JSON.stringify({
        user_id: userId,
        AUTH_KEY: authKey,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errJson = (await res.json().catch(() => null)) as { message?: string } | null;
      const message = errJson?.message || `Set default address failed with status ${res.status}`;
      console.warn(`[setDefaultAddress] WordPress endpoint failed with status ${res.status}:`, message);
      return { success: false, error: message };
    }

    const json = (await res.json()) as AddressBook;
    return { success: true, data: json };
  } catch (error: unknown) {
    console.warn("[setDefaultAddress] Unexpected error setting default address:", error);
    return { success: false, error: "Failed to set default address." };
  }
}
