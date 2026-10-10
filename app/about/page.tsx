import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Box, Brush, Heart, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Clay Brush Studio is a creative studio based in India, combining traditional art with modern technology to create unique products for your home.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    url: "/about",
    title: "About Clay Brush Studio",
    description:
      "Where art meets technology — original paintings and 3D printed spiritual idols, sculptures and home décor, made with creativity and care.",
  },
};

const CRAFTS = [
  {
    icon: Brush,
    eyebrow: "Paintings",
    text: "My wife is an artist who creates original oil and acrylic paintings. Every painting is created with patience, emotion, and attention to detail. From spiritual artworks to beautiful decorative paintings, each piece reflects her love for traditional and contemporary art.",
  },
  {
    icon: Box,
    eyebrow: "3D Design & Printing",
    text: "I work with 3D design and printing technology, creating detailed spiritual idols, devotional products, decorative pieces, sculptures, and unique home décor. We enjoy transforming ideas and designs into physical products that people can display, use, and cherish.",
  },
] as const;

const PROCESS_STEPS = [
  "Designing",
  "Modelling",
  "Printing",
  "Finishing",
  "Painting",
  "Packing",
] as const;

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-white/10 bg-black text-white">
        <div className="container mx-auto px-4 py-16 text-center md:px-6 md:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
            About Us
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-balance font-heading text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Welcome to Clay Brush Studio
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-8 text-white/90">
            At Clay Brush Studio, we believe that art can bring beauty, meaning, and a special
            feeling into everyday life.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-balance leading-7 text-white/75">
            We are a creative studio based in India, combining traditional art with modern
            technology to create unique products for your home.
          </p>
        </div>
      </section>

      {/* Our journey */}
      <section className="container mx-auto px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-heading text-3xl font-bold tracking-tight md:text-4xl">
            Our journey comes from two different forms of creativity.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {CRAFTS.map(({ icon: Icon, eyebrow, text }) => (
              <article
                key={eyebrow}
                className="rounded-xl border border-border/60 bg-background p-6 sm:p-8"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--gold-light)]/30">
                  <Icon className="h-5 w-5" style={{ color: "var(--gold)" }} aria-hidden="true" />
                </div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold-muted)]">
                  {eyebrow}
                </p>
                <p className="mt-3 leading-7 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Where art meets technology */}
      <section className="border-y border-border/50 bg-secondary/30">
        <div className="container mx-auto px-4 py-16 md:px-6 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Sparkles className="mx-auto h-6 w-6" style={{ color: "var(--gold)" }} aria-hidden="true" />
            <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight md:text-4xl">
              Where Art Meets Technology
            </h2>
            <p className="mt-6 leading-7 text-muted-foreground">
              Our studio brings together the beauty of handmade art and the possibilities of 3D
              printing technology.
            </p>
            <p className="mt-4 leading-7 text-muted-foreground">
              We carefully work on every stage — from designing and modelling to printing,
              finishing, painting, and packing. Our goal is to create products that are not only
              beautiful but also meaningful.
            </p>
          </div>
          <ol className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {PROCESS_STEPS.map((step, index) => (
              <li
                key={step}
                className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-4 text-center"
              >
                <span className="font-heading text-lg font-bold text-[var(--gold-muted)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-medium">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Made with creativity & care */}
      <section className="container mx-auto px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Heart className="mx-auto h-6 w-6" style={{ color: "var(--gold)" }} aria-hidden="true" />
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight md:text-4xl">
            Made With Creativity &amp; Care
          </h2>
          <p className="mt-6 leading-7 text-muted-foreground">
            We pay attention to the small details because we believe they make a big difference.
          </p>
          <p className="mt-4 leading-7 text-muted-foreground">
            Whether it is a painting created with a brush or a sculpture created using 3D printing
            technology, every product is made with creativity, care, and passion.
          </p>
        </div>

        <figure className="mx-auto mt-14 max-w-3xl rounded-xl bg-brand-brown px-6 py-10 text-center sm:px-12">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--gold-light)]">
            Our Mission
          </p>
          <blockquote className="mt-4 text-balance font-heading text-2xl font-medium leading-snug text-brand-yellow md:text-3xl">
            To create beautiful products that bring art, devotion, and happiness into your space.
          </blockquote>
        </figure>
      </section>

      {/* Closing */}
      <section className="border-t border-brand-brown/15 bg-brand-yellow">
        <div className="container mx-auto px-4 py-14 text-center md:px-6">
          <p className="font-heading text-2xl font-bold text-brand-brown md:text-3xl">
            Thank you for visiting Clay Brush Studio
          </p>
          <Link
            href="/shop"
            className={cn(buttonVariants({ size: "default" }), "mt-8 inline-flex gap-2 bg-brand-brown text-brand-yellow hover:bg-brand-brown/90 shadow-none font-medium")}
          >
            Explore the Store <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
