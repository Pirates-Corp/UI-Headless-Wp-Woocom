import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert total major currency amount to minor units (e.g. cents/paise).
 * Matches the decimal precision mapping used by the WordPress mu-plugin:
 * - 0 decimals: JPY, KRW, VND, CLP, UGX, XOF, XAF
 * - 3 decimals: KWD, BHD, OMR, JOD, TND
 * - 2 decimals: all other currencies (USD, INR, EUR, GBP, etc.)
 */
export function toMinorUnits(total: number | string, currency: string): number {
  const c = currency.toUpperCase();
  const zero = ["JPY", "KRW", "VND", "CLP", "UGX", "XOF", "XAF"];
  const three = ["KWD", "BHD", "OMR", "JOD", "TND"];
  const d = zero.includes(c) ? 0 : three.includes(c) ? 3 : 2;
  const num = typeof total === "string" ? parseFloat(total) : total;
  if (isNaN(num)) return 0;
  return Math.round(num * Math.pow(10, d));
}
