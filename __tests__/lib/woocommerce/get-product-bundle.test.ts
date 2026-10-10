import { getProduct } from "@/lib/woocommerce/api";

type Route = (url: string, init?: RequestInit) => Partial<Response> | undefined;

const settings = [
  { id: "woocommerce_currency", value: "INR" },
  { id: "woocommerce_currency_pos", value: "left" },
  { id: "woocommerce_price_thousand_sep", value: "," },
  { id: "woocommerce_price_decimal_sep", value: "." },
  { id: "woocommerce_price_num_decimals", value: "2" },
];

const v3Product = {
  id: 42,
  name: "Clay Brush",
  slug: "clay-brush",
  type: "variable",
  status: "publish",
  description: "",
  short_description: "",
  sku: "CB-1",
  permalink: "",
  price: "100",
  regular_price: "100",
  sale_price: "",
  on_sale: false,
  purchasable: true,
  stock_status: "instock",
  manage_stock: false,
  stock_quantity: null,
  low_stock_amount: null,
  average_rating: "4.50",
  rating_count: 2,
  featured: false,
  categories: [],
  tags: [],
  images: [],
  attributes: [{ id: 1, name: "Size", slug: "size", variation: true, options: ["S", "M"] }],
  variations: [7, 8],
};

const v3Variations = [
  { id: 7, price: "100", regular_price: "100", sale_price: "", on_sale: false, stock_status: "instock", attributes: [{ id: 1, name: "Size", option: "S" }] },
  { id: 8, price: "120", regular_price: "120", sale_price: "", on_sale: false, stock_status: "instock", attributes: [{ id: 1, name: "Size", option: "M" }] },
];

function json(body: unknown, status = 200): Partial<Response> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  };
}

function mockFetch(route: Route) {
  global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes("/settings/general")) return Promise.resolve(json(settings));
    const res = route(url, init);
    if (!res) throw new Error(`Unexpected fetch: ${url}`);
    return Promise.resolve(res);
  }) as unknown as typeof fetch;
}

const calls = () => (global.fetch as jest.Mock).mock.calls.map(([u]) => String(u));

describe("getProduct — single-request product bundle", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.MYAPP_CART_AUTH_KEY;

  beforeEach(() => {
    process.env.MYAPP_CART_AUTH_KEY = "bundle_secret";
    process.env.WC_CONSUMER_KEY = "ck";
    process.env.WC_CONSUMER_SECRET = "cs";
  });

  afterEach(() => {
    process.env.MYAPP_CART_AUTH_KEY = originalKey;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("loads product + variations from the bundle route in one request, with the key in a header", async () => {
    mockFetch((url) =>
      url.includes("/myapp/v1/product/clay-brush")
        ? json({ product: v3Product, variations: v3Variations })
        : undefined,
    );

    const product = await getProduct("clay-brush");

    expect(product.id).toBe(42);
    expect(product.variations.map((v) => v.id)).toEqual([7, 8]);

    const productCalls = calls().filter((u) => !u.includes("/settings/general"));
    expect(productCalls).toHaveLength(1);
    expect(productCalls[0]).toContain("product_fields=");
    expect(productCalls[0]).not.toContain("bundle_secret");

    const bundleCall = (global.fetch as jest.Mock).mock.calls.find(([u]) =>
      String(u).includes("/myapp/v1/product/"),
    );
    expect(bundleCall?.[1]?.headers?.["X-MyApp-Auth-Key"]).toBe("bundle_secret");
  });

  it("throws (→ notFound) when the bundle route reports the product is missing, without falling back", async () => {
    mockFetch((url) =>
      url.includes("/myapp/v1/product/")
        ? json({ code: "myapp_product_not_found" }, 404)
        : undefined,
    );

    await expect(getProduct("nope")).rejects.toThrow("Product not found");
    expect(calls().some((u) => u.includes("/wc/v3/products"))).toBe(false);
  });

  it("falls back to the wc/v3 multi-request path when the route is not deployed", async () => {
    mockFetch((url) => {
      if (url.includes("/myapp/v1/product/")) return json({ code: "rest_no_route" }, 404);
      if (url.includes("/wc/v3/products/42/variations")) return json(v3Variations);
      if (url.includes("/wc/v3/products?")) return json([v3Product]);
      return undefined;
    });

    const product = await getProduct("clay-brush");

    expect(product.id).toBe(42);
    expect(product.variations).toHaveLength(2);
    const variationsCall = calls().find((u) => u.includes("/variations"));
    expect(variationsCall).toContain("_fields=");
  });

  it("falls back to wc/v3 when MYAPP_CART_AUTH_KEY is not configured", async () => {
    delete process.env.MYAPP_CART_AUTH_KEY;
    mockFetch((url) => {
      if (url.includes("/wc/v3/products/42/variations")) return json(v3Variations);
      if (url.includes("/wc/v3/products?")) return json([v3Product]);
      return undefined;
    });

    const product = await getProduct("clay-brush");

    expect(product.id).toBe(42);
    expect(calls().some((u) => u.includes("/myapp/v1/product/"))).toBe(false);
  });
});
