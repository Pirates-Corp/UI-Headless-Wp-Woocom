import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCategoryBySlug } from "@/lib/woocommerce/api";
import { t } from "@/lib/i18n";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: t("shop.title") };
  return {
    title: `${category.name} | ${t("brand.name")}`,
    description: category.description?.replace(/<[^>]*>?/gm, "") || t("shop.description"),
  };
}

/**
 * Category archives use the same authoritative taxonomy and Shop query path.
 * The redirect keeps one product grid, filter model, and pagination system.
 */
export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const incoming = await searchParams;
  const query = new URLSearchParams();
  Object.entries(incoming).forEach(([key, value]) => {
    if (key === "category" || value === undefined) return;
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else query.set(key, value);
  });
  query.set("category", category.slug);
  redirect(`/shop?${query.toString()}`);
}