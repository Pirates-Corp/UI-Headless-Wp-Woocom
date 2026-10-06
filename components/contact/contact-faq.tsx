"use client";

import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

export interface FAQItem {
  id: string;
  category: "Products & Art" | "Orders & Delivery" | "Returns & Policies";
  question: string;
  answer: React.ReactNode;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: "faq-products",
    category: "Products & Art",
    question: "What products does Clay Brush Studio create?",
    answer: (
      <p>
        We are a creative studio based in India bringing together traditional art and modern
        technology. Our resident artist creates original acrylic and oil paintings (spiritual
        and decorative works), while our 3D design team creates detailed spiritual idols,
        devotional products, sculptures, and unique home décor.
      </p>
    ),
  },
  {
    id: "faq-custom",
    category: "Products & Art",
    question: "Do you accept custom artwork, painting, or 3D sculpture commissions?",
    answer: (
      <p>
        Yes! We warmly welcome custom requests. Whether you would like a personalized canvas
        painting, a custom-sized spiritual idol, or a bespoke 3D sculpted home décor piece,
        reach out to us via{" "}
        <a
          href="https://wa.me/919787120055?text=Hi%20Clay%20Brush%20Studio%2C%20I%20would%20like%20to%20discuss%20a%20custom%20order"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-brown underline underline-offset-2 hover:opacity-80"
        >
          WhatsApp (+91 97871 20055)
        </a>{" "}
        or email{" "}
        <a
          href="mailto:info@claybrushstudio.com?subject=Custom%20Commission%20Inquiry"
          className="font-medium text-brand-brown underline underline-offset-2 hover:opacity-80"
        >
          info@claybrushstudio.com
        </a>{" "}
        with your ideas, dimensions, or reference photos.
      </p>
    ),
  },
  {
    id: "faq-process",
    category: "Products & Art",
    question: "How are your 3D printed products created and finished?",
    answer: (
      <p>
        Every piece is created in-house across six careful stages: designing, 3D modelling,
        precision printing, surface finishing, hand-painting, and secure packing. This
        ensures that our spiritual idols and decorative sculptures possess both technological
        precision and the warmth of handmade craft.
      </p>
    ),
  },
  {
    id: "faq-shipping",
    category: "Orders & Delivery",
    question: "How long does order processing and delivery take?",
    answer: (
      <p>
        Orders are processed and dispatched within <strong>4 business days</strong> following order
        confirmation and payment. Delivery takes an estimated <strong>4–7 business days</strong> after
        shipment (overall 5–7 business days). Read our full{" "}
        <Link
          href="/legal#shipping"
          className="font-medium text-brand-brown underline underline-offset-2 hover:opacity-80"
        >
          Shipping Policy
        </Link>{" "}
        for further courier details.
      </p>
    ),
  },
  {
    id: "faq-tracking",
    category: "Orders & Delivery",
    question: "How can I track my existing order?",
    answer: (
      <p>
        You can check the live fulfillment and delivery status of any order in your account under{" "}
        <Link
          href="/account/orders"
          className="font-medium text-brand-brown underline underline-offset-2 hover:opacity-80"
        >
          My Orders
        </Link>
        . If you have any delivery questions, you can also message us directly on WhatsApp with your
        order number for personal assistance.
      </p>
    ),
  },
  {
    id: "faq-cancellation",
    category: "Returns & Policies",
    question: "Can I cancel an order after placing it?",
    answer: (
      <p>
        Orders can be cancelled before they have been packed and handed over to our courier partner.
        To request cancellation, please contact us promptly via WhatsApp or email with your Order ID.
        Once an order has been shipped, it cannot be cancelled and must follow our standard return
        procedure. Custom-made artworks cannot be cancelled once work has begun. Read our full{" "}
        <Link
          href="/legal#cancellation"
          className="font-medium text-brand-brown underline underline-offset-2 hover:opacity-80"
        >
          Cancellation Policy
        </Link>
        .
      </p>
    ),
  },
  {
    id: "faq-returns",
    category: "Returns & Policies",
    question: "What is your return and refund policy?",
    answer: (
      <p>
        We offer a <strong>7-day return window</strong> from the delivery date for verified
        manufacturing defects, items damaged in transit, or incorrect products received. Approved
        returns must be unused and in original packaging. Approved refunds are processed to your
        original payment method within 7–10 working days after inspection. For full terms, please see
        our{" "}
        <Link
          href="/legal#returns"
          className="font-medium text-brand-brown underline underline-offset-2 hover:opacity-80"
        >
          Return and Refund Policy
        </Link>
        .
      </p>
    ),
  },
  {
    id: "faq-contact",
    category: "Orders & Delivery",
    question: "What is the quickest way to reach the studio team?",
    answer: (
      <p>
        For the fastest assistance, chat with us directly on{" "}
        <a
          href="https://wa.me/919787120055"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-brown underline underline-offset-2 hover:opacity-80"
        >
          WhatsApp (+91 97871 20055)
        </a>
        . You can also email us at{" "}
        <a
          href="mailto:info@claybrushstudio.com"
          className="font-medium text-brand-brown underline underline-offset-2 hover:opacity-80"
        >
          info@claybrushstudio.com
        </a>{" "}
        or call us directly at +91 97871 20055.
      </p>
    ),
  },
];

export function ContactFAQ() {
  return (
    <section id="faq" className="scroll-mt-24 py-16 md:py-24 border-t border-border/60 bg-secondary/20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-yellow px-3.5 py-1 text-xs font-semibold text-brand-brown border border-brand-brown/15 mb-4">
            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Common Questions</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed">
            Quick answers about our products, shipping timelines, order tracking, and policies
            before you reach out.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <Accordion className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="rounded-xl border border-border/70 bg-card px-5 py-1 transition-all hover:border-brand-brown/30 shadow-xs"
              >
                <AccordionTrigger className="cursor-pointer py-4 text-left font-heading text-base sm:text-lg font-medium text-foreground hover:no-underline group">
                  <span className="flex-1 pr-4">{item.question}</span>
                </AccordionTrigger>
                <AccordionContent keepMounted className="pb-5 pt-1 text-sm sm:text-base leading-relaxed text-muted-foreground border-t border-border/40 mt-1">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
