import Link from "next/link";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import type { LegalBlock, LegalPolicy } from "@/lib/legal/schema";
import {
  getLegalPolicies,
  getLegalPolicyBySlug,
  getLegalPolicyHref,
  getLegalTableOfContents,
} from "@/lib/legal/content";
import { LEGAL_CONTACT } from "@/lib/legal/contact";

function PolicyNav({ currentSlug }: { currentSlug?: string }) {
  return <nav aria-label="Legal and policies" className="w-full min-w-0 border-b border-border/60">
    <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max min-w-full gap-1 py-2">
        {getLegalPolicies().map((policy) => {
          const active = policy.slug === currentSlug;
          return <Link key={policy.slug} href={getLegalPolicyHref(policy.slug)} aria-current={active ? "page" : undefined}
            className={["shrink-0 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent hover:text-foreground"].join(" ")}>
            {policy.title}
          </Link>;
        })}
      </div>
    </div>
  </nav>;
}
function TocLinks({ policy }: { policy: LegalPolicy }) {
  return <ul className="space-y-1">{getLegalTableOfContents(policy).map((section) =>
    <li key={section.id}><a href={"#" + section.id}
      className="block rounded-md px-3 py-2 text-sm leading-snug text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {section.title}
    </a></li>
  )}</ul>;
}

function TableOfContents({ policy }: { policy: LegalPolicy }) {
  return <>
    <aside className="hidden lg:block lg:sticky lg:top-24" aria-label="On this page">
      <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">On this page</p>
      <TocLinks policy={policy} />
    </aside>
    <details className="rounded-lg border border-border/60 bg-background lg:hidden">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex items-center justify-between">On this page <span aria-hidden="true" className="text-muted-foreground">+</span></span>
      </summary>
      <div className="border-t border-border/60 px-2 py-2"><TocLinks policy={policy} /></div>
    </details>
  </>;
}

function renderBlock(block: LegalBlock, index: number) {
  if (block.type === "list") {
    const List = block.ordered ? "ol" : "ul";
    return <List key={block.type + "-" + index}
      className={"space-y-2 pl-5 text-muted-foreground " + (block.ordered ? "list-decimal" : "list-disc")}>
      {block.items.map((item) => <li key={item} className="pl-1 leading-7">{item}</li>)}
    </List>;
  }
  return <p key={block.type + "-" + index} className="leading-7 text-muted-foreground">{block.text}</p>;
}

function ContactCard() {
  return <section className="rounded-xl border border-border/60 bg-secondary/30 p-5 sm:p-6" aria-labelledby="legal-contact-heading">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold-muted)]">General questions</p>
    <h2 id="legal-contact-heading" className="mt-2 font-heading text-xl font-bold">Need help with a policy?</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">
      These are development-provided contact details for general questions. They are not a statement of legal-entity, registered-office, or statutory grievance-officer status.
    </p>
    <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--gold-muted)]" aria-hidden="true" />
        <address className="not-italic text-muted-foreground">
          <span className="font-medium text-foreground">{LEGAL_CONTACT.brand}</span>
          {LEGAL_CONTACT.address.map((line) => <span key={line} className="block">{line}</span>)}
        </address>
      </div>
      <div className="space-y-2">
        <a href={"mailto:" + LEGAL_CONTACT.email} className="flex items-center gap-2 break-all text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Mail className="size-4 shrink-0 text-[var(--gold-muted)]" aria-hidden="true" />{LEGAL_CONTACT.email}</a>
        <a href={"tel:" + LEGAL_CONTACT.phone.replace(/\s/g, "")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Phone className="size-4 shrink-0 text-[var(--gold-muted)]" aria-hidden="true" />{LEGAL_CONTACT.phone}</a>
        <a href={"tel:" + LEGAL_CONTACT.whatsappPhone.replace(/\s/g, "")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Phone className="size-4 shrink-0 text-[var(--gold-muted)]" aria-hidden="true" />{LEGAL_CONTACT.whatsappPhone}</a>
      </div>
    </div>
  </section>;
}

function RelatedPolicies({ policy }: { policy: LegalPolicy }) {
  const related = policy.relatedPolicies.map(getLegalPolicyBySlug).filter((item): item is LegalPolicy => Boolean(item));
  if (related.length === 0) return null;
  return <section className="border-t border-border/60 pt-8" aria-labelledby="related-policies-heading">
    <h2 id="related-policies-heading" className="font-heading text-xl font-bold">Related policies</h2>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{related.map((item) =>
      <Link key={item.slug} href={getLegalPolicyHref(item.slug)}
        className="group flex items-center justify-between rounded-lg border border-border/60 bg-background p-4 text-sm transition-colors hover:border-[var(--gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span>{item.title}</span><ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    )}</div>
  </section>;
}

export function LegalPolicyView({ policy }: { policy: LegalPolicy }) {
  return <div className="bg-secondary/20">
    <section className="border-b border-border/60 bg-background">
      <div className="container mx-auto px-4 pb-8 pt-10 md:px-6 md:pb-10 md:pt-14">
        <Link href="/legal" className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Legal &amp; Policies</Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--gold-muted)]">Legal document</p>
        <PolicyNav currentSlug={policy.slug} />
        <h1 className="mt-3 max-w-3xl font-heading text-3xl font-bold tracking-tight sm:text-4xl">{policy.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">{policy.summary}</p>
      </div>
    </section>
    <div className="container mx-auto px-4 md:px-6">
      <div className="py-6 md:py-10">
        <div className="mt-0 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
          <TableOfContents policy={policy} />
          <article className="min-w-0 max-w-3xl space-y-10">
            {policy.sections.map((section) => <section key={section.id} id={section.id} className="scroll-mt-28">
              <h2 className="font-heading text-2xl font-bold tracking-tight">{section.title}</h2>
              <div className="mt-4 space-y-4">{section.blocks.map(renderBlock)}</div>
            </section>)}
            <RelatedPolicies policy={policy} />
            <ContactCard />
          </article>
        </div>
      </div>
    </div>
  </div>;
}

export function LegalHubView() {
  const policies = getLegalPolicies();
  return <div className="bg-secondary/20">
    <section className="border-b border-border/60 bg-background">
      <div className="container mx-auto px-4 pb-10 pt-12 md:px-6 md:pb-14 md:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--gold-muted)]">Legal &amp; Policies</p>
        <h1 className="mt-3 max-w-3xl font-heading text-4xl font-bold tracking-tight">Clear information for every stage of your order.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">Browse the policies that support shopping, checkout, delivery, cancellations, returns, and privacy. Each document is currently marked as development content until client approval.</p>
      </div>
    </section>
    <div className="container mx-auto px-4 py-8 md:px-6 md:py-12">
      <PolicyNav />
      <div className="mt-8 grid gap-4 md:grid-cols-2">{policies.map((policy) =>
        <Link key={policy.slug} href={getLegalPolicyHref(policy.slug)}
          className="group rounded-xl border border-border/60 bg-background p-5 transition-colors hover:border-[var(--gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="font-heading text-2xl font-bold">{policy.title}</h2></div>
            <ArrowRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{policy.summary}</p>
        </Link>
      )}</div>
      <div className="mt-10"><ContactCard /></div>
    </div>
  </div>;
}
