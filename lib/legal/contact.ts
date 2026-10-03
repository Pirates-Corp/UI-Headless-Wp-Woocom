import { STORE_ADDRESS_CONFIG } from "@/store-address-config";
import { STORE_CONFIG } from "@/store.config";

export const LEGAL_CONTACT = {
  ...STORE_ADDRESS_CONFIG,
  whatsappPhone: STORE_CONFIG.whatsapp.phoneNumber,
} as const;
