import type { Metadata } from "next";
import { LegalSinglePageView } from "@/components/legal/legal-policy-view";

export const metadata: Metadata = {
  title: "Legal & Policies | Clay Brush Studio",
  description: "Browse the official terms, shipping, cancellation, return, and privacy policies for Clay Brush Studio.",
};

export default function LegalPage() {
  return <LegalSinglePageView />;
}