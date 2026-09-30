import { getProductsMeta } from "@/lib/woocommerce/api";

const originalEnv = {
  protocol: process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL,
  host: process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST,
  key: process.env.WC_CONSUMER_KEY,
  secret: process.env.WC_CONSUMER_SECRET,
};
const fetchMock = jest.fn();
const mockResponse = (data: unknown, headers: Record<string, string> = {}) => ({
  ok: true,
  status: 200,
  headers: { get: (name: string) => headers[name] ?? null },
  json: async () => data,
  text: async () => JSON.stringify(data),
}) as Response;

describe("Shop WooCommerce product query", () => {

  beforeAll(() => {
    Object.defineProperty(global, "fetch", { configurable: true, writable: true, value: fetchMock });
    process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL = "https";
    process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST = "shop.example.test";
    process.env.WC_CONSUMER_KEY = "test-key";
    process.env.WC_CONSUMER_SECRET = "test-secret";
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL = originalEnv.protocol;
    process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST = originalEnv.host;
    process.env.WC_CONSUMER_KEY = originalEnv.key;
    process.env.WC_CONSUMER_SECRET = originalEnv.secret;
  });

  it("sends category, tag, price, sale, sort, and page to the existing REST v3 query", async () => {
    const requested: URL[] = [];
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = new URL(String(input));
      requested.push(url);
      if (url.pathname.endsWith("/settings/general")) {
        return mockResponse([
          { id: "woocommerce_currency", value: "INR" },
          { id: "woocommerce_currency_pos", value: "left" },
          { id: "woocommerce_price_num_decimals", value: "2" },
        ]);
      }
      if (url.pathname.endsWith("/products/categories")) {
        return mockResponse([{ id: 11, name: "Nature", slug: "nature" }]);
      }
      return mockResponse([], { "X-WP-TotalPages": "3" });
    });

    const result = await getProductsMeta({
      per_page: 12, page: 2, category: "nature", tag: "7", min_price: "500", max_price: "1000",
      on_sale: true, orderby: "price", order: "asc",
    });

    expect(result).toEqual({ products: [], totalPages: 3 });
    const productQuery = requested.find((url) => url.pathname.endsWith("/products"));
    expect(productQuery).toBeDefined();
    expect(productQuery?.searchParams.get("category")).toBe("11");
    expect(productQuery?.searchParams.get("tag")).toBe("7");
    expect(productQuery?.searchParams.get("min_price")).toBe("500");
    expect(productQuery?.searchParams.get("max_price")).toBe("1000");
    expect(productQuery?.searchParams.get("on_sale")).toBe("true");
    expect(productQuery?.searchParams.get("orderby")).toBe("price");
    expect(productQuery?.searchParams.get("order")).toBe("asc");
    expect(productQuery?.searchParams.get("page")).toBe("2");
  });
});

describe("Shop brand query", () => {
  it("uses the public Store API brand filter and converts prices to minor units", async () => {
    const requested: URL[] = [];
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = new URL(String(input));
      requested.push(url);
      if (url.pathname.endsWith("/settings/general")) {
        return mockResponse([
          { id: "woocommerce_currency", value: "INR" },
          { id: "woocommerce_currency_pos", value: "left" },
          { id: "woocommerce_price_num_decimals", value: "2" },
        ]);
      }
      return mockResponse([], { "X-WP-TotalPages": "2" });
    });

    const result = await getProductsMeta({ brand: "trj", min_price: "500", max_price: "1000", per_page: 12 });
    expect(result).toEqual({ products: [], totalPages: 2 });
    const productQuery = requested.find((url) => url.pathname.endsWith("/wc/store/v1/products"));
    expect(productQuery).toBeDefined();
    expect(productQuery?.searchParams.get("brand")).toBe("trj");
    expect(productQuery?.searchParams.get("min_price")).toBe("50000");
    expect(productQuery?.searchParams.get("max_price")).toBe("100000");
  });
});