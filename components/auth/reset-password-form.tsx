"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPasswordAction } from "@/lib/actions/auth";
import {
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/defaultbutton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ResetPasswordFormProps {
  initialEmail?: string;
  initialCode?: string;
}

export function ResetPasswordForm({
  initialEmail = "",
  initialCode = "",
}: ResetPasswordFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read email and code from props or URL search params
  const email = (initialEmail || searchParams.get("email") || "").trim();
  const code = (initialCode || searchParams.get("code") || searchParams.get("key") || "").trim();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Missing or incomplete reset parameters state
  if (!email || !code) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm p-5 sm:p-8 shadow-xl shadow-black/5 dark:shadow-black/30 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight mb-2">
            {t("resetPassword.invalidLinkTitle", "Invalid or Expired Link")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mb-6">
            {t(
              "resetPassword.invalidLinkDesc",
              "This password reset link is invalid, incomplete, or has expired. Please request a new one."
            )}
          </p>

          <div className="space-y-3">
            <Link
              href="/forgot-password"
              className={cn(buttonVariants(), "w-full h-10 text-sm font-medium flex items-center justify-center")}
            >
              {t("resetPassword.requestNewLink", "Request New Reset Link")}
            </Link>

            <div>
              <Link
                href="/login"
                className="text-xs text-muted-foreground hover:text-foreground font-medium hover:underline"
              >
                &larr; {t("resetPassword.backToLogin", "Back to Sign In")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 6) {
      const err = "Password must be at least 6 characters.";
      setErrorMessage(err);
      toast.error(err);
      return;
    }

    if (password !== confirmPassword) {
      const err = "Passwords do not match.";
      setErrorMessage(err);
      toast.error(err);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetPasswordAction({
        email,
        code,
        password,
        confirmPassword,
      });

      if (!res.success) {
        const err = res.error || "Failed to reset password. The link may have expired.";
        setErrorMessage(err);
        toast.error(err);
        return;
      }

      toast.success(
        res.message || t("resetPassword.successToast", "Your password has been reset successfully. Please sign in.")
      );
      router.push("/auth");
    } catch {
      const err = "An unexpected error occurred. Please try again.";
      setErrorMessage(err);
      toast.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm p-5 sm:p-8 shadow-xl shadow-black/5 dark:shadow-black/30">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-brand-brown/10 text-brand-brown flex items-center justify-center mx-auto mb-3">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">
            {t("resetPassword.title", "Set New Password")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
            {t(
              "resetPassword.description",
              "Please choose a strong new password for your account."
            )}
          </p>
          <div className="mt-2 inline-block px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground font-medium">
            {email}
          </div>
        </div>

        {errorMessage && (
          <div className="p-3.5 mb-5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs sm:text-sm flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p>{errorMessage}</p>
              <Link
                href="/forgot-password"
                className="underline font-medium mt-1 inline-block hover:opacity-80"
              >
                {t("resetPassword.requestNewLink", "Request a new link")}
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="new-password"
              className="text-xs font-medium text-foreground block"
            >
              {t("resetPassword.passwordMinLength", "Password (min. 6 characters)")}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 pr-9 h-10 text-sm"
                autoComplete="new-password"
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="confirm-new-password"
              className="text-xs font-medium text-foreground block"
            >
              {t("resetPassword.confirmPasswordLabel", "Confirm New Password")}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="confirm-new-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-9 pr-9 h-10 text-sm"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-10 mt-2 text-sm font-medium gap-2 shadow-none bg-brand-brown text-brand-yellow hover:bg-brand-brown/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("resetPassword.submitting", "Updating password...")}
              </>
            ) : (
              <>
                {t("resetPassword.submitButton", "Reset Password")}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="text-xs text-muted-foreground hover:text-foreground font-medium hover:underline"
            >
              &larr; {t("resetPassword.backToLogin", "Back to Sign In")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
