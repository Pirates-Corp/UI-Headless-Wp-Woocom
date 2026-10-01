/**
 * Format a WooCommerce price string (in minor units) to display format
 */
export function formatPrice(
  price: string,
  currencyMinorUnit: number = 2,
  currencyPrefix: string = "$",
  currencySuffix: string = ""
): string {
  const numericPrice = parseInt(price, 10) / Math.pow(10, currencyMinorUnit);
  const formatted = numericPrice.toFixed(currencyMinorUnit);
  return `${currencyPrefix}${formatted}${currencySuffix}`;
}

/**
 * Format price from a WooCommerce prices object
 */
export function formatProductPrice(prices: {
  price: string;
  regular_price: string;
  sale_price: string;
  currency_minor_unit: number;
  currency_prefix: string;
  currency_suffix: string;
}): { current: string; regular: string; onSale: boolean } {
  const current = formatPrice(
    prices.price,
    prices.currency_minor_unit,
    prices.currency_prefix,
    prices.currency_suffix
  );
  const regular = formatPrice(
    prices.regular_price || prices.price,
    prices.currency_minor_unit,
    prices.currency_prefix,
    prices.currency_suffix
  );

  const priceNum = parseInt(prices.price, 10);
  const regularNum = parseInt(prices.regular_price, 10);
  const saleNum = parseInt(prices.sale_price, 10);

  // A product is truly on sale only if regular price is strictly greater than the current price
  const hasValidRegular = !isNaN(regularNum) && regularNum > 0;
  const hasValidPrice = !isNaN(priceNum) && priceNum >= 0;
  const isDiscounted = hasValidRegular && hasValidPrice && regularNum > priceNum;

  const onSale =
    isDiscounted &&
    (prices.sale_price !== "" && prices.sale_price !== "0"
      ? !isNaN(saleNum) && saleNum < regularNum
      : true);

  return { current, regular, onSale };
}

/**
 * Strip HTML tags from a string
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * Decode HTML entities commonly returned by WordPress / WooCommerce (e.g. &#038;, &amp;, &#8217;, &quot;)
 */
export function decodeHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/&#0*38;|&amp;/gi, "&")
    .replace(/&#0*39;|&apos;|&#8217;|&#8216;/gi, "'")
    .replace(/&#0*34;|&quot;|&#8220;|&#8221;/gi, '"')
    .replace(/&#0*60;|&lt;/gi, "<")
    .replace(/&#0*62;|&gt;/gi, ">")
    .replace(/&#0*160;|&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return !isNaN(code) ? String.fromCharCode(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return !isNaN(code) ? String.fromCharCode(code) : _;
    });
}

/**
 * Extract a human-readable error message from a WooCommerce REST/Store API error body.
 */
export function formatCartError(raw: string, fallback = "An unexpected error occurred. Please try again."): string {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as { message?: string; code?: string };
    if (parsed.message) {
      return decodeHtml(parsed.message.replace(/<[^>]*>/g, "").trim());
    }
  } catch {
    // Not JSON
  }
  const cleaned = decodeHtml(raw.replace(/<[^>]*>/g, "").trim());
  return cleaned || fallback;
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Deterministic date formatter safe for Next.js SSR hydration across all client locales.
 * Formats dates consistently as "MMM D, YYYY" (e.g. "Sep 30, 2026").
 */
export function formatDate(dateInput?: string | number | Date | null): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "object" && dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";

  if (typeof dateInput === "string") {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = match[1];
      const monthIndex = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      if (monthIndex >= 0 && monthIndex < 12 && !isNaN(day)) {
        return `${SHORT_MONTHS[monthIndex]} ${day}, ${year}`;
      }
    }
  }

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Convert a decimal currency amount to minor units (e.g. dollars/rupees -> cents/paise).
 * Supports zero-decimal, two-decimal, and three-decimal currencies.
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

