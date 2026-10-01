"use server";

import { getSessionUser } from "@/lib/auth/session";
import { fetchOrderTracking } from "@/lib/woocommerce/shipping";
import type { OrderTrackingInfo } from "@/lib/woocommerce/shipping-types";
import { getCurrencySettings, getCurrencySymbol } from "@/lib/woocommerce/api";
import type { CurrencySettings } from "@/lib/woocommerce/types";
import { decodeHtml } from "@/lib/utils/format";

export interface CustomerOrderLineItem {
  id: number;
  productId: number;
  variationId?: number;
  name: string;
  quantity: number;
  total: string;
  price: number;
  sku?: string;
  image?: string;
}

export interface CustomerOrderSummary {
  id: number;
  number: string;
  status: string;
  dateCreated: string;
  total: string;
  currency: string;
  currencySymbol: string;
  currencyPrefix: string;
  currencySuffix: string;
  currencyMinorUnit: number;
  itemCount: number;
  paymentMethodTitle: string;
  lineItems: CustomerOrderLineItem[];
}

interface RawLineItem {
  id?: number;
  product_id?: number;
  variation_id?: number;
  name?: string;
  quantity?: number;
  total?: string;
  price?: number;
  sku?: string;
  image?: {
    id?: number | string;
    src?: string;
  };
}

interface RawOrder {
  id: number;
  customer_id?: number;
  number?: string;
  status?: string;
  date_created?: string;
  date_created_gmt?: string;
  total?: string;
  currency?: string;
  currency_symbol?: string;
  payment_method_title?: string;
  payment_method?: string;
  billing?: {
    email?: string;
  };
  line_items?: RawLineItem[];
}

/**
 * Fetch orders for the currently authenticated customer.
 */
export async function getCustomerOrdersAction(): Promise<{
  success: boolean;
  orders: CustomerOrderSummary[];
  error?: string;
}> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return {
        success: false,
        orders: [],
        error: "You must be signed in to view your orders.",
      };
    }

    const ck = process.env.WC_CONSUMER_KEY;
    const cs = process.env.WC_CONSUMER_SECRET;
    if (!ck || !cs) {
      return {
        success: false,
        orders: [],
        error: "WooCommerce API credentials not configured",
      };
    }

    const protocol = process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL || "https";
    const host = process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST || "trjshop.com";
    const baseUrl = `${protocol}://${host}/wp-json/wc/v3/orders`;

    const orderMap = new Map<number, RawOrder>();

    // 1. Primary source: Fetch orders by customer ID if logged in
    if (user.id && Number(user.id) > 0) {
      try {
        const idUrl = new URL(baseUrl);
        idUrl.searchParams.set("consumer_key", ck);
        idUrl.searchParams.set("consumer_secret", cs);
        idUrl.searchParams.set("customer", String(user.id));
        idUrl.searchParams.set("per_page", "50");

        const idRes = await fetch(idUrl.toString(), { cache: "no-store" });
        if (idRes.ok) {
          const idData = (await idRes.json().catch(() => [])) as RawOrder[];
          if (Array.isArray(idData)) {
            for (const o of idData) {
              if (o?.id) orderMap.set(o.id, o);
            }
          }
        }
      } catch (idErr) {
        console.warn("[getCustomerOrdersAction] Customer ID search error:", idErr);
      }
    }

    // 2. Fallback: Fetch legacy guest orders matching the account email.
    // Note: This fallback exists only for legacy guest orders placed prior to customer_id assignment
    // and can be removed once old orders are reassigned.
    // Only accepts orders where customer_id === 0 (true guest orders) AND billing email equals account email.
    // Skips any order whose customer_id belongs to a different non-zero user.
    if (user.email) {
      try {
        const emailUrl = new URL(baseUrl);
        emailUrl.searchParams.set("consumer_key", ck);
        emailUrl.searchParams.set("consumer_secret", cs);
        emailUrl.searchParams.set("search", user.email.trim());
        emailUrl.searchParams.set("per_page", "50");

        const emailRes = await fetch(emailUrl.toString(), { cache: "no-store" });
        if (emailRes.ok) {
          const emailData = (await emailRes.json().catch(() => [])) as RawOrder[];
          if (Array.isArray(emailData)) {
            const userEmailLower = user.email.toLowerCase().trim();
            for (const o of emailData) {
              if (o?.id) {
                // If already captured by primary customer query, skip
                if (orderMap.has(o.id)) continue;

                const orderCustomerId =
                  typeof o.customer_id === "number"
                    ? o.customer_id
                    : Number(o.customer_id ?? 0);
                const billingEmail = o.billing?.email?.toLowerCase().trim();

                // Tightened fallback: accept ONLY true guest orders (customer_id === 0)
                // where the billing email equals the authenticated account email.
                if (orderCustomerId === 0 && billingEmail === userEmailLower) {
                  orderMap.set(o.id, o);
                }
              }
            }
          }
        }
      } catch (emailErr) {
        console.warn("[getCustomerOrdersAction] Email search error:", emailErr);
      }
    }

    // 3. Sort merged orders newest to oldest
    const combinedRawOrders = Array.from(orderMap.values()).sort((a, b) => {
      const dateA = new Date(a.date_created || a.date_created_gmt || 0).getTime();
      const dateB = new Date(b.date_created || b.date_created_gmt || 0).getTime();
      if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
        return dateB - dateA;
      }
      return b.id - a.id;
    });

    const storeCurrency = await getCurrencySettings();
    const orders = formatOrders(combinedRawOrders, storeCurrency);
    return {
      success: true,
      orders,
    };
  } catch (error: unknown) {
    return {
      success: false,
      orders: [],
      error: error instanceof Error ? error.message : "Failed to retrieve orders",
    };
  }
}

