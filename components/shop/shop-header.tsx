import { t } from "@/lib/i18n";
import type { WooCategory } from "@/lib/woocommerce/types";
import { decodeHtml } from "@/lib/utils/format";

interface ShopHeaderProps {
  onSale: boolean;
  category?: WooCategory | null;
}

export function ShopHeader({ onSale, category }: ShopHeaderProps) {
  const title = onSale
    ? t("shop.onSale")
    : category?.name
    ? decodeHtml(category.name)
    : t("shop.allFragrances");

  return (
    <div className="mb-8 md:mb-10">
      <p className="text-xs tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-1">
        {t("shop.collection")}
      </p>
      <h1 className="text-3xl md:text-4xl font-heading font-bold">
        {title}
      </h1>
      {category?.description ? (
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          {category.description.replace(/<[^>]*>?/gm, "")}
        </p>
      ) : null}
    </div>
  );
}
