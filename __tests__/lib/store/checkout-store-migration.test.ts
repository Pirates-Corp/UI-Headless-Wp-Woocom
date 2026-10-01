import { useCheckoutStore } from "@/lib/store/checkout-store";

describe("Checkout store and persist migration", () => {
  beforeEach(() => {
    useCheckoutStore.getState().reset();
  });

  it("1. default state has billingSameAsShipping = true", () => {
    const state = useCheckoutStore.getState();
    expect(state.billingSameAsShipping).toBe(true);
    expect(state.billing.country).toBe("IN");
    expect(state.shipping.country).toBe("IN");
  });

  it("2. setBillingSameAsShipping updates store flag", () => {
    useCheckoutStore.getState().setBillingSameAsShipping(false);
    expect(useCheckoutStore.getState().billingSameAsShipping).toBe(false);

    useCheckoutStore.getState().setBillingSameAsShipping(true);
    expect(useCheckoutStore.getState().billingSameAsShipping).toBe(true);
  });

  it("3. reset() restores default values", () => {
    useCheckoutStore.getState().updateShipping("first_name", "Test");
    useCheckoutStore.getState().updateBilling("email", "test@example.com");
    useCheckoutStore.getState().setBillingSameAsShipping(false);

    useCheckoutStore.getState().reset();

    const state = useCheckoutStore.getState();
    expect(state.billingSameAsShipping).toBe(true);
    expect(state.shipping.first_name).toBe("");
    expect(state.billing.email).toBe("");
  });

  it("4. migrate logic correctly maps old sameAsShipping to billingSameAsShipping and copies billing into empty shipping", () => {
    const persistOptions = (useCheckoutStore as unknown as { persist?: { getOptions: () => { migrate?: (state: unknown, version: number) => unknown } } }).persist?.getOptions();
    
    if (persistOptions?.migrate) {
      const oldV1State = {
        sameAsShipping: true,
        billing: {
          first_name: "Old",
          last_name: "User",
          company: "Old Corp",
          address_1: "Old Street 1",
          address_2: "Apt 1",
          city: "Delhi",
          state: "DL",
          postcode: "110001",
          country: "IN",
          email: "old@example.com",
          phone: "9999999999",
        },
        shipping: {
          first_name: "",
          last_name: "",
          company: "",
          address_1: "",
          address_2: "",
          city: "",
          state: "",
          postcode: "",
          country: "IN",
        },
        selectedPaymentMethod: "cod",
      };

      const migrated = persistOptions.migrate(oldV1State, 1) as Record<string, unknown>;
      expect(migrated.billingSameAsShipping).toBe(true);
      expect((migrated.shipping as Record<string, string>).address_1).toBe("Old Street 1");
      expect((migrated.shipping as Record<string, string>).first_name).toBe("Old");
      expect((migrated.shipping as Record<string, string>).city).toBe("Delhi");
    }
  });
});
