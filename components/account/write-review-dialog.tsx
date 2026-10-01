"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  submitProductReviewAction,
  updateProductReviewAction,
} from "@/lib/actions/reviews";
import type { WooProductReview } from "@/lib/woocommerce/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/defaultbutton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Star, Loader2, AlertCircle, Sparkles, CheckCircle2, ShoppingBag, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WriteReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: number;
    name: string;
    price?: number | string;
    image?: string;
  } | null;
  existingReview?: {
    reviewId: number;
    rating: number;
    review: string;
  } | null;
  orderNumber: string;
  onSuccess?: (productId: number, review: WooProductReview) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: "Poor - Disappointed",
  2: "Fair - Needs improvement",
  3: "Good - Meets expectations",
  4: "Very Good - Highly recommended",
  5: "Excellent - Truly loved it!",
};

export function WriteReviewDialog({
  open,
  onOpenChange,
  product,
  existingReview,
  orderNumber,
  onSuccess,
}: WriteReviewDialogProps) {
  const { user } = useAuthStore();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>("");
  const [reviewerName, setReviewerName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const isEditMode = Boolean(existingReview?.reviewId);

  // Set default / existing review data when modal opens
  useEffect(() => {
    if (user && open) {
      const defaultName =
        user.displayName && !/^user_[a-z0-9_]+$/i.test(user.displayName)
          ? user.displayName
          : user.firstName
          ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
          : user.username && !/^user_[a-z0-9_]+$/i.test(user.username)
          ? user.username
          : user.email.split("@")[0];

      setReviewerName(defaultName);
      setReviewText(existingReview?.review || "");
      setRating(existingReview?.rating || 5);
      setError(null);
      setIsSubmitted(false);
    }
  }, [user, open, product?.id, existingReview]);

  if (!product) return null;

  const activeRating = hoverRating || rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product.id) {
      setError("Invalid product ID.");
      return;
    }

    if (reviewText.trim().length < 5) {
      setError("Please write at least 5 characters for your review.");
      return;
    }

    if (!reviewerName.trim()) {
      setError("Please provide your name.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditMode && existingReview?.reviewId) {
        const res = await updateProductReviewAction({
          reviewId: existingReview.reviewId,
          productId: product.id,
          rating,
          review: reviewText.trim(),
        });

        if (res.success && res.review) {
          setIsSubmitted(true);
          toast.success("Your product review has been updated successfully.");
          if (onSuccess) {
            onSuccess(product.id, res.review);
          }
          setTimeout(() => {
            onOpenChange(false);
          }, 1000);
        } else {
          setError(res.error || "Failed to update review. Please try again.");
        }
      } else {
        const res = await submitProductReviewAction({
          productId: product.id,
          rating,
          review: reviewText.trim(),
          reviewer: reviewerName.trim(),
          reviewerEmail: user?.email || "customer@example.com",
        });

        if (res.success && res.review) {
          setIsSubmitted(true);
          toast.success("Thank you! Your product review has been submitted.");
          if (onSuccess) {
            onSuccess(product.id, res.review);
          }
          setTimeout(() => {
            onOpenChange(false);
          }, 1000);
        } else {
          setError(res.error || "Failed to submit review. Please try again.");
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider mb-1">
            {isEditMode ? <Edit3 className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{isEditMode ? "Edit Submitted Review" : "Verified Purchase Review"}</span>
          </div>
          <DialogTitle className="text-xl">
            {isEditMode ? "Edit Product Review" : "Review Product"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? `Update your rating and experience for Order #${orderNumber}.`
              : `Share your experience for Order #${orderNumber} to help other buyers.`}
          </DialogDescription>
        </DialogHeader>

        {isSubmitted ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="font-heading text-lg font-bold text-foreground">
              {isEditMode ? "Review Updated!" : "Review Submitted!"}
            </h4>
            <p className="text-xs text-muted-foreground max-w-xs">
              Your feedback for <strong>{product.name}</strong> has been saved successfully.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Product Card Info */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-lg bg-background border border-border/60 overflow-hidden shrink-0 flex items-center justify-center">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-sm text-foreground truncate">
                  {product.name}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Order #{orderNumber}
                </p>
              </div>
            </div>

            {/* Star Rating Picker */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                Overall Rating <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-1.5 py-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = star <= activeRating;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 -m-1 transition-transform hover:scale-115 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                      aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                    >
                      <Star
                        className={cn(
                          "w-7 h-7 transition-colors duration-150 stroke-[1.5]",
                          isFilled
                            ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]"
                            : "text-amber-500/70 dark:text-amber-400/80 fill-amber-500/10 dark:fill-amber-400/10"
                        )}
                      />
                    </button>
                  );
                })}
                <span className="ml-3 text-xs font-medium text-muted-foreground">
                  {RATING_LABELS[activeRating] || `${activeRating} Stars`}
                </span>
              </div>
            </div>

            {/* Reviewer Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="reviewer-name"
                className="block text-xs font-semibold text-foreground uppercase tracking-wider"
              >
                Your Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="reviewer-name"
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="e.g. Jane Doe"
                required
                disabled={isEditMode}
                className="h-10 text-sm"
              />
            </div>

            {/* Review Text */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="review-body"
                  className="block text-xs font-semibold text-foreground uppercase tracking-wider"
                >
                  Your Review <span className="text-destructive">*</span>
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {reviewText.length}/2000
                </span>
              </div>
              <textarea
                id="review-body"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="What did you like or dislike? How does it smell and perform?"
                required
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 outline-none resize-none"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || reviewText.trim().length < 5}
                className="text-xs font-semibold gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{isEditMode ? "Updating..." : "Submitting..."}</span>
                  </>
                ) : isEditMode ? (
                  <>
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                ) : (
                  <>
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>Submit Review</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
