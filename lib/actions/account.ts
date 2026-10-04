"use server";

import { getSessionUser } from "@/lib/auth/session";
import { fetchOrderTracking } from "@/lib/woocommerce/shipping";
import type { OrderTrackingInfo } from "@/lib/woocommerce/shipping-types";
import { getCurrencySettings, getCurrencySymbol } from "@/lib/woocommerce/api";
import type { CurrencySettings } from "@/lib/woocommerce/types";
import { decodeHtml } from "@/lib/utils/format";
import {
  canCancelOrder,
  canReturnOrder,
  getReturnDeadline,
} from "@/lib/orders/eligibility";
import {
  getWooOrder,
  updateWooOrderStatus,
  addWooOrderNote,
  updateWooOrderMeta,
  createWooRefund,
  type RawWooOrder,
} from "@/lib/woocommerce/orders";
import { refundRazorpayPayment } from "@/lib/razorpay-server";
import { refundStripePayment } from "@/lib/stripe-server";
import { CancelOrderSchema, ReturnOrderSchema } from "@/lib/validation/schemas";


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
  paymentMethod: string;
  isPrepaid: boolean;
  shipmentAwb?: string;
  shipmentStatusId?: string | number;
  deliveredAt?: string;
  refundStatus?: "initiated" | "processed" | "failed";
  canCancel: boolean;
  canReturn: boolean;
  returnDeadline?: string;
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
  date_paid?: string | null;
  date_completed?: string | null;
  shipping_total?: string;
  total?: string;
  currency?: string;
  currency_symbol?: string;
  payment_method_title?: string;
  payment_method?: string;
  transaction_id?: string;
  billing?: {
    email?: string;
  };
  line_items?: RawLineItem[];
  meta_data?: Array<{ id?: number; key: string; value: unknown }>;
  refunds?: Array<{ id?: number; reason?: string; total?: string }>;
}

