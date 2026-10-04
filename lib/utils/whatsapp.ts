import { STORE_CONFIG } from "@/store.config";

export function getWhatsAppChatUrl(message?: string): string {
  const phoneNumber = STORE_CONFIG.whatsapp.phoneNumber.replace(/\D/g, "");
  const base = `https://wa.me/${phoneNumber}`;
  if (message) {
    return `${base}?text=${encodeURIComponent(message)}`;
  }
  return base;
}

