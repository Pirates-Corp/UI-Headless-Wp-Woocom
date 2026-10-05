import rawPolicies from "@/content/legal/legal-policies.json";
import {
  LegalPoliciesSchema,
  type LegalPolicy,
  type LegalSection,
} from "@/lib/legal/schema";

const parsedPolicies = LegalPoliciesSchema.parse(rawPolicies);

export const LEGAL_BASE_PATH = "/legal";

export const SLUG_TO_ANCHOR: Record<string, string> = {
  "terms-and-conditions": "terms",
  "privacy-policy": "privacy",
  "shipping-policy": "shipping",
  "cancellation-policy": "cancellation",
  "returns-refunds": "returns",
};

export const ANCHOR_TO_SLUG: Record<string, string> = {
  terms: "terms-and-conditions",
  privacy: "privacy-policy",
  shipping: "shipping-policy",
  cancellation: "cancellation-policy",
  returns: "returns-refunds",
};

export function getLegalPolicies(): readonly LegalPolicy[] {
  return parsedPolicies;
}

export function getLegalPolicyBySlug(slug: string): LegalPolicy | undefined {
  return parsedPolicies.find((policy) => policy.slug === slug);
}

export function getLegalPolicyHref(slug: string): string {
  return `${LEGAL_BASE_PATH}/${slug}`;
}

export function getLegalAnchorHref(slug: string): string {
  const anchor = SLUG_TO_ANCHOR[slug];
  return anchor ? `${LEGAL_BASE_PATH}#${anchor}` : `${LEGAL_BASE_PATH}/${slug}`;
}

export function getLegalTableOfContents(
  policy: LegalPolicy
): Pick<LegalSection, "id" | "title">[] {
  return policy.sections.map(({ id, title }) => ({ id, title }));
}