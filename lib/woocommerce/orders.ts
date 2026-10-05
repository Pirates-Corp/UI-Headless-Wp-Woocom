/**
 * Server-only WooCommerce Orders & Refunds REST API helpers.
 * Never import this file from client components.
 */

export interface RawWooOrder {
  id: number;
  status: string;
  total: string;
  currency: string;
  transaction_id?: string;
  customer_id?: number;
  date_paid?: string | null;
  date_completed?: string | null;
  shipping_total?: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  shipping?: {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  line_items?: Array<{
    id: number;
    name: string;
    product_id: number;
    variation_id: number;
    quantity: number;
    total: string;
    subtotal: string;
    price: number;
    image?: { id: number; src: string };
  }>;
  meta_data?: Array<{ id?: number; key: string; value: unknown }>;
  refunds?: Array<{ id: number; reason: string; total: string }>;
  payment_method?: string;
  payment_method_title?: string;
}

export interface WooRefundResponse {
  id: number;
  date_created?: string;
  amount: string;
  reason?: string;
  refunded_by?: number;
  refunded_payment?: boolean;
}

function getWcApiUrl(path: string): string {
  const ck = process.env.WC_CONSUMER_KEY;
  const cs = process.env.WC_CONSUMER_SECRET;
  if (!ck || !cs) throw new Error("WC_CONSUMER_KEY / WC_CONSUMER_SECRET not set");

  const base =
    (process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL || "https") +
    "://" +
    (process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST || "trjshop.com");
  const separator = path.includes("?") ? "&" : "?";
  return `${base}/wp-json/wc/v3/${path}${separator}consumer_key=${ck}&consumer_secret=${cs}`;
}

/**
 * Fetch a single WooCommerce order by ID.
 */
export async function getWooOrder(orderId: number): Promise<RawWooOrder> {
  const url = getWcApiUrl(`orders/${orderId}`);
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch WC order ${orderId} (${res.status}): ${body}`);
  }
  return (await res.json()) as RawWooOrder;
}

/**
 * Update WooCommerce order status.
 */
export async function updateWooOrderStatus(
  orderId: number,
  status: string
): Promise<void> {
  const url = getWcApiUrl(`orders/${orderId}`);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WC order update failed (${res.status}): ${body}`);
  }
}

/**
 * Add a note to a WooCommerce order.
 */
export async function addWooOrderNote(
  orderId: number,
  note: string
): Promise<void> {
  const url = getWcApiUrl(`orders/${orderId}/notes`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WC add order note failed (${res.status}): ${body}`);
  }
}

/**
 * Update WooCommerce order custom metadata.
 */
export async function updateWooOrderMeta(
  orderId: number,
  meta: Array<{ key: string; value: unknown }>
): Promise<void> {
  const url = getWcApiUrl(`orders/${orderId}`);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meta_data: meta }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WC update order meta failed (${res.status}): ${body}`);
  }
}

/**
 * Create a WooCommerce refund record without triggering gateway refund via WP.
 * Posts to /wc/v3/orders/{id}/refunds with api_refund: false and no line items.
 */
export async function createWooRefund(
  orderId: number,
  params: {
    amount: string | number;
    reason?: string;
  }
): Promise<WooRefundResponse> {
  const url = getWcApiUrl(`orders/${orderId}/refunds`);
  const body = {
    amount: String(params.amount),
    reason: params.reason || "Customer refund",
    api_refund: false,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const resBody = await res.text();
    throw new Error(`WC create refund failed (${res.status}): ${resBody}`);
  }
  return (await res.json()) as WooRefundResponse;
}

/**
 * Search WooCommerce order by transaction ID.
 */
export async function findWooOrderByTransactionId(
  transactionId: string
): Promise<RawWooOrder | null> {
  if (!transactionId) return null;
  const url = getWcApiUrl(`orders?search=${encodeURIComponent(transactionId)}`);
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to search WC orders (${res.status}): ${body}`);
  }
  const orders = (await res.json()) as RawWooOrder[];
  const matched = orders.find((o) => o.transaction_id === transactionId);
  return matched || orders[0] || null;
}

