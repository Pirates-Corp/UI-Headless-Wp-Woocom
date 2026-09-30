/**
 * Unit tests for Product Review actions and WooCommerce Reviews API integration.
 */

jest.mock("@/lib/auth/session", () => ({
  getSessionUser: jest.fn(),
}));

jest.mock("@/lib/woocommerce/api", () => ({
  createProductReviewOnServer: jest.fn(),
  updateProductReviewOnServer: jest.fn(),
  getProductReviewsFromServer: jest.fn(),
}));

import { getSessionUser as mockGetSessionUser } from "@/lib/auth/session";
import {
  createProductReviewOnServer as mockCreateProductReviewOnServer,
  updateProductReviewOnServer as mockUpdateProductReviewOnServer,
  getProductReviewsFromServer as mockGetProductReviewsFromServer,
} from "@/lib/woocommerce/api";
import {
  submitProductReviewAction,
  updateProductReviewAction,
  getCustomerReviewedProductsAction,
} from "@/lib/actions/reviews";

describe("Product Reviews Server Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("submitProductReviewAction", () => {
    it("returns error if user is not authenticated", async () => {
      (mockGetSessionUser as jest.Mock).mockResolvedValue(null);

      const result = await submitProductReviewAction({
        productId: 101,
        rating: 5,
        review: "Amazing product!",
        reviewer: "Alice",
        reviewerEmail: "alice@example.com",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("logged in");
      expect(mockCreateProductReviewOnServer).not.toHaveBeenCalled();
    });

    it("returns validation error if review is too short", async () => {
      (mockGetSessionUser as jest.Mock).mockResolvedValue({
        id: "1",
        email: "alice@example.com",
        displayName: "Alice",
      });

      const result = await submitProductReviewAction({
        productId: 101,
        rating: 5,
        review: "Hi",
        reviewer: "Alice",
        reviewerEmail: "alice@example.com",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("at least 5 characters");
      expect(mockCreateProductReviewOnServer).not.toHaveBeenCalled();
    });

    it("submits valid review successfully using session user info", async () => {
      (mockGetSessionUser as jest.Mock).mockResolvedValue({
        id: "1",
        email: "alice@example.com",
        displayName: "Alice Smith",
      });

      const mockReviewResponse = {
        id: 999,
        date_created: "2026-09-29T10:00:00",
        date_created_gmt: "2026-09-29T10:00:00",
        product_id: 101,
        product_name: "Velvet Rose Perfume",
        product_permalink: "https://trjshop.com/product/velvet-rose",
        status: "approved",
        reviewer: "Alice Smith",
        reviewer_email: "alice@example.com",
        review: "This perfume lasts all day and smells incredible!",
        rating: 5,
        verified: true,
      };

      (mockCreateProductReviewOnServer as jest.Mock).mockResolvedValue(mockReviewResponse);

      const result = await submitProductReviewAction({
        productId: 101,
        rating: 5,
        review: "This perfume lasts all day and smells incredible!",
        reviewer: "Alice Smith",
        reviewerEmail: "alice@example.com",
      });

      expect(result.success).toBe(true);
      expect(result.review).toEqual(mockReviewResponse);
      expect(mockCreateProductReviewOnServer).toHaveBeenCalledWith({
        product_id: 101,
        rating: 5,
        review: "This perfume lasts all day and smells incredible!",
        reviewer: "Alice Smith",
        reviewer_email: "alice@example.com",
        verified: true,
        status: "approved",
      });
    });

    it("handles errors thrown by createProductReviewOnServer gracefully", async () => {
      (mockGetSessionUser as jest.Mock).mockResolvedValue({
        id: "1",
        email: "alice@example.com",
        displayName: "Alice Smith",
      });

      (mockCreateProductReviewOnServer as jest.Mock).mockRejectedValue(
        new Error("Duplicate review detected")
      );

      const result = await submitProductReviewAction({
        productId: 101,
        rating: 4,
        review: "Another great perfume from this brand.",
        reviewer: "Alice Smith",
        reviewerEmail: "alice@example.com",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Duplicate review detected");
    });
  });

  describe("updateProductReviewAction", () => {
    it("returns error if user is not authenticated", async () => {
      (mockGetSessionUser as jest.Mock).mockResolvedValue(null);

      const result = await updateProductReviewAction({
        reviewId: 999,
        productId: 101,
        rating: 4,
        review: "Updated review text.",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("logged in");
      expect(mockUpdateProductReviewOnServer).not.toHaveBeenCalled();
    });

    it("updates existing review successfully", async () => {
      (mockGetSessionUser as jest.Mock).mockResolvedValue({
        id: "1",
        email: "alice@example.com",
      });

      const updatedResponse = {
        id: 999,
        product_id: 101,
        rating: 4,
        review: "Updated review: very high quality aroma!",
        status: "approved",
      };

      (mockUpdateProductReviewOnServer as jest.Mock).mockResolvedValue(updatedResponse);

      const result = await updateProductReviewAction({
        reviewId: 999,
        productId: 101,
        rating: 4,
        review: "Updated review: very high quality aroma!",
      });

      expect(result.success).toBe(true);
      expect(result.review).toEqual(updatedResponse);
      expect(mockUpdateProductReviewOnServer).toHaveBeenCalledWith(999, {
        review: "Updated review: very high quality aroma!",
        rating: 4,
      });
    });
  });

  describe("getCustomerReviewedProductsAction", () => {
    it("returns empty list if user is not authenticated", async () => {
      (mockGetSessionUser as jest.Mock).mockResolvedValue(null);

      const result = await getCustomerReviewedProductsAction();

      expect(result.success).toBe(true);
      expect(result.reviewedProducts).toEqual([]);
      expect(mockGetProductReviewsFromServer).not.toHaveBeenCalled();
    });

    it("fetches reviewed products for authenticated customer", async () => {
      (mockGetSessionUser as jest.Mock).mockResolvedValue({
        id: "1",
        email: "alice@example.com",
      });

      (mockGetProductReviewsFromServer as jest.Mock).mockResolvedValue([
        {
          id: 50,
          product_id: 101,
          rating: 5,
          date_created: "2026-09-25",
          review: "<p>Wonderful!</p>",
        },
        {
          id: 51,
          product_id: 102,
          rating: 4,
          date_created: "2026-09-26",
          review: "Great scent",
        },
      ]);

      const result = await getCustomerReviewedProductsAction();

      expect(result.success).toBe(true);
      expect(result.reviewedProducts).toHaveLength(2);
      expect(result.reviewedProducts[0].productId).toBe(101);
      expect(result.reviewedProducts[0].rating).toBe(5);
      expect(result.reviewedProducts[0].review).toBe("Wonderful!");
      expect(result.reviewedProducts[1].productId).toBe(102);
    });
  });
});
