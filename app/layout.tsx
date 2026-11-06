import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { CartStoreInitializer } from "@/components/cart-store-initializer";
import { AuthStoreInitializer } from "@/components/auth/auth-store-initializer";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { WhatsAppFloatingButton } from "@/components/whatsapp-floating-button";
import { Toaster } from "@/components/ui/sonner";
import GoogleTagManagerLoader from "@/components/analytics/google-tag-manager";
import { WebVitals } from "@/components/analytics/web-vitals";
import { JsonLdScript } from "@/components/analytics/json-ld-script";
import { getCategories } from "@/lib/woocommerce/api";
import { t } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const META_PIXEL_ID = "2026060125425781";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  ),
  title: {
    default: t('brand.name'),
    template: "%s | " + t('brand.name'),
  },
  description:
    t('brand.description'),
  icons: {
    icon: [
      {
        url: "/assets/brand/favicon.svg",
        type: "image/svg+xml",
      },
    ],
    shortcut: "/assets/brand/favicon.svg",
    apple: "/assets/brand/favicon.svg",
  },
  openGraph: {
    type: "website",
    siteName: t('brand.name'),
    locale: "en_US",
    title: {
      default: t('brand.name') + " — " + t('brand.tagline'),
      template: "%s | " + t('brand.name'),
    },
    description:
      t('brand.description')
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const categories = await getCategories({ hide_empty: false })
    .then((cats) => cats.filter((c) => c.slug !== "uncategorized"))
    .catch(() => []);

  return (
    <html
      lang={t('lang')}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" type="image/svg+xml" href="/assets/brand/favicon.svg" />
        <link rel="apple-touch-icon" href="/assets/brand/favicon.svg" />
        {process.env.NEXT_PUBLIC_GTM_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,l){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});})(window,'dataLayer');`,
            }}
          />
        )}
        {/* Meta Pixel Code */}
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`,
          }}
        />
        {/* End Meta Pixel Code */}
        <GoogleTagManagerLoader />
        <WebVitals />
        <JsonLdScript
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: t('brand.name'),
            url: process.env.NEXT_PUBLIC_SITE_URL ?? "",
            description: t('brand.description'),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            alt=""
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          />
        </noscript>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          forcedTheme="light"
          disableTransitionOnChange
        >
          <CartStoreInitializer />
          <AuthStoreInitializer />
          <Header initialCategories={categories} />
          <main className="flex-1">{children}</main>
          <Footer />
          <WhatsAppFloatingButton />
          <Toaster theme="light" />
        </ThemeProvider>
      </body>
    </html>
  );
}
