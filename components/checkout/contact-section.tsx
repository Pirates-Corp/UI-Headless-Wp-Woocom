"use client";

import { useState, useCallback } from "react";
import { useCheckoutStore } from "@/lib/store/checkout-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/defaultcard";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { Mail } from "lucide-react";

export function ContactSection() {
  const billing = useCheckoutStore((s) => s.billing);
  const updateBilling = useCheckoutStore((s) => s.updateBilling);

  const [emailError, setEmailError] = useState("");

  const validateEmail = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setEmailError("Email is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError("");
    }
  }, []);

  return (
    <Card className="border-border/80 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <span>{t("checkout.contactTitle")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="billing_email" className="text-sm font-medium mb-1 block text-foreground">
              {t("checkout.fields.email")}
            </label>
            <Input
              id="billing_email"
              name="billing_email"
              type="email"
              autoComplete="email"
              value={billing.email || ""}
              onChange={(e) => {
                updateBilling("email", e.target.value);
                if (emailError) validateEmail(e.target.value);
              }}
              onBlur={(e) => validateEmail(e.target.value)}
              placeholder={t("checkout.fields.emailPlaceholder")}
              aria-invalid={Boolean(emailError)}
            />
            {emailError && (
              <p className="text-xs text-destructive mt-1 font-medium">{emailError}</p>
            )}
          </div>

          <div>
            <label htmlFor="billing_phone" className="text-sm font-medium mb-1 block text-foreground">
              {t("checkout.fields.phone")}
            </label>
            <Input
              id="billing_phone"
              name="billing_phone"
              type="tel"
              autoComplete="tel"
              value={billing.phone || ""}
              onChange={(e) => updateBilling("phone", e.target.value)}
              placeholder={t("checkout.fields.phonePlaceholder")}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
