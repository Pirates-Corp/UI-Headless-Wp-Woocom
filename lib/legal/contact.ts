import { STORE_CONFIG } from "@/store.config";

export const LEGAL_CONTACT = {
  brand: STORE_CONFIG.brand,
  address: STORE_CONFIG.address,
  phone: STORE_CONFIG.phone,
  email: STORE_CONFIG.email,
  whatsappPhone: STORE_CONFIG.whatsapp.phoneNumber,
} as const;
