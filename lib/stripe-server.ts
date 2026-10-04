/**
 * Server-only Stripe + WooCommerce REST API utilities.
 * Never import this file from client components.
 */
import Stripe from "stripe";

// Singleton — constructed once per server process
function getStripeServer(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

// ─── Stripe Checkout Session ──────────────────────────────────────────────────

export interface LineItemParam {
  price_data: {
    currency: string;
    product_data: { name: string };
    unit_amount: number;
  };
  quantity: number;
}

export interface CreateSessionParams {
  orderId: number;
  lineItems: LineItemParam[];
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createStripeCheckoutSession(
  params: CreateSessionParams
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeServer();
  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: params.lineItems,
    customer_email: params.customerEmail,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { wc_order_id: String(params.orderId) },
    // Suppress Stripe's own billing/shipping collection since we already have it
    billing_address_collection: "auto",
  });
}

export async function retrieveStripeCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeServer();
  return stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Verifies a Stripe webhook signature and constructs the event.
 * Must be called with the raw request body string (not parsed JSON).
 */
export function constructStripeEvent(
  rawBody: string,
  signature: string
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  const stripe = getStripeServer();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

export async function refundStripePayment(
  paymentIntentId: string,
  amountMinor?: number,
  idempotencyKey?: string
): Promise<Stripe.Refund> {
  const stripe = getStripeServer();
  const params: Stripe.RefundCreateParams = {
    payment_intent: paymentIntentId,
  };
  if (typeof amountMinor === "number") {
    params.amount = amountMinor;
  }
  return stripe.refunds.create(
    params,
    idempotencyKey ? { idempotencyKey } : undefined
  );
}

// ─── WooCommerce REST API v3 ──────────────────────────────────────────────────

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

export interface MarkWooOrderPaidParams {
  status: string;
  transactionId?: string;
  gateway: "razorpay" | "stripe";
}

const TERMINAL_OR_LOCKED_STATUSES = new Set([
  "cancelled",
  "refunded",
  "completed",
  "shipped",
  "rto",
]);

export function isLockedStatus(status: string): boolean {
  const normalized = status.toLowerCase().replace(/^wc-/, "");
  return TERMINAL_OR_LOCKED_STATUSES.has(normalized) || normalized.startsWith("return-");
}

function getWcApiUrl(path: string): string {
  const ck = process.env.WC_CONSUMER_KEY;
  const cs = process.env.WC_CONSUMER_SECRET;
  if (!ck || !cs) throw new Error("WC_CONSUMER_KEY / WC_CONSUMER_SECRET not set");

  const base = process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL + "://" + process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST;
  const separator = path.includes("?") ? "&" : "?";
  return `${base}/wp-json/wc/v3/${path}${separator}consumer_key=${ck}&consumer_secret=${cs}`;
}

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
 * Update a WooCommerce order status via the REST API.
 * Uses query-string auth so it works on both HTTP and HTTPS.
 * status values: "pending" | "processing" | "on-hold" | "completed" | "cancelled" | "refunded" | "failed"
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

export async function markWooOrderPaid(
  orderId: number,
  params: MarkWooOrderPaidParams
): Promise<void> {
  const url = getWcApiUrl(`orders/${orderId}`);
  const body: Record<string, unknown> = {
    status: params.status,
    meta_data: [
      { key: "_myapp_gateway", value: params.gateway },
    ],
  };

  if (params.transactionId) {
    body.transaction_id = params.transactionId;
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const resBody = await res.text();
    throw new Error(`WC order mark paid failed (${res.status}): ${resBody}`);
  }
}

export async function addWooOrderNote(orderId: number, note: string): Promise<void> {
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

