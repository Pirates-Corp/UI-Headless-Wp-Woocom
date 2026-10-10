import { render, screen } from "@testing-library/react";
import { CategoryProductCard } from "@/components/home/category-product-card";
import type { WooProduct } from "@/lib/woocommerce/types";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const baseProduct = {
  id: 101,
  name: "Shiva Lingam Idol",
  slug: "shiva-lingam-idol",
  short_description: "Meditation & Spiritual Gift",
  prices: {
    price: "89900",
    regular_price: "89900",
    sale_price: "",
    currency_code: "INR",
    currency_symbol: "₹",
    currency_minor_unit: 2,
    currency_prefix: "₹",
    currency_suffix: "",
  },
  images: [{ id: 1, src: "/assets/hero-section/claybrushstudio1.webp", alt: "Shiva Lingam" }],
  categories: [{ id: 19, name: "Home Decor", slug: "home-decor" }],
  is_in_stock: true,
  is_purchasable: true,
  type: "simple",
} as unknown as WooProduct;

describe("CategoryProductCard hover image", () => {
  it("renders the second product image as a hidden hover layer", () => {
    const product = {
      ...baseProduct,
      images: [
        ...baseProduct.images,
        { id: 2, src: "/assets/hero-section/claybrushstudio4.webp", alt: "Shiva Lingam side" },
      ],
    } as unknown as WooProduct;

    const { container } = render(<CategoryProductCard product={product} />);

    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(2);
    expect(imgs[0].className).toContain("group-hover:opacity-0");
    expect(imgs[1].className).toContain("opacity-0");
    expect(imgs[1].className).toContain("group-hover:opacity-100");
    expect(imgs[1]).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("card-glaze")).toBeInTheDocument();
  });

  it("keeps the primary image visible on hover when there is only one image", () => {
    const { container } = render(<CategoryProductCard product={baseProduct} />);

    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0].className).not.toContain("group-hover:opacity-0");
    expect(screen.getByTestId("card-glaze")).toBeInTheDocument();
  });
});
