import "server-only";

export type PaymentResult =
  | { ok: true; result: "paid" | "duplicate" | "already_paid" | "ignored" }
  | { ok: false; code: "amount_mismatch" | "currency_mismatch" | "order_not_found" | "invalid" };

export interface ConfirmPaymentInput {
  gateway: "razorpay" | "stripe";
  eventId: string;
  wcOrderId: number;
  paymentId: string;
  amountMinor: number;
  currency: string;
  source: "webhook" | "verify";
}

export interface UpdatePaymentStatusInput {
  gateway: "razorpay" | "stripe";
  eventId: string;
  wcOrderId: number;
  paymentId?: string;
  status: "failed" | "cancelled" | "on-hold";
  reason?: string;
}

export class PaymentBackendError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "PaymentBackendError";
    this.status = status;
  }
}

/**
 * Derives WordPress/WooCommerce root URL using environment variables.
 */
function getBaseUrl(): string {
  const protocol = process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL || "https";
  const host = process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST || "trjshop.com";
  return `${protocol}://${host}`.replace(/\/+$/, "");
}

/**
 * Retrieves the secret AUTH_KEY for payment confirmation endpoints.
 * Throws a clear error if the server environment variable is missing.
 */
function getPaymentAuthKey(): string {
  const key = process.env.MYAPP_PAYMENT_AUTH_KEY;
  if (!key) {
    throw new PaymentBackendError("MYAPP_PAYMENT_AUTH_KEY environment variable is not configured");
  }
  return key;
}

/**
 * Confirms a payment with WordPress mu-plugin endpoint.
 *
 * Throws PaymentBackendError on network error, timeout, 401, 5xx, or 503 so gateway callers retry.
 */
export async function confirmPayment(
  input: ConfirmPaymentInput
): Promise<PaymentResult> {
  const authKey = getPaymentAuthKey();
  const url = `${getBaseUrl()}/wp-json/myapp/v1/payment/confirm`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-key": authKey,
      },
      body: JSON.stringify({
        gateway: input.gateway,
        event_id: input.eventId,
        wc_order_id: input.wcOrderId,
        payment_id: input.paymentId,
        amount_minor: input.amountMinor,
        currency: input.currency.toUpperCase(),
        source: input.source,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new PaymentBackendError(
      `Payment confirmation request failed: ${(err as Error).message}`
    );
  }

  // Handle unauthorized or server error responses
  if (res.status === 401 || res.status >= 500) {
    const errorText = await res.text().catch(() => "");
    throw new PaymentBackendError(
      `WordPress payment confirm returned HTTP ${res.status}: ${errorText}`,
      res.status
    );
  }

  // Parse JSON response
  let data: { ok?: boolean; result?: string; code?: string } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new PaymentBackendError(
      `Invalid JSON response from payment confirm endpoint (status ${res.status})`,
      res.status
    );
  }

  if (res.status === 200 && data.ok && data.result) {
    return {
      ok: true,
      result: data.result as "paid" | "duplicate" | "already_paid" | "ignored",
    };
  }

  if (res.status === 409) {
    const code =
      data.code === "currency_mismatch" ? "currency_mismatch" : "amount_mismatch";
    return { ok: false, code };
  }

  if (res.status === 404) {
    return { ok: false, code: "order_not_found" };
  }

  if (res.status === 400) {
    return { ok: false, code: "invalid" };
  }

  throw new PaymentBackendError(
    `Unexpected response from payment confirm endpoint: ${res.status} - ${JSON.stringify(data)}`,
    res.status
  );
}

/**
 * Updates an order status with WordPress mu-plugin endpoint.
 *
 * Throws PaymentBackendError on network error, timeout, 401, 5xx, or 503 so gateway callers retry.
 */
export async function updatePaymentStatus(
  input: UpdatePaymentStatusInput
): Promise<PaymentResult> {
  const authKey = getPaymentAuthKey();
  const url = `${getBaseUrl()}/wp-json/myapp/v1/payment/status`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-key": authKey,
      },
      body: JSON.stringify({
        gateway: input.gateway,
        event_id: input.eventId,
        wc_order_id: input.wcOrderId,
        payment_id: input.paymentId || "",
        status: input.status,
        reason: input.reason || "",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new PaymentBackendError(
      `Payment status update request failed: ${(err as Error).message}`
    );
  }

  // Handle unauthorized or server error responses
  if (res.status === 401 || res.status >= 500) {
    const errorText = await res.text().catch(() => "");
    throw new PaymentBackendError(
      `WordPress payment status returned HTTP ${res.status}: ${errorText}`,
      res.status
    );
  }

  let data: { ok?: boolean; result?: string; code?: string } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new PaymentBackendError(
      `Invalid JSON response from payment status endpoint (status ${res.status})`,
      res.status
    );
  }

  if (res.status === 200 && data.ok && data.result) {
    return {
      ok: true,
      result: data.result as "paid" | "duplicate" | "already_paid" | "ignored",
    };
  }

  if (res.status === 404) {
    return { ok: false, code: "order_not_found" };
  }

  if (res.status === 400) {
    return { ok: false, code: "invalid" };
  }

  throw new PaymentBackendError(
    `Unexpected response from payment status endpoint: ${res.status} - ${JSON.stringify(data)}`,
    res.status
  );
}
