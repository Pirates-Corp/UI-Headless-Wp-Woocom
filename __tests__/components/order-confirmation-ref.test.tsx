import { render, screen } from "@testing-library/react";
import OrderConfirmationPage from "@/app/order-confirmation/page";

// Mock CartClearer
jest.mock("@/components/order-confirmation/cart-clearer", () => ({
  CartClearer: () => <div data-testid="cart-clearer-mounted" />,
}));

// Mock OrderDetails
jest.mock("@/components/order-confirmation/order-details", () => ({
  OrderDetails: () => <div data-testid="order-details-mounted" />,
}));

describe("OrderConfirmationPage ref param behavior", () => {
  it("mounts CartClearer on standard checkout completion (without ref=email)", async () => {
    const page = await OrderConfirmationPage({
      searchParams: Promise.resolve({
        order_id: "123",
        order_key: "wc_order_abc123",
        billing_email: "test@example.com",
      }),
    });

    render(page);

    expect(screen.getByTestId("cart-clearer-mounted")).toBeInTheDocument();
    expect(screen.getByTestId("order-details-mounted")).toBeInTheDocument();
  });

  it("does NOT mount CartClearer when ref=email (clicking link from email preserves cart)", async () => {
    const page = await OrderConfirmationPage({
      searchParams: Promise.resolve({
        order_id: "123",
        order_key: "wc_order_abc123",
        billing_email: "test@example.com",
        ref: "email",
      }),
    });

    render(page);

    expect(screen.queryByTestId("cart-clearer-mounted")).not.toBeInTheDocument();
    expect(screen.getByTestId("order-details-mounted")).toBeInTheDocument();
  });
});
