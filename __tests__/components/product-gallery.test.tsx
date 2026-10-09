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

  it("switches images when Next and Previous chevrons are clicked", () => {
    const images = [makeImage(1), makeImage(2), makeImage(3)];
    render(<ProductGallery images={images} productName="Test product" />);

    // Initially on first image
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous image" })).not.toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: "Next image" });
    fireEvent.click(nextBtn);

    // Now on second image
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    const prevBtn = screen.getByRole("button", { name: "Previous image" });
    expect(prevBtn).toBeInTheDocument();

    fireEvent.click(prevBtn);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("swipes to next image on touch swipe left and back on touch swipe right", () => {
    const images = [makeImage(1), makeImage(2), makeImage(3)];
    const { container } = render(
      <ProductGallery images={images} productName="Test product" />
    );

    const galleryContainer = container.querySelector(".touch-pan-y") as HTMLElement;
    expect(galleryContainer).toBeInTheDocument();

    // Swipe left (finger moves from clientX: 200 to clientX: 120 -> deltaX: -80)
    fireEvent.touchStart(galleryContainer, {
      touches: [{ clientX: 200, clientY: 100 }],
    });
    fireEvent.touchMove(galleryContainer, {
      touches: [{ clientX: 120, clientY: 100 }],
    });
    fireEvent.touchEnd(galleryContainer);

    // Advanced to image 2
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    // Swipe right (finger moves from clientX: 100 to clientX: 190 -> deltaX: +90)
    fireEvent.touchStart(galleryContainer, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchMove(galleryContainer, {
      touches: [{ clientX: 190, clientY: 100 }],
    });
    fireEvent.touchEnd(galleryContainer);

    // Back to image 1
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });
});