function getMetaValue(
  metaData?: Array<{ key: string; value: unknown }>,
  key?: string
): string | undefined {
  if (!Array.isArray(metaData) || !key) return undefined;
  const item = metaData.find((m) => m.key === key);
  if (item === undefined || item.value === undefined || item.value === null) return undefined;
  return String(item.value);
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
                if (orderMap.has(o.id)) continue;

                const orderCustomerId =
                  typeof o.customer_id === "number"
                    ? o.customer_id
                    : Number(o.customer_id ?? 0);
                const billingEmail = o.billing?.email?.toLowerCase().trim();

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

/**
 * Cancel an order requested by the authenticated customer.
 */
export async function cancelOrderAction(
  orderId: number,
  reason: string,
  note?: string
): Promise<{
  success: boolean;
  status?: string;
  refundStatus?: "initiated" | "processed" | "failed";
  message?: string;
  error?: string;
}> {
  try {
    const validated = CancelOrderSchema.safeParse({ orderId, reason, note });
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Invalid cancellation request",
      };
    }

    const user = await getSessionUser();
    if (!user) {
      return {
        success: false,
        error: "You must be signed in to cancel an order.",
      };
    }

    // 2. Fetch fresh order
    let order: RawWooOrder;
    try {
      order = await getWooOrder(orderId);
    } catch {
      return {
        success: false,
        error: "Order not found.",
      };
    }

    // Check ownership
    const orderCustomerId =
      typeof order.customer_id === "number" ? order.customer_id : Number(order.customer_id ?? 0);
    const userCustomerId = Number(user.id || 0);

    const isCustomerMatch = userCustomerId > 0 && orderCustomerId === userCustomerId;
    const isGuestEmailMatch =
      orderCustomerId === 0 &&
      Boolean(user.email && order.billing?.email?.toLowerCase().trim() === user.email.toLowerCase().trim());

    if (!isCustomerMatch && !isGuestEmailMatch) {
      return {
        success: false,
        error: "You do not have permission to cancel this order.",
      };
    }

    // 3. Idempotent check
    const currentStatus = (order.status || "").toLowerCase().replace(/^wc-/, "");
    const existingRefundStatus = getMetaValue(order.meta_data, "_myapp_refund_status") as
      | "initiated"
      | "processed"
      | "failed"
      | undefined;

    if (currentStatus === "cancelled" || currentStatus === "refunded") {
      return {
        success: true,
        status: currentStatus,
        refundStatus: existingRefundStatus,
        message: "Order is already cancelled.",
      };
    }

    // 4. Re-run eligibility on fresh data
    const shipmentAwb = getMetaValue(order.meta_data, "_myapp_shiprocket_awb");
    if (!canCancelOrder({ status: currentStatus, shipmentAwb })) {
      return {
        success: false,
        error: "This order can no longer be cancelled because shipment has already been initiated.",
      };
    }

    // 5. Update status to cancelled and add note
    await updateWooOrderStatus(orderId, "cancelled");
    const noteText = `Cancelled by customer. Reason: ${reason}${note ? ` | Note: ${note}` : ""}`;
    await addWooOrderNote(orderId, noteText);

    // 6. Check if prepaid
    const paymentMethod = (order.payment_method || "").toLowerCase();
    const isPrepaid = Boolean(
      (order.transaction_id && order.transaction_id.trim() !== "" && paymentMethod !== "cod" && paymentMethod !== "bacs") ||
      (order.date_paid && paymentMethod !== "cod" && paymentMethod !== "bacs")
    );

    if (!isPrepaid) {
      // COD / offline order - cancellation only, no gateway refund
      return {
        success: true,
        status: "cancelled",
        message: "Your order has been cancelled successfully.",
      };
    }

    // Prepaid order - execute gateway refund
    await updateWooOrderMeta(orderId, [{ key: "_myapp_refund_status", value: "initiated" }]);

    const totalAmount = parseFloat(order.total || "0");
    const amountMinor = Math.round(totalAmount * 100);
    const transactionId = order.transaction_id || "";
    const gateway = (getMetaValue(order.meta_data, "_myapp_gateway") || paymentMethod || "").toLowerCase();

    try {
      let refundId = "";
      if (gateway.includes("razorpay") || transactionId.startsWith("pay_")) {
        const rzpRefund = await refundRazorpayPayment(transactionId, amountMinor, {
          wc_order_id: String(orderId),
        });
        refundId = rzpRefund.id;
      } else if (gateway.includes("stripe") || transactionId.startsWith("pi_") || transactionId.startsWith("ch_")) {
        const stripeRefund = await refundStripePayment(transactionId, amountMinor, `cancel-${orderId}`);
        refundId = stripeRefund.id;
      } else {
        throw new Error(`Unsupported payment gateway for automatic refund: ${gateway || "unknown"}`);
      }

      // Save refund ID and mark refund processed
      await updateWooOrderMeta(orderId, [
        { key: "_myapp_refund_id", value: refundId },
        { key: "_myapp_refund_status", value: "processed" },
      ]);

      // Record refund in WooCommerce
      try {
        await createWooRefund(orderId, {
          amount: totalAmount,
          reason: `Customer cancellation: ${reason}`,
        });
      } catch (refundErr) {
        console.warn("[cancelOrderAction] WooCommerce refund record creation warning:", refundErr);
      }

      return {
        success: true,
        status: "refunded",
        refundStatus: "processed",
        message: "Your order has been cancelled and the full refund has been initiated.",
      };
    } catch (refundErr) {
      console.error(`[cancelOrderAction] Gateway refund failed for order ${orderId}:`, refundErr);
      const errMessage = refundErr instanceof Error ? refundErr.message : "Gateway error";

      await updateWooOrderMeta(orderId, [
        { key: "_myapp_refund_status", value: "failed" },
        { key: "_myapp_refund_pending", value: 1 },
      ]);
      await addWooOrderNote(
        orderId,
        `Gateway refund failed (${errMessage}). Manual refund required.`
      );

      return {
        success: true,
        status: "cancelled",
        refundStatus: "failed",
        message:
          "Your order has been cancelled. Our support team will process your refund manually.",
      };
    }
  } catch (error: unknown) {
    console.error("[cancelOrderAction] Unexpected error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel order",
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

    const paymentMethod = order.payment_method || "online";
    const isPrepaid = Boolean(
      (order.transaction_id && order.transaction_id.trim() !== "" && paymentMethod !== "cod" && paymentMethod !== "bacs") ||
      (order.date_paid && paymentMethod !== "cod" && paymentMethod !== "bacs")
    );

    const shipmentAwb = getMetaValue(order.meta_data, "_myapp_shiprocket_awb");
    const shipmentStatusId = getMetaValue(order.meta_data, "_myapp_shiprocket_status_id");
    const deliveredAt =
      getMetaValue(order.meta_data, "_myapp_delivered_at") ||
      order.date_completed ||
      undefined;

    const rawRefundStatus = getMetaValue(order.meta_data, "_myapp_refund_status");
    const refundStatus: "initiated" | "processed" | "failed" | undefined =
      rawRefundStatus === "initiated" || rawRefundStatus === "processed" || rawRefundStatus === "failed"
        ? rawRefundStatus
        : undefined;

    const canCancel = canCancelOrder({
      status: order.status || "pending",
      shipmentAwb,
    });

    const canReturn = canReturnOrder({
      status: order.status || "pending",
      deliveredAt,
    });

    const returnDeadline = getReturnDeadline({
      deliveredAt,
    });

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
      paymentMethod,
      isPrepaid,
      shipmentAwb,
      shipmentStatusId,
      deliveredAt,
      refundStatus,
      canCancel,
      canReturn,
      returnDeadline,
      lineItems,
    };
  });
}

