import type { Metadata } from "next";
import { HeroSection } from "@/components/home/hero-section";
import { CategoriesSection } from "@/components/home/categories-section";
import { CategoryProductsSection } from "@/components/home/category-products-section";
import { JsonLdScript } from "@/components/analytics/json-ld-script";
import { t } from "@/lib/i18n";
import { AboutTheStudio } from "@/components/home/about-the-studio";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: {
    absolute: "Clay Brush Studio",
  },
  description: t('brand.description'),
  openGraph: {
    title: "Clay Brush Studio",
    description: t('brand.description'),
    type: "website",
    url: "/",
  },
  alternates: {
    canonical: "/",
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: t('brand.name'),
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function HomePage() {
  return (
    <>
      <JsonLdScript data={websiteJsonLd} />
      <HeroSection />
      <CategoriesSection />
      <CategoryProductsSection />
      <AboutTheStudio />
    
    </>
  );
}

