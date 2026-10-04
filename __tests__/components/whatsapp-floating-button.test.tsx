import { render, screen } from "@testing-library/react";
import { WhatsAppFloatingButton } from "@/components/whatsapp-floating-button";

describe("WhatsAppFloatingButton", () => {
  it("links to the configured WhatsApp number", () => {
    render(<WhatsAppFloatingButton />);

    const link = screen.getByRole("link", {
      name: "Chat with us on WhatsApp",
    });

    expect(link).toHaveAttribute("href", "https://wa.me/919345678221");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});