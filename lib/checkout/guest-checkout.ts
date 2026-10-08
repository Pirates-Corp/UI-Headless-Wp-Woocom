import { STORE_CONFIG } from "@/store.config";
import { getSessionUser } from "@/lib/auth/session";
import { t } from "@/lib/i18n";

export const GUEST_CHECKOUT_BLOCKED_MESSAGE = t(
  "checkout.loginRequiredTitle",
  "You must log in to place an order"
);

export function isGuestCheckoutAllowed(): boolean {
  return STORE_CONFIG.featureFlags.allowGuest;
}

export async function getGuestCheckoutError(): Promise<string | null> {
  if (isGuestCheckoutAllowed()) {
    return null;
  }
  const user = await getSessionUser();
  if (user) {
    return null;
  }
  return GUEST_CHECKOUT_BLOCKED_MESSAGE;
}
