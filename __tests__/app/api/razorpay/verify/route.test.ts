/**
 * @jest-environment node
 */
import { POST } from "@/app/api/razorpay/verify/route";
import { NextRequest } from "next/server";
import {
  verifyRazorpayPaymentSignature,
  fetchRazorpayOrder,
  fetchRazorpayPayment,
} from "@/lib/razorpay-server";
import { confirmPayment, PaymentBackendError } from "@/lib/woocommerce/payment-confirm";

jest.mock("@/lib/razorpay-server", () => ({
  verifyRazorpayPaymentSignature: jest.fn(),
  fetchRazorpayOrder: jest.fn(),
  fetchRazorpayPayment: jest.fn(),
}));

jest.mock("@/lib/woocommerce/payment-confirm", () => ({
  confirmPayment: jest.fn(),
  PaymentBackendError: class PaymentBackendError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.name = "PaymentBackendError";
      this.status = status;
    }
  },
}));

describe("POST /api/razorpay/verify", () => {
  const validBody = {
    razorpay_order_id: "order_rzp_123",
    razorpay_payment_id: "pay_rzp_456",
    razorpay_signature: "a".repeat(64),
    wc_order_id: 101,
    wc_order_key: "wc_order_key_101",
    billing_email: "customer@example.com",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createRequest(body: unknown): NextRequest {
    return new NextRequest("http://localhost:3000/api/razorpay/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 if signature is invalid", async () => {
    (verifyRazorpayPaymentSignature as jest.Mock).mockReturnValue(false);

    const req = createRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Invalid signature/i);
  });

  it("returns 403 if client-provided wc_order_id differs from gateway order notes", async () => {
    (verifyRazorpayPaymentSignature as jest.Mock).mockReturnValue(true);
    (fetchRazorpayOrder as jest.Mock).mockResolvedValue({
      id: "order_rzp_123",
      notes: { wc_order_id: "999", wc_order_key: "wc_order_key_999" },
    });

    // Body contains wc_order_id: 101, but gateway notes has wc_order_id: 999
    const req = createRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Order ID mismatch/i);
  });

  it("returns 400 if payment order_id does not match razorpay_order_id", async () => {
    (verifyRazorpayPaymentSignature as jest.Mock).mockReturnValue(true);
    (fetchRazorpayOrder as jest.Mock).mockResolvedValue({
      id: "order_rzp_123",
      notes: { wc_order_id: "101", wc_order_key: "wc_order_key_101" },
    });
    (fetchRazorpayPayment as jest.Mock).mockResolvedValue({
      id: "pay_rzp_456",
      order_id: "order_rzp_DIFFERENT",
      amount: 50000,
      currency: "INR",
      status: "captured",
    });

    const req = createRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Payment does not match order/i);
  });

  it("returns 400 if payment status is neither captured nor authorized", async () => {
    (verifyRazorpayPaymentSignature as jest.Mock).mockReturnValue(true);
    (fetchRazorpayOrder as jest.Mock).mockResolvedValue({
      id: "order_rzp_123",
      notes: { wc_order_id: "101", wc_order_key: "wc_order_key_101" },
    });
    (fetchRazorpayPayment as jest.Mock).mockResolvedValue({
      id: "pay_rzp_456",
      order_id: "order_rzp_123",
      amount: 50000,
      currency: "INR",
      status: "failed",
    });

    const req = createRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Payment does not match order or is in an invalid state/i);
  });

  it("returns 409 with generic message when confirmPayment returns not ok (mismatch)", async () => {
    (verifyRazorpayPaymentSignature as jest.Mock).mockReturnValue(true);
    (fetchRazorpayOrder as jest.Mock).mockResolvedValue({
      id: "order_rzp_123",
      notes: { wc_order_id: "101", wc_order_key: "wc_order_key_101" },
    });
    (fetchRazorpayPayment as jest.Mock).mockResolvedValue({
      id: "pay_rzp_456",
      order_id: "order_rzp_123",
      amount: 50000,
      currency: "INR",
      status: "captured",
    });
    (confirmPayment as jest.Mock).mockResolvedValue({
      ok: false,
      code: "amount_mismatch",
    });

    const req = createRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("We couldn't confirm this payment. Please contact support.");
  });

  it("returns 500 when confirmPayment throws PaymentBackendError", async () => {
    (verifyRazorpayPaymentSignature as jest.Mock).mockReturnValue(true);
    (fetchRazorpayOrder as jest.Mock).mockResolvedValue({
      id: "order_rzp_123",
      notes: { wc_order_id: "101", wc_order_key: "wc_order_key_101" },
    });
    (fetchRazorpayPayment as jest.Mock).mockResolvedValue({
      id: "pay_rzp_456",
      order_id: "order_rzp_123",
      amount: 50000,
      currency: "INR",
      status: "captured",
    });
    (confirmPayment as jest.Mock).mockRejectedValue(
      new PaymentBackendError("WP Lock timeout", 503)
    );

    const req = createRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/Payment verification backend error/i);
  });

  it("success uses the amount & currency from the Razorpay payment entity", async () => {
    (verifyRazorpayPaymentSignature as jest.Mock).mockReturnValue(true);
    (fetchRazorpayOrder as jest.Mock).mockResolvedValue({
      id: "order_rzp_123",
      notes: { wc_order_id: "101", wc_order_key: "wc_order_key_101" },
    });
    (fetchRazorpayPayment as jest.Mock).mockResolvedValue({
      id: "pay_rzp_456",
      order_id: "order_rzp_123",
      amount: 75000,
      currency: "INR",
      status: "captured",
    });
    (confirmPayment as jest.Mock).mockResolvedValue({
      ok: true,
      result: "paid",
    });

    const req = createRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(200);

    // Confirm that confirmPayment received the amount from the Razorpay payment object (75000)
    expect(confirmPayment).toHaveBeenCalledWith({
      gateway: "razorpay",
      eventId: "verify_pay_rzp_456",
      wcOrderId: 101,
      paymentId: "pay_rzp_456",
      amountMinor: 75000,
      currency: "INR",
      source: "verify",
    });

    const json = await res.json();
    expect(json).toEqual({
      verified: true,
      orderId: 101,
      orderKey: "wc_order_key_101",
      billingEmail: "customer@example.com",
    });
  });
});
