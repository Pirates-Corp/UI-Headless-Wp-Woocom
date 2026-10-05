import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay-server";
import {
  getWooOrder,
  markWooOrderPaid,
  updateWooOrderStatus,
  addWooOrderNote,
  updateWooOrderMeta,
  isLockedStatus,
} from "@/lib/stripe-server";

export const dynamic = "force-dynamic";

/**
 * Maps each relevant Razorpay webhook event to the WC order status it should produce.
 * These serve as asynchronous backup — the primary verification happens
 * synchronously in /api/razorpay/verify after the checkout modal callback.
 */
const EVENT_TO_WC_STATUS: Record<string, string> = {
  // Payment was authorized (manual capture flow)
  "payment.authorized": "on-hold",
  // Payment was captured (auto-capture or manual capture)
  "payment.captured": "processing",
  // Payment failed
  "payment.failed": "failed",
  // Order is fully paid (backup confirmation)
  "order.paid": "processing",
};

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        notes?: Record<string, string>;
        status: string;
      };
    };
    order?: {
      entity: {
        id: string;
        notes?: Record<string, string>;
        status: string;
      };
    };
    refund?: {
      entity: {
        id: string;
        payment_id: string;
        notes?: Record<string, string>;
        status: string;
      };
    };
  };
}

/**
 * Extract the WooCommerce order ID from the Razorpay webhook payload.
 * The wc_order_id is stored in the Razorpay order notes during creation.
 */
function extractWcOrderId(payload: RazorpayWebhookPayload): number | null {
  // Try refund entity notes
  const refundNotes = payload.payload?.refund?.entity?.notes;
  if (refundNotes?.wc_order_id) {
    return Number(refundNotes.wc_order_id);
  }

  // Try payment entity notes first
  const paymentNotes = payload.payload?.payment?.entity?.notes;
  if (paymentNotes?.wc_order_id) {
    return Number(paymentNotes.wc_order_id);
  }

  // Fallback to order entity notes
  const orderNotes = payload.payload?.order?.entity?.notes;
  if (orderNotes?.wc_order_id) {
    return Number(orderNotes.wc_order_id);
  }

  return null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Must read raw body before any parsing for signature verification
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing x-razorpay-signature header" },
      { status: 400 }
    );
  }

  // Verify webhook signature using HMAC SHA256
  const isValid = verifyRazorpayWebhookSignature(rawBody, signature);
  if (!isValid) {
    console.error("[razorpay webhook] Signature verification failed");
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // Parse the verified payload
  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const eventType = payload.event;
  const wcOrderId = extractWcOrderId(payload);

  if (eventType === "refund.processed" || eventType === "refund.failed") {
    if (!wcOrderId) {
      console.warn(
        `[razorpay webhook] ${eventType}: No wc_order_id in notes — skipping`
      );
      return NextResponse.json({ received: true, skipped: true });
    }

    try {
      const refundId = payload.payload?.refund?.entity?.id || "N/A";
      if (eventType === "refund.processed") {
        await updateWooOrderMeta(wcOrderId, [
          { key: "_myapp_refund_status", value: "processed" },
        ]);
        await addWooOrderNote(
          wcOrderId,
          `Razorpay refund processed (Refund ID: ${refundId})`
        );
        console.log(`[razorpay webhook] Refund processed for order ${wcOrderId}`);
        return NextResponse.json({ received: true, refundStatus: "processed" });
      } else {
        await updateWooOrderMeta(wcOrderId, [
          { key: "_myapp_refund_status", value: "failed" },
          { key: "_myapp_refund_pending", value: 1 },
        ]);
        await addWooOrderNote(
          wcOrderId,
          `Razorpay refund failed (Refund ID: ${refundId}), manual refund required.`
        );
        console.warn(`[razorpay webhook] Refund failed for order ${wcOrderId}`);
        return NextResponse.json({ received: true, refundStatus: "failed" });
      }
    } catch (err) {
      console.error(
        `[razorpay webhook] Failed to update refund status for order ${wcOrderId}:`,
        err
      );
      return NextResponse.json(
        { error: "Failed to update WooCommerce refund status. Will retry." },
        { status: 500 }
      );
    }
  }

  const targetStatus = EVENT_TO_WC_STATUS[eventType];

  if (!targetStatus) {
    // Acknowledge unknown/unhandled events so Razorpay doesn't retry
    return NextResponse.json({ received: true, ignored: true });
  }

  if (!wcOrderId) {
    console.warn(
      `[razorpay webhook] ${eventType}: No wc_order_id in notes — skipping`
    );
    // Acknowledge anyway so Razorpay doesn't retry
    return NextResponse.json({ received: true, skipped: true });
  }

  const paymentId = payload.payload?.payment?.entity?.id;


  try {
    const wooOrder = await getWooOrder(wcOrderId);
    const currentStatus = (wooOrder.status || "").toLowerCase().replace(/^wc-/, "");

    if (currentStatus === "cancelled") {
      if (eventType === "payment.captured" || eventType === "order.paid") {
        await addWooOrderNote(
          wcOrderId,
          "Payment captured after cancellation, refund required"
        );
        await updateWooOrderMeta(wcOrderId, [
          { key: "_myapp_refund_pending", value: 1 },
          { key: "_myapp_gateway", value: "razorpay" },
        ]);
        console.warn(
          `[razorpay webhook] Payment captured for cancelled order ${wcOrderId}; flagged refund pending.`
        );
      }
      return NextResponse.json({ received: true, status: "cancelled_preserved" });
    }

    if (isLockedStatus(currentStatus)) {
      console.log(
        `[razorpay webhook] ${eventType}: Order ${wcOrderId} is in locked status '${currentStatus}' — skipping update`
      );
      return NextResponse.json({ received: true, status: "locked_preserved" });
    }

    if (
      currentStatus === "processing" &&
      (targetStatus === "pending" || targetStatus === "on-hold" || targetStatus === "failed")
    ) {
      console.log(
        `[razorpay webhook] ${eventType}: Cannot revert order ${wcOrderId} from processing to ${targetStatus}`
      );
      return NextResponse.json({ received: true, ignored: true });
    }

    if (targetStatus === "processing") {
      await markWooOrderPaid(wcOrderId, {
        status: "processing",
        transactionId: paymentId,
        gateway: "razorpay",
      });
      console.log(
        `[razorpay webhook] ${eventType}: WC order ${wcOrderId} → processing (payment: ${paymentId})`
      );
    } else if (targetStatus !== currentStatus) {
      await updateWooOrderStatus(wcOrderId, targetStatus);
      console.log(
        `[razorpay webhook] ${eventType}: WC order ${wcOrderId} → ${targetStatus}`
      );
    }
  } catch (err) {
    // Return 500 so Razorpay retries delivery
    console.error(
      `[razorpay webhook] Failed to update WC order ${wcOrderId}:`,
      err
    );
    return NextResponse.json(
      { error: "Failed to update WooCommerce order status. Will retry." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
