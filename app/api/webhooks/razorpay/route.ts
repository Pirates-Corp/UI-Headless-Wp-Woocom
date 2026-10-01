import { NextRequest, NextResponse } from "next/server";
import {
  verifyRazorpayWebhookSignature,
  fetchRazorpayOrder,
} from "@/lib/razorpay-server";
import {
  confirmPayment,
  updatePaymentStatus,
  PaymentBackendError,
} from "@/lib/woocommerce/payment-confirm";

export const dynamic = "force-dynamic";

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        notes?: Record<string, string>;
        status: string;
      };
    };
    order?: {
      entity: {
        id: string;
        amount: number;
        currency: string;
        notes?: Record<string, string>;
        status: string;
      };
    };
  };
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
  const paymentEntity = payload.payload?.payment?.entity;
  const orderEntity = payload.payload?.order?.entity;

  // Derive unique event ID from header or fallback
  const eventId =
    req.headers.get("x-razorpay-event-id") ||
    `${eventType}:${paymentEntity?.id || orderEntity?.id || Date.now()}`;

  // If payment.authorized, explicitly ignore per spec
  if (eventType === "payment.authorized") {
    return NextResponse.json({ received: true, ignored: true }, { status: 200 });
  }

  // Filter unhandled event types early
  if (
    eventType !== "payment.captured" &&
    eventType !== "order.paid" &&
    eventType !== "payment.failed"
  ) {
    return NextResponse.json({ received: true, ignored: true }, { status: 200 });
  }

  // Resolve WooCommerce order ID via payment.entity.order_id -> fetchRazorpayOrder -> notes.wc_order_id
  let wcOrderId: number | null = null;
  const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;

  if (razorpayOrderId) {
    try {
      const rzpOrder = await fetchRazorpayOrder(razorpayOrderId);
      if (rzpOrder.notes?.wc_order_id) {
        wcOrderId = Number(rzpOrder.notes.wc_order_id);
      }
    } catch (err) {
      console.warn(
        `[razorpay webhook] Failed to fetch Razorpay order ${razorpayOrderId}:`,
        err
      );
    }
  }

  // Fallback to payload notes if direct order fetch didn't resolve it
  if (!wcOrderId || isNaN(wcOrderId)) {
    const payloadWcId =
      paymentEntity?.notes?.wc_order_id || orderEntity?.notes?.wc_order_id;
    if (payloadWcId) {
      wcOrderId = Number(payloadWcId);
    }
  }

  if (!wcOrderId || isNaN(wcOrderId)) {
    console.error(
      `[razorpay webhook] ${eventType}: Unable to resolve wc_order_id from Razorpay order or payload notes`
    );
    // Acknowledge with 200 skipped so Razorpay does not retry
    return NextResponse.json({ received: true, skipped: true }, { status: 200 });
  }

  // Handle payment success (payment.captured / order.paid)
  if (eventType === "payment.captured" || eventType === "order.paid") {
    if (!paymentEntity) {
      console.warn(
        `[razorpay webhook] ${eventType}: Missing payment entity in payload`
      );
      return NextResponse.json({ received: true, skipped: true }, { status: 200 });
    }

    try {
      const result = await confirmPayment({
        gateway: "razorpay",
        eventId,
        wcOrderId,
        paymentId: paymentEntity.id,
        amountMinor: paymentEntity.amount,
        currency: paymentEntity.currency,
        source: "webhook",
      });

      if (!result.ok) {
        console.error(
          `[razorpay webhook] confirmPayment returned ok:false (code: ${result.code}) for order ${wcOrderId}`
        );
      }

      return NextResponse.json({ received: true, result }, { status: 200 });
    } catch (err) {
      if (err instanceof PaymentBackendError) {
        console.error(
          `[razorpay webhook] PaymentBackendError for order ${wcOrderId}:`,
          err
        );
        return NextResponse.json(
          { error: "Payment backend error. Will retry." },
          { status: 500 }
        );
      }
      console.error(
        `[razorpay webhook] Unexpected error confirming payment for order ${wcOrderId}:`,
        err
      );
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }

  // Handle payment failure (payment.failed)
  if (eventType === "payment.failed") {
    try {
      const result = await updatePaymentStatus({
        gateway: "razorpay",
        eventId,
        wcOrderId,
        paymentId: paymentEntity?.id || "",
        status: "failed",
        reason: "Razorpay payment.failed webhook",
      });

      if (!result.ok) {
        console.error(
          `[razorpay webhook] updatePaymentStatus returned ok:false (code: ${result.code}) for order ${wcOrderId}`
        );
      }

      return NextResponse.json({ received: true, result }, { status: 200 });
    } catch (err) {
      if (err instanceof PaymentBackendError) {
        console.error(
          `[razorpay webhook] PaymentBackendError updating status for order ${wcOrderId}:`,
          err
        );
        return NextResponse.json(
          { error: "Payment backend error. Will retry." },
          { status: 500 }
        );
      }
      console.error(
        `[razorpay webhook] Unexpected error updating status for order ${wcOrderId}:`,
        err
      );
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true, ignored: true }, { status: 200 });
}
