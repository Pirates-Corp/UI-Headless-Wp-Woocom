import { getProductReviewsFromServer } from "@/lib/woocommerce/api";
import { ProductReviews } from "@/components/product/product-reviews";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductReviewsSectionProps {
  productId: number;
  productName: string;
  averageRating: string;
  reviewCount: number;
}

/**
 * Server component that fetches reviews on its own so the product page can
 * stream: gallery, price and Add to cart render immediately, and this section
 * fills in when the reviews request finishes. Wrap it in <Suspense>.
 */
export async function ProductReviewsSection({
  productId,
  productName,
  averageRating,
  reviewCount,
}: ProductReviewsSectionProps) {
  const reviews = await getProductReviewsFromServer({ productId });

  return (
    <ProductReviews
      productId={productId}
      productName={productName}
      averageRating={averageRating}
      reviewCount={reviewCount}
      reviews={reviews}
    />
  );
}

/** Placeholder shown while reviews stream in — sized to avoid a big layout jump. */
export function ProductReviewsSkeleton() {
  return (
    <section className="mt-16 md:mt-24" aria-busy="true" aria-label="Loading reviews">
      <Skeleton className="h-7 w-48 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Skeleton className="h-40 w-full" />
        <div className="md:col-span-2 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </section>
  );
}
