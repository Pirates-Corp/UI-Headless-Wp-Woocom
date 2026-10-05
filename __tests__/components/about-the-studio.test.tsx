import { render, screen } from "@testing-library/react";
import { AboutTheStudio } from "@/components/home/about-the-studio";

describe("AboutTheStudio", () => {
  it("renders the heading, logo, description, and Read More link", () => {
    render(<AboutTheStudio />);

    expect(screen.getByRole("heading", { level: 2, name: "About The Studio" })).toBeInTheDocument();
    expect(screen.getByAltText("Clay Brush Studio")).toBeInTheDocument();
    expect(
      screen.getByText(/The clay brush studio provides 3d printed Divine collections/i)
    ).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /Read More/i });
    expect(link).toHaveAttribute("href", "/about");
  });
});
