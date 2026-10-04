import {
  canCancelOrder,
  canReturnOrder,
  getReturnDeadline,
  getReturnRefundAmount,
} from "@/lib/orders/eligibility";

describe("Order Eligibility Helpers", () => {
  describe("canCancelOrder", () => {
    it("allows cancel for pending, on-hold, processing without AWB", () => {
      expect(canCancelOrder({ status: "pending" })).toBe(true);
      expect(canCancelOrder({ status: "wc-pending" })).toBe(true);
      expect(canCancelOrder({ status: "on-hold" })).toBe(true);
      expect(canCancelOrder({ status: "processing" })).toBe(true);
      expect(canCancelOrder({ status: "processing", shipmentAwb: "" })).toBe(true);
      expect(canCancelOrder({ status: "processing", shipmentAwb: "   " })).toBe(true);
    });

    it("rejects cancel when AWB tracking is assigned", () => {
      expect(
        canCancelOrder({ status: "processing", shipmentAwb: "SR12345678" })
      ).toBe(false);
      expect(
        canCancelOrder({ status: "pending", shipmentAwb: "AWB999" })
      ).toBe(false);
    });

    it("rejects cancel for non-cancellable statuses", () => {
      expect(canCancelOrder({ status: "shipped" })).toBe(false);
      expect(canCancelOrder({ status: "completed" })).toBe(false);
      expect(canCancelOrder({ status: "cancelled" })).toBe(false);
      expect(canCancelOrder({ status: "refunded" })).toBe(false);
      expect(canCancelOrder({ status: "rto" })).toBe(false);
      expect(canCancelOrder({ status: "return-requested" })).toBe(false);
    });
  });

  describe("canReturnOrder", () => {
    const baseDate = new Date("2026-03-10T12:00:00Z");

    it("allows return when status is completed and within returnWindowDays (7 days)", () => {
      // Delivered 3 days before now
      const deliveredAt = new Date("2026-03-07T12:00:00Z").toISOString();
      expect(
        canReturnOrder({
          status: "completed",
          deliveredAt,
          now: baseDate,
          returnWindowDays: 7,
        })
      ).toBe(true);
    });

    it("allows return on day 6 within the window", () => {
      // Delivered 6 days before now
      const deliveredAt = new Date("2026-03-04T12:00:00Z").toISOString();
      expect(
        canReturnOrder({
          status: "completed",
          deliveredAt,
          now: baseDate,
          returnWindowDays: 7,
        })
      ).toBe(true);
    });

    it("rejects return on day 8 (expired window)", () => {
      // Delivered 8 days before now
      const deliveredAt = new Date("2026-03-02T12:00:00Z").toISOString();
      expect(
        canReturnOrder({
          status: "completed",
          deliveredAt,
          now: baseDate,
          returnWindowDays: 7,
        })
      ).toBe(false);
    });

    it("rejects return when status is not completed", () => {
      const deliveredAt = new Date("2026-03-09T12:00:00Z").toISOString();
      expect(
        canReturnOrder({
          status: "processing",
          deliveredAt,
          now: baseDate,
        })
      ).toBe(false);
      expect(
        canReturnOrder({
          status: "shipped",
          deliveredAt,
          now: baseDate,
        })
      ).toBe(false);
    });

    it("rejects return when deliveredAt is missing or invalid", () => {
      expect(canReturnOrder({ status: "completed" })).toBe(false);
      expect(canReturnOrder({ status: "completed", deliveredAt: "invalid-date" })).toBe(false);
    });
  });

  describe("getReturnDeadline", () => {
    it("returns formatted deadline date string", () => {
      const deliveredAt = "2026-03-01T00:00:00.000Z";
      const deadline = getReturnDeadline({ deliveredAt, returnWindowDays: 7 });
      expect(deadline).toBeDefined();
      expect(typeof deadline).toBe("string");
    });

    it("returns undefined for missing deliveredAt", () => {
      expect(getReturnDeadline({})).toBeUndefined();
    });
  });

  describe("getReturnRefundAmount", () => {
    it("calculates full refund (including shipping) for damaged, defective, wrong_item", () => {
      expect(
        getReturnRefundAmount({
          reason: "damaged",
          orderTotal: 1200,
          shippingTotal: 150,
        })
      ).toBe(1200);

      expect(
        getReturnRefundAmount({
          reason: "defective",
          orderTotal: 500,
          shippingTotal: 50,
        })
      ).toBe(500);

      expect(
        getReturnRefundAmount({
          reason: "wrong_item",
          orderTotal: 800,
          shippingTotal: 80,
        })
      ).toBe(800);
    });

    it("calculates product total only (excluding shipping) for changed_mind and other", () => {
      expect(
        getReturnRefundAmount({
          reason: "changed_mind",
          orderTotal: 1200,
          shippingTotal: 150,
        })
      ).toBe(1050);

      expect(
        getReturnRefundAmount({
          reason: "other",
          orderTotal: 500,
          shippingTotal: 100,
        })
      ).toBe(400);
    });

    it("deducts already refunded amounts properly", () => {
      expect(
        getReturnRefundAmount({
          reason: "changed_mind",
          orderTotal: 1000,
          shippingTotal: 100,
          alreadyRefunded: 300,
        })
      ).toBe(600); // (1000 - 100) - 300 = 600

      expect(
        getReturnRefundAmount({
          reason: "damaged",
          orderTotal: 1000,
          shippingTotal: 100,
          alreadyRefunded: 400,
        })
      ).toBe(600); // 1000 - 400 = 600
    });
  });
});
