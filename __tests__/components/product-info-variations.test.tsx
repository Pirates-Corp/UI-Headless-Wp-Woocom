import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductInfo } from "@/components/product/product-info";
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
  terms: { id: number; name: string; slug: string; default: boolean }[]
): WooProductAttribute => ({
  id: 1,
  name,
  taxonomy: `pa_${name.toLowerCase()}`,
  has_variations: true,
  terms,
});

describe("ProductInfo Variations & Live Price Updating", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const variableProduct: WooProduct = makeProduct({
    id: 40,
    name: "Aromatic Fragrance Blend",
    slug: "aromatic-fragrance-blend",
    type: "variable",
    prices: {
      price: "149900",
      regular_price: "149900",
      sale_price: "149900",
      currency_code: "INR",
      currency_symbol: "₹",
      currency_minor_unit: 2,
      currency_decimal_separator: ".",
      currency_thousand_separator: ",",
      currency_prefix: "₹",
      currency_suffix: "",
      price_range: {
        min_amount: "149900",
        max_amount: "299900",
      },
    },
    attributes: [
      makeAttr("Size", [
        { id: 1, name: "Small", slug: "small", default: false },
        { id: 2, name: "Large", slug: "large", default: false },
      ]),
      makeAttr("Color", [
        { id: 3, name: "Blue", slug: "blue", default: false },
        { id: 4, name: "Red", slug: "red", default: false },
      ]),
      makeAttr("Weight", [
        { id: 5, name: "200g", slug: "200g", default: false },
        { id: 6, name: "300g", slug: "300g", default: false },
        { id: 7, name: "700g", slug: "700g", default: false },
      ]),
    ],
    variations: [
      {
        id: 167,
        attributes: [
          { name: "pa_size", value: "Small" },
          { name: "pa_color", value: "Blue" },
          { name: "pa_weight", value: "200g" },
        ],
        prices: {
          price: "149900",
          regular_price: "149900",
          sale_price: "149900",
          currency_code: "INR",
          currency_symbol: "₹",
          currency_minor_unit: 2,
          currency_decimal_separator: ".",
          currency_thousand_separator: ",",
          currency_prefix: "₹",
          currency_suffix: "",
        },
        is_in_stock: true,
      },
      {
        id: 166,
        attributes: [
          { name: "pa_size", value: "Large" },
          { name: "pa_color", value: "Red" },
          { name: "pa_weight", value: "700g" },
        ],
        prices: {
          price: "299900",
          regular_price: "299900",
          sale_price: "299900",
          currency_code: "INR",
          currency_symbol: "₹",
          currency_minor_unit: 2,
          currency_decimal_separator: ".",
          currency_thousand_separator: ",",
          currency_prefix: "₹",
          currency_suffix: "",
        },
        is_in_stock: true,
      },
    ],
  });

  it("renders with initial variation price and attributes selected", () => {
    render(<ProductInfo product={variableProduct} initialVariationId={167} />);
    expect(screen.getAllByText("₹1499.00").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Small/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("updates price immediately to ₹2999.00 and routes when user clicks Large", () => {
    render(<ProductInfo product={variableProduct} initialVariationId={167} />);
    expect(screen.getAllByText("₹1499.00").length).toBeGreaterThan(0);

    const largeBtn = screen.getByRole("button", { name: /Large/i });
    fireEvent.click(largeBtn);

    // Live price updates on client
    expect(screen.getAllByText("₹2999.00").length).toBeGreaterThan(0);

    // Auto-selects Red and 700g because Large is only valid with #166
    expect(screen.getByRole("button", { name: /Large/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Red/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /700g/i })).toHaveAttribute("aria-pressed", "true");

    // Navigates URL without scroll jump
    expect(mockPush).toHaveBeenCalledWith("/product/aromatic-fragrance-blend/166", { scroll: false });
  });
});