/**
 * Fetch shipment tracking information for a specific order.
 * Ensures the authenticated user owns the requested order before fetching.
 */
export async function getOrderTrackingAction(orderId: number): Promise<{
  success: boolean;
  tracking?: OrderTrackingInfo;
  error?: string;
}> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return {
        success: false,
        error: "You must be signed in to view tracking details.",
      };
    }

    return await fetchOrderTracking(orderId, user.id, user.email);
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to retrieve order tracking.",
    };
  }
}

function formatOrders(
  rawOrders: RawOrder[],
  storeCurrency: CurrencySettings
): CustomerOrderSummary[] {
  return rawOrders.map((order) => {
    const lineItems: CustomerOrderLineItem[] = Array.isArray(order.line_items)
      ? order.line_items.map((item) => ({
          id: item.id || 0,
          productId: item.product_id || item.id || 0,
          variationId: item.variation_id || undefined,
          name: item.name || "Item",
          quantity: item.quantity || 1,
          total: item.total || "0",
          price: item.price || 0,
          sku: item.sku || undefined,
          image: item.image?.src || undefined,
        }))
      : [];

    const itemCount = lineItems.reduce((sum, item) => sum + item.quantity, 0);
    const currencyCode = order.currency || storeCurrency.code || "INR";
    const rawSymbol = order.currency_symbol || getCurrencySymbol(currencyCode) || storeCurrency.symbol || "₹";
    const currencySymbol = decodeHtml(rawSymbol);

    const currencyPrefix =
      order.currency && order.currency !== storeCurrency.code
        ? currencySymbol
        : storeCurrency.prefix || currencySymbol;
    const currencySuffix =
      order.currency && order.currency !== storeCurrency.code
        ? ""
        : storeCurrency.suffix || "";

    return {
      id: order.id,
      number: String(order.number || order.id),
      status: order.status || "pending",
      dateCreated: order.date_created || order.date_created_gmt || "",
      total: order.total || "0",
      currency: currencyCode,
      currencySymbol,
      currencyPrefix,
      currencySuffix,
      currencyMinorUnit: storeCurrency.minor_unit ?? 2,
      itemCount,
      paymentMethodTitle: order.payment_method_title || order.payment_method || "Online",
      lineItems,
    };
  });
}
