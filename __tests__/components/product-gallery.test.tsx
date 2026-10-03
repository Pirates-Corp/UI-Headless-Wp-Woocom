import { render, screen } from "@testing-library/react";
import { ProductGallery } from "@/components/product-gallery";
import type { WooImage } from "@/lib/woocommerce/types";

function makeImage(id: number, src = `https://example.com/image-${id}.jpg`): WooImage {
  return {
    id,
    src,
    thumbnail: src,
    srcset: "",
    sizes: "",
    name: `image-${id}`,
    alt: `Image ${id}`,
  };
}

describe("ProductGallery", () => {
  it("renders duplicate Woo image records only once", () => {
    render(
      <ProductGallery
        images={[makeImage(42), makeImage(42), makeImage(90)]}
        productName="Test product"
      />,
    );

    expect(
      screen.getByRole("button", { name: "View image 1 of 2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View image 2 of 2" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "View image 3 of 3" }),
    ).not.toBeInTheDocument();
  });
});