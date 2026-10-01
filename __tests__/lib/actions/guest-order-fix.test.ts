import { assignOrderToCustomer } from "@/lib/woocommerce/api";
import { checkout } from "@/lib/actions/cart";
import { createRazorpayCheckoutOrder } from "@/lib/actions/razorpay-checkout";
import { createStripeOrder } from "@/lib/actions/stripe-checkout";
import { getCustomerOrdersAction } from "@/lib/actions/account";
import { getSessionUser } from "@/lib/auth/session";
import {
  createWooOrderOnServer,
  checkoutOnServer,
} from "@/lib/woocommerce/api";
import { createRazorpayOrder } from "@/lib/razorpay-server";
import { createStripeCheckoutSession } from "@/lib/stripe-server";

// Mock dependencies
jest.mock("@/lib/auth/session", () => ({
  getSessionUser: jest.fn(),
}));

jest.mock("@/lib/razorpay-server", () => ({
  createRazorpayOrder: jest.fn(),
}));

jest.mock("@/lib/stripe-server", () => ({
  createStripeCheckoutSession: jest.fn(),
}));

// We will selectively mock global fetch for API tests
const originalFetch = global.fetch;

describe("Guest Order Bug Fix — Customer ID Assignment & Account Orders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL = "https";
    process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST = "example.com";
    process.env.WC_CONSUMER_KEY = "ck_test_123";
    process.env.WC_CONSUMER_SECRET = "cs_test_456";
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_key";
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("assignOrderToCustomer helper", () => {
    it("calls PUT /wc/v3/orders/{orderId} with customer_id and returns true on success", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 101, customer_id: 42 }),
      } as Response);

      const result = await assignOrderToCustomer(101, 42);
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/wp-json/wc/v3/orders/101"),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ customer_id: 42 }),
          cache: "no-store",
        })
      );
    });

    it("returns false without calling fetch if customerId <= 0 or orderId is empty", async () => {
      global.fetch = jest.fn();

      expect(await assignOrderToCustomer(101, 0)).toBe(false);
      expect(await assignOrderToCustomer("", 42)).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("returns false and logs warning without throwing if server returns non-ok", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      } as Response);

      const result = await assignOrderToCustomer(101, 42);
      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("returns false and logs warning without throwing if network fetch throws", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      global.fetch = jest.fn().mockRejectedValue(new Error("Network disconnect"));

      const result = await assignOrderToCustomer(101, 42);
      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("createRazorpayCheckoutOrder action", () => {
    const mockBilling = {
      first_name: "Alice",
      last_name: "Smith",
      company: "",
      address_1: "123 Main St",
      address_2: "",
      city: "Mumbai",
      state: "MH",
      postcode: "400001",
      country: "IN",
      email: "different-billing@example.com",
      phone: "9999999999",
    };
    const mockShipping = {
      first_name: "Alice",
      last_name: "Smith",
      company: "",
      address_1: "123 Main St",
      address_2: "",
      city: "Mumbai",
      state: "MH",
      postcode: "400001",
      country: "IN",
    };
    const mockLineItems = [
      { name: "Test Perfume", unitAmount: 100000, quantity: 1, currency: "INR" },
    ];

    it("includes customer_id when session user is logged in", async () => {
      (getSessionUser as jest.Mock).mockResolvedValue({
        id: "77",
        email: "alice-account@example.com",
        username: "alice",
        displayName: "Alice",
      });

      global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/wp-json/wc/v3/orders") && init?.method === "POST") {
          const body = JSON.parse(init.body as string);
          expect(body.customer_id).toBe(77);
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 501, order_key: "wc_order_key_501" }),
          });
        }
        if (url.includes("/wp-json/wc/v3/orders/501")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 501, order_key: "wc_order_key_501", total: "1000.00", currency: "INR" }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      (createRazorpayOrder as jest.Mock).mockResolvedValue({ id: "order_rzp_501" });

      const res = await createRazorpayCheckoutOrder(
        mockBilling,
        mockShipping,
        "razorpay",
        mockLineItems
      );

      expect("razorpayOrderId" in res).toBe(true);
      if ("razorpayOrderId" in res) {
        expect(res.wcOrderId).toBe(501);
      }
    });

    it("does not include customer_id when user is a guest", async () => {
      (getSessionUser as jest.Mock).mockResolvedValue(null);

      global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/wp-json/wc/v3/orders") && init?.method === "POST") {
          const body = JSON.parse(init.body as string);
          expect(body.customer_id).toBeUndefined();
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 502, order_key: "wc_order_key_502" }),
          });
        }
        if (url.includes("/wp-json/wc/v3/orders/502")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 502, order_key: "wc_order_key_502", total: "1000.00", currency: "INR" }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      (createRazorpayOrder as jest.Mock).mockResolvedValue({ id: "order_rzp_502" });

      const res = await createRazorpayCheckoutOrder(
        mockBilling,
        mockShipping,
        "razorpay",
        mockLineItems
      );

      expect("razorpayOrderId" in res).toBe(true);
    });
  });

  describe("createStripeOrder action", () => {
    const mockBilling = {
      first_name: "Bob",
      last_name: "Jones",
      company: "",
      address_1: "456 Side St",
      address_2: "",
      city: "New York",
      state: "NY",
      postcode: "10001",
      country: "US",
      email: "bob-billing@example.com",
      phone: "5551234567",
    };
    const mockShipping = {
      first_name: "Bob",
      last_name: "Jones",
      company: "",
      address_1: "456 Side St",
      address_2: "",
      city: "New York",
      state: "NY",
      postcode: "10001",
      country: "US",
    };
    const mockLineItems = [
      { name: "Luxury EDP", unitAmount: 5000, quantity: 1, currency: "USD" },
    ];

    it("includes customer_id in createWooOrderOnServer when user is logged in", async () => {
      (getSessionUser as jest.Mock).mockResolvedValue({
        id: "88",
        email: "bob-account@example.com",
        username: "bobjones",
        displayName: "Bob Jones",
      });

      global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/wp-json/wc/v3/orders") && init?.method === "POST") {
          const body = JSON.parse(init.body as string);
          expect(body.customer_id).toBe(88);
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 601, order_key: "wc_order_key_601" }),
          });
        }
        if (url.includes("/wp-json/wc/v3/orders/601")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 601, order_key: "wc_order_key_601", total: "50.00", currency: "USD" }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      (createStripeCheckoutSession as jest.Mock).mockResolvedValue({
        url: "https://checkout.stripe.com/test_session_601",
      });

      const res = await createStripeOrder(
        mockBilling,
        mockShipping,
        "stripe",
        mockLineItems
      );

      expect("sessionUrl" in res).toBe(true);
      if ("sessionUrl" in res) {
        expect(res.orderId).toBe(601);
      }
    });
  });

  describe("checkout action (lib/actions/cart.ts)", () => {
    const mockBilling = {
      first_name: "Charlie",
      last_name: "Brown",
      company: "",
      address_1: "789 Pine St",
      address_2: "",
      city: "London",
      state: "",
      postcode: "SW1A 1AA",
      country: "GB",
      email: "charlie-billing@example.com",
      phone: "07123456789",
    };
    const mockShipping = {
      first_name: "Charlie",
      last_name: "Brown",
      company: "",
      address_1: "789 Pine St",
      address_2: "",
      city: "London",
      state: "",
      postcode: "SW1A 1AA",
      country: "GB",
    };

    it("calls assignOrderToCustomer after Store API checkout when user is logged in", async () => {
      (getSessionUser as jest.Mock).mockResolvedValue({
        id: "99",
        email: "charlie-account@example.com",
        username: "charlieb",
        displayName: "Charlie Brown",
      });

      let assignedCustomerId: number | undefined;

      global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/wp-json/wc/store/v1/checkout")) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ "Cart-Token": "token-123", Nonce: "nonce-123" }),
            json: async () => ({
              order_id: 701,
              order_key: "wc_order_701",
              status: "processing",
              customer_note: "",
              payment_result: { payment_status: "success", payment_details: [], redirect_url: "" },
            }),
          });
        }
        if (url.includes("/wp-json/wc/v3/orders/701") && init?.method === "PUT") {
          const body = JSON.parse(init.body as string);
          assignedCustomerId = body.customer_id;
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 701, customer_id: 99 }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      const res = await checkout(mockBilling, mockShipping, "cod", "cart_token_xyz");

      expect(res.order?.order_id).toBe(701);
      expect(assignedCustomerId).toBe(99);
    });

    it("does not call assignOrderToCustomer when user is guest (not logged in)", async () => {
      (getSessionUser as jest.Mock).mockResolvedValue(null);

      let putCalled = false;
      global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/wp-json/wc/store/v1/checkout")) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ "Cart-Token": "token-123", Nonce: "nonce-123" }),
            json: async () => ({
              order_id: 702,
              order_key: "wc_order_702",
              status: "processing",
              customer_note: "",
              payment_result: { payment_status: "success", payment_details: [], redirect_url: "" },
            }),
          });
        }
        if (url.includes("/wp-json/wc/v3/orders/702") && init?.method === "PUT") {
          putCalled = true;
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      const res = await checkout(mockBilling, mockShipping, "cod", "cart_token_xyz");

      expect(res.order?.order_id).toBe(702);
      expect(putCalled).toBe(false);
    });
  });

  describe("getCustomerOrdersAction (lib/actions/account.ts)", () => {
    it("returns orders with different billing email if owned by logged-in user (customer=<id>)", async () => {
      (getSessionUser as jest.Mock).mockResolvedValue({
        id: "42",
        email: "alice-account@example.com",
        username: "alice",
        displayName: "Alice Smith",
      });

      global.fetch = jest.fn().mockImplementation((url: string) => {
        // Query by customer ID
        if (url.includes("customer=42")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 101,
                number: "101",
                customer_id: 42,
                status: "processing",
                date_created: "2026-09-30T10:00:00",
                total: "1500",
                billing: { email: "gift-recipient@example.com" }, // Different billing email!
                line_items: [{ id: 1, product_id: 10, name: "Perfume A", quantity: 1, total: "1500" }],
              },
            ],
          });
        }
        // Fallback search by email
        if (url.includes("search=alice-account%40example.com") || url.includes("search=alice-account@example.com")) {
          return Promise.resolve({
            ok: true,
            json: async () => [],
          });
        }
        // General settings
        if (url.includes("/settings/general")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "woocommerce_currency", value: "INR" },
              { id: "woocommerce_currency_pos", value: "left" },
            ],
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      const res = await getCustomerOrdersAction();
      expect(res.success).toBe(true);
      expect(res.orders).toHaveLength(1);
      expect(res.orders[0].id).toBe(101);
    });

    it("tightened email fallback accepts true guest orders (customer_id = 0) matching user email", async () => {
      (getSessionUser as jest.Mock).mockResolvedValue({
        id: "42",
        email: "alice-account@example.com",
        username: "alice",
        displayName: "Alice Smith",
      });

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("customer=42")) {
          return Promise.resolve({
            ok: true,
            json: async () => [],
          });
        }
        if (url.includes("search=")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 201,
                number: "201",
                customer_id: 0, // Legacy true guest order
                status: "completed",
                date_created: "2026-09-28T10:00:00",
                total: "2000",
                billing: { email: "alice-account@example.com" },
                line_items: [],
              },
            ],
          });
        }
        if (url.includes("/settings/general")) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ id: "woocommerce_currency", value: "INR" }],
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      const res = await getCustomerOrdersAction();
      expect(res.success).toBe(true);
      expect(res.orders).toHaveLength(1);
      expect(res.orders[0].id).toBe(201);
    });

    it("email fallback strictly rejects orders whose customer_id belongs to a different non-zero user (customer_id = B)", async () => {
      (getSessionUser as jest.Mock).mockResolvedValue({
        id: "42", // User A
        email: "alice-account@example.com",
        username: "alice",
        displayName: "Alice Smith",
      });

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("customer=42")) {
          return Promise.resolve({
            ok: true,
            json: async () => [],
          });
        }
        if (url.includes("search=")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 301,
                number: "301",
                customer_id: 999, // User B!
                status: "processing",
                date_created: "2026-09-29T10:00:00",
                total: "5000",
                billing: { email: "alice-account@example.com" }, // But billing entered Alice's email
                line_items: [],
              },
            ],
          });
        }
        if (url.includes("/settings/general")) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ id: "woocommerce_currency", value: "INR" }],
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      const res = await getCustomerOrdersAction();
      expect(res.success).toBe(true);
      // Must NOT include order 301 because customer_id is 999 (User B), not 0 or 42
      expect(res.orders).toHaveLength(0);
    });

    it("de-duplicates orders if an order is returned by both customer query and email search", async () => {
      (getSessionUser as jest.Mock).mockResolvedValue({
        id: "42",
        email: "alice-account@example.com",
        username: "alice",
        displayName: "Alice Smith",
      });

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("customer=42")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 401,
                number: "401",
                customer_id: 42,
                status: "completed",
                date_created: "2026-09-25T10:00:00",
                total: "3000",
                billing: { email: "alice-account@example.com" },
                line_items: [],
              },
            ],
          });
        }
        if (url.includes("search=")) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 401,
                number: "401",
                customer_id: 42,
                status: "completed",
                date_created: "2026-09-25T10:00:00",
                total: "3000",
                billing: { email: "alice-account@example.com" },
                line_items: [],
              },
            ],
          });
        }
        if (url.includes("/settings/general")) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ id: "woocommerce_currency", value: "INR" }],
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      const res = await getCustomerOrdersAction();
      expect(res.success).toBe(true);
      expect(res.orders).toHaveLength(1);
      expect(res.orders[0].id).toBe(401);
    });
  });
});
