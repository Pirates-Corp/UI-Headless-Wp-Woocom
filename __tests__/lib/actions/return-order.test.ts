import { requestReturnAction, uploadReturnPhotoAction } from "@/lib/actions/account";
import * as authModule from "@/lib/auth/session";

jest.mock("@/lib/auth/session", () => ({
  getSessionUser: jest.fn(),
}));

describe("requestReturnAction & uploadReturnPhotoAction", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      MYAPP_CART_AUTH_KEY: "test-auth-key",
      AUTH_KEY: "test-auth-key",
      NEXT_PUBLIC_WOOCOMMERCE_PROTCOL: "https",
      NEXT_PUBLIC_WOOCOMMERCE_HOST: "trjshop.com",
    };
    (authModule.getSessionUser as jest.Mock).mockResolvedValue({
      id: "123",
      email: "customer@example.com",
      displayName: "Alice",
      role: "customer",
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe("requestReturnAction", () => {
    it("rejects unauthenticated user", async () => {
      (authModule.getSessionUser as jest.Mock).mockResolvedValue(null);

      const res = await requestReturnAction({
        orderId: 701,
        reason: "damaged",
        items: [{ id: 10, quantity: 1 }],
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("You must be signed in to request a return.");
    });

    it("rejects invalid input parameters with validation error", async () => {
      const res = await requestReturnAction({
        orderId: 0,
        // @ts-expect-error invalid reason test
        reason: "invalid_reason_string",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it("successfully submits return request to WordPress endpoint", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          status: "return-requested",
          refund_amount: 1499,
          message: "Return request submitted successfully.",
        }),
      });
      global.fetch = mockFetch;

      const res = await requestReturnAction({
        orderId: 702,
        reason: "defective",
        note: "Does not turn on",
        items: [{ id: 11, quantity: 1 }],
        photoUrls: ["https://example.com/photo1.jpg"],
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("return-requested");
      expect(res.refundAmount).toBe(1499);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/wp-json/myapp/v1/orders/702/return"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "x-auth-key": "test-auth-key",
          }),
        })
      );
    });

    it("successfully submits return request with COD bank refund account", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          status: "return-requested",
          refund_amount: 70.04,
          message: "Return request submitted successfully.",
        }),
      });
      global.fetch = mockFetch;

      const res = await requestReturnAction({
        orderId: 704,
        reason: "other",
        items: [{ id: 15, quantity: 1 }],
        refundAccount: {
          type: "bank",
          accountNumber: "1234567890",
          ifsc: "HDFC0001234",
          holderName: "John Doe",
        },
      });

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/wp-json/myapp/v1/orders/704/return"),
        expect.objectContaining({
          body: JSON.stringify({
            reason: "other",
            items: [{ id: 15, quantity: 1 }],
            refund_account: {
              type: "bank",
              accountNumber: "1234567890",
              ifsc: "HDFC0001234",
              holderName: "John Doe",
            },
          }),
        })
      );
    });

    it("handles WordPress endpoint errors (e.g. window expired, duplicate request)", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: "window_expired",
          message: "The return window for this order has expired.",
        }),
      });
      global.fetch = mockFetch;

      const res = await requestReturnAction({
        orderId: 703,
        reason: "changed_mind",
        items: [{ id: 12, quantity: 1 }],
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("The return window for this order has expired.");
    });
  });

  describe("uploadReturnPhotoAction", () => {
    it("rejects unauthenticated user", async () => {
      (authModule.getSessionUser as jest.Mock).mockResolvedValue(null);
      const formData = new FormData();
      formData.append("file", new Blob(["dummy"], { type: "image/jpeg" }));

      const res = await uploadReturnPhotoAction(formData);
      expect(res.success).toBe(false);
      expect(res.error).toBe("You must be signed in to upload photos.");
    });

    it("rejects files that exceed 5MB limit", async () => {
      const largeContent = new Uint8Array(6 * 1024 * 1024);
      const largeFile = new File([largeContent], "large.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", largeFile);

      const res = await uploadReturnPhotoAction(formData);
      expect(res.success).toBe(false);
      expect(res.error).toContain("5 MB");
    });
  });
});
