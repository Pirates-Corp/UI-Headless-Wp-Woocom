import React from "react";
import { render, screen } from "@testing-library/react";
import { ProductBreadcrumb } from "@/components/product/product-breadcrumb";

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  };
});

describe("ProductBreadcrumb", () => {
  it("decodes HTML entities in category and product names", () => {
    const categories = [
      { id: 1, name: "Spiritual &amp; Religious Decor", slug: "spiritual-religious-decor" },
    ];
    const productName = "Venkateswara &amp; Perumal Statue &#039;Edition&#039;";

    render(
      <ProductBreadcrumb
        categories={categories}
        productName={productName}
      />
    );

    expect(screen.getByText("Spiritual & Religious Decor")).toBeInTheDocument();
    expect(screen.getByText("Venkateswara & Perumal Statue 'Edition'")).toBeInTheDocument();
  });
});
