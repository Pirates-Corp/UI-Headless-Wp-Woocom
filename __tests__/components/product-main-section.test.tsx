import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductMainSection } from "@/components/product/product-main-section";
import { makeProduct } from "../fixtures";
import type { WooProduct, WooProductAttribute } from "@/lib/woocommerce/types";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: jest.fn(),
  }),
}));

jest.mock("@/lib/store/cart-store", () => ({
  useCartStore: () => ({
    addItem: jest.fn().mockResolvedValue({}),
    openCart: jest.fn(),
  }),
}));

jest.mock("@/lib/store/buy-now-store", () => ({
  useBuyNowStore: {
    getState: () => ({
      startBuyNow: jest.fn().mockResolvedValue({ cart: {} }),
    }),
  },
}));

const makeAttr = (
  name: string,
  terms: { id: number; name: string; slug: string; default: boolean }[],
): WooProductAttribute => ({
  id: 1,
  name,
  taxonomy: `pa_${name.toLowerCase()}`,
  has_variations: true,
  terms,
});

describe("ProductMainSection - Variation Image Switching", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const variableProduct: WooProduct = makeProduct({
    id: 50,
    name: "Classic Silk Shirt",
    slug: "classic-silk-shirt",
    type: "variable",
    images: [
      {
        id: 10,
        src: "https://example.com/shirt-main.jpg",
        thumbnail: "https://example.com/shirt-main.jpg",
        srcset: "",
        sizes: "",
        name: "shirt-main",
        alt: "Classic Silk Shirt Main",
      },
    ],
    attributes: [
      makeAttr("Color", [
        { id: 1, name: "Blue", slug: "blue", default: false },
        { id: 2, name: "Red", slug: "red", default: false },
      ]),
    ],
    variations: [
      {
        id: 201,
        attributes: [{ name: "pa_color", value: "Blue" }],
        prices: {
          price: "199900",
          regular_price: "199900",
          sale_price: "199900",
          currency_code: "INR",
          currency_symbol: "₹",
          currency_minor_unit: 2,
          currency_decimal_separator: ".",
          currency_thousand_separator: ",",
          currency_prefix: "₹",
          currency_suffix: "",
        },
        image: {
          id: 21,
          src: "https://example.com/shirt-blue.jpg",
          thumbnail: "https://example.com/shirt-blue.jpg",
          srcset: "",
          sizes: "",
          name: "shirt-blue",
          alt: "Blue Shirt Variation",
        },
        is_in_stock: true,
      },
      {
        id: 202,
        attributes: [{ name: "pa_color", value: "Red" }],
        prices: {
          price: "249900",
          regular_price: "249900",
          sale_price: "249900",
          currency_code: "INR",
          currency_symbol: "₹",
          currency_minor_unit: 2,
          currency_decimal_separator: ".",
          currency_thousand_separator: ",",
          currency_prefix: "₹",
          currency_suffix: "",
        },
        image: {
          id: 22,
          src: "https://example.com/shirt-red.jpg",
          thumbnail: "https://example.com/shirt-red.jpg",
          srcset: "",
          sizes: "",
          name: "shirt-red",
          alt: "Red Shirt Variation",
        },
        is_in_stock: true,
      },
    ],
  });

  it("loads initial variation image when initialVariationId is set", () => {
    render(
      <ProductMainSection
        product={variableProduct}
        initialVariationId={201}
      />,
    );

    const blueImgs = screen.getAllByAltText("Blue Shirt Variation");
    expect(blueImgs.length).toBeGreaterThan(0);
    expect(blueImgs[0]).toHaveAttribute("src", expect.stringContaining("shirt-blue.jpg"));
  });

  it("switches main gallery image immediately when user clicks another variation", () => {
    render(
      <ProductMainSection
        product={variableProduct}
        initialVariationId={201}
      />,
    );

    // Initial image is Blue variation
    const blueImgs = screen.getAllByAltText("Blue Shirt Variation");
    expect(blueImgs.length).toBeGreaterThan(0);

    // Click Red variation
    const redBtn = screen.getByRole("button", { name: /Red/i });
    fireEvent.click(redBtn);

    // Main image switches to Red variation
    const redImgs = screen.getAllByAltText("Red Shirt Variation");
    expect(redImgs.length).toBeGreaterThan(0);
    expect(redImgs[0]).toHaveAttribute("src", expect.stringContaining("shirt-red.jpg"));
  });
});
