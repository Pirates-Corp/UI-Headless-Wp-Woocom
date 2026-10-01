"use server";

import { getSessionUser } from "@/lib/auth/session";
import {
  CreateProductReviewSchema,
  UpdateProductReviewSchema,
} from "@/lib/validation/schemas";
import {
  createProductReviewOnServer,
  updateProductReviewOnServer,
  getProductReviewsFromServer,
} from "@/lib/woocommerce/api";
import type { WooProductReview } from "@/lib/woocommerce/types";

export interface ReviewActionResult {
  success: boolean;
  review?: WooProductReview;
  error?: string;
}

export interface ReviewedProductSummary {
  productId: number;
  reviewId: number;
  rating: number;
  dateCreated: string;
  review: string;
}

/**
 * Submit a product review for a purchased product.
 * Requires user to be authenticated.
 */
export async function submitProductReviewAction(
  data: unknown
): Promise<ReviewActionResult> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return {
        success: false,
        error: "You must be logged in to submit a review.",
      };
    }

    const parsed = CreateProductReviewSchema.safeParse(data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message || "Invalid review data.";
      return { success: false, error: issue };
    }

    const { productId, rating, review, reviewer, reviewerEmail } = parsed.data;

    // Use session user email for security/consistency if email mismatch
    const emailToUse = user.email || reviewerEmail;
    const nameToUse =
      reviewer ||
      user.displayName ||
      user.firstName ||
      (user.username && !/^user_[a-z0-9_]+$/i.test(user.username) ? user.username : "Customer");

    const createdReview = await createProductReviewOnServer({
      product_id: productId,
      review,
      reviewer: nameToUse,
      reviewer_email: emailToUse,
      rating,
      verified: true,
      status: "approved",
    });

    return {
      success: true,
      review: createdReview,
    };
  } catch (err: unknown) {
    console.error("[submitProductReviewAction] Error:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while submitting your review.",
    };
  }
}

/**
 * Fetch all product IDs that the authenticated user has already reviewed.
 */
export async function getCustomerReviewedProductsAction(): Promise<{
  success: boolean;
  reviewedProducts: ReviewedProductSummary[];
  error?: string;
}> {
  try {
    const user = await getSessionUser();
    if (!user || !user.email) {
      return { success: true, reviewedProducts: [] };
    }

    const reviews = await getProductReviewsFromServer({
      reviewerEmail: user.email,
      perPage: 100,
    });

    const reviewedProducts: ReviewedProductSummary[] = reviews.map((r) => ({
      productId: r.product_id,
      reviewId: r.id,
      rating: r.rating,
      dateCreated: r.date_created || r.date_created_gmt || "",
      review: r.review ? r.review.replace(/<[^>]*>?/gm, "").trim() : "",
    }));

    return {
      success: true,
      reviewedProducts,
    };
  } catch (err: unknown) {
    console.warn("[getCustomerReviewedProductsAction] Error:", err);
    return {
      success: false,
      reviewedProducts: [],
      error:
        err instanceof Error
          ? err.message
          : "Failed to fetch reviewed products.",
    };
  }
}

/**
 * Fetch reviews for a specific product by product ID.
 */
export async function getProductReviewsAction(productId: number): Promise<{
  success: boolean;
  reviews: WooProductReview[];
  error?: string;
}> {
  try {
    const reviews = await getProductReviewsFromServer({
      productId,
      perPage: 100,
    });

    return {
      success: true,
      reviews,
    };
  } catch (err: unknown) {
    console.warn("[getProductReviewsAction] Error:", err);
    return {
      success: false,
      reviews: [],
      error:
        err instanceof Error ? err.message : "Failed to fetch product reviews.",
    };
  }
}

/**
 * Update an existing product review.
 * Requires user to be authenticated.
 */
export async function updateProductReviewAction(
  data: unknown
): Promise<ReviewActionResult> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return {
        success: false,
        error: "You must be logged in to update a review.",
      };
    }

    const parsed = UpdateProductReviewSchema.safeParse(data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message || "Invalid review data.";
      return { success: false, error: issue };
    }

    const { reviewId, rating, review } = parsed.data;

    const updatedReview = await updateProductReviewOnServer(reviewId, {
      review,
      rating,
    });

    return {
      success: true,
      review: updatedReview,
    };
  } catch (err: unknown) {
    console.error("[updateProductReviewAction] Error:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while updating your review.",
    };
  }
}


