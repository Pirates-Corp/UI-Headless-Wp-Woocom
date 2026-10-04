import {
  ResetPasswordSchema,
  ForgotPasswordSchema,
  LoginSchema,
  RegisterSchema,
} from "@/lib/validation/auth-schemas";

describe("Auth Validation Schemas", () => {
  describe("ResetPasswordSchema", () => {
    const validReset = {
      email: "user@example.com",
      code: "reset_code_12345",
      password: "newPassword123!",
      confirmPassword: "newPassword123!",
    };

    it("accepts valid reset password input", () => {
      const res = ResetPasswordSchema.safeParse(validReset);
      expect(res.success).toBe(true);
    });

    it("rejects invalid email address", () => {
      const res = ResetPasswordSchema.safeParse({
        ...validReset,
        email: "not-an-email",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe("Please enter a valid email address");
      }
    });

    it("rejects empty reset code", () => {
      const res = ResetPasswordSchema.safeParse({
        ...validReset,
        code: "",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe("Reset code is required");
      }
    });

    it("rejects password shorter than 6 characters", () => {
      const res = ResetPasswordSchema.safeParse({
        ...validReset,
        password: "12345",
        confirmPassword: "12345",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe("Password must be at least 6 characters");
      }
    });

    it("rejects mismatched passwords", () => {
      const res = ResetPasswordSchema.safeParse({
        ...validReset,
        password: "newPassword123!",
        confirmPassword: "differentPassword456!",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe("Passwords do not match");
      }
    });
  });

  describe("ForgotPasswordSchema", () => {
    it("accepts valid email", () => {
      const res = ForgotPasswordSchema.safeParse({ email: "user@example.com" });
      expect(res.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const res = ForgotPasswordSchema.safeParse({ email: "invalid-email" });
      expect(res.success).toBe(false);
    });

    it("rejects empty email", () => {
      const res = ForgotPasswordSchema.safeParse({ email: "" });
      expect(res.success).toBe(false);
    });
  });

  describe("LoginSchema", () => {
    it("accepts valid credentials", () => {
      const res = LoginSchema.safeParse({
        emailOrUsername: "user@example.com",
        password: "password123",
      });
      expect(res.success).toBe(true);
    });
  });

  describe("RegisterSchema", () => {
    it("accepts valid registration data", () => {
      const res = RegisterSchema.safeParse({
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        password: "password123",
        confirmPassword: "password123",
      });
      expect(res.success).toBe(true);
    });
  });
});
