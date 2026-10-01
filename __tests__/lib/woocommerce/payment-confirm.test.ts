import {
  confirmPayment,
  updatePaymentStatus,
  PaymentBackendError,
} from "@/lib/woocommerce/payment-confirm";

describe("lib/woocommerce/payment-confirm", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      MYAPP_PAYMENT_AUTH_KEY: "test_secret_key_123",
      NEXT_PUBLIC_WOOCOMMERCE_PROTCOL: "https",
      NEXT_PUBLIC_WOOCOMMERCE_HOST: "example.com",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe("confirmPayment", () => {
    const defaultInput = {
      gateway: "razorpay" as const,
      eventId: "evt_123",
      wcOrderId: 456,
      paymentId: "pay_789",
      amountMinor: 10000,
      currency: "INR",
      source: "verify" as const,
    };

    it("throws an error if MYAPP_PAYMENT_AUTH_KEY is not configured", async () => {
      delete process.env.MYAPP_PAYMENT_AUTH_KEY;
      await expect(confirmPayment(defaultInput)).rejects.toThrow(
        "MYAPP_PAYMENT_AUTH_KEY environment variable is not configured"
      );
    });

    it("sends correct headers, body, and options to the WordPress endpoint", async () => {
      let capturedUrl = "";
      let capturedInit: RequestInit | undefined;

      global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedInit = init;
        return Promise.resolve({
          status: 200,
          json: async () => ({ ok: true, result: "paid" }),
        } as Response);
      });

      const result = await confirmPayment(defaultInput);

      expect(capturedUrl).toBe("https://example.com/wp-json/myapp/v1/payment/confirm");
      expect(capturedInit?.method).toBe("POST");
      expect((capturedInit?.headers as Record<string, string>)["x-auth-key"]).toBe("test_secret_key_123");
      expect((capturedInit?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
      expect(capturedInit?.cache).toBe("no-store");

      const body = JSON.parse(capturedInit?.body as string);
      expect(body).toEqual({
        gateway: "razorpay",
        event_id: "evt_123",
        wc_order_id: 456,
        payment_id: "pay_789",
        amount_minor: 10000,
        currency: "INR",
        source: "verify",
      });

      expect(result).toEqual({ ok: true, result: "paid" });
    });

    it("maps 200 duplicate, already_paid, and ignored results correctly", async () => {
      for (const resType of ["duplicate", "already_paid", "ignored"] as const) {
        global.fetch = jest.fn().mockResolvedValue({
          status: 200,
          json: async () => ({ ok: true, result: resType }),
        } as Response);

        const result = await confirmPayment(defaultInput);
        expect(result).toEqual({ ok: true, result: resType });
      }
    });

    it("maps 409 amount_mismatch and currency_mismatch to {ok: false, code}", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 409,
        json: async () => ({ ok: false, code: "amount_mismatch" }),
      } as Response);

      const res1 = await confirmPayment(defaultInput);
      expect(res1).toEqual({ ok: false, code: "amount_mismatch" });

      global.fetch = jest.fn().mockResolvedValue({
        status: 409,
        json: async () => ({ ok: false, code: "currency_mismatch" }),
      } as Response);

      const res2 = await confirmPayment(defaultInput);
      expect(res2).toEqual({ ok: false, code: "currency_mismatch" });
    });

    it("maps 404 to {ok: false, code: 'order_not_found'}", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 404,
        json: async () => ({ ok: false, code: "order_not_found" }),
      } as Response);

      const res = await confirmPayment(defaultInput);
      expect(res).toEqual({ ok: false, code: "order_not_found" });
    });

    it("maps 400 to {ok: false, code: 'invalid'}", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 400,
        json: async () => ({ ok: false, code: "invalid_params" }),
      } as Response);

      const res = await confirmPayment(defaultInput);
      expect(res).toEqual({ ok: false, code: "invalid" });
    });

    it("throws PaymentBackendError on HTTP 401 unauthorized", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 401,
        text: async () => "Unauthorized",
      } as Response);

      await expect(confirmPayment(defaultInput)).rejects.toThrow(PaymentBackendError);
    });

    it("throws PaymentBackendError on HTTP 500 or 503 lock timeout", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 503,
        text: async () => "Could not acquire lock",
      } as Response);

      await expect(confirmPayment(defaultInput)).rejects.toThrow(PaymentBackendError);
    });

    it("throws PaymentBackendError on network error or fetch abort/timeout", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("Network timeout"));

      await expect(confirmPayment(defaultInput)).rejects.toThrow(PaymentBackendError);
    });
  });

  describe("updatePaymentStatus", () => {
    const defaultInput = {
      gateway: "stripe" as const,
      eventId: "evt_stripe_456",
      wcOrderId: 789,
      paymentId: "pi_123",
      status: "failed" as const,
      reason: "Payment failed",
    };

    it("sends correct body and returns ok result", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ ok: true, result: "ignored" }),
      } as Response);

      const result = await updatePaymentStatus(defaultInput);
      expect(result).toEqual({ ok: true, result: "ignored" });
    });

    it("throws PaymentBackendError on 5xx or network failure", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 500,
        text: async () => "Server error",
      } as Response);

      await expect(updatePaymentStatus(defaultInput)).rejects.toThrow(PaymentBackendError);
    });
  });
});
