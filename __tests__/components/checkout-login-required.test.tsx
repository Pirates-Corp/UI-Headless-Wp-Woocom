import React from "react";
import { render, screen, within } from "@testing-library/react";
import { LoginRequired } from "@/components/checkout/login-required";

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

describe("LoginRequired component", () => {
  const returnUrl = "/checkout?buy_now=1";
  const expectedLoginHref = `/login?returnUrl=${encodeURIComponent(returnUrl)}`;
  const expectedRegisterHref = `/register?returnUrl=${encodeURIComponent(returnUrl)}`;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Desktop: heading is shown, no dialog, links point to /login and /register with encoded returnUrl", () => {
    mockMatchMedia(true);

    render(<LoginRequired returnUrl={returnUrl} />);

    // Heading is shown
    expect(
      screen.getByRole("heading", { name: "You must log in to place an order" })
    ).toBeInTheDocument();

    // No element with role dialog exists
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Log In and Sign Up links
    const loginLink = screen.getByRole("link", { name: "Log In" });
    const registerLink = screen.getByRole("link", { name: "Sign Up" });

    expect(loginLink).toHaveAttribute("href", expectedLoginHref);
    expect(registerLink).toHaveAttribute("href", expectedRegisterHref);
  });

  it("Mobile: an element with role dialog appears and contains the message and both links", () => {
    mockMatchMedia(false);

    render(<LoginRequired returnUrl={returnUrl} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Dialog contains the message
    expect(
      within(dialog).getByText("You must log in to place an order")
    ).toBeInTheDocument();

    // Dialog contains both links
    const dialogLoginLink = within(dialog).getByRole("link", { name: "Log In" });
    const dialogRegisterLink = within(dialog).getByRole("link", { name: "Sign Up" });

    expect(dialogLoginLink).toHaveAttribute("href", expectedLoginHref);
    expect(dialogRegisterLink).toHaveAttribute("href", expectedRegisterHref);
  });
});
