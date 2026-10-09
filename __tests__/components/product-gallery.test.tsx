import { render, screen, fireEvent } from "@testing-library/react";
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

  it("switches main image when a thumbnail is clicked and keeps the clicked image selected", () => {
    const images = [makeImage(1), makeImage(2), makeImage(3)];
    const { rerender } = render(
      <ProductGallery images={images} productName="Test product" />
    );

    const thumbnail2 = screen.getByRole("button", { name: "View image 2 of 3" });
    expect(thumbnail2).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(thumbnail2);

    expect(thumbnail2).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "View image 1 of 3" })).toHaveAttribute("aria-pressed", "false");

    // Re-render with same props (e.g. parent component re-renders)
    rerender(<ProductGallery images={images} productName="Test product" />);
    expect(thumbnail2).toHaveAttribute("aria-pressed", "true");
  });

  it("switches to activeImage when activeImage changes", () => {
    const images = [makeImage(1), makeImage(2), makeImage(3)];
    const { rerender } = render(
      <ProductGallery images={images} productName="Test product" activeImage={images[0]} />
    );

    const thumbnail1 = screen.getByRole("button", { name: "View image 1 of 3" });
    const thumbnail3 = screen.getByRole("button", { name: "View image 3 of 3" });
    expect(thumbnail1).toHaveAttribute("aria-pressed", "true");

    // Parent changes activeImage to images[2]
    rerender(
      <ProductGallery images={images} productName="Test product" activeImage={images[2]} />
    );
    expect(thumbnail3).toHaveAttribute("aria-pressed", "true");
    expect(thumbnail1).toHaveAttribute("aria-pressed", "false");
  });

  it("renders click to see full view button", () => {
    const images = [makeImage(1)];
    render(<ProductGallery images={images} productName="Test product" />);
    expect(screen.getByText("Click to see full view")).toBeInTheDocument();
  });
});