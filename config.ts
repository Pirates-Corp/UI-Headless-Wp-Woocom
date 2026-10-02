export const APP_CONFIG = {
  whatsapp: {
    // Keep the number in international format; the URL helper removes formatting characters.
    phoneNumber: "+91 9345678221",
  },
} as const;

export function getWhatsAppChatUrl(): string {
  const phoneNumber = APP_CONFIG.whatsapp.phoneNumber.replace(/\D/g, "");

  return `https://wa.me/${phoneNumber}`;
}