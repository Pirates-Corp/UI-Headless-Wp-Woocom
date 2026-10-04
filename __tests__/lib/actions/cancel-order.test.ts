import { cancelOrderAction } from "@/lib/actions/account";
import * as authModule from "@/lib/auth/session";
import * as wooOrdersModule from "@/lib/woocommerce/orders";
import * as razorpayServerModule from "@/lib/razorpay-server";
import * as stripeServerModule from "@/lib/stripe-server";

jest.mock("@/lib/auth/session", () => ({
  getSessionUser: jest.fn(),
}));

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

describe("cancelOrderAction", () => {
  const mockUser = {
    id: "123",
    email: "customer@example.com",
    displayName: "Test Customer",
    role: "customer",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (authModule.getSessionUser as jest.Mock).mockResolvedValue(mockUser);
    (wooOrdersModule.updateWooOrderStatus as jest.Mock).mockResolvedValue(undefined);
    (wooOrdersModule.addWooOrderNote as jest.Mock).mockResolvedValue(undefined);
    (wooOrdersModule.updateWooOrderMeta as jest.Mock).mockResolvedValue(undefined);
    (wooOrdersModule.createWooRefund as jest.Mock).mockResolvedValue({ id: 999 });
  });

  it("rejects unauthenticated user", async () => {
    (authModule.getSessionUser as jest.Mock).mockResolvedValue(null);

    const res = await cancelOrderAction(1001, "ordered_by_mistake");
    expect(res.success).toBe(false);
    expect(res.error).toBe("You must be signed in to cancel an order.");
  });


  it("rejects another user's order ID", async () => {
    (wooOrdersModule.getWooOrder as jest.Mock).mockResolvedValue({
      id: 1001,
      customer_id: 456, // Different customer
      billing: { email: "other@example.com" },
      status: "processing",
      total: "500.00",
      payment_method: "cod",
    });

    const res = await cancelOrderAction(1001, "ordered_by_mistake");
    expect(res.success).toBe(false);
    expect(res.error).toContain("permission");
    expect(wooOrdersModule.updateWooOrderStatus).not.toHaveBeenCalled();
  });

  it("rejects cancellation if order has an AWB tracking code", async () => {
    (wooOrdersModule.getWooOrder as jest.Mock).mockResolvedValue({
      id: 1001,
      customer_id: 123,
      status: "processing",
      total: "500.00",
      meta_data: [{ key: "_myapp_shiprocket_awb", value: "SR123456789" }],
    });

    const res = await cancelOrderAction(1001, "delivery_too_slow");
    expect(res.success).toBe(false);
    expect(res.error).toContain("shipment has already been initiated");
    expect(wooOrdersModule.updateWooOrderStatus).not.toHaveBeenCalled();
  });

  it("cancels a COD order without invoking gateway refund", async () => {
    (wooOrdersModule.getWooOrder as jest.Mock).mockResolvedValue({
      id: 1001,
      customer_id: 123,
      status: "processing",
      total: "500.00",
      payment_method: "cod",
      meta_data: [],
    });

    const res = await cancelOrderAction(1001, "ordered_by_mistake", "Need to change address");
    expect(res.success).toBe(true);
    expect(res.status).toBe("cancelled");
    expect(wooOrdersModule.updateWooOrderStatus).toHaveBeenCalledWith(1001, "cancelled");
    expect(wooOrdersModule.addWooOrderNote).toHaveBeenCalledWith(
      1001,
      expect.stringContaining("Cancelled by customer. Reason: ordered_by_mistake")
    );
    expect(razorpayServerModule.refundRazorpayPayment).not.toHaveBeenCalled();
    expect(stripeServerModule.refundStripePayment).not.toHaveBeenCalled();
  });

  it("cancels a Razorpay prepaid order and initiates full refund", async () => {
    (wooOrdersModule.getWooOrder as jest.Mock).mockResolvedValue({
      id: 1002,
      customer_id: 123,
      status: "processing",
      total: "1250.00",
      transaction_id: "pay_rzp123456",
      meta_data: [{ key: "_myapp_gateway", value: "razorpay" }],
    });

    (razorpayServerModule.refundRazorpayPayment as jest.Mock).mockResolvedValue({
      id: "rfnd_rzp999",
      amount: 125000,
      status: "processed",
    });

    const res = await cancelOrderAction(1002, "found_better_price");
    expect(res.success).toBe(true);
    expect(res.status).toBe("refunded");
    expect(res.refundStatus).toBe("processed");

    // Order status cancelled
    expect(wooOrdersModule.updateWooOrderStatus).toHaveBeenCalledWith(1002, "cancelled");
    // Gateway refund initiated
    expect(razorpayServerModule.refundRazorpayPayment).toHaveBeenCalledWith(
      "pay_rzp123456",
      125000,
      { wc_order_id: "1002" }
    );
    // Meta updated with refund ID and processed status
    expect(wooOrdersModule.updateWooOrderMeta).toHaveBeenCalledWith(1002, [
      { key: "_myapp_refund_id", value: "rfnd_rzp999" },
      { key: "_myapp_refund_status", value: "processed" },
    ]);
    // WC refund record created
    expect(wooOrdersModule.createWooRefund).toHaveBeenCalledWith(1002, {
      amount: 1250,
      reason: expect.stringContaining("found_better_price"),
    });
  });

  it("cancels a Stripe prepaid order and initiates full refund", async () => {
    (wooOrdersModule.getWooOrder as jest.Mock).mockResolvedValue({
      id: 1003,
      customer_id: 123,
      status: "processing",
      total: "899.00",
      transaction_id: "pi_stripe12345",
      meta_data: [{ key: "_myapp_gateway", value: "stripe" }],
    });

    (stripeServerModule.refundStripePayment as jest.Mock).mockResolvedValue({
      id: "re_stripe999",
      amount: 89900,
      status: "succeeded",
    });

    const res = await cancelOrderAction(1003, "changed_mind");
    expect(res.success).toBe(true);
    expect(res.status).toBe("refunded");
    expect(res.refundStatus).toBe("processed");

    expect(stripeServerModule.refundStripePayment).toHaveBeenCalledWith(
      "pi_stripe12345",
      89900,
      "cancel-1003"
    );
    expect(wooOrdersModule.updateWooOrderMeta).toHaveBeenCalledWith(1003, [
      { key: "_myapp_refund_id", value: "re_stripe999" },
      { key: "_myapp_refund_status", value: "processed" },
    ]);
  });

  it("is idempotent: calling cancel on an already cancelled order returns success without making gateway call", async () => {
    (wooOrdersModule.getWooOrder as jest.Mock).mockResolvedValue({
      id: 1004,
      customer_id: 123,
      status: "cancelled",
      total: "500.00",
      transaction_id: "pay_rzp123456",
      meta_data: [{ key: "_myapp_refund_status", value: "processed" }],
    });

    const res = await cancelOrderAction(1004, "ordered_by_mistake");
    expect(res.success).toBe(true);
    expect(res.message).toBe("Order is already cancelled.");
    expect(wooOrdersModule.updateWooOrderStatus).not.toHaveBeenCalled();
    expect(razorpayServerModule.refundRazorpayPayment).not.toHaveBeenCalled();
    expect(stripeServerModule.refundStripePayment).not.toHaveBeenCalled();
  });

  it("handles gateway refund failure gracefully by marking order cancelled and refund pending", async () => {
    (wooOrdersModule.getWooOrder as jest.Mock).mockResolvedValue({
      id: 1005,
      customer_id: 123,
      status: "processing",
      total: "1500.00",
      transaction_id: "pay_rzp_fail",
      meta_data: [{ key: "_myapp_gateway", value: "razorpay" }],
    });

    (razorpayServerModule.refundRazorpayPayment as jest.Mock).mockRejectedValue(
      new Error("Gateway connection error")
    );

    const res = await cancelOrderAction(1005, "other", "Need refund");
    expect(res.success).toBe(true);
    expect(res.status).toBe("cancelled");
    expect(res.refundStatus).toBe("failed");
    expect(res.message).toContain("Our support team will process your refund manually");

    expect(wooOrdersModule.updateWooOrderStatus).toHaveBeenCalledWith(1005, "cancelled");
    expect(wooOrdersModule.updateWooOrderMeta).toHaveBeenCalledWith(1005, [
      { key: "_myapp_refund_status", value: "failed" },
      { key: "_myapp_refund_pending", value: 1 },
    ]);
    expect(wooOrdersModule.addWooOrderNote).toHaveBeenCalledWith(
      1005,
      expect.stringContaining("Gateway refund failed")
    );
  });
});
