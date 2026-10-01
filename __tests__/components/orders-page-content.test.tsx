import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrdersPageContent } from "@/components/account/orders-page-content";
import { getCustomerOrdersAction } from "@/lib/actions/account";
import {
  getCustomerReviewedProductsAction,
  submitProductReviewAction,
  updateProductReviewAction,
} from "@/lib/actions/reviews";
import { useAuthStore } from "@/lib/store/auth-store";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock("@/lib/store/auth-store", () => ({
  useAuthStore: jest.fn(),
}));

jest.mock("@/lib/actions/account", () => ({
  getCustomerOrdersAction: jest.fn(),
}));

jest.mock("@/lib/actions/reviews", () => ({
  getCustomerReviewedProductsAction: jest.fn(),
  submitProductReviewAction: jest.fn(),
  updateProductReviewAction: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("OrdersPageContent Review Feature", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      isInitialized: true,
      user: {
        id: "1",
        email: "alice@example.com",
        displayName: "Alice Smith",
        firstName: "Alice",
      },
    });
  });

  it("displays 'Write Review' button for items in completed orders", async () => {
    (getCustomerOrdersAction as jest.Mock).mockResolvedValue({
      success: true,
      orders: [
        {
          id: 201,
          number: "201",
          status: "completed",
          dateCreated: "2026-09-20",
          total: "1999",
          currency: "INR",
          currencySymbol: "₹",
          currencyPrefix: "₹",
          currencySuffix: "",
          currencyMinorUnit: 2,
          itemCount: 1,
          paymentMethodTitle: "Razorpay",
          lineItems: [
            {
              id: 10,
              productId: 501,
              name: "Royal Oud Eau De Parfum",
              quantity: 1,
              total: "1999",
              price: 1999,
            },
          ],
        },
      ],
    });

    (getCustomerReviewedProductsAction as jest.Mock).mockResolvedValue({
      success: true,
      reviewedProducts: [],
    });

    render(<OrdersPageContent />);

    await waitFor(() => {
      expect(screen.getByText("Order #201")).toBeInTheDocument();
      expect(screen.getByText("Royal Oud Eau De Parfum")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /write review/i })).toBeInTheDocument();
    });
  });

  it("does not display 'Write Review' button for items in processing or pending orders", async () => {
    (getCustomerOrdersAction as jest.Mock).mockResolvedValue({
      success: true,
      orders: [
        {
          id: 202,
          number: "202",
          status: "processing",
          dateCreated: "2026-09-21",
          total: "1499",
          currency: "INR",
          currencySymbol: "₹",
          currencyPrefix: "₹",
          currencySuffix: "",
          currencyMinorUnit: 2,
          itemCount: 1,
          paymentMethodTitle: "Online",
          lineItems: [
            {
              id: 11,
              productId: 502,
              name: "Amber Musk Perfume",
              quantity: 1,
              total: "1499",
              price: 1499,
            },
          ],
        },
      ],
    });

    (getCustomerReviewedProductsAction as jest.Mock).mockResolvedValue({
      success: true,
      reviewedProducts: [],
    });

    render(<OrdersPageContent />);

    await waitFor(() => {
      expect(screen.getByText("Order #202")).toBeInTheDocument();
      expect(screen.getByText("Amber Musk Perfume")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /write review/i })).not.toBeInTheDocument();
  });

  it("displays rating star and 'Edit Review' button if product has already been reviewed", async () => {
    (getCustomerOrdersAction as jest.Mock).mockResolvedValue({
      success: true,
      orders: [
        {
          id: 203,
          number: "203",
          status: "completed",
          dateCreated: "2026-09-22",
          total: "2499",
          currency: "INR",
          currencySymbol: "₹",
          currencyPrefix: "₹",
          currencySuffix: "",
          currencyMinorUnit: 2,
          itemCount: 1,
          paymentMethodTitle: "Razorpay",
          lineItems: [
            {
              id: 12,
              productId: 503,
              name: "Sandalwood Noir",
              quantity: 1,
              total: "2499",
              price: 2499,
            },
          ],
        },
      ],
    });

    (getCustomerReviewedProductsAction as jest.Mock).mockResolvedValue({
      success: true,
      reviewedProducts: [
        {
          productId: 503,
          reviewId: 88,
          rating: 5,
          dateCreated: "2026-09-23",
          review: "Superb longevity",
        },
      ],
    });

    render(<OrdersPageContent />);

    await waitFor(() => {
      expect(screen.getByText("5 ★")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /edit review/i })).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /write review/i })).not.toBeInTheDocument();
  });

  it("opens WriteReviewDialog when 'Write Review' is clicked and submits review", async () => {
    (getCustomerOrdersAction as jest.Mock).mockResolvedValue({
      success: true,
      orders: [
        {
          id: 204,
          number: "204",
          status: "completed",
          dateCreated: "2026-09-24",
          total: "1999",
          currency: "INR",
          currencySymbol: "₹",
          currencyPrefix: "₹",
          currencySuffix: "",
          currencyMinorUnit: 2,
          itemCount: 1,
          paymentMethodTitle: "Razorpay",
          lineItems: [
            {
              id: 14,
              productId: 504,
              name: "Velvet Night EDP",
              quantity: 1,
              total: "1999",
              price: 1999,
            },
          ],
        },
      ],
    });

    (getCustomerReviewedProductsAction as jest.Mock).mockResolvedValue({
      success: true,
      reviewedProducts: [],
    });

    (submitProductReviewAction as jest.Mock).mockResolvedValue({
      success: true,
      review: {
        id: 777,
        product_id: 504,
        rating: 5,
        review: "Absolutely enchanting aroma!",
      },
    });

    render(<OrdersPageContent />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /write review/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /write review/i }));

    await waitFor(() => {
      expect(screen.getByText("Review Product")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/what did you like or dislike/i);
    fireEvent.change(textarea, { target: { value: "Absolutely enchanting aroma!" } });

    const submitBtn = screen.getByRole("button", { name: /submit review/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitProductReviewAction).toHaveBeenCalledWith({
        productId: 504,
        rating: 5,
        review: "Absolutely enchanting aroma!",
        reviewer: "Alice Smith",
        reviewerEmail: "alice@example.com",
      });
    });
  });

  it("opens WriteReviewDialog in edit mode when 'Edit Review' is clicked and updates review", async () => {
    (getCustomerOrdersAction as jest.Mock).mockResolvedValue({
      success: true,
      orders: [
        {
          id: 205,
          number: "205",
          status: "completed",
          dateCreated: "2026-09-25",
          total: "2999",
          currency: "INR",
          currencySymbol: "₹",
          currencyPrefix: "₹",
          currencySuffix: "",
          currencyMinorUnit: 2,
          itemCount: 1,
          paymentMethodTitle: "Razorpay",
          lineItems: [
            {
              id: 15,
              productId: 505,
              name: "Imperial Rose EDP",
              quantity: 1,
              total: "2999",
              price: 2999,
            },
          ],
        },
      ],
    });

    (getCustomerReviewedProductsAction as jest.Mock).mockResolvedValue({
      success: true,
      reviewedProducts: [
        {
          productId: 505,
          reviewId: 99,
          rating: 4,
          dateCreated: "2026-09-26",
          review: "Initial good review",
        },
      ],
    });

    (updateProductReviewAction as jest.Mock).mockResolvedValue({
      success: true,
      review: {
        id: 99,
        product_id: 505,
        rating: 5,
        review: "Updated to 5 stars! Even better after a week.",
      },
    });

    render(<OrdersPageContent />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /edit review/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /edit review/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /edit product review/i })
      ).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/what did you like or dislike/i);
    expect(textarea).toHaveValue("Initial good review");

    fireEvent.change(textarea, {
      target: { value: "Updated to 5 stars! Even better after a week." },
    });

    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateProductReviewAction).toHaveBeenCalledWith({
        reviewId: 99,
        productId: 505,
        rating: 4,
        review: "Updated to 5 stars! Even better after a week.",
      });
    });
  });
});
