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
  orders: {
    returnWindowDays: 7,
    cancelReasons: [
      "ordered_by_mistake",
      "found_better_price",
      "delivery_too_slow",
      "changed_mind",
      "other",
    ] as const,
    returnReasons: [
      "damaged",
      "defective",
      "wrong_item",
      "changed_mind",
      "other",
    ] as const,
    fullRefundReturnReasons: [
      "damaged",
      "defective",
      "wrong_item",
    ] as const,
  },
  featureFlags: {
    // true  = guests can place orders without an account
    // false = checkout asks the customer to log in or sign up first
    allowGuest: false as boolean,
  },
} as const;

export const APP_CONFIG = STORE_CONFIG;
