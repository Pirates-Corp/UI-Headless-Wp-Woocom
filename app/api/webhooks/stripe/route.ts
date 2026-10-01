import { NextRequest, NextResponse } from "next/server";
import { constructStripeEvent } from "@/lib/stripe-server";
import {
  confirmPayment,
  updatePaymentStatus,
  PaymentBackendError,
} from "@/lib/woocommerce/payment-confirm";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

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

  const eventId = event.id;

  // Handle Stripe Checkout Session events
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded" ||
    event.type === "checkout.session.async_payment_failed" ||
    event.type === "checkout.session.expired"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const wcOrderId = Number(session.metadata?.wc_order_id);

    if (!wcOrderId || isNaN(wcOrderId)) {
      console.warn(`[stripe webhook] ${event.type}: session has no wc_order_id metadata — skipping`);
      return NextResponse.json({ received: true, skipped: true }, { status: 200 });
    }

    const paymentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id || session.id);
    const amountMinor = session.amount_total ?? 0;
    const currency = (session.currency || "USD").toUpperCase();

    try {
      if (
        event.type === "checkout.session.async_payment_succeeded" ||
        (event.type === "checkout.session.completed" && session.payment_status === "paid")
      ) {
        const result = await confirmPayment({
          gateway: "stripe",
          eventId,
          wcOrderId,
          paymentId,
          amountMinor,
          currency,
          source: "webhook",
        });

        if (!result.ok) {
          console.error(
            `[stripe webhook] confirmPayment returned ok:false (code: ${result.code}) for order ${wcOrderId}`
          );
        }

        return NextResponse.json({ received: true, result }, { status: 200 });
      }

      if (event.type === "checkout.session.completed" && session.payment_status !== "paid") {
        const result = await updatePaymentStatus({
          gateway: "stripe",
          eventId,
          wcOrderId,
          paymentId,
          status: "on-hold",
          reason: "Stripe checkout session completed with unpaid status",
        });

        if (!result.ok) {
          console.error(
            `[stripe webhook] updatePaymentStatus returned ok:false (code: ${result.code}) for order ${wcOrderId}`
          );
        }

        return NextResponse.json({ received: true, result }, { status: 200 });
      }

      if (event.type === "checkout.session.async_payment_failed") {
        const result = await updatePaymentStatus({
          gateway: "stripe",
          eventId,
          wcOrderId,
          paymentId,
          status: "failed",
          reason: "Stripe async payment failed",
        });

        if (!result.ok) {
          console.error(
            `[stripe webhook] updatePaymentStatus returned ok:false (code: ${result.code}) for order ${wcOrderId}`
          );
        }

        return NextResponse.json({ received: true, result }, { status: 200 });
      }

      if (event.type === "checkout.session.expired") {
        const result = await updatePaymentStatus({
          gateway: "stripe",
          eventId,
          wcOrderId,
          paymentId,
          status: "cancelled",
          reason: "Stripe checkout session expired",
        });

        if (!result.ok) {
          console.error(
            `[stripe webhook] updatePaymentStatus returned ok:false (code: ${result.code}) for order ${wcOrderId}`
          );
        }

        return NextResponse.json({ received: true, result }, { status: 200 });
      }
    } catch (err) {
      if (err instanceof PaymentBackendError) {
        console.error(
          `[stripe webhook] PaymentBackendError for order ${wcOrderId}:`,
          err
        );
        return NextResponse.json(
          { error: "Payment backend error. Will retry." },
          { status: 500 }
        );
      }
      console.error(
        `[stripe webhook] Unexpected error processing ${event.type} for order ${wcOrderId}:`,
        err
      );
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }

  // All other event types are acknowledged and ignored
  return NextResponse.json({ received: true, ignored: true }, { status: 200 });
}
