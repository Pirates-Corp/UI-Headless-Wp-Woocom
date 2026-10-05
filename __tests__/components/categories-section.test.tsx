import { render, screen } from "@testing-library/react";
import { CategoriesSection } from "@/components/home/categories-section";

jest.mock("@/lib/woocommerce/api", () => ({
  getCategories: jest.fn().mockResolvedValue([
    {
      id: 19,
      name: "Home Decor",
      slug: "home-decor",
      count: 3,
      image: { src: "https://store.claybrushstudio.com/wp-content/uploads/2026/10/Home-Decor.webp", alt: "Home Decor" },
    },
    {
      id: 20,
      name: "God Idols",
      slug: "god-idols",
      count: 3,
      image: { src: "https://store.claybrushstudio.com/wp-content/uploads/2026/10/God-idol.webp", alt: "God Idols" },
    },
    { id: 1, name: "Uncategorized", slug: "uncategorized", count: 0, image: null },
  ]),
}));

describe("CategoriesSection", () => {
  it("renders the Shop by Category heading and active categories with WooCommerce images", async () => {
    const Component = await CategoriesSection();
    if (!Component) throw new Error("CategoriesSection rendered null");
    render(Component);

    expect(screen.getByRole("heading", { level: 2, name: "Shop by Category" })).toBeInTheDocument();
    expect(screen.getByText("Home Decor")).toBeInTheDocument();
    expect(screen.getByText("God Idols")).toBeInTheDocument();
    expect(screen.queryByText("Uncategorized")).not.toBeInTheDocument();

    const homeDecorImg = screen.getByAltText("Home Decor");
    expect(homeDecorImg).toBeInTheDocument();
  });
});
