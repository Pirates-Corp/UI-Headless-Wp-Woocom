import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { STORE_CONFIG } from "@/store.config";
import { getWhatsAppChatUrl } from "@/lib/utils/whatsapp";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ContactCopyButton } from "@/components/contact/contact-copy-button";
import { InstagramIcon, YouTubeIcon, WhatsAppIcon } from "@/components/contact/contact-icons";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with Clay Brush Studio. Direct WhatsApp, phone, email, and studio address in Tamil Nadu, India, plus answers to common order and custom design questions.",
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    url: "/contact",
    title: "Contact Clay Brush Studio",
    description:
      "Direct WhatsApp, phone, email, and studio address for Clay Brush Studio. Connect with our artists regarding paintings, 3D sculptures, and orders.",
  },
};

export default function ContactPage() {
  const whatsappUrl = getWhatsAppChatUrl(
    "Hello Clay Brush Studio, I would like to inquire about your products and services."
  );
  const customOrderWhatsappUrl = getWhatsAppChatUrl(
    "Hello Clay Brush Studio, I would like to discuss a custom painting or 3D design commission."
  );

  return (
    <>
      {/* 1. Hero Section */}
      <section className="border-b border-brand-brown/15 bg-brand-yellow/60">
        <div className="container mx-auto px-4 py-14 text-center md:px-6 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--gold-muted)]">
            Contact &amp; Support
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-balance font-heading text-4xl font-bold tracking-tight text-brand-brown sm:text-5xl">
            Get in Touch with Our Studio
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-base sm:text-lg leading-relaxed text-brand-brown/85">
            Whether you have a question about an order, want to inquire about custom artwork or
            3D sculptures, or simply want to connect with our studio, we are here to help.
          </p>
        </div>
      </section>

      {/* 2. Direct Contact Channels */}
      <section className="container mx-auto px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Direct Communication Channels
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground">
              Choose the method that works best for you. We typically respond as quickly as possible.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* WhatsApp Card - Highlighted */}
            <article className="relative flex flex-col justify-between rounded-2xl border-2 border-brand-brown/30 bg-card p-6 sm:p-8 shadow-sm transition-all hover:border-brand-brown hover:shadow-md">
              <div className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-brand-brown px-3 py-0.5 text-[11px] font-semibold tracking-wide text-brand-yellow">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                <span>Fastest Response</span>
              </div>

              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-yellow text-brand-brown border border-brand-brown/15">
                  <WhatsAppIcon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-heading text-xl font-bold text-foreground">
                  Chat on WhatsApp
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Ideal for quick questions, stock inquiries, sharing reference photos, or custom
                  order discussions.
                </p>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-secondary/50 px-3.5 py-2">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {STORE_CONFIG.phone}
                  </span>
                  <ContactCopyButton
                    textToCopy={STORE_CONFIG.whatsapp.phoneNumber}
                    label="WhatsApp number"
                  />
                </div>
              </div>

              <div className="mt-6 pt-2">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ size: "default" }),
                    "w-full justify-center gap-2 bg-brand-brown text-brand-yellow hover:bg-brand-brown/90 shadow-none font-medium"
                  )}
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  <span>Open WhatsApp</span>
                </a>
              </div>
            </article>

            {/* Email Card */}
            <article className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-sm transition-all hover:border-brand-brown/30 hover:shadow-md">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-brand-brown border border-border/60">
                  <Mail className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-heading text-xl font-bold text-foreground">
                  Email Support
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Best for detailed order references, formal inquiries, or longer design
                  collaborations.
                </p>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-secondary/50 px-3.5 py-2">
                  <span className="truncate font-mono text-xs sm:text-sm font-medium text-foreground pr-2">
                    {STORE_CONFIG.email}
                  </span>
                  <ContactCopyButton
                    textToCopy={STORE_CONFIG.email}
                    label="Email address"
                  />
                </div>
              </div>

              <div className="mt-6 pt-2">
                <a
                  href={`mailto:${STORE_CONFIG.email}?subject=Inquiry%20-%20Clay%20Brush%20Studio`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "w-full justify-center gap-2 hover:border-brand-brown hover:bg-brand-yellow/30 hover:text-brand-brown font-medium"
                  )}
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <span>Send an Email</span>
                </a>
              </div>
            </article>

            {/* Phone Card */}
            <article className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-sm transition-all hover:border-brand-brown/30 hover:shadow-md">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-brand-brown border border-border/60">
                  <Phone className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-heading text-xl font-bold text-foreground">
                  Call the Studio
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Direct telephone contact for immediate assistance with existing orders or store
                  questions.
                </p>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-secondary/50 px-3.5 py-2">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {STORE_CONFIG.phone}
                  </span>
                  <ContactCopyButton
                    textToCopy={STORE_CONFIG.phone}
                    label="Phone number"
                  />
                </div>
              </div>

              <div className="mt-6 pt-2">
                <a
                  href={`tel:${STORE_CONFIG.phone.replace(/\s/g, "")}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "w-full justify-center gap-2 hover:border-brand-brown hover:bg-brand-yellow/30 hover:text-brand-brown font-medium"
                  )}
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  <span>Call Studio</span>
                </a>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 3. Support Pathways (Self-Serve Intent Routing) */}
      <section className="border-y border-border/50 bg-secondary/20 py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-10">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                How Can We Help You Today?
              </h2>
              <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                Select your inquiry type to get connected or find self-serve resources faster.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Order Tracking */}
              <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-6 shadow-xs">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-yellow/80 text-brand-brown">
                    <Package className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-heading text-lg font-bold text-foreground">
                    Order Tracking &amp; Status
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Check fulfillment milestones, delivery tracking, and purchase history directly
                    in your account.
                  </p>
                </div>
                <div className="mt-6 pt-2">
                  <Link
                    href="/account/orders"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-brown hover:underline underline-offset-4"
                  >
                    <span>View My Orders</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              {/* Returns & Cancellations */}
              <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-6 shadow-xs">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-yellow/80 text-brand-brown">
                    <RotateCcw className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-heading text-lg font-bold text-foreground">
                    Returns &amp; Cancellations
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Review our 7-day return guidelines, defect inspection rules, or request a
                    cancellation before dispatch.
                  </p>
                </div>
                <div className="mt-6 pt-2">
                  <Link
                    href="/legal#returns"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-brown hover:underline underline-offset-4"
                  >
                    <span>Review Return Policies</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              {/* Custom Art & 3D Design */}
              <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-6 shadow-xs sm:col-span-2 lg:col-span-1">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-yellow/80 text-brand-brown">
                    <Sparkles className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-heading text-lg font-bold text-foreground">
                    Custom Commissions
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Discuss custom canvas paintings, personalized spiritual idols, or special
                    sculpture dimensions with the artist.
                  </p>
                </div>
                <div className="mt-6 pt-2">
                  <a
                    href={customOrderWhatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-brown hover:underline underline-offset-4"
                  >
                    <span>Discuss on WhatsApp</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Studio Location & Social Media Showcase */}
      <section className="container mx-auto px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Physical Location Card */}
            <article className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8 md:p-10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-yellow text-brand-brown border border-brand-brown/15">
                    <MapPin className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-heading text-xl font-bold text-foreground">
                      Studio Location
                    </h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      India
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  Clay Brush Studio brings together traditional painting and 3D printing
                  technology in Tamil Nadu, India.
                </p>

                <div className="mt-6 rounded-xl border border-border/60 bg-secondary/30 p-5">
                  <address className="not-italic text-sm sm:text-base leading-relaxed text-foreground">
                    <strong className="block font-semibold text-brand-brown">
                      {STORE_CONFIG.brand}
                    </strong>
                    {STORE_CONFIG.address.map((line) => (
                      <span key={line} className="block text-muted-foreground">
                        {line}
                      </span>
                    ))}
                  </address>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-border/50 pt-4">
                <span className="text-xs text-muted-foreground">Postal Address</span>
                <ContactCopyButton
                  textToCopy={STORE_CONFIG.address.join(", ")}
                  label="Studio address"
                />
              </div>
            </article>

            {/* Social Presence & Creative Process */}
            <article className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8 md:p-10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-yellow text-brand-brown border border-brand-brown/15">
                    <Sparkles className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-heading text-xl font-bold text-foreground">
                      Follow Our Creative Journey
                    </h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      Social Community
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  Follow behind-the-scenes painting sessions, 3D printing timelapses, and preview
                  upcoming idol sculptures on our official channels.
                </p>

                <div className="mt-6 space-y-3">
                  {/* Instagram */}
                  <a
                    href={STORE_CONFIG.social.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/30 p-4 transition-all hover:border-brand-brown hover:bg-brand-yellow/30 group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background text-brand-brown border border-border/60">
                        <InstagramIcon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <span className="block text-sm font-semibold text-foreground group-hover:text-brand-brown transition-colors">
                          Instagram
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          @claybrushstudio • Behind the scenes &amp; artwork drops
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-brand-brown" aria-hidden="true" />
                  </a>

                  {/* YouTube */}
                  <a
                    href={STORE_CONFIG.social.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/30 p-4 transition-all hover:border-brand-brown hover:bg-brand-yellow/30 group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background text-rose-600 border border-border/60">
                        <YouTubeIcon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <span className="block text-sm font-semibold text-foreground group-hover:text-brand-brown transition-colors">
                          YouTube
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          @claybrushstudio • Art process &amp; 3D sculpture timelapses
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-brand-brown" aria-hidden="true" />
                  </a>
                </div>
              </div>

              <div className="mt-6 border-t border-border/50 pt-4 text-xs text-muted-foreground">
                Connect with our community and watch each product come to life.
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 5. Bottom Reassurance Call to Action */}
      <section className="border-t border-brand-brown/15 bg-brand-yellow/60">
        <div className="container mx-auto px-4 py-12 text-center md:px-6 md:py-16">
          <h2 className="font-heading text-2xl font-bold text-brand-brown md:text-3xl">
            Still Have Questions?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm sm:text-base text-brand-brown/85">
            We are always happy to help. Reach out directly and let us know what you need.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3.5">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ size: "default" }),
                "bg-brand-brown text-brand-yellow hover:bg-brand-brown/90 shadow-none gap-2 font-medium"
              )}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              <span>Chat on WhatsApp</span>
            </a>
            <a
              href={`mailto:${STORE_CONFIG.email}?subject=Customer%20Support`}
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "border-brand-brown/30 text-brand-brown hover:bg-brand-yellow hover:border-brand-brown gap-2 font-medium"
              )}
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              <span>Email Support</span>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
