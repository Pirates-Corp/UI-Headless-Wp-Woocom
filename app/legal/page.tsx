import type { Metadata } from "next";
import { LegalHubView } from "@/components/legal/legal-policy-view";

export const metadata: Metadata = {
  title: "Legal & Policies",
  description: "Browse the Round Logics development-stage legal and policy documents.",
  robots: { index: false, follow: false },
};

export default function LegalPage() {
  return <LegalHubView />;
}