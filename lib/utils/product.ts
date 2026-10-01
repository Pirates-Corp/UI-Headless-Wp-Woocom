import type { WooProduct } from "@/lib/woocommerce/types";

/** Sort terms: numeric values first (ascending), then alphabetically. */
export function sortTerms<T extends { name: string }>(terms: T[]): T[] {
  return [...terms].sort((a, b) => {
    const aNum = parseFloat(a.name);
    const bNum = parseFloat(b.name);
    const aIsNum = !isNaN(aNum) && a.name.trim() !== "";
    const bIsNum = !isNaN(bNum) && b.name.trim() !== "";
    if (aIsNum && bIsNum) return aNum - bNum;
    if (aIsNum) return -1;
    if (bIsNum) return 1;
    return a.name.localeCompare(b.name);
  });
}

/** Check if attribute name matches a variation attribute name (handles pa_ prefixes and case). */
export function matchesAttributeName(
  attr: WooProduct["attributes"][number] | string,
  varAttrName: string,
): boolean {
  if (!attr || !varAttrName) return false;
  const aName =
    typeof attr === "string" ? attr.toLowerCase() : attr.name.toLowerCase();
  const vName = varAttrName.toLowerCase();
  if (aName === vName) return true;

  if (
    typeof attr !== "string" &&
    attr.taxonomy &&
    attr.taxonomy.toLowerCase() === vName
  ) {
    return true;
  }

  const aClean = aName.replace(/^pa_/, "");
  const vClean = vName.replace(/^pa_/, "");
  return aClean === vClean;
}

/**
 * Normalize a raw variation attribute value (which may be a term name or slug)
 * to the canonical slug by looking it up in the parent attribute's terms list.
 */
export function resolveTermSlug(
  attr: WooProduct["attributes"][number],
  rawValue: string,
): string {
  if (!rawValue) return "";
  const rawLower = rawValue.trim().toLowerCase();
  const term =
    attr.terms.find((t) => t.name.toLowerCase() === rawLower) ??
    attr.terms.find((t) => t.slug.toLowerCase() === rawLower) ??
    attr.terms.find((t) => t.name === rawValue) ??
    attr.terms.find((t) => t.slug === rawValue);
  return term?.slug ?? rawLower;
}

/**
 * Resolve the original term display name (e.g. "Large", "Red") from a slug or raw value.
 */
export function resolveTermName(
  attr: WooProduct["attributes"][number],
  slugOrValue: string,
): string {
  if (!slugOrValue) return "";
  const lower = slugOrValue.trim().toLowerCase();
  const term =
    attr.terms.find((t) => t.slug.toLowerCase() === lower) ??
    attr.terms.find((t) => t.name.toLowerCase() === lower) ??
    attr.terms.find((t) => t.slug === slugOrValue) ??
    attr.terms.find((t) => t.name === slugOrValue);
  return term?.name ?? slugOrValue;
}

/**
 * Find the variation from product.variations whose attributes all match
 * the given slug-keyed selection map (attr.name → term slug).
 */
export function findMatchedVariation(
  product: WooProduct,
  selection: Record<string, string>,
): WooProduct["variations"][number] | undefined {
  if (!product.variations || product.variations.length === 0) return undefined;

  const variationAttrs = product.attributes.filter((a) => a.has_variations);
  if (variationAttrs.length === 0) return undefined;

  // Ensure all variation attributes are specified in selection
  const allSelected = variationAttrs.every((attr) =>
    Boolean(selection[attr.name]),
  );
  if (!allSelected) return undefined;

  return product.variations.find((v) => {
    // If variation has no attributes (empty/any), it cannot match specific selection
    if (!v.attributes || v.attributes.length === 0) return false;

    return variationAttrs.every((attr) => {
      const selectedSlug = selection[attr.name];
      if (!selectedSlug) return false;

      const va = v.attributes.find((a) => matchesAttributeName(attr, a.name));
      // In WooCommerce, an empty va.value represents "Any <Attribute>"
      if (!va || !va.value || va.value === "") return true;

      const varValSlug = resolveTermSlug(attr, va.value);
      return varValSlug === selectedSlug;
    });
  });
}

/**
 * Build a slug-keyed selection map (attr.name → term slug) from a variation's
 * own attribute values.
 */
export function buildSelectionFromVariation(
  product: WooProduct,
  variation: WooProduct["variations"][number],
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!variation || !variation.attributes) return result;

  variation.attributes.forEach((va) => {
    const attr = product.attributes.find((a) =>
      matchesAttributeName(a, va.name),
    );
    if (attr && va.value) {
      result[attr.name] = resolveTermSlug(attr, va.value);
    }
  });

  // For any attribute not specified in the variation (or if attributes were empty),
  // pick the first available term from the product attribute
  product.attributes
    .filter((a) => a.has_variations)
    .forEach((attr) => {
      if (!result[attr.name] && attr.terms.length > 0) {
        result[attr.name] = attr.terms[0].slug;
      }
    });

  return result;
}

/**
 * Intelligently resolve the next selection when a user selects an attribute.
 * If the current selection combined with the new term does not form a valid variation,
 * find a valid variation containing the newly selected term and return its selection.
 */
export function resolveNextSelection(
  product: WooProduct,
  currentSelection: Record<string, string>,
  changedAttrName: string,
  newTermSlug: string,
): Record<string, string> {
  const directCandidate = {
    ...currentSelection,
    [changedAttrName]: newTermSlug,
  };
  const directMatch = findMatchedVariation(product, directCandidate);
  if (directMatch) {
    return directCandidate;
  }

  // Find any variation that contains the new term
  const targetAttr = product.attributes.find((a) =>
    matchesAttributeName(a, changedAttrName),
  );
  if (!targetAttr) return directCandidate;

  const compatibleVariation = product.variations.find((v) => {
    if (!v.attributes || v.attributes.length === 0) return false;
    const va = v.attributes.find((a) =>
      matchesAttributeName(targetAttr, a.name),
    );
    if (!va) return false;
    if (!va.value || va.value === "") return true;
    return resolveTermSlug(targetAttr, va.value) === newTermSlug;
  });

  if (compatibleVariation) {
    return buildSelectionFromVariation(product, compatibleVariation);
  }

  return directCandidate;
}
