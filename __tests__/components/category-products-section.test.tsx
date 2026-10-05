import { render, screen } from "@testing-library/react";
import { CategoryProductsSection } from "@/components/home/category-products-section";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/woocommerce/api", () => ({
  getCategories: jest.fn().mockResolvedValue([
    { id: 19, name: "Home Decor", slug: "home-decor", count: 3 },
    { id: 20, name: "God Idols", slug: "god-idols", count: 3 },
  ]),
  getProducts: jest.fn().mockImplementation(({ category }) => {
    if (category === "home-decor") {
      return Promise.resolve([
        {
          id: 101,
          name: "Shiva Lingam Idol",
          slug: "shiva-lingam-idol",
          short_description: "Meditation & Spiritual Gift",
          prices: { price: "89900", regular_price: "89900", sale_price: "", currency_code: "INR", currency_symbol: "₹", currency_minor_unit: 2, currency_prefix: "₹", currency_suffix: "" },
          images: [{ id: 1, src: "/assets/hero-section/claybrushstudio1.webp", alt: "Shiva Lingam" }],
          categories: [{ id: 19, name: "Home Decor", slug: "home-decor" }],
          is_in_stock: true,
          is_purchasable: true,
          type: "simple",
        },
      ]);
    }
    return Promise.resolve([
      {
        id: 201,
        name: "Venkateswara Perumal",
        slug: "venkateswara-perumal",
        short_description: "Spiritual Tirupati Gift",
        prices: { price: "159900", regular_price: "159900", sale_price: "", currency_code: "INR", currency_symbol: "₹", currency_minor_unit: 2, currency_prefix: "₹", currency_suffix: "" },
        images: [{ id: 2, src: "/assets/hero-section/claybrushstudio4.webp", alt: "Venkateswara Perumal" }],
        categories: [{ id: 20, name: "God Idols", slug: "god-idols" }],
        is_in_stock: true,
        is_purchasable: true,
        type: "simple",
      },
    ]);
  }),
}));

describe("CategoryProductsSection", () => {
  it("renders both category headers with View All buttons and products", async () => {
    const Component = await CategoryProductsSection();
    if (!Component) throw new Error("CategoryProductsSection rendered null");
    render(Component);

    expect(screen.getByRole("heading", { level: 3, name: "Home Decor Products" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "God Idols" })).toBeInTheDocument();

    const viewAllLinks = screen.getAllByRole("link", { name: /View All/i });
    expect(viewAllLinks.length).toBe(2);

    expect(screen.getByText("Shiva Lingam Idol")).toBeInTheDocument();
    expect(screen.getByText("Venkateswara Perumal")).toBeInTheDocument();

    const buyNowBtns = screen.getAllByRole("button", { name: /BUY NOW/i });
    expect(buyNowBtns.length).toBe(2);

    const addToCartBtns = screen.getAllByRole("button", { name: /ADD TO CART/i });
    expect(addToCartBtns.length).toBe(2);
  });
});
