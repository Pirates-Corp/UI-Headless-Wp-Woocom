import { getEffectiveAddresses } from "@/lib/checkout/effective-addresses";
import type { BillingAddress, ShippingAddress } from "@/lib/woocommerce/types";

describe("getEffectiveAddresses helper", () => {
  const sampleDelivery: ShippingAddress = {
    first_name: "John",
    last_name: "Doe",
    company: "",
    address_1: "123 Delivery St",
    address_2: "Apt 4B",
    city: "Mumbai",
    state: "MH",
    postcode: "400001",
    country: "IN",
  };

  const sampleBillingInput: BillingAddress = {
    first_name: "Jane",
    last_name: "Smith",
    company: "Acme Corp",
    address_1: "789 Billing Blvd",
    address_2: "Suite 100",
    city: "Bangalore",
    state: "KA",
    postcode: "560001",
    country: "IN",
    email: "john.doe@example.com",
    phone: "9876543210",
  };

  it("1. mirrors delivery address to billing when billingSameAsShipping is true while retaining contact email/phone", () => {
    const result = getEffectiveAddresses({
      shipping: sampleDelivery,
      billing: sampleBillingInput,
      billingSameAsShipping: true,
    });

    expect(result.shipping).toEqual(sampleDelivery);
    expect(result.billing.first_name).toBe("John");
    expect(result.billing.last_name).toBe("Doe");
    expect(result.billing.address_1).toBe("123 Delivery St");
    expect(result.billing.address_2).toBe("Apt 4B");
    expect(result.billing.city).toBe("Mumbai");
    expect(result.billing.state).toBe("MH");
    expect(result.billing.postcode).toBe("400001");
    expect(result.billing.country).toBe("IN");
    expect(result.billing.email).toBe("john.doe@example.com");
    expect(result.billing.phone).toBe("9876543210");
  });

  it("2. returns separate billing address when billingSameAsShipping is false", () => {
    const result = getEffectiveAddresses({
      shipping: sampleDelivery,
      billing: sampleBillingInput,
      billingSameAsShipping: false,
    });

    expect(result.shipping).toEqual(sampleDelivery);
    expect(result.billing.first_name).toBe("Jane");
    expect(result.billing.last_name).toBe("Smith");
    expect(result.billing.company).toBe("Acme Corp");
    expect(result.billing.address_1).toBe("789 Billing Blvd");
    expect(result.billing.city).toBe("Bangalore");
    expect(result.billing.state).toBe("KA");
    expect(result.billing.postcode).toBe("560001");
    expect(result.billing.email).toBe("john.doe@example.com");
    expect(result.billing.phone).toBe("9876543210");
  });

  it("3. handles empty or undefined inputs safely without throw", () => {
    const result = getEffectiveAddresses({
      shipping: {} as ShippingAddress,
      billing: {} as BillingAddress,
      billingSameAsShipping: true,
    });

    expect(result.shipping.first_name).toBe("");
    expect(result.billing.first_name).toBe("");
    expect(result.billing.email).toBe("");
  });
});
