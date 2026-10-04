import {
  getAddressBookAction,
  createAddressAction,
  updateAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  getSavedBillingAction,
  saveBillingAction,
} from "@/lib/actions/address";
import * as sessionModule from "@/lib/auth/session";

jest.mock("@/lib/auth/session");

describe("Address Server Actions", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      MYAPP_CART_AUTH_KEY: "test-cart-auth-key",
      WC_CONSUMER_KEY: "ck_test_123",
      WC_CONSUMER_SECRET: "cs_test_123",
      NEXT_PUBLIC_WOOCOMMERCE_HOST: "trjshop.com",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("Authentication checks (User ID from session only)", () => {
    it("1. getAddressBookAction rejects when session has no user", async () => {
      jest.spyOn(sessionModule, "getSessionUser").mockResolvedValue(null);
      const res = await getAddressBookAction();
      expect(res.ok).toBe(false);
      expect(res.error).toBe("Unauthorized");
    });

    it("2. createAddressAction rejects when session has no user", async () => {
      jest.spyOn(sessionModule, "getSessionUser").mockResolvedValue(null);
      const res = await createAddressAction({ first_name: "Test" });
      expect(res.ok).toBe(false);
      expect(res.error).toBe("Unauthorized");
    });

    it("3. updateAddressAction rejects when session has no user", async () => {
      jest.spyOn(sessionModule, "getSessionUser").mockResolvedValue(null);
      const res = await updateAddressAction("addr-1", { first_name: "Test" });
      expect(res.ok).toBe(false);
      expect(res.error).toBe("Unauthorized");
    });

    it("4. deleteAddressAction rejects when session has no user", async () => {
      jest.spyOn(sessionModule, "getSessionUser").mockResolvedValue(null);
      const res = await deleteAddressAction("addr-1");
      expect(res.ok).toBe(false);
      expect(res.error).toBe("Unauthorized");
    });

    it("5. setDefaultAddressAction rejects when session has no user", async () => {
      jest.spyOn(sessionModule, "getSessionUser").mockResolvedValue(null);
      const res = await setDefaultAddressAction("addr-1");
      expect(res.ok).toBe(false);
      expect(res.error).toBe("Unauthorized");
    });

    it("6. getSavedBillingAction rejects when session has no user", async () => {
      jest.spyOn(sessionModule, "getSessionUser").mockResolvedValue(null);
      const res = await getSavedBillingAction();
      expect(res.ok).toBe(false);
      expect(res.error).toBe("Unauthorized");
    });

    it("7. saveBillingAction rejects when session has no user", async () => {
      jest.spyOn(sessionModule, "getSessionUser").mockResolvedValue(null);
      const res = await saveBillingAction({});
      expect(res.ok).toBe(false);
      expect(res.error).toBe("Unauthorized");
    });
  });

  describe("Validation & Error Resilience", () => {
    it("8. createAddressAction returns field validation errors gracefully without throw", async () => {
      jest.spyOn(sessionModule, "getSessionUser").mockResolvedValue({
        id: "42",
        email: "user@example.com",
        username: "user42",
        displayName: "User 42",
      });

      const res = await createAddressAction({
        label: "Home",
        first_name: "", // Missing required
        last_name: "Doe",
      });

      expect(res.ok).toBe(false);
      expect(res.error).toBeDefined();
    });

    it("9. saveBillingAction returns validation errors gracefully without throw", async () => {
      jest.spyOn(sessionModule, "getSessionUser").mockResolvedValue({
        id: "42",
        email: "user@example.com",
        username: "user42",
        displayName: "User 42",
      });

      const res = await saveBillingAction({
        first_name: "John",
        email: "not-an-email", // invalid email
      });

      expect(res.ok).toBe(false);
      expect(res.error).toBeDefined();
    });

    it("10. createAddressAction succeeds when payload is valid and REST endpoint returns data", async () => {
      jest.spyOn(sessionModule, "getSessionUser").mockResolvedValue({
        id: "42",
        email: "user@example.com",
        username: "user42",
        displayName: "User 42",
      });

      const mockBook = {
        addresses: [
          {
            id: "uuid-123",
            label: "Home",
            first_name: "John",
            last_name: "Doe",
            address_1: "123 Main St",
            city: "Mumbai",
            state: "MH",
            postcode: "400001",
            country: "IN",
            is_default: true,
          },
        ],
        default_id: "uuid-123",
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockBook,
      } as Response);

      const res = await createAddressAction({
        label: "Home",
        first_name: "John",
        last_name: "Doe",
        address_1: "123 Main St",
        city: "Mumbai",
        state: "MH",
        postcode: "400001",
        country: "IN",
        is_default: true,
      });

      expect(res.ok).toBe(true);
      expect(res.data?.addresses).toHaveLength(1);
      expect(res.data?.default_id).toBe("uuid-123");
    });
  });
});
