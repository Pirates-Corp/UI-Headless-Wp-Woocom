import { NextRequest, NextResponse } from "next/server";
import {
  verifyRazorpayPaymentSignature,
  fetchRazorpayOrder,
  fetchRazorpayPayment,
} from "@/lib/razorpay-server";
import { confirmPayment, PaymentBackendError } from "@/lib/woocommerce/payment-confirm";
import { RazorpayVerifySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/razorpay/verify
 *
 * Called by the client after the Razorpay Checkout modal returns a
 * successful payment. Verifies the signature, validates the order against
 * Razorpay's API, and confirms payment with WordPress.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate input shape with Zod
  const parsed = RazorpayVerifySchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    wc_order_id: bodyWcOrderId,
    wc_order_key: bodyWcOrderKey,
    billing_email,
  } = parsed.data;

  // Verify HMAC SHA256 signature
  const isValid = verifyRazorpayPaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  );

  if (!isValid) {
    console.error(
      "[razorpay/verify] Signature verification failed for razorpay_order_id:",
      razorpay_order_id
    );
    return NextResponse.json(
      { error: "Payment verification failed. Invalid signature." },
      { status: 400 }
    );
  }

  // 1. Fetch Razorpay order to securely resolve wc_order_id as the ONLY source of truth
  let rzpOrder;
  try {
    rzpOrder = await fetchRazorpayOrder(razorpay_order_id);
  } catch (err) {
    console.error("[razorpay/verify] Failed to fetch Razorpay order:", err);
    return NextResponse.json(
      { error: "Failed to verify Razorpay order with gateway." },
      { status: 500 }
    );
  }

  const wcOrderId = Number(rzpOrder.notes?.wc_order_id);
  if (!wcOrderId || isNaN(wcOrderId)) {
    console.error("[razorpay/verify] Missing or invalid wc_order_id in Razorpay order notes:", rzpOrder.notes);
    return NextResponse.json(
      { error: "Unable to resolve order from gateway." },
      { status: 400 }
    );
  }

  // If the body included a wc_order_id and it differs from the gateway order notes, reject with 403
  if (bodyWcOrderId !== undefined && bodyWcOrderId !== wcOrderId) {
    console.error(
      `[razorpay/verify] Order ID mismatch! Body: ${bodyWcOrderId}, Gateway Notes: ${wcOrderId}`
    );
    return NextResponse.json(
      { error: "Order ID mismatch." },
      { status: 403 }
    );
  }

  // 2. Fetch Razorpay payment to verify status and order association
  let payment;
  try {
    payment = await fetchRazorpayPayment(razorpay_payment_id);
  } catch (err) {
    console.error("[razorpay/verify] Failed to fetch Razorpay payment:", err);
    return NextResponse.json(
      { error: "Failed to fetch payment details from gateway." },
      { status: 500 }
    );
  }

  if (
    payment.order_id !== razorpay_order_id ||
    !["captured", "authorized"].includes(payment.status)
  ) {
    console.error(
      `[razorpay/verify] Invalid payment. order_id: ${payment.order_id} (expected ${razorpay_order_id}), status: ${payment.status}`
    );
    return NextResponse.json(
      { error: "Payment does not match order or is in an invalid state." },
      { status: 400 }
    );
  }

  // 3. Confirm payment with WordPress backend
  try {
    const result = await confirmPayment({
      gateway: "razorpay",
      eventId: `verify_${razorpay_payment_id}`,
      wcOrderId,
      paymentId: payment.id,
      amountMinor: payment.amount,
      currency: payment.currency,
      source: "verify",
    });

    if (!result.ok) {
      console.error("[razorpay/verify] confirmPayment returned not ok:", result.code);
      return NextResponse.json(
        { error: "We couldn't confirm this payment. Please contact support." },
        { status: 409 }
      );
    }
  } catch (err) {
    if (err instanceof PaymentBackendError) {
      console.error("[razorpay/verify] PaymentBackendError:", err);
      return NextResponse.json(
        { error: "Payment verification backend error. Please contact support." },
        { status: 500 }
      );
    }
    console.error("[razorpay/verify] Unexpected error confirming payment:", err);
    return NextResponse.json(
      { error: "Unexpected error confirming payment." },
      { status: 500 }
    );
  }

  const orderKey = rzpOrder.notes?.wc_order_key || bodyWcOrderKey || "";

  return NextResponse.json({
    verified: true,
    orderId: wcOrderId,
    orderKey,
    billingEmail: billing_email,
  });
}
