import React from "react";
import { render, screen } from "@testing-library/react";
import { ShopHeader } from "@/components/shop/shop-header";
import { ShopSortBar } from "@/components/shop/shop-sort-bar";
import type { WooCategory } from "@/lib/woocommerce/types";

describe("ShopHeader", () => {
  it("renders default title when no category or sale is active", () => {
    render(<ShopHeader onSale={false} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("All Fragrances");
  });

  it("renders On Sale title when onSale is true", () => {
    render(<ShopHeader onSale={true} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("On Sale");
  });

  it("renders category name and description when category is provided", () => {
    const category: WooCategory = {
      id: 17,
      name: "Herbals",
      slug: "herbals",
      description: "Natural herbal formulations",
      parent: 0,
      count: 2,
      image: null,
    };
    render(<ShopHeader onSale={false} category={category} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Herbals");
    expect(screen.getByText("Natural herbal formulations")).toBeInTheDocument();
  });
});

describe("ShopSortBar", () => {
  const mockCategories: WooCategory[] = [
    {
      id: 17,
      name: "Herbals",
      slug: "herbals",
      description: "",
      parent: 0,
      count: 2,
      image: null,
    },
    {
      id: 18,
      name: "Naturals",
      slug: "naturals",
      description: "",
      parent: 0,
      count: 3,
      image: null,
    },
  ];

  it("renders category pills and highlights active category", () => {
    render(
      <ShopSortBar
        searchParams={{ category: "herbals" }}
        activeOrderby="date"
        activeOrder="desc"
        onSale={false}
        categories={mockCategories}
        activeCategory="herbals"
      />
    );

    expect(screen.getAllByText("Herbals").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Naturals")).toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument();

    // Active filter chip is rendered
    expect(screen.getByTitle("Remove category filter")).toBeInTheDocument();
  });

  it("renders Show Sale Only button on right side", () => {
    render(
      <ShopSortBar
        searchParams={{}}
        activeOrderby="date"
        activeOrder="desc"
        onSale={false}
        categories={mockCategories}
      />
    );

    expect(screen.getByText("Show Sale Only")).toBeInTheDocument();
  });

  it("opens sort dropdown menu on click and lists all sort options", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(
      <ShopSortBar
        searchParams={{}}
        activeOrderby="date"
        activeOrder="desc"
        onSale={false}
        categories={mockCategories}
      />
    );

    const sortButton = screen.getByRole("button", { name: "Sort products" });
    expect(sortButton).toHaveTextContent("Default sorting");

    // Click to open dropdown
    fireEvent.click(sortButton);

    expect(screen.getByText("Sort by popularity")).toBeInTheDocument();
    expect(screen.getByText("Sort by average rating")).toBeInTheDocument();
    expect(screen.getByText("Sort by latest")).toBeInTheDocument();
    expect(screen.getByText("Sort by price: low to high")).toBeInTheDocument();
    expect(screen.getByText("Sort by price: high to low")).toBeInTheDocument();
  });
});
