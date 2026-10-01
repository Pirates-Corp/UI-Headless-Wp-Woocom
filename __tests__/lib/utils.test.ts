import { cn, toMinorUnits } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("deduplicates conflicting Tailwind classes (last wins)", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("handles undefined and null gracefully", () => {
    expect(cn(undefined, null, "text-sm")).toBe("text-sm");
  });

  it("returns empty string when no arguments", () => {
    expect(cn()).toBe("");
  });
});

describe("toMinorUnits", () => {
  it("handles 0-decimal currencies correctly (JPY, KRW, VND, etc.)", () => {
    expect(toMinorUnits(1500, "JPY")).toBe(1500);
    expect(toMinorUnits("50000", "KRW")).toBe(50000);
    expect(toMinorUnits(250000, "VND")).toBe(250000);
    expect(toMinorUnits(1200, "CLP")).toBe(1200);
    expect(toMinorUnits(5000, "UGX")).toBe(5000);
    expect(toMinorUnits(1000, "XOF")).toBe(1000);
    expect(toMinorUnits(1000, "XAF")).toBe(1000);
  });

  it("handles 2-decimal currencies correctly (INR, USD, EUR, GBP)", () => {
    expect(toMinorUnits(10.5, "USD")).toBe(1050);
    expect(toMinorUnits("499.99", "INR")).toBe(49999);
    expect(toMinorUnits(12.34, "EUR")).toBe(1234);
    expect(toMinorUnits("100", "GBP")).toBe(10000);
    expect(toMinorUnits(0.01, "USD")).toBe(1);
  });

  it("handles 3-decimal currencies correctly (KWD, BHD, OMR, JOD, TND)", () => {
    expect(toMinorUnits(5.125, "KWD")).toBe(5125);
    expect(toMinorUnits("1.500", "BHD")).toBe(1500);
    expect(toMinorUnits(2.25, "OMR")).toBe(2250);
    expect(toMinorUnits("3.1", "JOD")).toBe(3100);
    expect(toMinorUnits(10, "TND")).toBe(10000);
  });

  it("handles case insensitivity for currency codes", () => {
    expect(toMinorUnits(10, "usd")).toBe(1000);
    expect(toMinorUnits(100, "jpy")).toBe(100);
    expect(toMinorUnits(1, "kwd")).toBe(1000);
  });

  it("handles invalid or non-numeric inputs safely", () => {
    expect(toMinorUnits("invalid", "USD")).toBe(0);
    expect(toMinorUnits(NaN, "USD")).toBe(0);
  });
});
