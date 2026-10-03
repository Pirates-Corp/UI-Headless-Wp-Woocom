export const STORE_CONFIG = {
  whatsapp: {
    // Keep the number in international format; the URL helper removes formatting characters.
    phoneNumber: "+91 9345678221",
  },
} as const;

export const APP_CONFIG = STORE_CONFIG;
