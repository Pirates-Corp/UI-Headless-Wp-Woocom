import { z } from "zod";

const LegalBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().min(1) }),
  z.object({
    type: z.literal("list"),
    items: z.array(z.string().min(1)).min(1),
    ordered: z.boolean().optional(),
  }),
]);

export const LegalSectionSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  blocks: z.array(LegalBlockSchema).min(1),
});

export const LegalPolicySchema = z.object({
  policyId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: z.enum(["draft", "approved"]),
  version: z.string().min(1),
  effectiveDate: z.string().date().nullable(),
  lastUpdated: z.string().date().nullable(),
  summary: z.string().min(1),
  sections: z.array(LegalSectionSchema).min(1),
  relatedPolicies: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
});

export const LegalPoliciesSchema = z.array(LegalPolicySchema).superRefine((policies, ctx) => {
  const policyIds = new Set<string>();
  const slugs = new Set<string>();

  for (const [policyIndex, policy] of policies.entries()) {
    if (policyIds.has(policy.policyId)) {
      ctx.addIssue({ code: "custom", path: [policyIndex, "policyId"], message: "Policy IDs must be unique" });
    }
    if (slugs.has(policy.slug)) {
      ctx.addIssue({ code: "custom", path: [policyIndex, "slug"], message: "Policy slugs must be unique" });
    }
    policyIds.add(policy.policyId);
    slugs.add(policy.slug);

    const sectionIds = new Set<string>();
    for (const [sectionIndex, section] of policy.sections.entries()) {
      if (sectionIds.has(section.id)) {
        ctx.addIssue({
          code: "custom",
          path: [policyIndex, "sections", sectionIndex, "id"],
          message: "Section IDs must be unique within a policy",
        });
      }
      sectionIds.add(section.id);
    }
  }

  for (const [policyIndex, policy] of policies.entries()) {
    for (const [relatedIndex, relatedPolicy] of policy.relatedPolicies.entries()) {
      if (!slugs.has(relatedPolicy)) {
        ctx.addIssue({
          code: "custom",
          path: [policyIndex, "relatedPolicies", relatedIndex],
          message: `Related policy does not exist: ${relatedPolicy}`,
        });
      }
    }
  }
});

export type LegalBlock = z.infer<typeof LegalBlockSchema>;
export type LegalSection = z.infer<typeof LegalSectionSchema>;
export type LegalPolicy = z.infer<typeof LegalPolicySchema>;