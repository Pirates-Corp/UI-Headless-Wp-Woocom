import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { LEGAL_CONTACT } from "@/lib/legal/contact";
import { t } from "@/lib/i18n";
import { getWhatsAppChatUrl } from "@/lib/utils/whatsapp";

// Social Media Icons
function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.372-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982 1-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.89-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.436 9.884-9.889 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.89c0 2.096.547 4.141 1.588 5.945L.057 24l6.304-1.654a11.875 11.875 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.89a11.821 11.821 0 00-3.478-8.416A11.815 11.815 0 0012.05 0" />
    </svg>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function YouTubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

interface SocialLinkItem {
  readonly name: string;
  readonly href?: string;
  readonly icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

/**
 * Configurable social links. When actual production URLs are provided by the client,
 * set the `href` field for the respective platform (e.g. "https://instagram.com/...").
 * Unset/undefined links render safely as accessible placeholders without navigating to broken destinations.
 */
const SOCIAL_LINKS: readonly SocialLinkItem[] = [
  {
    name: "WhatsApp",
    href: getWhatsAppChatUrl(),
    icon: WhatsAppIcon,
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/claybrushstudio/?hl=en#",
    icon: InstagramIcon,
  },
  {
    name: "Facebook",
    href: undefined, // Replace with production URL when ready
    icon: FacebookIcon,
  },
  {
    name: "YouTube",
    href: "https://youtube.com/@claybrushstudio?si=SW1ni6usbz5YdGSR",
    icon: YouTubeIcon,
  },
];

// Preserved Shop routes
const SHOP_LINKS = [
  { href: "/shop", label: t("footer.links.allProducts") },
  { href: "/shop?on_sale=true", label: t("footer.links.sale") },
  { href: "/shop?orderby=popularity", label: t("footer.links.bestSellers") },
  { href: "/cart", label: t("footer.links.cart") },
  { href: "/checkout", label: t("footer.links.checkout") },
] as const;

// Figma-aligned Legal links pointing to canonical /legal anchors
const LEGAL_LINKS = [
  { href: "/legal#terms", label: "Terms of Service" },
  { href: "/legal#privacy", label: "Privacy Policy" },
  { href: "/legal#cancellation", label: "Cancellation Policy" },
] as const;

// Figma-aligned Support links + preserved Account routes
const SUPPORT_LINKS = [
  { href: "/legal#shipping", label: "Shipping Policy" },
  { href: "/legal#returns", label: "Returns & Refunds" },
  { href: "/#faq", label: "FAQ" },
  { href: "/account", label: "My Account" },
  { href: "/account/orders", label: "My Orders" },
] as const;

export function Footer() {
  return (
    <footer className="mt-auto bg-brand-brown text-brand-yellow">
      <div className="container mx-auto px-4 py-12 md:px-6 md:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 lg:gap-8">
          {/* Brand Presentation */}
          <div className="sm:col-span-2 md:col-span-3 lg:col-span-3">
            <h3 className="font-heading text-xl md:text-2xl font-normal tracking-[0.1em] uppercase text-brand-yellow">
              CLAY BRUSH STUDIO
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-brand-yellow/80 max-w-sm">
              Crafting premium 3D printable digital art and conversion services for
              discerning collectors and creators.
            </p>
          </div>

          {/* Shop Column (Preserving existing ecommerce navigation) */}
          <div className="lg:col-span-2">
            <FooterColumn title="Shop" links={SHOP_LINKS} />
          </div>

          {/* Legal Column (Figma visual hierarchy) */}
          <div className="lg:col-span-2">
            <FooterColumn title="Legal" links={LEGAL_LINKS} />
          </div>

          {/* Support Column (Figma visual hierarchy) */}
          <div className="lg:col-span-2">
            <FooterColumn title="Support" links={SUPPORT_LINKS} />
          </div>

          {/* Contact Column (Figma visual hierarchy + canonical project contact data) */}
          <div className="sm:col-span-2 md:col-span-2 lg:col-span-3">
            <h4 className="mb-4 text-xs font-semibold tracking-[0.2em] uppercase text-brand-yellow">
              Contact
            </h4>
            <div className="space-y-3">
              {/* Phone */}
              <div className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-brand-yellow/70" aria-hidden="true" />
                <a
                  href={`tel:${LEGAL_CONTACT.phone.replace(/\s/g, "")}`}
                  className="text-sm text-brand-yellow/80 hover:text-brand-yellow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow rounded-sm"
                >
                  {LEGAL_CONTACT.phone}
                </a>
              </div>

              {/* Email */}
              <div className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0 text-brand-yellow/70" aria-hidden="true" />
                <a
                  href={`mailto:${LEGAL_CONTACT.email}`}
                  className="text-sm text-brand-yellow/80 hover:text-brand-yellow transition-colors break-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow rounded-sm"
                >
                  {LEGAL_CONTACT.email}
                </a>
              </div>

              {/* Address */}
              <div className="flex items-start gap-2.5">
                <MapPin className="size-4 shrink-0 text-brand-yellow/70 mt-1" aria-hidden="true" />
                <address className="not-italic text-sm text-brand-yellow/80 leading-relaxed">
                  {Array.isArray(LEGAL_CONTACT.address) ? (
                    LEGAL_CONTACT.address.map((line, idx) => (
                      <span key={idx} className="block">
                        {line}
                      </span>
                    ))
                  ) : (
                    <span>{LEGAL_CONTACT.address}</span>
                  )}
                </address>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Divider & Bottom Area */}
      <div className="border-t border-brand-yellow/15">
        <div className="container mx-auto flex flex-col-reverse items-center justify-between gap-4 px-4 py-6 sm:flex-row md:px-6">
          <p className="text-xs text-brand-yellow/70">
            &copy; {new Date().getFullYear()} Clay Brush Studio. All rights reserved.
          </p>

          {/* Social Icons (Future-Ready) */}
          <div className="flex items-center gap-4">
            {SOCIAL_LINKS.map((item) =>
              item.href ? (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.name}
                  className="text-brand-yellow/80 hover:text-brand-yellow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow rounded-full p-1"
                >
                  <item.icon className="size-5" aria-hidden="true" />
                </a>
              ) : (
                <span
                  key={item.name}
                  role="link"
                  aria-disabled="true"
                  aria-label={`${item.name} (Coming soon)`}
                  tabIndex={0}
                  className="text-brand-yellow/60 hover:text-brand-yellow/80 transition-colors cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow rounded-full p-1"
                >
                  <item.icon className="size-5" aria-hidden="true" />
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <div>
      <h4 className="mb-4 text-xs font-semibold tracking-[0.2em] uppercase text-brand-yellow">
        {title}
      </h4>
      <ul className="space-y-3">
        {links.map(({ href, label }) => (
          <li key={label}>
            <Link
              href={href}
              className="text-sm text-brand-yellow/75 transition-colors duration-200 hover:text-brand-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow rounded-sm"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
