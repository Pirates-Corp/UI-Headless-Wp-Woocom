export const STORE_CONFIG = {
  brand: "CLAY BRUSH STUDIO",
  address: [
    "3/420 Navaladi Patty Road",
    "Pavithiram (PO)",
    "Namakkal(DT)",
    "Tamil Nadu, India",
  ],
  phone: "+91 9787120055",
  email: "info@claybrushstudio.com",
  whatsapp: {
    // Keep the number in international format; the URL helper removes formatting characters.
    phoneNumber: "+91 9787120055",
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
  social : {
    instagram : "https://www.instagram.com/claybrushstudio/?hl=en#",
    whatsApp : "+919787120055",
    youtube: "https://youtube.com/@claybrushstudio?si=SW1ni6usbz5YdGSR"
  },
  featureFlags: {
    // true  = guests can place orders without an account
    // false = checkout asks the customer to log in or sign up first
    allowGuest: false as boolean,
  },
} as const;

export const APP_CONFIG = STORE_CONFIG;
