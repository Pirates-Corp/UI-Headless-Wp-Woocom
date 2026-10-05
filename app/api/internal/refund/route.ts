import { NextRequest, NextResponse } from "next/server";
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

export const dynamic = "force-dynamic";

function getInternalAuthKey(): string {
  return (
    process.env.MYAPP_CART_AUTH_KEY ||
    process.env.AUTH_KEY ||
    ""
  );
}

function getMetaValue(meta: RawWooOrder["meta_data"], key: string): string | undefined {
  if (!meta) return undefined;
  const item = meta.find((m) => m.key === key);
  return item && typeof item.value === "string" ? item.value : undefined;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authKey = getInternalAuthKey();
  const reqKey = req.headers.get("x-auth-key") || req.headers.get("authorization");

  if (!authKey || !reqKey || (reqKey !== authKey && reqKey !== `Bearer ${authKey}`)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Invalid internal auth key" },
      { status: 401 }
    );
  }

  let body: { orderId?: number | string; amount?: number | string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const orderId = Number(body.orderId);
  if (!orderId || isNaN(orderId)) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid orderId" },
      { status: 400 }
    );
  }

  try {
    const order = await getWooOrder(orderId);
    const currentStatus = (order.status || "").toLowerCase().replace(/^wc-/, "");

    // 1. Verify status is return-received
    if (currentStatus !== "return-received") {
      return NextResponse.json(
        {
          success: false,
          error: `Order is not in 'return-received' status (current status: '${currentStatus}')`,
        },
        { status: 400 }
      );
    }

    // Check if return refund already processed
    const existingRefundId = getMetaValue(order.meta_data, "_myapp_return_refund_id");
    if (existingRefundId) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        refundId: existingRefundId,
        message: "Return refund has already been processed.",
      });
    }

    const orderTotal = parseFloat(order.total || "0");
    const requestedAmount = body.amount !== undefined ? parseFloat(String(body.amount)) : orderTotal;
    const amount = Math.min(orderTotal, Math.max(0, requestedAmount));
    const amountMinor = Math.round(amount * 100);

    const paymentMethod = (order.payment_method || "").toLowerCase();
    const transactionId = order.transaction_id || "";
    const isPrepaid = Boolean(
      (transactionId && transactionId.trim() !== "" && paymentMethod !== "cod" && paymentMethod !== "bacs") ||
      (order.date_paid && paymentMethod !== "cod" && paymentMethod !== "bacs")
    );

    const reason = body.reason || "Return received";

    if (!isPrepaid) {
      // COD Order: Record manual refund pending for team to transfer funds
      await updateWooOrderMeta(orderId, [
        { key: "_myapp_refund_pending", value: 1 },
        { key: "_myapp_refund_status", value: "initiated" },
      ]);
      await addWooOrderNote(
        orderId,
        `Return received for COD order. Refund of ${amount} pending manual bank/UPI transfer.`
      );

      return NextResponse.json({
        success: true,
        orderId,
        isPrepaid: false,
        refundPending: true,
        amount,
        message: "COD return recorded; manual refund pending transfer to customer.",
      });
    }

    // Prepaid order: Execute gateway refund
    const gateway = (getMetaValue(order.meta_data, "_myapp_gateway") || paymentMethod).toLowerCase();
    let refundId = "";

    try {
      if (gateway.includes("razorpay") || transactionId.startsWith("pay_")) {
        const rzpRefund = await refundRazorpayPayment(transactionId, amountMinor, {
          wc_order_id: String(orderId),
        });
        refundId = rzpRefund.id;
      } else if (gateway.includes("stripe") || transactionId.startsWith("pi_") || transactionId.startsWith("ch_")) {
        const stripeRefund = await refundStripePayment(transactionId, amountMinor, `return-${orderId}`);
        refundId = stripeRefund.id;
      } else {
        throw new Error(`Unsupported payment gateway: ${gateway}`);
      }

      await updateWooOrderMeta(orderId, [
        { key: "_myapp_return_refund_id", value: refundId },
        { key: "_myapp_refund_status", value: "processed" },
      ]);

      // Record refund in WooCommerce
      try {
        await createWooRefund(orderId, {
          amount,
          reason,
        });
      } catch (wcErr) {
        console.warn("[/api/internal/refund] WC refund record creation warning:", wcErr);
      }

      // If full refund (or sum of refunds >= total), transition to refunded
      const priorRefundTotal = (order.refunds || []).reduce(
        (sum, r) => sum + Math.abs(parseFloat(r.total || "0")),
        0
      );
      if (priorRefundTotal + amount >= orderTotal - 0.01) {
        await updateWooOrderStatus(orderId, "refunded");
      }

      return NextResponse.json({
        success: true,
        orderId,
        isPrepaid: true,
        refundId,
        amount,
        status: priorRefundTotal + amount >= orderTotal - 0.01 ? "refunded" : "return-received",
      });
    } catch (refundErr) {
      console.error("[/api/internal/refund] Gateway refund error:", refundErr);
      const errMessage = refundErr instanceof Error ? refundErr.message : "Gateway error";

      await updateWooOrderMeta(orderId, [
        { key: "_myapp_refund_status", value: "failed" },
        { key: "_myapp_refund_pending", value: 1 },
      ]);
      await addWooOrderNote(
        orderId,
        `Gateway return refund failed (${errMessage}). Manual refund required.`
      );

      return NextResponse.json(
        {
          success: false,
          error: `Gateway refund failed: ${errMessage}`,
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("[/api/internal/refund] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal refund processing error",
      },
      { status: 500 }
    );
  }
}
