/**
 * @jest-environment node
 */
/**
 * Tests for hardened /api/razorpay/verify route
 */
import { POST } from "@/app/api/razorpay/verify/route";
import { NextRequest } from "next/server";
import {
  verifyRazorpayPaymentSignature,
  fetchRazorpayOrder,
} from "@/lib/razorpay-server";
import {
  getWooOrder,
  markWooOrderPaid,
  addWooOrderNote,
  updateWooOrderMeta,
} from "@/lib/stripe-server";

jest.mock("@/lib/razorpay-server", () => ({
  verifyRazorpayPaymentSignature: jest.fn(),
  fetchRazorpayOrder: jest.fn(),
}));

jest.mock("@/lib/stripe-server", () => ({
  getWooOrder: jest.fn(),
  markWooOrderPaid: jest.fn(),
  addWooOrderNote: jest.fn(),
  updateWooOrderMeta: jest.fn(),
  isLockedStatus: jest.requireActual("@/lib/stripe-server").isLockedStatus,
}));

describe("POST /api/razorpay/verify (Hardened)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyRazorpayPaymentSignature as jest.Mock).mockReturnValue(true);
  });

  function createRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest("http://localhost:3000/api/razorpay/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const validPayload = {
    razorpay_order_id: "order_rzp_123",
    razorpay_payment_id: "pay_rzp_456",
    razorpay_signature: "a".repeat(64),
    wc_order_id: 1001,
    wc_order_key: "wc_order_key_abc",
    billing_email: "test@example.com",
  };

  it("rejects when signature is invalid", async () => {
    (verifyRazorpayPaymentSignature as jest.Mock).mockReturnValue(false);

    const req = createRequest(validPayload);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Invalid signature");
    expect(fetchRazorpayOrder).not.toHaveBeenCalled();
  });

  it("rejects when Razorpay order notes wc_order_id does not match payload", async () => {
    (fetchRazorpayOrder as jest.Mock).mockResolvedValueOnce({
      id: "order_rzp_123",
      amount: 50000,
      currency: "INR",
      notes: { wc_order_id: "9999" }, // Mismatch
    });

    const req = createRequest(validPayload);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Order ID mismatch.");
    expect(getWooOrder).not.toHaveBeenCalled();
  });

  it("rejects when amount or currency does not match WooCommerce order total", async () => {
    (fetchRazorpayOrder as jest.Mock).mockResolvedValueOnce({
      id: "order_rzp_123",
      amount: 40000, // 400.00 INR
      currency: "INR",
      notes: { wc_order_id: "1001" },
    });

    (getWooOrder as jest.Mock).mockResolvedValueOnce({
      id: 1001,
      status: "pending",
      total: "500.00", // 500.00 INR != 400.00 INR
      currency: "INR",
    });

    const req = createRequest(validPayload);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Payment amount or currency mismatch.");
    expect(markWooOrderPaid).not.toHaveBeenCalled();
  });

  it("successfully marks order paid with transaction ID when valid and matching", async () => {
    (fetchRazorpayOrder as jest.Mock).mockResolvedValueOnce({
      id: "order_rzp_123",
      amount: 50000, // 500.00 INR
      currency: "INR",
      notes: { wc_order_id: "1001" },
    });

    (getWooOrder as jest.Mock).mockResolvedValueOnce({
      id: 1001,
      status: "pending",
      total: "500.00",
      currency: "INR",
    });

    const req = createRequest(validPayload);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.verified).toBe(true);
    expect(markWooOrderPaid).toHaveBeenCalledWith(1001, {
      status: "processing",
      transactionId: "pay_rzp_456",
      gateway: "razorpay",
    });
  });

  it("leaves status unchanged and flags refund pending when payment captured for already cancelled order", async () => {
    (fetchRazorpayOrder as jest.Mock).mockResolvedValueOnce({
      id: "order_rzp_123",
      amount: 50000,
      currency: "INR",
      notes: { wc_order_id: "1001" },
    });

    (getWooOrder as jest.Mock).mockResolvedValueOnce({
      id: 1001,
      status: "cancelled", // Already cancelled
      total: "500.00",
      currency: "INR",
    });

    const req = createRequest(validPayload);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.verified).toBe(true);
    expect(markWooOrderPaid).not.toHaveBeenCalled();
    expect(addWooOrderNote).toHaveBeenCalledWith(
      1001,
      "Payment captured after cancellation, refund required"
    );
    expect(updateWooOrderMeta).toHaveBeenCalledWith(1001, [
      { key: "_myapp_refund_pending", value: 1 },
      { key: "_myapp_gateway", value: "razorpay" },
    ]);
  });
});
