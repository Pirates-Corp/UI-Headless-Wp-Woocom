import {
  getGuestCheckoutError,
  isGuestCheckoutAllowed,
  GUEST_CHECKOUT_BLOCKED_MESSAGE,
} from "@/lib/checkout/guest-checkout";
import { getSessionUser } from "@/lib/auth/session";
import { checkoutAction } from "@/lib/actions/checkout-submit";
import { checkout } from "@/lib/actions/cart";
import { createStripeOrder } from "@/lib/actions/stripe-checkout";
import { createRazorpayCheckoutOrder } from "@/lib/actions/razorpay-checkout";
import type { BillingAddress, ShippingAddress } from "@/lib/woocommerce/types";

const mockFeatureFlags = { allowGuest: false };

jest.mock("@/store.config", () => ({
  get STORE_CONFIG() {
    return {
      featureFlags: mockFeatureFlags,
    };
  },
  get APP_CONFIG() {
    return {
      featureFlags: mockFeatureFlags,
    };
  },
}));

jest.mock("@/lib/auth/session", () => ({
  getSessionUser: jest.fn(),
}));

const mockBilling: BillingAddress = {
  first_name: "John",
  last_name: "Doe",
  company: "",
  address_1: "123 Elm St",
  address_2: "",
  city: "Metropolis",
  state: "NY",
  postcode: "10001",
  country: "US",
  email: "john@example.com",
  phone: "5551234567",
};

const mockShipping: ShippingAddress = {
  first_name: "John",
  last_name: "Doe",
  company: "",
  address_1: "123 Elm St",
  address_2: "",
  city: "Metropolis",
  state: "NY",
  postcode: "10001",
  country: "US",
};

describe("Guest Checkout Helper & Action Locks", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("flag true allows guests without reading the session", async () => {
    mockFeatureFlags.allowGuest = true;
    (getSessionUser as jest.Mock).mockClear();

    expect(isGuestCheckoutAllowed()).toBe(true);

    const error = await getGuestCheckoutError();
    expect(error).toBeNull();
    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it("flag false with no session returns the message", async () => {
    mockFeatureFlags.allowGuest = false;
    (getSessionUser as jest.Mock).mockResolvedValue(null);

    expect(isGuestCheckoutAllowed()).toBe(false);

    const error = await getGuestCheckoutError();
    expect(error).toBe(GUEST_CHECKOUT_BLOCKED_MESSAGE);
    expect(getSessionUser).toHaveBeenCalled();
  });

  it("flag false with a session returns null", async () => {
    mockFeatureFlags.allowGuest = false;
    (getSessionUser as jest.Mock).mockResolvedValue({
      id: "42",
      email: "user@example.com",
      username: "testuser",
      displayName: "Test User",
    });

    const error = await getGuestCheckoutError();
    expect(error).toBeNull();
    expect(getSessionUser).toHaveBeenCalled();
  });

  it("with flag false and no session, all four order-creating actions return the error and global.fetch is never called", async () => {
    mockFeatureFlags.allowGuest = false;
    (getSessionUser as jest.Mock).mockResolvedValue(null);

    // 1. checkoutAction
    const formData = new FormData();
    const actionResult = await checkoutAction(null, formData);
    expect(actionResult).toEqual({
      type: "error",
      message: GUEST_CHECKOUT_BLOCKED_MESSAGE,
    });

    // 2. checkout (cart.ts)
    const cartResult = await checkout(mockBilling, mockShipping, "cod");
    expect(cartResult).toEqual({
      order: null,
      cartToken: null,
      nonce: null,
      error: GUEST_CHECKOUT_BLOCKED_MESSAGE,
    });

    // 3. createStripeOrder
    const stripeResult = await createStripeOrder(mockBilling, mockShipping, "stripe", []);
    expect(stripeResult).toEqual({
      error: GUEST_CHECKOUT_BLOCKED_MESSAGE,
    });

    // 4. createRazorpayCheckoutOrder
    const razorpayResult = await createRazorpayCheckoutOrder(
      mockBilling,
      mockShipping,
      "razorpay",
      []
    );
    expect(razorpayResult).toEqual({
      error: GUEST_CHECKOUT_BLOCKED_MESSAGE,
    });

    // Confirm nothing ever called WordPress / WooCommerce APIs
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
