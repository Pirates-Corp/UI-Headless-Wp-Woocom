import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { resetPasswordAction as mockResetPasswordAction } from "@/lib/actions/auth";
import { useRouter, useSearchParams } from "next/navigation";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock("@/lib/actions/auth", () => ({
  resetPasswordAction: jest.fn(),
}));

describe("ResetPasswordForm", () => {
  const mockPush = jest.fn();
  const mockRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    });
    (useSearchParams as jest.Mock).mockReturnValue({
      get: (key: string) => {
        if (key === "email") return "customer@example.com";
        if (key === "code") return "valid_code_123";
        return null;
      },
    });
  });

  it("renders invalid/expired link card when email or code is missing", () => {
    (useSearchParams as jest.Mock).mockReturnValue({
      get: () => null,
    });

    render(<ResetPasswordForm initialEmail="" initialCode="" />);

    expect(screen.getByText(/Invalid or Expired Link/i)).toBeInTheDocument();
    expect(screen.getByText(/Request New Reset Link/i)).toBeInTheDocument();
  });

  it("renders new password form when email and code are provided", () => {
    render(<ResetPasswordForm initialEmail="customer@example.com" initialCode="valid_code_123" />);

    expect(screen.getByText(/Set New Password/i)).toBeInTheDocument();
    expect(screen.getByText("customer@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText(/Password \(min\. 6 characters\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm New Password/i)).toBeInTheDocument();
  });

  it("submits new password successfully and redirects to /auth", async () => {
    (mockResetPasswordAction as jest.Mock).mockResolvedValueOnce({
      success: true,
      message: "Your password has been reset successfully.",
    });

    render(<ResetPasswordForm initialEmail="customer@example.com" initialCode="valid_code_123" />);

    const passwordInput = screen.getByLabelText(/Password \(min\. 6 characters\)/i);
    const confirmInput = screen.getByLabelText(/Confirm New Password/i);
    const submitBtn = screen.getByRole("button", { name: /Reset Password/i });

    fireEvent.change(passwordInput, { target: { value: "newSecretPassword123" } });
    fireEvent.change(confirmInput, { target: { value: "newSecretPassword123" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockResetPasswordAction).toHaveBeenCalledWith({
        email: "customer@example.com",
        code: "valid_code_123",
        password: "newSecretPassword123",
        confirmPassword: "newSecretPassword123",
      });
      expect(mockPush).toHaveBeenCalledWith("/auth");
    });
  });

  it("displays error message when resetPasswordAction returns error", async () => {
    (mockResetPasswordAction as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: "The reset code has expired. Please request a new one.",
    });

    render(<ResetPasswordForm initialEmail="customer@example.com" initialCode="expired_code" />);

    const passwordInput = screen.getByLabelText(/Password \(min\. 6 characters\)/i);
    const confirmInput = screen.getByLabelText(/Confirm New Password/i);
    const submitBtn = screen.getByRole("button", { name: /Reset Password/i });

    fireEvent.change(passwordInput, { target: { value: "newSecretPassword123" } });
    fireEvent.change(confirmInput, { target: { value: "newSecretPassword123" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/The reset code has expired/i)).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
