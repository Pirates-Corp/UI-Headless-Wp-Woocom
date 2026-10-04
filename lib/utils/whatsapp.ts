import { STORE_CONFIG } from "@/store.config";

export function getWhatsAppChatUrl(): string {
  const phoneNumber = STORE_CONFIG.whatsapp.phoneNumber.replace(/\D/g, "");

  return `https://wa.me/${phoneNumber}`;
}
