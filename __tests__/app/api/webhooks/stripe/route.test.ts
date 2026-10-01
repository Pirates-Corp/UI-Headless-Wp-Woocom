/**
 * @jest-environment node
 */
import { POST } from "@/app/api/webhooks/stripe/route";
import { NextRequest } from "next/server";
import { constructStripeEvent } from "@/lib/stripe-server";
import {
  confirmPayment,
  updatePaymentStatus,
  PaymentBackendError,
} from "@/lib/woocommerce/payment-confirm";

jest.mock("@/lib/stripe-server", () => ({
  constructStripeEvent: jest.fn(),
}));

jest.mock("@/lib/woocommerce/payment-confirm", () => ({
  confirmPayment: jest.fn(),
  updatePaymentStatus: jest.fn(),
  PaymentBackendError: class PaymentBackendError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.name = "PaymentBackendError";
      this.status = status;
    }
  },
}));

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createRequest(
    body: unknown,
    headers: Record<string, string> = {}
  ): NextRequest {
    return new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "valid_stripe_sig",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 if stripe-signature header is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Missing stripe-signature header/i);
  });

  it("returns 400 if signature construction fails", async () => {
    (constructStripeEvent as jest.Mock).mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const req = createRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Webhook verification failed/i);
  });

  it("skips event if session metadata has no wc_order_id", async () => {
    (constructStripeEvent as jest.Mock).mockReturnValue({
      id: "evt_stripe_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          metadata: {},
        },
      },
    });

    const req = createRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ received: true, skipped: true });
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it("calls confirmPayment on checkout.session.completed with paid status", async () => {
    (constructStripeEvent as jest.Mock).mockReturnValue({
      id: "evt_stripe_paid_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_paid_1",
          payment_intent: "pi_stripe_123",
          payment_status: "paid",
          amount_total: 4999,
          currency: "usd",
          metadata: { wc_order_id: "701" },
        },
      },
    });
    (confirmPayment as jest.Mock).mockResolvedValue({ ok: true, result: "paid" });

    const req = createRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(confirmPayment).toHaveBeenCalledWith({
      gateway: "stripe",
      eventId: "evt_stripe_paid_1",
      wcOrderId: 701,
      paymentId: "pi_stripe_123",
      amountMinor: 4999,
      currency: "USD",
      source: "webhook",
    });
  });

  it("calls updatePaymentStatus on checkout.session.completed when unpaid (on-hold)", async () => {
    (constructStripeEvent as jest.Mock).mockReturnValue({
      id: "evt_stripe_unpaid_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_unpaid_1",
          payment_intent: "pi_stripe_unpaid",
          payment_status: "unpaid",
          amount_total: 5000,
          currency: "usd",
          metadata: { wc_order_id: "702" },
        },
      },
    });
    (updatePaymentStatus as jest.Mock).mockResolvedValue({ ok: true, result: "ignored" });

    const req = createRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(updatePaymentStatus).toHaveBeenCalledWith({
      gateway: "stripe",
      eventId: "evt_stripe_unpaid_1",
      wcOrderId: 702,
      paymentId: "pi_stripe_unpaid",
      status: "on-hold",
      reason: "Stripe checkout session completed with unpaid status",
    });
  });

  it("calls confirmPayment on checkout.session.async_payment_succeeded", async () => {
    (constructStripeEvent as jest.Mock).mockReturnValue({
      id: "evt_stripe_async_succ",
      type: "checkout.session.async_payment_succeeded",
      data: {
        object: {
          id: "cs_test_async_succ",
          payment_intent: "pi_async_succ",
          payment_status: "paid",
          amount_total: 9900,
          currency: "usd",
          metadata: { wc_order_id: "703" },
        },
      },
    });
    (confirmPayment as jest.Mock).mockResolvedValue({ ok: true, result: "paid" });

    const req = createRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(confirmPayment).toHaveBeenCalledWith({
      gateway: "stripe",
      eventId: "evt_stripe_async_succ",
      wcOrderId: 703,
      paymentId: "pi_async_succ",
      amountMinor: 9900,
      currency: "USD",
      source: "webhook",
    });
  });

  it("calls updatePaymentStatus on checkout.session.async_payment_failed (status: failed)", async () => {
    (constructStripeEvent as jest.Mock).mockReturnValue({
      id: "evt_stripe_async_fail",
      type: "checkout.session.async_payment_failed",
      data: {
        object: {
          id: "cs_test_async_fail",
          payment_intent: "pi_async_fail",
          metadata: { wc_order_id: "704" },
        },
      },
    });
    (updatePaymentStatus as jest.Mock).mockResolvedValue({ ok: true, result: "ignored" });

    const req = createRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(updatePaymentStatus).toHaveBeenCalledWith({
      gateway: "stripe",
      eventId: "evt_stripe_async_fail",
      wcOrderId: 704,
      paymentId: "pi_async_fail",
      status: "failed",
      reason: "Stripe async payment failed",
    });
  });

  it("calls updatePaymentStatus on checkout.session.expired (status: cancelled)", async () => {
    (constructStripeEvent as jest.Mock).mockReturnValue({
      id: "evt_stripe_expired",
      type: "checkout.session.expired",
      data: {
        object: {
          id: "cs_test_expired",
          payment_intent: null,
          metadata: { wc_order_id: "705" },
        },
      },
    });
    (updatePaymentStatus as jest.Mock).mockResolvedValue({ ok: true, result: "ignored" });

    const req = createRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(updatePaymentStatus).toHaveBeenCalledWith({
      gateway: "stripe",
      eventId: "evt_stripe_expired",
      wcOrderId: 705,
      paymentId: "cs_test_expired",
      status: "cancelled",
      reason: "Stripe checkout session expired",
    });
  });

  it("returns 500 when confirmPayment throws PaymentBackendError", async () => {
    (constructStripeEvent as jest.Mock).mockReturnValue({
      id: "evt_stripe_err",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_err",
          payment_intent: "pi_stripe_err",
          payment_status: "paid",
          amount_total: 4999,
          currency: "usd",
          metadata: { wc_order_id: "706" },
        },
      },
    });
    (confirmPayment as jest.Mock).mockRejectedValue(
      new PaymentBackendError("Lock timeout on WordPress", 503)
    );

    const req = createRequest({});
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/Payment backend error. Will retry./i);
  });
});
