import Link from "next/link";
import { getLegalPolicies, getLegalPolicyHref } from "@/lib/legal/content";
import { LEGAL_CONTACT } from "@/lib/legal/contact";
import { t } from "@/lib/i18n";

const SHOP_LINKS = [
  { href: "/shop", label: t("footer.links.allProducts") },
  { href: "/shop?on_sale=true", label: t("footer.links.sale") },
  { href: "/shop?orderby=popularity", label: t("footer.links.bestSellers") },
];

const HELP_LINKS = [
  { href: "/account", label: "My Account" },
  { href: "/account/orders", label: "My Orders" },
  { href: "/cart", label: t("footer.links.cart") },
  { href: "/checkout", label: t("footer.links.checkout") },
];

export function Footer() {
  const legalLinks = getLegalPolicies();

  return (
    <footer className="border-t border-border/50 bg-secondary/40 mt-auto">
      <div className="container mx-auto px-4 py-12 md:px-6 md:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5 md:gap-10">
          <div className="col-span-2 md:col-span-1">
            <p className="mb-1 font-heading text-base font-bold tracking-[0.15em] uppercase">
              {t("brand.name")}
            </p>
            <p className="mb-4 text-[9px] tracking-[0.4em] text-muted-foreground uppercase font-medium">
              {t("brand.tagline")}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("brand.description")}
            </p>
          </div>

          <FooterLinkGroup title={t("footer.shopHeading")} links={SHOP_LINKS} />
          <FooterLinkGroup title={t("footer.accountHeading")} links={HELP_LINKS} />
          <FooterLinkGroup
            title="Legal & Policies"
            links={legalLinks.map((policy) => ({
              href: getLegalPolicyHref(policy.slug),
              label: policy.title,
            }))}
          />

          <div>
            <h4 className="mb-4 text-xs font-semibold tracking-[0.2em] uppercase text-foreground">
              {t("footer.contactHeading")}
            </h4>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("footer.contactBody")}
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <a href={"mailto:" + LEGAL_CONTACT.email} className="block break-all text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {LEGAL_CONTACT.email}
              </a>
              <a href={"tel:" + LEGAL_CONTACT.whatsappPhone.replace(/\s/g, "")} className="block text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {LEGAL_CONTACT.whatsappPhone}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border/50">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-4 sm:flex-row md:px-6">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {t("brand.name")}. {t("brand.copyright")}
          </p>
          <p className="text-xs text-muted-foreground">{t("brand.fineLine")}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLinkGroup({
  title,
  links,
}: {
  title: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <div>
      <h4 className="mb-4 text-xs font-semibold tracking-[0.2em] uppercase text-foreground">
        {title}
      </h4>
      <ul className="space-y-3">
        {links.map(({ href, label }) => (
          <li key={label}>
            <Link
              href={href}
              className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
