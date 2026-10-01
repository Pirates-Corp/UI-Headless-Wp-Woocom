import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductInfo } from "@/components/product/product-info";
import { makeProduct } from "../fixtures";
import type { WooProduct, WooProductAttribute } from "@/lib/woocommerce/types";
import { t } from "@/lib/i18n";

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

  it("displays Out of Stock when selected variation is out of stock", () => {
    const oosProduct: WooProduct = {
      ...variableProduct,
      variations: [
        {
          ...variableProduct.variations[0],
          is_in_stock: false,
          stock_quantity: 0,
        },
      ],
    };

    render(<ProductInfo product={oosProduct} initialVariationId={167} />);
    expect(screen.getAllByText("Out of Stock").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^Out of Stock$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Buy Now/i })).toBeDisabled();
  });

  it("displays 'Only 2 items left – order soon' when quantity is 2 (below 3)", () => {
    const lowStockProduct: WooProduct = {
      ...variableProduct,
      variations: [
        {
          ...variableProduct.variations[0],
          is_in_stock: true,
          stock_quantity: 2,
          low_stock_remaining: 2,
        },
      ],
    };

    render(<ProductInfo product={lowStockProduct} initialVariationId={167} />);
    expect(screen.getByText("In Stock")).toBeInTheDocument();
    expect(screen.getByText("Only 2 items left – order soon")).toBeInTheDocument();
  });

  it("displays 'Available on backorder' notice and enables purchase buttons when backorder is allowed with stock -1", () => {
    const backorderProduct: WooProduct = {
      ...variableProduct,
      variations: [
        {
          ...variableProduct.variations[0],
          is_in_stock: true,
          is_on_backorder: true,
          backorders_allowed: true,
          stock_quantity: -1,
        },
      ],
    };

    render(<ProductInfo product={backorderProduct} initialVariationId={167} />);
    expect(screen.getByText("Available on backorder")).toBeInTheDocument();
    expect(
      screen.getByText(/This item is currently on backorder/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: new RegExp(t("product.addToCart"), "i"),
      }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Buy Now/i }),
    ).not.toBeDisabled();
  });

  it("inherits backorder from parent product when variation does not manage individual stock", () => {
    const parentBackorderProduct: WooProduct = {
      ...variableProduct,
      is_on_backorder: true,
      backorders_allowed: true,
      stock_quantity: 0,
      variations: [
        {
          ...variableProduct.variations[0],
          is_in_stock: true,
          is_on_backorder: undefined,
          backorders_allowed: undefined,
          stock_quantity: null,
        },
      ],
    };

    render(<ProductInfo product={parentBackorderProduct} initialVariationId={167} />);
    expect(screen.getByText("Available on backorder")).toBeInTheDocument();
    expect(
      screen.getByText(/This item is currently on backorder/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: new RegExp(t("product.addToCart"), "i"),
      }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Buy Now/i }),
    ).not.toBeDisabled();
  });

  it("shows 'In Stock' and low stock notice (not on backorder) when stock is 2 even if backorders are allowed", () => {
    const inStockWithBackordersAllowedProduct: WooProduct = {
      ...variableProduct,
      is_in_stock: true,
      is_on_backorder: false,
      backorders_allowed: true,
      stock_quantity: 2,
      low_stock_remaining: 2,
      variations: [
        {
          ...variableProduct.variations[0],
          is_in_stock: true,
          is_on_backorder: false,
          backorders_allowed: true,
          stock_quantity: 2,
          low_stock_remaining: 2,
        },
      ],
    };

    render(
      <ProductInfo
        product={inStockWithBackordersAllowedProduct}
        initialVariationId={167}
      />
    );
    expect(screen.getByText("In Stock")).toBeInTheDocument();
    expect(
      screen.getByText("Only 2 items left – order soon")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Available on backorder")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/This item is currently on backorder/i)
    ).not.toBeInTheDocument();
  });
});
