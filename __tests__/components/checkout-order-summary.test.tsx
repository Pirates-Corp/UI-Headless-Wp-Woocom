import React from "react";
import { render, screen } from "@testing-library/react";
import { CheckoutOrderSummary } from "@/components/checkout/checkout-order-summary";
import { makeCartItem } from "../fixtures";
import type { WooCart } from "@/lib/woocommerce/types";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const cart: WooCart = {
  items: [makeCartItem()],
  coupons: [],
  totals: {
    total_items: "5998",
    total_items_tax: "0",
    total_shipping: "0",
    total_shipping_tax: "0",
    total_discount: "0",
    total_discount_tax: "0",
    total_tax: "0",
    total_price: "5998",
    currency_code: "USD",
    currency_symbol: "$",
    currency_minor_unit: 2,
    currency_prefix: "$",
    currency_suffix: "",
  },
  items_count: 1,
  items_weight: 0,
  needs_payment: true,
  needs_shipping: true,
  shipping_rates: [],
  payment_methods: ["cod"],
};

describe("CheckoutOrderSummary", () => {
  it("omits policy and marketing rows while keeping Place Order", () => {
    render(
      <CheckoutOrderSummary
        cart={cart}
        isPending={false}
        isUpdatingAddress={false}
        isSelectingShipping={false}
        isStripeMethod={false}
        isRazorpayMethod={false}
      />
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Terms & Conditions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Privacy Policy" })).not.toBeInTheDocument();
    expect(screen.queryByText("Send me order updates & offers - (no spam)")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Place Order" })).toBeInTheDocument();
  });
});