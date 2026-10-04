import { STORE_CONFIG } from "@/store.config";

export interface CanCancelOrderParams {
  status: string;
  shipmentAwb?: string | null;
}

export interface CanReturnOrderParams {
  status: string;
  deliveredAt?: string | null;
  now?: Date;
  returnWindowDays?: number;
}

export interface GetReturnDeadlineParams {
  deliveredAt?: string | null;
  returnWindowDays?: number;
}

export interface GetReturnRefundAmountParams {
  reason: string;
  orderTotal: number;
  shippingTotal?: number;
  alreadyRefunded?: number;
}

const CANCELLABLE_STATUSES = new Set(["pending", "on-hold", "processing"]);

/**
 * Pure function: Determines if an order can be cancelled by the customer.
 * Allowed only when status is pending, on-hold, or processing AND no AWB is assigned.
 */
export function canCancelOrder(params: CanCancelOrderParams): boolean {
  if (!params || !params.status) return false;

  const normalizedStatus = params.status.toLowerCase().replace(/^wc-/, "");
  if (!CANCELLABLE_STATUSES.has(normalizedStatus)) {
    return false;
  }

  // If an AWB tracking number has been assigned by Shiprocket, cancel is locked
  if (params.shipmentAwb && params.shipmentAwb.trim() !== "") {
    return false;
  }

  return true;
}

/**
 * Pure function: Determines if an order is eligible for a return request.
 * Allowed only when status is completed and within returnWindowDays of delivered date.
 */
export function canReturnOrder(params: CanReturnOrderParams): boolean {
  if (!params || !params.status) return false;

  const normalizedStatus = params.status.toLowerCase().replace(/^wc-/, "");
  if (normalizedStatus !== "completed") {
    return false;
  }

  if (!params.deliveredAt) {
    return false;
  }

  const deliveredDate = new Date(params.deliveredAt);
  if (isNaN(deliveredDate.getTime())) {
    return false;
  }

  const windowDays = params.returnWindowDays ?? STORE_CONFIG.orders.returnWindowDays ?? 7;
  const now = params.now ?? new Date();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const deadlineMs = deliveredDate.getTime() + windowMs;

  return now.getTime() <= deadlineMs;
}

/**
 * Pure function: Computes the formatted deadline string for returns.
 */
export function getReturnDeadline(params: GetReturnDeadlineParams): string | undefined {
  if (!params.deliveredAt) return undefined;

  const deliveredDate = new Date(params.deliveredAt);
  if (isNaN(deliveredDate.getTime())) return undefined;

  const windowDays = params.returnWindowDays ?? STORE_CONFIG.orders.returnWindowDays ?? 7;
  const deadline = new Date(deliveredDate.getTime() + windowDays * 24 * 60 * 60 * 1000);

  return deadline.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Pure function: Calculates the refund amount for a return request based on business rules:
 * - Damaged / Defective / Wrong Item: full amount including shipping.
 * - Changed Mind / Other: product total only (no shipping).
 * - Subtracts any prior refunds on the order.
 */
export function getReturnRefundAmount(params: GetReturnRefundAmountParams): number {
  const { reason, orderTotal, shippingTotal = 0, alreadyRefunded = 0 } = params;
  const fullRefundReasons = (STORE_CONFIG.orders.fullRefundReturnReasons || [
    "damaged",
    "defective",
    "wrong_item",
  ]) as readonly string[];

  let grossRefund: number;
  if (fullRefundReasons.includes(reason)) {
    // Full amount including shipping
    grossRefund = orderTotal;
  } else {
    // Product total only (exclude shipping)
    grossRefund = Math.max(0, orderTotal - shippingTotal);
  }

  // Deduct already refunded amounts, capped at remaining order value
  const netRefund = Math.max(0, grossRefund - alreadyRefunded);
  return Number(netRefund.toFixed(2));
}
