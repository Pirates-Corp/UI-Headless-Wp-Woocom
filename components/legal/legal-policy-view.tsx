import { ChevronRight, Mail, MapPin, Phone, ShieldCheck, FileText, Truck, XCircle, RotateCcw, HelpCircle } from "lucide-react";
import type { LegalBlock } from "@/lib/legal/schema";
import {
  getLegalPolicies,
  SLUG_TO_ANCHOR,
} from "@/lib/legal/content";
import { LEGAL_CONTACT } from "@/lib/legal/contact";

export const LEGAL_NAV_ITEMS = [
  {
    id: "terms",
    label: "Terms & Conditions",
    shortLabel: "Terms",
    slug: "terms-and-conditions",
    icon: FileText,
  },
  {
    id: "privacy",
    label: "Privacy Policy",
    shortLabel: "Privacy",
    slug: "privacy-policy",
    icon: ShieldCheck,
  },
  {
    id: "shipping",
    label: "Shipping Policy",
    shortLabel: "Shipping",
    slug: "shipping-policy",
    icon: Truck,
  },
  {
    id: "cancellation",
    label: "Cancellation Policy",
    shortLabel: "Cancellation",
    slug: "cancellation-policy",
    icon: XCircle,
  },
  {
    id: "returns",
    label: "Return & Refund Policy",
    shortLabel: "Returns & Refunds",
    slug: "returns-refunds",
    icon: RotateCcw,
  },
  {
    id: "contact",
    label: "Contact & Support",
    shortLabel: "Contact",
    slug: "contact",
    icon: HelpCircle,
  },
] as const;

function renderBlock(block: LegalBlock, index: number) {
  if (block.type === "list") {
    const List = block.ordered ? "ol" : "ul";
    return (
      <List
        key={`${block.type}-${index}`}
        className={
          "space-y-2.5 pl-6 text-muted-foreground " +
          (block.ordered ? "list-decimal" : "list-disc")
        }
      >
        {block.items.map((item) => (
          <li key={item} className="pl-1 leading-relaxed">
            {item}
          </li>
        ))}
      </List>
    );
  }
  return (
    <p key={`${block.type}-${index}`} className="leading-relaxed text-muted-foreground">
      {block.text}
    </p>
  );
}

