/**
 * @jest-environment node
 */
/**
 * Tests for Razorpay and Stripe payment webhooks status guards & reference saving.
 */
import { POST as razorpayWebhookPost } from "@/app/api/webhooks/razorpay/route";
import { POST as stripeWebhookPost } from "@/app/api/webhooks/stripe/route";
import { NextRequest } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay-server";
import {
  constructStripeEvent,
  getWooOrder,
  markWooOrderPaid,
  updateWooOrderStatus,
  addWooOrderNote,
  updateWooOrderMeta,
} from "@/lib/stripe-server";

jest.mock("@/lib/razorpay-server", () => ({
  verifyRazorpayWebhookSignature: jest.fn(),
}));

jest.mock("@/lib/stripe-server", () => ({
  constructStripeEvent: jest.fn(),
  getWooOrder: jest.fn(),
  markWooOrderPaid: jest.fn(),
  updateWooOrderStatus: jest.fn(),
  addWooOrderNote: jest.fn(),
  updateWooOrderMeta: jest.fn(),
  isLockedStatus: jest.requireActual("@/lib/stripe-server").isLockedStatus,
}));

describe("Payment Webhook Status Guards", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Razorpay Webhook", () => {
    function createRzpRequest(body: Record<string, unknown>): NextRequest {
      return new NextRequest("http://localhost:3000/api/webhooks/razorpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": "valid_rzp_sig",
        },
        body: JSON.stringify(body),
      });
    }

    it("saves transaction ID and moves order to processing on payment.captured", async () => {
      (verifyRazorpayWebhookSignature as jest.Mock).mockReturnValue(true);
      (getWooOrder as jest.Mock).mockResolvedValueOnce({
        id: 2001,
        status: "pending",
      });

      const payload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_rzp_999",
              order_id: "order_rzp_111",
              status: "captured",
              notes: { wc_order_id: "2001" },
            },
          },
        },
      };

      const res = await razorpayWebhookPost(createRzpRequest(payload));
      expect(res.status).toBe(200);
      expect(markWooOrderPaid).toHaveBeenCalledWith(2001, {
        status: "processing",
        transactionId: "pay_rzp_999",
        gateway: "razorpay",
      });
    });

    it("leaves status unchanged and adds note when payment.captured arrives for a cancelled order", async () => {
      (verifyRazorpayWebhookSignature as jest.Mock).mockReturnValue(true);
      (getWooOrder as jest.Mock).mockResolvedValueOnce({
        id: 2002,
        status: "cancelled",
      });

      const payload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_rzp_999",
              order_id: "order_rzp_111",
              status: "captured",
              notes: { wc_order_id: "2002" },
            },
          },
        },
      };

      const res = await razorpayWebhookPost(createRzpRequest(payload));
      expect(res.status).toBe(200);
      expect(markWooOrderPaid).not.toHaveBeenCalled();
      expect(updateWooOrderStatus).not.toHaveBeenCalled();
      expect(addWooOrderNote).toHaveBeenCalledWith(
        2002,
        "Payment captured after cancellation, refund required"
      );
      expect(updateWooOrderMeta).toHaveBeenCalledWith(2002, [
        { key: "_myapp_refund_pending", value: 1 },
        { key: "_myapp_gateway", value: "razorpay" },
      ]);
    });

    it("ignores payment event when order is in return-requested or shipped status", async () => {
      (verifyRazorpayWebhookSignature as jest.Mock).mockReturnValue(true);
      (getWooOrder as jest.Mock).mockResolvedValueOnce({
        id: 2003,
        status: "return-requested",
      });

      const payload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_rzp_999",
              order_id: "order_rzp_111",
              status: "captured",
              notes: { wc_order_id: "2003" },
            },
          },
        },
      };

      const res = await razorpayWebhookPost(createRzpRequest(payload));
      expect(res.status).toBe(200);
      expect(markWooOrderPaid).not.toHaveBeenCalled();
      expect(updateWooOrderStatus).not.toHaveBeenCalled();
    });
  });

  describe("Stripe Webhook", () => {
    function createStripeRequest(bodyText: string): NextRequest {
      return new NextRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "valid_stripe_sig",
        },
        body: bodyText,
      });
    }

    it("saves transaction ID and moves order to processing on checkout.session.completed", async () => {
      (constructStripeEvent as jest.Mock).mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            payment_status: "paid",
            payment_intent: "pi_stripe_777",
            metadata: { wc_order_id: "3001" },
          },
        },
      });

      (getWooOrder as jest.Mock).mockResolvedValueOnce({
        id: 3001,
        status: "pending",
      });

      const res = await stripeWebhookPost(createStripeRequest("{}"));
      expect(res.status).toBe(200);
      expect(markWooOrderPaid).toHaveBeenCalledWith(3001, {
        status: "processing",
        transactionId: "pi_stripe_777",
        gateway: "stripe",
      });
    });

    it("leaves status unchanged on late Stripe payment for a cancelled order", async () => {
      (constructStripeEvent as jest.Mock).mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            payment_status: "paid",
            payment_intent: "pi_stripe_777",
            metadata: { wc_order_id: "3002" },
          },
        },
      });

      (getWooOrder as jest.Mock).mockResolvedValueOnce({
        id: 3002,
        status: "cancelled",
      });

      const res = await stripeWebhookPost(createStripeRequest("{}"));
      expect(res.status).toBe(200);
      expect(markWooOrderPaid).not.toHaveBeenCalled();
      expect(updateWooOrderStatus).not.toHaveBeenCalled();
      expect(addWooOrderNote).toHaveBeenCalledWith(
        3002,
        "Payment captured after cancellation, refund required"
      );
      expect(updateWooOrderMeta).toHaveBeenCalledWith(3002, [
        { key: "_myapp_refund_pending", value: 1 },
        { key: "_myapp_gateway", value: "stripe" },
      ]);
    });
  });
});
