/**
 * @jest-environment node
 */
import { POST } from "@/app/api/webhooks/razorpay/route";
import { NextRequest } from "next/server";
import {
  verifyRazorpayWebhookSignature,
  fetchRazorpayOrder,
} from "@/lib/razorpay-server";
import {
  confirmPayment,
  updatePaymentStatus,
  PaymentBackendError,
} from "@/lib/woocommerce/payment-confirm";

jest.mock("@/lib/razorpay-server", () => ({
  verifyRazorpayWebhookSignature: jest.fn(),
  fetchRazorpayOrder: jest.fn(),
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

describe("POST /api/webhooks/razorpay", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createRequest(
    body: unknown,
    headers: Record<string, string> = {}
  ): NextRequest {
    return new NextRequest("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": "valid_sig",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 if x-razorpay-signature header is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Missing x-razorpay-signature header/i);
  });

  it("returns 400 if webhook signature is invalid", async () => {
    (verifyRazorpayWebhookSignature as jest.Mock).mockReturnValue(false);

    const req = createRequest({ event: "payment.captured" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Webhook signature verification failed/i);
  });

  it("ignores payment.authorized event and returns 200", async () => {
    (verifyRazorpayWebhookSignature as jest.Mock).mockReturnValue(true);

    const payload = {
      event: "payment.authorized",
      payload: {
        payment: { entity: { id: "pay_1", amount: 100, currency: "INR" } },
      },
    };

    const req = createRequest(payload);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ received: true, ignored: true });
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it("falls back to event:payment_id when x-razorpay-event-id header is missing", async () => {
    (verifyRazorpayWebhookSignature as jest.Mock).mockReturnValue(true);
    (fetchRazorpayOrder as jest.Mock).mockResolvedValue({
      id: "order_rzp_123",
      notes: { wc_order_id: "201" },
    });
    (confirmPayment as jest.Mock).mockResolvedValue({ ok: true, result: "paid" });

    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_fallback_999",
            order_id: "order_rzp_123",
            amount: 50000,
            currency: "INR",
            status: "captured",
          },
        },
      },
    };

    // No x-razorpay-event-id header provided
    const req = createRequest(payload);
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(confirmPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "payment.captured:pay_fallback_999",
        wcOrderId: 201,
      })
    );
  });

  it("resolves order via fetchRazorpayOrder when payment entity notes are missing", async () => {
    (verifyRazorpayWebhookSignature as jest.Mock).mockReturnValue(true);
    (fetchRazorpayOrder as jest.Mock).mockResolvedValue({
      id: "order_rzp_456",
      notes: { wc_order_id: "305" },
    });
    (confirmPayment as jest.Mock).mockResolvedValue({ ok: true, result: "paid" });

    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_capture_456",
            order_id: "order_rzp_456",
            amount: 80000,
            currency: "INR",
            status: "captured",
            // Notice: no notes in payment entity
          },
        },
      },
    };

    const req = createRequest(payload, { "x-razorpay-event-id": "evt_hdr_1" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(fetchRazorpayOrder).toHaveBeenCalledWith("order_rzp_456");
    expect(confirmPayment).toHaveBeenCalledWith({
      gateway: "razorpay",
      eventId: "evt_hdr_1",
      wcOrderId: 305,
      paymentId: "pay_capture_456",
      amountMinor: 80000,
      currency: "INR",
      source: "webhook",
    });
  });

  it("handles payment.failed by calling updatePaymentStatus", async () => {
    (verifyRazorpayWebhookSignature as jest.Mock).mockReturnValue(true);
    (fetchRazorpayOrder as jest.Mock).mockResolvedValue({
      id: "order_rzp_failed_1",
      notes: { wc_order_id: "404" },
    });
    (updatePaymentStatus as jest.Mock).mockResolvedValue({ ok: true, result: "ignored" });

    const payload = {
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: "pay_failed_1",
            order_id: "order_rzp_failed_1",
            amount: 10000,
            currency: "INR",
            status: "failed",
          },
        },
      },
    };

    const req = createRequest(payload, { "x-razorpay-event-id": "evt_failed_1" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(updatePaymentStatus).toHaveBeenCalledWith({
      gateway: "razorpay",
      eventId: "evt_failed_1",
      wcOrderId: 404,
      paymentId: "pay_failed_1",
      status: "failed",
      reason: "Razorpay payment.failed webhook",
    });
  });

  it("returns 500 when confirmPayment throws PaymentBackendError (e.g. WP 5xx / lock timeout)", async () => {
    (verifyRazorpayWebhookSignature as jest.Mock).mockReturnValue(true);
    (fetchRazorpayOrder as jest.Mock).mockResolvedValue({
      id: "order_rzp_123",
      notes: { wc_order_id: "501" },
    });
    (confirmPayment as jest.Mock).mockRejectedValue(
      new PaymentBackendError("WordPress payment confirm returned HTTP 503", 503)
    );

    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_err_1",
            order_id: "order_rzp_123",
            amount: 50000,
            currency: "INR",
            status: "captured",
          },
        },
      },
    };

    const req = createRequest(payload, { "x-razorpay-event-id": "evt_err_1" });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/Payment backend error. Will retry./i);
  });

  it("returns 200 when confirmPayment returns {ok: false} (e.g. 409 mismatch)", async () => {
    (verifyRazorpayWebhookSignature as jest.Mock).mockReturnValue(true);
    (fetchRazorpayOrder as jest.Mock).mockResolvedValue({
      id: "order_rzp_123",
      notes: { wc_order_id: "502" },
    });
    (confirmPayment as jest.Mock).mockResolvedValue({
      ok: false,
      code: "amount_mismatch",
    });

    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_mismatch_1",
            order_id: "order_rzp_123",
            amount: 10000,
            currency: "INR",
            status: "captured",
          },
        },
      },
    };

    const req = createRequest(payload, { "x-razorpay-event-id": "evt_mismatch_1" });
    const res = await POST(req);
    // Returns 200 to acknowledge webhook while logging error
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(json.result).toEqual({ ok: false, code: "amount_mismatch" });
  });
});