function ContactSection() {
  return (
    <section
      id="contact"
      className="scroll-mt-32 rounded-2xl border border-border/70 bg-card p-6 sm:p-8 md:p-10 shadow-sm"
      aria-labelledby="legal-contact-heading"
    >
      <div className="border-b border-border/60 pb-5 mb-6">
        <span className="inline-flex items-center rounded-full bg-brand-yellow px-3 py-1 text-xs font-semibold text-brand-brown border border-brand-brown/15">
          Support & Inquiries
        </span>
        <h2 id="legal-contact-heading" className="mt-3 font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Need Help With Our Policies?
        </h2>
        <p className="mt-2 text-sm sm:text-base leading-relaxed text-muted-foreground">
          If you have questions regarding your order, shipping status, cancellation, or returns, our studio team is here to assist.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/20 p-5">
          <MapPin className="mt-1 h-5 w-5 shrink-0 text-brand-brown" aria-hidden="true" />
          <address className="not-italic text-sm leading-6 text-muted-foreground">
            <span className="font-semibold text-foreground block">{LEGAL_CONTACT.brand}</span>
            {LEGAL_CONTACT.address.map((line) => (
              <span key={line} className="block">{line}</span>
            ))}
          </address>
        </div>

        <div className="flex flex-col justify-center gap-3 rounded-xl border border-border/60 bg-secondary/20 p-5 text-sm">
          <a
            href={`mailto:${LEGAL_CONTACT.email}`}
            className="flex items-center gap-3 text-muted-foreground hover:text-brand-brown transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Mail className="h-5 w-5 shrink-0 text-brand-brown" aria-hidden="true" />
            <span className="break-all">{LEGAL_CONTACT.email}</span>
          </a>
          <a
            href={`tel:${LEGAL_CONTACT.phone.replace(/\s/g, "")}`}
            className="flex items-center gap-3 text-muted-foreground hover:text-brand-brown transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Phone className="h-5 w-5 shrink-0 text-brand-brown" aria-hidden="true" />
            <span>{LEGAL_CONTACT.phone}</span>
          </a>
          <a
            href={`https://wa.me/${LEGAL_CONTACT.whatsappPhone.replace(/[^0-9]/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-muted-foreground hover:text-brand-brown transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Phone className="h-5 w-5 shrink-0 text-brand-brown" aria-hidden="true" />
            <span>WhatsApp: {LEGAL_CONTACT.whatsappPhone}</span>
          </a>
        </div>
      </div>
    </section>
  );
}

export function LegalSinglePageView() {
  const policies = getLegalPolicies();

  return (
    <div className="min-h-screen bg-secondary/15">
      {/* Header Banner */}
      <section className="border-b border-border/60 bg-background">
        <div className="container mx-auto px-4 pb-8 pt-10 md:px-6 md:pb-12 md:pt-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-yellow/80 px-3.5 py-1 text-xs font-semibold text-brand-brown border border-brand-brown/15">
            <span>Clay Brush Studio</span>
            <span className="text-brand-brown/40">•</span>
            <span>Legal Center</span>
          </div>
          <h1 className="mt-4 font-heading text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Legal &amp; Policies
          </h1>
          <p className="mt-3 max-w-2xl text-base sm:text-lg leading-relaxed text-muted-foreground">
            All official store policies, customer terms, ordering rules, delivery timelines, and returns in one comprehensive, transparent guide.
          </p>
        </div>
      </section>

      {/* Sticky Quick-Jump Navigation for Mobile & Tablet */}
      <div className="sticky top-18 sm:top-20 z-40 lg:hidden border-b border-border/70 bg-background/95 backdrop-blur px-4 py-2.5 shadow-sm">
        <nav
          aria-label="Quick policy navigation"
          className="overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex gap-2 min-w-max">
            {LEGAL_NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="inline-flex items-center rounded-full border border-border/70 bg-secondary/60 px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-brand-brown/40 hover:bg-brand-yellow/70 hover:text-brand-brown focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.shortLabel}
              </a>
            ))}
          </div>
        </nav>
      </div>

      {/* Main Content Area */}
      <main className="container mx-auto px-4 py-8 md:px-6 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)] lg:gap-12">
          {/* Desktop Sticky Table of Contents Sidebar */}
          <aside
            className="hidden lg:block lg:sticky lg:top-28 self-start"
            aria-label="Table of contents"
          >
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
              <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-brown/80 mb-3">
                On This Page
              </p>
              <nav className="space-y-1">
                {LEGAL_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-brand-yellow/60 hover:text-brand-brown focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0 text-brand-brown/70 group-hover:text-brand-brown transition-colors" />
                        <span>{item.label}</span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-brand-brown" />
                    </a>
                  );
                })}
              </nav>

              <div className="mt-6 border-t border-border/60 pt-4 px-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Have an urgent order inquiry? Jump to{" "}
                  <a
                    href="#contact"
                    className="font-medium text-brand-brown underline underline-offset-2 hover:opacity-80"
                  >
                    Contact Support
                  </a>
                  .
                </p>
              </div>
            </div>
          </aside>

          {/* Policy Articles Stream */}
          <div className="min-w-0 space-y-10 sm:space-y-12">
            {policies.map((policy) => {
              const anchor = SLUG_TO_ANCHOR[policy.slug] || policy.slug;

              return (
                <article
                  key={policy.policyId}
                  id={anchor}
                  className="scroll-mt-32 rounded-2xl border border-border/70 bg-card p-6 sm:p-8 md:p-10 shadow-sm transition-shadow hover:shadow-md"
                  aria-labelledby={`heading-${anchor}`}
                >
                  <header className="border-b border-border/60 pb-5 mb-8">
                    <h2
                      id={`heading-${anchor}`}
                      className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground"
                    >
                      {policy.title}
                    </h2>
                    <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-muted-foreground">
                      {policy.summary}
                    </p>
                  </header>

                  <div className="space-y-8">
                    {policy.sections.map((section) => (
                      <section
                        key={section.id}
                        id={`${anchor}-${section.id}`}
                        className="space-y-3"
                      >
                        <h3 className="font-heading text-lg sm:text-xl font-semibold text-foreground">
                          {section.title}
                        </h3>
                        <div className="space-y-3 text-sm sm:text-base">
                          {section.blocks.map(renderBlock)}
                        </div>
                      </section>
                    ))}
                  </div>

                  <footer className="mt-8 border-t border-border/60 pt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Clay Brush Studio Policy</span>
                    <a
                      href="#top"
                      className="hover:text-brand-brown transition-colors underline underline-offset-2"
                    >
                      Back to top ↑
                    </a>
                  </footer>
                </article>
              );
            })}

            {/* Contact Section */}
            <ContactSection />
          </div>
        </div>
      </main>
    </div>
  );
}

// Backwards-compatible components
export function LegalHubView() {
  return <LegalSinglePageView />;
}

export function LegalPolicyView() {
  return <LegalSinglePageView />;
}
