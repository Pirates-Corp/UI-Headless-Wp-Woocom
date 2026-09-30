import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ShopHeader } from "@/components/shop/shop-header";
import { ShopSortBar } from "@/components/shop/shop-sort-bar";
import type { CurrencySettings, WooCategory } from "@/lib/woocommerce/types";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const currency: CurrencySettings = {
  code: "INR", symbol: "₹", minor_unit: 2, decimal_separator: ".", thousand_separator: ",", prefix: "₹", suffix: "",
};

const mockCategories: WooCategory[] = [
  { id: 17, name: "Herbals", slug: "herbals", description: "", parent: 0, count: 2, image: null },
  { id: 18, name: "Naturals", slug: "naturals", description: "", parent: 0, count: 3, image: null },
];

describe("ShopHeader", () => {
  it("renders the default title", () => {
    render(<ShopHeader onSale={false} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("All Fragrances");
  });

  it("renders the sale title", () => {
    render(<ShopHeader onSale={true} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("On Sale");
  });

  it("renders the current category name and description", () => {
    const category: WooCategory = { ...mockCategories[0], description: "Natural herbal formulations" };
    render(<ShopHeader onSale={false} category={category} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Herbals");
    expect(screen.getByText("Natural herbal formulations")).toBeInTheDocument();
  });
});

describe("ShopSortBar", () => {
  const common = {
    searchParams: {} as Record<string, string | undefined>,
    activeOrderby: "date",
    activeOrder: "desc",
    onSale: false,
    categories: mockCategories,
    brands: [{ id: 29, name: "JOSE", slug: "jose" }],
    tags: [],
    currency,
  };

  it("renders active category chip and filter control", () => {
    render(<ShopSortBar {...common} searchParams={{ category: "herbals" }} activeCategory="herbals" />);
    expect(screen.getByRole("button", { name: "All Filters" })).toBeInTheDocument();
    expect(screen.getByTitle("Remove category filter")).toBeInTheDocument();
  });

  it("renders an active brand chip without changing other filter controls", () => {
    render(<ShopSortBar {...common} searchParams={{ brand: "jose" }} activeBrand="jose" />);
    expect(screen.getByTitle("Remove brand filter")).toBeInTheDocument();
    expect(screen.getByText(/Brand:/)).toHaveTextContent("JOSE");
  });
  it("keeps filtering and sorting as separate toolbar controls", () => {
    render(<ShopSortBar {...common} />);
    expect(screen.getByRole("button", { name: "All Filters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort products" })).toBeInTheDocument();
  });

  it("opens the sort menu with supported backend sort choices", () => {
    render(<ShopSortBar {...common} />);
    fireEvent.click(screen.getByRole("button", { name: "Sort products" }));
    expect(screen.getByText("Sort by popularity")).toBeInTheDocument();
    expect(screen.getByText("Sort by average rating")).toBeInTheDocument();
    expect(screen.getByText("Sort by latest")).toBeInTheDocument();
    expect(screen.getByText("Sort by price: low to high")).toBeInTheDocument();
    expect(screen.getByText("Sort by price: high to low")).toBeInTheDocument();
    expect(screen.queryByText(/Best Seller/i)).not.toBeInTheDocument();
  });
});

describe("ShopSortBar sort state and navigation", () => {
  const shopParams = {
    category: "herbals",
    brand: "trj",
    tag: "7",
    min_price: "500",
    max_price: "1000",
    on_sale: "true",
    page: "3",
    orderby: "rating",
    order: "desc",
  };
  const props = {
    searchParams: shopParams,
    activeOrderby: "rating",
    activeOrder: "desc",
    onSale: true,
    categories: mockCategories,
    brands: [{ id: 29, name: "TRJ", slug: "trj" }],
    tags: [],
    currency,
    activeCategory: "herbals",
    activeBrand: "trj",
    activeTag: "7",
  };

  it.each([
    { label: "Default sorting", orderby: null, order: null },
    { label: "Sort by popularity", orderby: "popularity", order: "desc" },
    { label: "Sort by average rating", orderby: "rating", order: "desc" },
    { label: "Sort by latest", orderby: "date", order: "desc" },
    { label: "Sort by price: low to high", orderby: "price", order: "asc" },
    { label: "Sort by price: high to low", orderby: "price", order: "desc" },
  ])("preserves active filters, writes $label, and resets pagination", ({ label, orderby, order }) => {
    render(<ShopSortBar {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Sort products" }));

    const option = screen.getByRole("menuitem", { name: label });
    const href = option.getAttribute("href");
    expect(href).toBeTruthy();
    const url = new URL(href!, "http://localhost");
    expect(url.pathname).toBe("/shop");
    expect(url.searchParams.get("orderby")).toBe(orderby);
    expect(url.searchParams.get("order")).toBe(order);
    expect(url.searchParams.get("category")).toBe("herbals");
    expect(url.searchParams.get("brand")).toBe("trj");
    expect(url.searchParams.get("tag")).toBe("7");
    expect(url.searchParams.get("min_price")).toBe("500");
    expect(url.searchParams.get("max_price")).toBe("1000");
    expect(url.searchParams.get("on_sale")).toBe("true");
    expect(url.searchParams.has("page")).toBe(false);
  });

  it("distinguishes explicit Latest from Default", () => {
    render(
      <ShopSortBar
        {...props}
        searchParams={{ ...shopParams, orderby: "date", order: "desc" }}
        activeOrderby="date"
        activeOrder="desc"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sort products" }));

    expect(screen.getByRole("menuitem", { name: "Sort by latest" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("menuitem", { name: "Default sorting" })).not.toHaveAttribute("aria-current", "true");
  });

  it("keeps an option mounted through inside mousedown and closes on selection", () => {
    render(<ShopSortBar {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Sort products" }));
    const option = screen.getByRole("menuitem", { name: "Sort by popularity" });

    fireEvent.mouseDown(option);
    expect(screen.getByRole("menuitem", { name: "Sort by popularity" })).toBeInTheDocument();

    fireEvent.click(option);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});