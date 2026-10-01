"use client";

import { useMemo } from "react";
import type { WooProductReview } from "@/lib/woocommerce/types";
import { StarRating } from "@/components/product/star-rating";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Star,
  CheckCircle2,
  MessageSquare,
  ShieldCheck,
  User,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/format";

interface ProductReviewsProps {
  productId: number;
  productName: string;
  averageRating: string;
  reviewCount: number;
  reviews: WooProductReview[];
}

export function ProductReviews({
  productId: _productId,
  productName,
  averageRating,
  reviewCount,
  reviews,
}: ProductReviewsProps) {
  const effectiveAvg = useMemo(() => {
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
      return sum / reviews.length;
    }
    const parsed = parseFloat(averageRating || "0");
    return isNaN(parsed) ? 0 : parsed;
  }, [reviews, averageRating]);

  const displayCount = reviews.length > 0 ? reviews.length : reviewCount;

  // Compute breakdown of 1-5 star ratings
  const breakdown = useMemo(() => {
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating)));
      counts[star] = (counts[star] || 0) + 1;
    });

    const total = reviews.length || 1;
    return [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: counts[star] || 0,
      percentage: Math.round(((counts[star] || 0) / total) * 100),
    }));
  }, [reviews]);

  return (
    <section id="reviews" className="mt-16 md:mt-24 scroll-mt-20">
      {/* Section Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-xs tracking-[0.25em] uppercase text-[var(--gold)] font-medium mb-1">
            Ratings & Feedback
          </p>
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground flex items-center gap-3">
            <span>Customer Reviews</span>
            <span className="text-sm font-semibold text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-full border border-border/50">
              ({displayCount})
            </span>
          </h2>
        </div>
      </div>

      <Separator className="mb-8 border-border/50" />

      {/* Reviews Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 mb-10">
        {/* Left Score Card */}
        <div className="md:col-span-4 rounded-2xl border border-border/70 bg-card p-6 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              Overall Rating
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-heading font-extrabold text-foreground">
                {effectiveAvg > 0 ? effectiveAvg.toFixed(1) : "0.0"}
              </span>
              <span className="text-sm text-muted-foreground font-medium">/ 5.0</span>
            </div>

            <div className="mt-2.5 mb-2">
              <StarRating
                rating={effectiveAvg > 0 ? effectiveAvg.toFixed(1) : "0"}
                count={displayCount}
                showCount={false}
                size="md"
                interactiveLink={false}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Based on {displayCount} {displayCount === 1 ? "review" : "reviews"} from verified buyers
            </p>
          </div>

          <div className="pt-3 border-t border-border/50 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>100% Authentic Customer Reviews</span>
          </div>
        </div>

        {/* Right Star Breakdown Card */}
        <div className="md:col-span-8 rounded-2xl border border-border/70 bg-card p-6 flex flex-col justify-center space-y-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
            Rating Breakdown
          </span>
          <div className="space-y-2.5">
            {breakdown.map(({ star, count, percentage }) => (
              <div key={star} className="flex items-center gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-1 w-12 shrink-0 font-medium text-muted-foreground">
                  <span>{star}</span>
                  <Star className="w-3.5 h-3.5 fill-[var(--gold)] text-[var(--gold)]" />
                </div>

                {/* Progress bar */}
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-[var(--gold)] rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <div className="w-10 text-right text-xs text-muted-foreground font-medium shrink-0">
                  {count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Review List */}
      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card/60 p-10 sm:p-14 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1">
            <MessageSquare className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="font-heading text-lg font-bold text-foreground">
            No customer reviews yet
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
            Have you purchased <strong>{productName}</strong>? You can share your review and experience from your My Orders page after delivery.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const reviewerName = review.reviewer || "Customer";
            const initials = reviewerName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            const dateStr = formatDate(review.date_created) || "Recent";

            // Clean review content from raw HTML tags
            const cleanContent = review.review
              ? review.review.replace(/<[^>]*>?/gm, "").trim()
              : "";

            return (
              <div
                key={review.id}
                className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm hover:border-primary/30 transition-all duration-200 space-y-3.5"
              >
                {/* Review Header: User Name, Badge, Date */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20 shrink-0">
                      {initials || <User className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm sm:text-base text-foreground">
                          {reviewerName}
                        </span>
                        {review.verified && (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px] py-0.5 px-2"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Verified Buyer
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Calendar className="w-3 h-3" />
                        <span>{dateStr}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rating Stars for this review */}
                  <div className="flex items-center gap-0.5 self-start sm:self-auto">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={cn(
                          "w-4 h-4",
                          star <= Math.round(review.rating)
                            ? "fill-[var(--gold)] text-[var(--gold)] drop-shadow-[0_0_4px_rgba(212,175,55,0.3)]"
                            : "text-muted-foreground/30 fill-transparent"
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Review Body */}
                {cleanContent && (
                  <p className="text-sm text-foreground/90 leading-relaxed pt-1">
                    {cleanContent}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
