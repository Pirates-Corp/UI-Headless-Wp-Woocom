/** @jest-environment node */

import { POST } from "@/app/api/internal/refund/route";
import * as wooOrdersModule from "@/lib/woocommerce/orders";
import * as razorpayServerModule from "@/lib/razorpay-server";
import * as stripeServerModule from "@/lib/stripe-server";
import { NextRequest } from "next/server";

jest.mock("@/lib/woocommerce/orders", () => ({
  getWooOrder: jest.fn(),
  updateWooOrderStatus: jest.fn(),
  addWooOrderNote: jest.fn(),
  updateWooOrderMeta: jest.fn(),
  createWooRefund: jest.fn(),
}));

jest.mock("@/lib/razorpay-server", () => ({
  refundRazorpayPayment: jest.fn(),
}));

jest.mock("@/lib/stripe-server", () => ({
  refundStripePayment: jest.fn(),
}));

describe("POST /api/internal/refund", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      MYAPP_CART_AUTH_KEY: "test-secret-auth-key",
      AUTH_KEY: "test-secret-auth-key",
    };
    (wooOrdersModule.updateWooOrderStatus as jest.Mock).mockResolvedValue(undefined);
    (wooOrdersModule.addWooOrderNote as jest.Mock).mockResolvedValue(undefined);
    (wooOrdersModule.updateWooOrderMeta as jest.Mock).mockResolvedValue(undefined);
    (wooOrdersModule.createWooRefund as jest.Mock).mockResolvedValue({ id: 888 });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("rejects requests with missing or invalid auth key with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/internal/refund", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-key": "wrong-key",
      },
      body: JSON.stringify({ orderId: 501, amount: 100 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("rejects orders that are not in return-received status with 400", async () => {
    (wooOrdersModule.getWooOrder as jest.Mock).mockResolvedValue({
      id: 502,
      status: "processing", // Not return-received
      total: "1200.00",
    });

    const req = new NextRequest("http://localhost:3000/api/internal/refund", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-key": "test-secret-auth-key",
      },
      body: JSON.stringify({ orderId: 502, amount: 1200 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("return-received");
    expect(razorpayServerModule.refundRazorpayPayment).not.toHaveBeenCalled();
  });

  it("executes gateway refund and creates WC refund for prepaid Razorpay orders", async () => {
    (wooOrdersModule.getWooOrder as jest.Mock).mockResolvedValue({
      id: 503,
      status: "return-received",
      total: "1500.00",
      transaction_id: "pay_rzp_return123",
      meta_data: [{ key: "_myapp_gateway", value: "razorpay" }],
      refunds: [],
    });

    (razorpayServerModule.refundRazorpayPayment as jest.Mock).mockResolvedValue({
      id: "rfnd_rzp_ret999",
      amount: 150000,
      status: "processed",
    });

    const req = new NextRequest("http://localhost:3000/api/internal/refund", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-key": "test-secret-auth-key",
      },
      body: JSON.stringify({ orderId: 503, amount: 1500, reason: "Return received" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.refundId).toBe("rfnd_rzp_ret999");
    expect(json.status).toBe("refunded"); // full refund moves to refunded

    expect(razorpayServerModule.refundRazorpayPayment).toHaveBeenCalledWith(
      "pay_rzp_return123",
      150000,
      { wc_order_id: "503" }
    );
    expect(wooOrdersModule.createWooRefund).toHaveBeenCalledWith(503, {
      amount: 1500,
      reason: "Return received",
    });
    expect(wooOrdersModule.updateWooOrderStatus).toHaveBeenCalledWith(503, "refunded");
  });

  it("leaves order in return-received for partial return refund", async () => {
    (wooOrdersModule.getWooOrder as jest.Mock).mockResolvedValue({
      id: 504,
      status: "return-received",
      total: "2000.00",
      transaction_id: "pi_stripe_ret123",
      meta_data: [{ key: "_myapp_gateway", value: "stripe" }],
      refunds: [],
    });

    (stripeServerModule.refundStripePayment as jest.Mock).mockResolvedValue({
      id: "re_stripe_part999",
      amount: 80000,
      status: "succeeded",
    });

    const req = new NextRequest("http://localhost:3000/api/internal/refund", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-key": "test-secret-auth-key",
      },
      body: JSON.stringify({ orderId: 504, amount: 800, reason: "Partial return" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.status).toBe("return-received"); // partial refund remains in return-received

    expect(wooOrdersModule.updateWooOrderStatus).not.toHaveBeenCalledWith(504, "refunded");
  });

  it("handles COD return by setting _myapp_refund_pending = 1 without calling payment gateways", async () => {
    (wooOrdersModule.getWooOrder as jest.Mock).mockResolvedValue({
      id: 505,
      status: "return-received",
      total: "900.00",
      payment_method: "cod",
      meta_data: [],
    });

    const req = new NextRequest("http://localhost:3000/api/internal/refund", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-key": "test-secret-auth-key",
      },
      body: JSON.stringify({ orderId: 505, amount: 900 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.refundPending).toBe(true);

    expect(razorpayServerModule.refundRazorpayPayment).not.toHaveBeenCalled();
    expect(stripeServerModule.refundStripePayment).not.toHaveBeenCalled();
    expect(wooOrdersModule.updateWooOrderMeta).toHaveBeenCalledWith(505, [
      { key: "_myapp_refund_pending", value: 1 },
      { key: "_myapp_refund_status", value: "initiated" },
    ]);
  });

  it("does not refund twice when a return refund was already processed", async () => {
    (wooOrdersModule.getWooOrder as jest.Mock).mockResolvedValue({
      id: 506,
      status: "return-received",
      total: "1500.00",
      transaction_id: "pay_rzp_dup",
      meta_data: [{ key: "_myapp_return_refund_id", value: "rfnd_already_done" }],
    });

    const req = new NextRequest("http://localhost:3000/api/internal/refund", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-key": "test-secret-auth-key",
      },
      body: JSON.stringify({ orderId: 506, amount: 1500 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.alreadyProcessed).toBe(true);

    expect(razorpayServerModule.refundRazorpayPayment).not.toHaveBeenCalled();
    expect(stripeServerModule.refundStripePayment).not.toHaveBeenCalled();
  });
});
