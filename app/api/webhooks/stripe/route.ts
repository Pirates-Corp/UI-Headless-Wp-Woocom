import { NextRequest, NextResponse } from "next/server";
import {
  constructStripeEvent,
  getWooOrder,
  markWooOrderPaid,
  updateWooOrderStatus,
  addWooOrderNote,
  updateWooOrderMeta,
  findWooOrderByTransactionId,
  isLockedStatus,
} from "@/lib/stripe-server";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

// Maps each relevant Stripe event to the WC order status it should produce
const EVENT_TO_WC_STATUS: Partial<Record<Stripe.Event["type"], string>> = {
  // Card payment completed immediately
  "checkout.session.completed": "processing", // payment_status === 'paid'
  // Async methods (BACS, SEPA, etc.) that succeed after a delay
  "checkout.session.async_payment_succeeded": "processing",
  // Async payment failed after delay
  "checkout.session.async_payment_failed": "failed",
  // Session expired without payment
  "checkout.session.expired": "cancelled",
};

async function handleSessionEvent(
  session: Stripe.Checkout.Session,
  targetStatus: string
): Promise<NextResponse | null> {
  const orderId = Number(session.metadata?.wc_order_id);
  if (!orderId) {
    console.warn("[stripe webhook] session has no wc_order_id metadata — skipping");
    return null; // acknowledge anyway so Stripe doesn't retry
  }

  // Extract payment intent ID (transactionId)
  const transactionId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as { id?: string } | null)?.id;

  // For checkout.session.completed with async payment methods, the
  // payment_status will be 'unpaid' — put the order on-hold instead.
  const isPaid = session.payment_status === "paid" || targetStatus === "processing";
  const status =
    targetStatus === "processing" && session.payment_status !== "paid"
      ? "on-hold"
      : targetStatus;

  try {
    const wooOrder = await getWooOrder(orderId);
    const currentStatus = (wooOrder.status || "").toLowerCase().replace(/^wc-/, "");

    if (currentStatus === "cancelled") {
      if (isPaid && session.payment_status === "paid") {
        await addWooOrderNote(
          orderId,
          "Payment captured after cancellation, refund required"
        );
        await updateWooOrderMeta(orderId, [
          { key: "_myapp_refund_pending", value: 1 },
          { key: "_myapp_gateway", value: "stripe" },
        ]);
        console.warn(
          `[stripe webhook] Payment captured for cancelled order ${orderId}; flagged refund pending.`
        );
      }
      return null;
    }

    if (isLockedStatus(currentStatus)) {
      console.log(
        `[stripe webhook] Order ${orderId} is in locked status '${currentStatus}' — skipping update`
      );
      return null;
    }

    if (
      currentStatus === "processing" &&
      (status === "pending" || status === "on-hold" || status === "failed")
    ) {
      console.log(
        `[stripe webhook] Cannot revert order ${orderId} from processing to ${status}`
      );
      return null;
    }

    if (status === "processing" && session.payment_status === "paid") {
      await markWooOrderPaid(orderId, {
        status: "processing",
        transactionId,
        gateway: "stripe",
      });
      console.log(
        `[stripe webhook] WC order ${orderId} → processing (payment_intent: ${transactionId})`
      );
    } else if (status !== currentStatus) {
      await updateWooOrderStatus(orderId, status);
      console.log(`[stripe webhook] WC order ${orderId} → ${status}`);
    }
  } catch (err) {
    // Return 500 so Stripe retries delivery
    console.error(`[stripe webhook] failed to update WC order ${orderId}:`, err);
    return NextResponse.json(
      { error: "Failed to update WooCommerce order status. Will retry." },
      { status: 500 }
    );
  }

  return null; // success — no error response
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Must read raw body before any parsing for signature verification
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = constructStripeEvent(rawBody, sig);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return NextResponse.json(
      { error: `Webhook verification failed: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;

    let orderId: number | null = charge.metadata?.wc_order_id
      ? Number(charge.metadata.wc_order_id)
      : null;

    if (!orderId && paymentIntentId) {
      try {
        const foundOrder = await findWooOrderByTransactionId(paymentIntentId);
        if (foundOrder) {
          orderId = foundOrder.id;
        }
      } catch (err) {
        console.error("[stripe webhook] Error searching order for refunded charge:", err);
      }
    }

    if (orderId) {
      try {
        await updateWooOrderMeta(orderId, [
          { key: "_myapp_refund_status", value: "processed" },
        ]);
        await addWooOrderNote(
          orderId,
          `Stripe refund processed (Charge ID: ${charge.id})`
        );
        console.log(`[stripe webhook] Refund processed for order ${orderId}`);
      } catch (err) {
        console.error(`[stripe webhook] Failed to update refund meta for order ${orderId}:`, err);
        return NextResponse.json(
          { error: "Failed to update WooCommerce refund status. Will retry." },
          { status: 500 }
        );
      }
    } else {
      console.warn(`[stripe webhook] charge.refunded: Could not find order for charge ${charge.id}`);
    }
    return NextResponse.json({ received: true, refundStatus: "processed" });
  }

  const handled = EVENT_TO_WC_STATUS[event.type];
  if (handled) {
    const session = event.data.object as Stripe.Checkout.Session;
    const errResponse = await handleSessionEvent(session, handled);
    if (errResponse) return errResponse;
  }
  // All other event types are acknowledged and ignored

  return NextResponse.json({ received: true });
}

