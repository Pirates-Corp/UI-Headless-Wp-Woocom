import rawPolicies from "@/content/legal/legal-policies.json";
import {
  getLegalPolicies,
  getLegalPolicyBySlug,
  getLegalPolicyHref,
  getLegalTableOfContents,
} from "@/lib/legal/content";
import { LegalPoliciesSchema } from "@/lib/legal/schema";
import { generateMetadata, generateStaticParams } from "@/app/legal/[slug]/page";

describe("legal policy content", () => {
  it("validates the centralized policy source", () => {
    const result = LegalPoliciesSchema.safeParse(rawPolicies);
    expect(result.success).toBe(true);
  });

  it("has unique policy and section identifiers", () => {
    const policies = getLegalPolicies();
    expect(new Set(policies.map((policy) => policy.policyId)).size).toBe(policies.length);
    expect(new Set(policies.map((policy) => policy.slug)).size).toBe(policies.length);

    for (const policy of policies) {
      const sectionIds = policy.sections.map((section) => section.id);
      expect(new Set(sectionIds).size).toBe(sectionIds.length);
      expect(policy.sections.length).toBeGreaterThan(0);
    }
  });

  it("keeps related policy links resolvable", () => {
    for (const policy of getLegalPolicies()) {
      for (const relatedSlug of policy.relatedPolicies) {
        expect(getLegalPolicyBySlug(relatedSlug)).toBeDefined();
        expect(getLegalPolicyHref(relatedSlug)).toBe("/legal/" + relatedSlug);
      }
    }
  });

  it("generates the table of contents from section data", () => {
    const terms = getLegalPolicyBySlug("terms-and-conditions");
    expect(terms).toBeDefined();
    if (!terms) return;

    const toc = getLegalTableOfContents(terms);
    expect(toc[0]).toEqual({ id: "introduction", title: "Introduction" });
    expect(toc).toHaveLength(terms.sections.length);
  });

  it("generates direct route params and draft noindex metadata", async () => {
    expect(generateStaticParams()).toContainEqual({ slug: "privacy-policy" });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "terms-and-conditions" }),
    });
    expect(metadata.alternates?.canonical).toBe("/legal/terms-and-conditions");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});