export interface RequestReturnParams {
  orderId: number;
  reason: "damaged" | "defective" | "wrong_item" | "changed_mind" | "other";
  note?: string;
  items?: Array<{ id: number; quantity: number }>;
  photoUrls?: string[];
  refundAccount?: {
    type: "upi" | "bank";
    upiId?: string;
    accountNumber?: string;
    ifsc?: string;
    holderName?: string;
  };
}

export async function requestReturnAction(
  params: RequestReturnParams
): Promise<{
  success: boolean;
  status?: string;
  refundAmount?: number;
  message?: string;
  error?: string;
}> {
  try {
    const validated = ReturnOrderSchema.safeParse(params);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Invalid return request parameters.",
      };
    }

    const user = await getSessionUser();
    if (!user) {
      return {
        success: false,
        error: "You must be signed in to request a return.",
      };
    }

    const authKey = process.env.MYAPP_CART_AUTH_KEY || process.env.AUTH_KEY || "";
    if (!authKey) {
      return {
        success: false,
        error: "Returns service credentials not configured.",
      };
    }

    const protocol = process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL || "https";
    const host = process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST || "trjshop.com";
    const baseUrl = `${protocol}://${host}`.replace(/\/+$/, "");

    const queryParams = new URLSearchParams();
    queryParams.set("AUTH_KEY", authKey);
    if (user.id && Number(user.id) > 0) {
      queryParams.set("user_id", String(user.id));
    }
    if (user.email) {
      queryParams.set("email", user.email);
    }

    const url = `${baseUrl}/wp-json/myapp/v1/orders/${params.orderId}/return?${queryParams.toString()}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-key": authKey,
      },
      body: JSON.stringify({
        reason: params.reason,
        note: params.note,
        items: params.items,
        photo_urls: params.photoUrls,
        refund_account: params.refundAccount,
      }),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      status?: string;
      refund_amount?: number;
      message?: string;
      error?: string;
    } | null;

    if (!res.ok || !json || json.success === false) {
      return {
        success: false,
        error: json?.message || json?.error || `Failed to submit return request (${res.status}).`,
      };
    }

    return {
      success: true,
      status: json.status || "return-requested",
      refundAmount: json.refund_amount,
      message: json.message || "Your return request has been submitted successfully.",
    };
  } catch (err: unknown) {
    console.error("[requestReturnAction] Unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to submit return request.",
    };
  }
}

export async function uploadReturnPhotoAction(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return { success: false, error: "You must be signed in to upload photos." };
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: "Image size must be under 5 MB." };
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: "Only JPEG, PNG, WebP, or GIF images are allowed." };
    }

    const ck = process.env.WC_CONSUMER_KEY;
    const cs = process.env.WC_CONSUMER_SECRET;
    const protocol = process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL || "https";
    const host = process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST || "trjshop.com";
    const base = `${protocol}://${host}`.replace(/\/+$/, "");

    const authHeader = ck && cs ? "Basic " + Buffer.from(`${ck}:${cs}`).toString("base64") : "";
    const buffer = Buffer.from(await file.arrayBuffer());

    const authKey = process.env.MYAPP_CART_AUTH_KEY || process.env.AUTH_KEY || "";
    const internalUrl = `${base}/wp-json/myapp/v1/media/upload`;

    const res = await fetch(internalUrl, {
      method: "POST",
      headers: {
        "x-auth-key": authKey,
      },
      body: formData,
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      let errorMsg = "Failed to upload photo to media library.";
      try {
        const parsed = JSON.parse(errText);
        if (parsed.message) errorMsg = parsed.message;
      } catch {
        // use fallback
      }
      console.error("[uploadReturnPhotoAction] Media upload failed:", res.status, errText);
      return { success: false, error: errorMsg };
    }

    const mediaJson = (await res.json()) as { source_url?: string };
    if (!mediaJson.source_url) {
      return { success: false, error: "Upload succeeded but no media URL returned." };
    }

    return {
      success: true,
      url: mediaJson.source_url,
    };
  } catch (err: unknown) {
    console.error("[uploadReturnPhotoAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to upload photo.",
    };
  }
}


