import rawPolicies from "@/content/legal/legal-policies.json";
import {
  LegalPoliciesSchema,
  type LegalPolicy,
  type LegalSection,
} from "@/lib/legal/schema";

const parsedPolicies = LegalPoliciesSchema.parse(rawPolicies);

export const LEGAL_BASE_PATH = "/legal";

export function getLegalPolicies(): readonly LegalPolicy[] {
  return parsedPolicies;
}

export function getLegalPolicyBySlug(slug: string): LegalPolicy | undefined {
  return parsedPolicies.find((policy) => policy.slug === slug);
}

export function getLegalPolicyHref(slug: string): string {
  return `${LEGAL_BASE_PATH}/${slug}`;
}

export function getLegalTableOfContents(
  policy: LegalPolicy
): Pick<LegalSection, "id" | "title">[] {
  return policy.sections.map(({ id, title }) => ({ id, title }));
}