import { addToCart } from "@/lib/actions/cart";
import { formatCartError } from "@/lib/utils/format";
import { addToCartOnServer } from "@/lib/woocommerce/api";

jest.mock("@/lib/woocommerce/api", () => ({
  addToCartOnServer: jest.fn(),
  updateCartItemOnServer: jest.fn(),
  removeCartItemOnServer: jest.fn(),
  getCartFromServer: jest.fn(),
  checkoutOnServer: jest.fn(),
  selectShippingRateOnServer: jest.fn(),
  updateCustomerOnServer: jest.fn(),
  applyCouponOnServer: jest.fn(),
  removeCouponOnServer: jest.fn(),
  extractCartToken: jest.fn().mockReturnValue("token-123"),
  extractNonce: jest.fn().mockReturnValue("nonce-123"),
  getCountriesFromServer: jest.fn().mockResolvedValue([]),
}));

describe("Cart Actions & Error Formatting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("formatCartError", () => {
    it("extracts clean message from WooCommerce Store API JSON error", () => {
      const raw = JSON.stringify({
        code: "woocommerce_rest_invalid_variation_data",
        message: "Invalid value posted for Size. Allowed values: Small, Large",
        data: { status: 400 },
      });
      const formatted = formatCartError(raw);
      expect(formatted).toBe("Invalid value posted for Size. Allowed values: Small, Large");
    });

    it("strips HTML tags and decodes entities in error messages", () => {
      const raw = JSON.stringify({
        message: "<strong>Error:</strong> Item &amp; stock unavailable &lt;test&gt;",
      });
      const formatted = formatCartError(raw);
      expect(formatted).toBe("Error: Item & stock unavailable <test>");
    });

    it("returns plain text or fallback when not valid JSON", () => {
      expect(formatCartError("Internal Server Error", "Default fallback")).toBe("Internal Server Error");
      expect(formatCartError("", "Default fallback")).toBe("Default fallback");
    });
  });

  describe("addToCart action", () => {
    it("returns friendly error message when WooCommerce Store API rejects invalid variation", async () => {
      (addToCartOnServer as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            code: "woocommerce_rest_invalid_variation_data",
            message: "Invalid value posted for Size. Allowed values: Small, Large",
            data: { status: 400 },
          }),
      });

      const result = await addToCart(40, 1);
      expect(result.cart).toBeNull();
      expect(result.error).toBe("Invalid value posted for Size. Allowed values: Small, Large");
    });

    it("successfully adds item when WooCommerce Store API returns 200", async () => {
      const mockCart = { items: [{ id: 166, quantity: 1 }], items_count: 1 };
      (addToCartOnServer as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockCart,
      });

      const result = await addToCart(166, 1);
      expect(result.cart).toEqual(mockCart);
      expect(result.cartToken).toBe("token-123");
      expect(result.nonce).toBe("nonce-123");
      expect(result.error).toBeUndefined();
    });
  });
});
