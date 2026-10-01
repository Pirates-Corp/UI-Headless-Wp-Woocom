import React from "react";
import { render, screen } from "@testing-library/react";
import { StarRating } from "@/components/product/star-rating";
import { ProductReviews } from "@/components/product/product-reviews";
import type { WooProductReview } from "@/lib/woocommerce/types";

describe("StarRating Component", () => {
  it("renders rating stars and review count in brackets when reviews exist", () => {
    render(<StarRating rating="4.5" count={12} />);

    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(12)")).toBeInTheDocument();
  });

  it("renders empty rating stars and (0) when 0 reviews exist", () => {
    render(<StarRating rating="0" count={0} />);

    expect(screen.getByText("(0)")).toBeInTheDocument();
  });

  it("links to #reviews section", () => {
    render(<StarRating rating="4.8" count={25} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "#reviews");
  });
});

describe("ProductReviews Component", () => {
  const mockReviews: WooProductReview[] = [
    {
      id: 1,
      date_created: "2026-09-20T10:00:00",
      date_created_gmt: "2026-09-20T10:00:00",
      product_id: 101,
      product_name: "Royal Oud",
      product_permalink: "https://example.com/product/royal-oud",
      status: "approved",
      reviewer: "Michael Scott",
      reviewer_email: "michael@example.com",
      review: "<p>Absolutely love this fragrance! Long lasting and rich aroma.</p>",
      rating: 5,
      verified: true,
    },
    {
      id: 2,
      date_created: "2026-09-22T14:30:00",
      date_created_gmt: "2026-09-22T14:30:00",
      product_id: 101,
      product_name: "Royal Oud",
      product_permalink: "https://example.com/product/royal-oud",
      status: "approved",
      reviewer: "Pam Beesly",
      reviewer_email: "pam@example.com",
      review: "Very pleasant notes. Great for evening wear.",
      rating: 4,
      verified: false,
    },
  ];

  it("renders customer reviews with user name, rating, and review content", () => {
    render(
      <ProductReviews
        productId={101}
        productName="Royal Oud"
        averageRating="4.5"
        reviewCount={2}
        reviews={mockReviews}
      />
    );

    // Section title & summary
    expect(screen.getByText("Customer Reviews")).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();

    // Review 1 details
    expect(screen.getByText("Michael Scott")).toBeInTheDocument();
    expect(screen.getByText("Verified Buyer")).toBeInTheDocument();
    expect(
      screen.getByText("Absolutely love this fragrance! Long lasting and rich aroma.")
    ).toBeInTheDocument();

    // Review 2 details
    expect(screen.getByText("Pam Beesly")).toBeInTheDocument();
    expect(
      screen.getByText("Very pleasant notes. Great for evening wear.")
    ).toBeInTheDocument();
  });

  it("dynamically calculates overall rating from reviews when WooCommerce averageRating is 0", () => {
    const singleReview: WooProductReview[] = [
      {
        id: 10,
        date_created: "2026-09-29T10:00:00",
        date_created_gmt: "2026-09-29T10:00:00",
        product_id: 101,
        product_name: "Gingelly Oil",
        product_permalink: "https://example.com/product/oil",
        status: "approved",
        reviewer: "Siva Prakash",
        reviewer_email: "siva@example.com",
        review: "The product was soo good!",
        rating: 4,
        verified: true,
      },
    ];

    render(
      <ProductReviews
        productId={101}
        productName="Gingelly Oil"
        averageRating="0.00"
        reviewCount={0}
        reviews={singleReview}
      />
    );

    expect(screen.getByText("4.0")).toBeInTheDocument();
    expect(screen.getByText("Based on 1 review from verified buyers")).toBeInTheDocument();
    expect(screen.getByText("Siva Prakash")).toBeInTheDocument();
  });

  it("renders empty state when there are no reviews yet", () => {
    render(
      <ProductReviews
        productId={102}
        productName="Velvet Rose"
        averageRating="0"
        reviewCount={0}
        reviews={[]}
      />
    );

    expect(screen.getByText("No customer reviews yet")).toBeInTheDocument();
    expect(screen.getByText(/Have you purchased/i)).toBeInTheDocument();
  });
});
