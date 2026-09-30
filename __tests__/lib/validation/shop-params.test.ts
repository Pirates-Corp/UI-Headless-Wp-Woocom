import { ShopParamsSchema } from "@/lib/validation/schemas";

describe("Shop filter query parsing", () => {
  it("accepts numeric category-filter tags and prices within the approved scale", () => {
    expect(ShopParamsSchema.parse({ brand: "trj", tag: "42", min_price: "200.50", max_price: "1500" })).toMatchObject({
      brand: "trj", tag: "42", min_price: "200.50", max_price: "1500",
    });
  });

  it("drops malformed, negative, out-of-scale, and inverted prices without throwing", () => {
    const malformed = ShopParamsSchema.parse({ min_price: "-1", max_price: "999999", tag: "0" });
    expect(malformed.min_price).toBeUndefined();
    expect(malformed.max_price).toBeUndefined();
    expect(malformed.tag).toBeUndefined();

    const inverted = ShopParamsSchema.parse({ min_price: "900", max_price: "300" });
    expect(inverted.min_price).toBeUndefined();
    expect(inverted.max_price).toBeUndefined();
  });

  it("accepts a single-ended price range", () => {
    expect(ShopParamsSchema.parse({ max_price: "200" }).max_price).toBe("200");
  });
});
