export const STORE_CONFIG = {
  brand: "Round Logics",
  address: [
    "Leepushpam Trust, No. 93, Shop Complex,",
    "Five Rathas St,",
    "Mahabalipuram,",
    "Tamil Nadu 603104",
  ],
  phone: "098407 93240",
  email: "hello@roundlogics.com",
  whatsapp: {
    // Keep the number in international format; the URL helper removes formatting characters.
    phoneNumber: "+91 9345678221",
  },
} as const;

export const APP_CONFIG = STORE_CONFIG;
