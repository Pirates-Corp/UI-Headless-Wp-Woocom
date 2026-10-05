import { render, screen, fireEvent } from "@testing-library/react";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { HeroSection } from "@/components/home/hero-section";

describe("HeroCarousel", () => {
  it("renders the hero carousel with slides linking to /shop", () => {
    render(<HeroCarousel />);

    const links = screen.getAllByRole("link", { name: /Shop Clay Brush Studio/i });
    expect(links.length).toBe(5);
    links.forEach((link) => {
      expect(link).toHaveAttribute("href", "/shop");
    });
  });

  it("renders navigation arrows and pagination tabs", () => {
    render(<HeroCarousel />);

    expect(screen.getByRole("button", { name: "Previous slide" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next slide" })).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(5);
  });

  it("advances slide on next button click", () => {
    render(<HeroCarousel />);

    const nextBtn = screen.getByRole("button", { name: "Next slide" });
    const tabs = screen.getAllByRole("tab");

    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.click(nextBtn);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  });
});

describe("HeroSection", () => {
  it("renders accessible h1 and carousel", () => {
    render(<HeroSection />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Clay Brush Studio - 3D Prints & Custom Art" })
    ).toBeInTheDocument();
  });
});
