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

