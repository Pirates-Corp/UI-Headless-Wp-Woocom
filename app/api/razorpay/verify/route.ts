import { NextRequest, NextResponse } from "next/server";
import {
  verifyRazorpayPaymentSignature,
  fetchRazorpayOrder,
} from "@/lib/razorpay-server";
import {
  getWooOrder,
  markWooOrderPaid,
  addWooOrderNote,
  updateWooOrderMeta,
  isLockedStatus,
} from "@/lib/stripe-server";
import { RazorpayVerifySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/razorpay/verify
 *
 * Called by the client after the Razorpay Checkout modal returns a
 * successful payment. Verifies the payment signature, verifies Razorpay order
 * server-side against the WooCommerce order, and updates status safely.
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
    wc_order_id,
    wc_order_key,
    billing_email,
  } = parsed.data;

  // 1. Verify HMAC SHA256 signature
  const isValid = verifyRazorpayPaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  );

  if (!isValid) {
    console.error(
      "[razorpay/verify] Signature verification failed for order:",
      wc_order_id
    );
    return NextResponse.json(
      { error: "Payment verification failed. Invalid signature." },
      { status: 400 }
    );
  }

  // 2. Fetch Razorpay order server-side & verify notes
  let rzpOrder;
  try {
    rzpOrder = await fetchRazorpayOrder(razorpay_order_id);
  } catch (err) {
    console.error("[razorpay/verify] Failed to fetch Razorpay order:", err);
    return NextResponse.json(
      { error: "Failed to verify Razorpay order details." },
      { status: 400 }
    );
  }

  if (rzpOrder.notes?.wc_order_id !== String(wc_order_id)) {
    console.error(
      `[razorpay/verify] Mismatched wc_order_id. Expected ${wc_order_id}, got ${rzpOrder.notes?.wc_order_id}`
    );
    return NextResponse.json(
      { error: "Order ID mismatch." },
      { status: 400 }
    );
  }

  // 3. Fetch Woo order & verify amount and currency
  let wooOrder;
  try {
    wooOrder = await getWooOrder(wc_order_id);
  } catch (err) {
    console.error(`[razorpay/verify] Failed to fetch WC order ${wc_order_id}:`, err);
    return NextResponse.json(
      { error: "Failed to fetch WooCommerce order for verification." },
      { status: 400 }
    );
  }

  const wooTotalMinor = Math.round(parseFloat(wooOrder.total || "0") * 100);
  if (
    rzpOrder.amount !== wooTotalMinor ||
    rzpOrder.currency.toUpperCase() !== (wooOrder.currency || "").toUpperCase()
  ) {
    console.error(
      `[razorpay/verify] Amount/currency mismatch. RZP: ${rzpOrder.amount} ${rzpOrder.currency}, WC: ${wooTotalMinor} ${wooOrder.currency}`
    );
    return NextResponse.json(
      { error: "Payment amount or currency mismatch." },
      { status: 400 }
    );
  }

  // 4. Guard status updates
  const currentStatus = (wooOrder.status || "").toLowerCase().replace(/^wc-/, "");

  try {
    if (currentStatus === "cancelled") {
      // Payment captured for an already cancelled order: leave status unchanged, add note & refund pending flag
      await addWooOrderNote(
        wc_order_id,
        "Payment captured after cancellation, refund required"
      );
      await updateWooOrderMeta(wc_order_id, [
        { key: "_myapp_refund_pending", value: 1 },
        { key: "_myapp_gateway", value: "razorpay" },
      ]);
      console.warn(
        `[razorpay/verify] Payment captured for cancelled order ${wc_order_id}; flagged refund pending.`
      );
    } else if (isLockedStatus(currentStatus)) {
      // Never move out of terminal/locked statuses
      console.log(
        `[razorpay/verify] Order ${wc_order_id} is in status '${currentStatus}', status preserved.`
      );
    } else {
      // Save status=processing, transaction_id, and meta in one call
      await markWooOrderPaid(wc_order_id, {
        status: "processing",
        transactionId: razorpay_payment_id,
        gateway: "razorpay",
      });
      console.log(
        `[razorpay/verify] WC order ${wc_order_id} → processing (payment: ${razorpay_payment_id})`
      );
    }
  } catch (err) {
    console.error(
      `[razorpay/verify] Failed to update WC order ${wc_order_id}:`,
      err
    );
    return NextResponse.json(
      { error: "Payment verified but failed to update order. Please contact support." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    verified: true,
    orderId: wc_order_id,
    orderKey: wc_order_key,
    billingEmail: billing_email,
  });
}
