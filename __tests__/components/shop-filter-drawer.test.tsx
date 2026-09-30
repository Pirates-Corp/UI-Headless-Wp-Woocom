import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ShopFilterDrawer } from "@/components/shop/shop-filter-drawer";
import type { CurrencySettings } from "@/lib/woocommerce/types";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

const currency: CurrencySettings = {
  code: "INR", symbol: "₹", minor_unit: 0, decimal_separator: ".", thousand_separator: ",", prefix: "₹", suffix: "",
};

function renderDrawer() {
  return render(<ShopFilterDrawer searchParams={{ category: "nature", orderby: "date", order: "desc", page: "2" }} categories={[
    { id: 1, name: "Nature", slug: "nature", description: "", parent: 0, count: 2, image: null },
    { id: 2, name: "Herbal", slug: "herbal", description: "", parent: 0, count: 4, image: null },
  ]} brands={[{ id: 29, name: "JOSE", slug: "jose" }]} tags={[{ id: 7, name: "Fresh", slug: "fresh" }]} currency={currency} activeCategory="nature" onSale={false} />);
}

beforeEach(() => mockPush.mockClear());

describe("ShopFilterDrawer", () => {
  it("keeps quick ranges and price inputs synchronized before applying once", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "All Filters" }));
    const under = screen.getByRole("button", { name: /Under ₹200/ });
    fireEvent.click(under);
    expect(screen.getByRole("spinbutton", { name: "Minimum price" })).toHaveValue(0);
    expect(screen.getByRole("spinbutton", { name: "Maximum price" })).toHaveValue(200);

    const min = screen.getByRole("spinbutton", { name: "Minimum price" });
    const max = screen.getByRole("spinbutton", { name: "Maximum price" });
    fireEvent.change(min, { target: { value: "500" } });
    fireEvent.change(max, { target: { value: "1000" } });
    expect(screen.getByRole("button", { name: /₹500 – ₹1,000/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Apply Filters" }));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0][0]).toContain("min_price=500");
    expect(mockPush.mock.calls[0][0]).toContain("max_price=1000");
    expect(mockPush.mock.calls[0][0]).not.toContain("page=");
    expect(mockPush.mock.calls[0][0]).toContain("category=nature");
  });

  it("commits a selected brand through the URL", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "All Filters" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Brand" }), { target: { value: "jose" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Filters" }));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("brand=jose"));
  });
  it("updates min/max inputs when the range slider moves", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "All Filters" }));
    fireEvent.keyDown(screen.getAllByRole("slider")[0], { key: "ArrowRight" });
    expect(screen.getByRole("spinbutton", { name: "Minimum price" })).toHaveValue(1);
  });
  it("allows a single-ended range when one price input is empty", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "All Filters" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum price" }), { target: { value: "500" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum price" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Filters" }));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("min_price=500"));
    expect(mockPush.mock.calls[0][0]).not.toContain("max_price=");
  });
  it("blocks inverted min/max values and reports a validation message", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "All Filters" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum price" }), { target: { value: "900" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum price" }), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Filters" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Minimum price must be less than or equal to maximum price.");
    expect(mockPush).not.toHaveBeenCalled();
  });
});
