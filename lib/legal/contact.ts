import { APP_CONFIG } from "@/config";

export const LEGAL_CONTACT = {
  brand: "Round Logics",
  address: [
    "Leepushpam Trust, No. 93, Shop Complex,",
    "Five Rathas St,",
    "Mahabalipuram,",
    "Tamil Nadu 603104",
  ],
  phone: "098407 93240",
  whatsappPhone: APP_CONFIG.whatsapp.phoneNumber,
  email: "hello@roundlogics.com",
} as const;
