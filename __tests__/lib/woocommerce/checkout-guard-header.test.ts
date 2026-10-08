import {
  checkoutOnServer,
  addToCartOnServer,
} from "@/lib/woocommerce/api";

describe("Checkout Guard Header (X-MyApp-Checkout-Key)", () => {
  const originalEnv = process.env.MYAPP_CART_AUTH_KEY;
  const originalFetch = global.fetch;

  const dummyCheckoutData = {
    billing_address: { first_name: "Jane", last_name: "Doe" },
    shipping_address: { first_name: "Jane", last_name: "Doe" },
    payment_method: "cod",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.MYAPP_CART_AUTH_KEY = originalEnv;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("checkoutOnServer sends X-MyApp-Checkout-Key equal to the env value", async () => {
    process.env.MYAPP_CART_AUTH_KEY = "test_cart_auth_secret_777";

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ order_id: 101 }),
      headers: new Headers(),
    } as unknown as Response);

    await checkoutOnServer(dummyCheckoutData, "token-abc", "nonce-xyz");

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers["X-MyApp-Checkout-Key"]).toBe("test_cart_auth_secret_777");
  });

  it("the header is still present on the retry after a 401 with code woocommerce_rest_missing_nonce", async () => {
    process.env.MYAPP_CART_AUTH_KEY = "test_cart_auth_secret_777";

    let attempt = 0;
    global.fetch = jest.fn().mockImplementation((url: string) => {
      attempt++;
      if (url.includes("/checkout") && attempt === 1) {
        // Initial 401 response
        return Promise.resolve({
          ok: false,
          status: 401,
          clone() {
            return this;
          },
          json: async () => ({ code: "woocommerce_rest_missing_nonce" }),
          text: async () => JSON.stringify({ code: "woocommerce_rest_missing_nonce" }),
          headers: new Headers(),
        } as unknown as Response);
      }
      if (url.includes("/cart") && attempt === 2) {
        // Nonce refresh response
        const headers = new Headers();
        headers.set("Nonce", "refreshed_nonce_value");
        headers.set("Cart-Token", "refreshed_token_value");
        return Promise.resolve({
          ok: true,
          status: 200,
          headers,
          json: async () => ({}),
        } as unknown as Response);
      }
      // Retry checkout attempt
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ order_id: 202 }),
      } as unknown as Response);
    });

    await checkoutOnServer(dummyCheckoutData, "token-abc", "nonce-xyz");

    // Attempt 1: POST /checkout with key
    const firstCallInit = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(firstCallInit.headers["X-MyApp-Checkout-Key"]).toBe("test_cart_auth_secret_777");

    // Attempt 3: Retry POST /checkout with key
    const retryCallInit = (global.fetch as jest.Mock).mock.calls[2][1];
    expect(retryCallInit.headers["X-MyApp-Checkout-Key"]).toBe("test_cart_auth_secret_777");
  });

  it("a non-checkout cart call does not send the header", async () => {
    process.env.MYAPP_CART_AUTH_KEY = "test_cart_auth_secret_777";

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
      headers: new Headers(),
    } as unknown as Response);

    await addToCartOnServer(12, 1, undefined, "token-abc", "nonce-xyz");

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers["X-MyApp-Checkout-Key"]).toBeUndefined();
  });

  it("with the env var unset, the request is still made without the header", async () => {
    delete process.env.MYAPP_CART_AUTH_KEY;
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ order_id: 303 }),
      headers: new Headers(),
    } as unknown as Response);

    await checkoutOnServer(dummyCheckoutData, "token-abc", "nonce-xyz");

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers["X-MyApp-Checkout-Key"]).toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("MYAPP_CART_AUTH_KEY")
    );

    errorSpy.mockRestore();
  });
});
