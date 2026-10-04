import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

interface StarRatingProps {
  rating: string | number;
  count?: number;
  showCount?: boolean;
  size?: "sm" | "md" | "lg";
  interactiveLink?: boolean;
  className?: string;
}

export function StarRating({
  rating,
  count = 0,
  showCount = true,
  size = "md",
  interactiveLink = true,
  className,
}: StarRatingProps) {
  const numRating = typeof rating === "string" ? parseFloat(rating || "0") : rating;
  const safeRating = isNaN(numRating) ? 0 : numRating;
  const safeCount = typeof count === "number" && !isNaN(count) ? count : 0;

  const starSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base font-semibold",
  };

  const content = (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/80 hover:border-[var(--gold)]/60 hover:bg-muted/60 transition-all duration-150 group/rating cursor-pointer",
        className
      )}
    >
      {/* 5 Stars with visible borders on dark & light themes */}
      <div className="flex items-center gap-1" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= Math.round(safeRating);
          return (
            <Star
              key={star}
              className={cn(
                starSizes[size],
                "transition-all duration-150 stroke-[1.5]",
                isFilled
                  ? "fill-[var(--gold)] text-[var(--gold)] drop-shadow-[0_0_5px_rgba(212,175,55,0.4)]"
                  : "text-amber-500/70 dark:text-amber-400/80 fill-amber-500/10 dark:fill-amber-400/10 stroke-current"
              )}
            />
          );
        })}
      </div>

      {/* Numerical rating & Count in brackets */}
      {showCount && (
        <span
          className={cn(
            textSizes[size],
            "text-muted-foreground group-hover/rating:text-foreground transition-colors font-medium flex items-center gap-1.5"
          )}
          aria-label={`Rated ${safeRating.toFixed(1)} out of 5 stars, ${safeCount} ${safeCount === 1 ? "review" : "reviews"}`}
        >
          {safeRating > 0 && (
            <span className="font-semibold text-foreground">
              {safeRating.toFixed(1)}
            </span>
          )}
          <span className="text-muted-foreground group-hover/rating:text-foreground">
            ({safeCount})
          </span>
        </span>
      )}
    </div>
  );

  if (interactiveLink) {
    return (
      <a
        href="#reviews"
        className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg transition-opacity hover:opacity-95"
      >
        {content}
      </a>
    );
  }

  return content;
}
