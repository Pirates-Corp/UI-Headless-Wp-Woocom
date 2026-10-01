import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPolicyView } from "@/components/legal/legal-policy-view";
import {
  getLegalPolicies,
  getLegalPolicyBySlug,
  getLegalPolicyHref,
} from "@/lib/legal/content";

type LegalPolicyPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getLegalPolicies().map((policy) => ({ slug: policy.slug }));
}

export async function generateMetadata(
  { params }: LegalPolicyPageProps
): Promise<Metadata> {
  const { slug } = await params;
  const policy = getLegalPolicyBySlug(slug);

  if (!policy) {
    return {
      title: "Policy not found",
      robots: { index: false, follow: false },
    };
  }

  const isApproved = policy.status === "approved";
  return {
    title: policy.title,
    description: policy.summary,
    alternates: { canonical: getLegalPolicyHref(policy.slug) },
    robots: { index: isApproved, follow: isApproved },
    openGraph: {
      type: "article",
      title: policy.title,
      description: policy.summary,
    },
  };
}

export default async function LegalPolicyPage({ params }: LegalPolicyPageProps) {
  const { slug } = await params;
  const policy = getLegalPolicyBySlug(slug);

  if (!policy) notFound();

  return <LegalPolicyView policy={policy} />;
}