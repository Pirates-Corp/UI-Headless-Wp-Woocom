# Headless WooCommerce — New Store Setup & Cloning Guide

This guide provides a complete, step-by-step action plan to clone this repository, connect a new WordPress/WooCommerce backend, configure environment variables, customize branding, and launch a new client storefront.

---

## Table of Contents
1. [Phase 1: WordPress & WooCommerce Backend Setup](#phase-1-wordpress--woocommerce-backend-setup)
2. [Phase 2: Repository Cloning & Initialization](#phase-2-repository-cloning--initialization)
3. [Phase 3: Environment Variables Configuration](#phase-3-environment-variables-configuration)
4. [Phase 4: Branding, Theme & Visual Identity](#phase-4-branding-theme--visual-identity)
5. [Phase 5: Homepage & Content Rebuilding](#phase-5-homepage--content-rebuilding)
6. [Phase 6: Third-Party Integrations & Webhooks](#phase-6-third-party-integrations--webhooks)
7. [Phase 7: Deployment & Production Launch](#phase-7-deployment--production-launch)
8. [Launch Checklist](#launch-checklist)

---

## Phase 1: WordPress & WooCommerce Backend Setup

### 1. WordPress Core & WooCommerce Configuration
- Install WordPress on the client's backend host (e.g. `https://headless.clientdomain.com` or `https://api.clientdomain.com`).
- **Permalinks**: Navigate to **Settings → Permalinks**, choose **"Post name"** (`/%postname%/`), and save. *(Required for REST API routing).*
- **WooCommerce General Settings**: Go to **WooCommerce → Settings → General**:
  - Set Base Location / Country.
  - Set Default Store Currency (e.g., **INR `₹`**, **USD `$`**, etc.) and Currency Position.
- **Shipping & Tax**:
  - Set up Shipping Zones, methods, and rates in **WooCommerce → Settings → Shipping**.
  - Configure Tax rates in **WooCommerce → Settings → Tax** (if applicable).

### 2. Generate REST API Credentials
1. Go to **WooCommerce → Settings → Advanced → REST API → Add Key**.
2. **Description**: `Next.js Headless Storefront`.
3. **Permissions**: `Read/Write`.
4. Click **Generate API Key** and copy:
   - `Consumer Key` (`ck_...`)
   - `Consumer Secret` (`cs_...`)

### 3. Install Plugins & MU-Plugins
- **Simple JWT Login Plugin**:
  - Install and activate `Simple JWT Login` from the WordPress plugin directory.
  - In **Simple JWT Login → Auth Codes**, configure your `AUTH_KEY`.
  - In **Simple JWT Login → Users / Registration**, enable registration and authentication endpoints.
  - In **Simple JWT Login → Reset Password**:
    - Check **Allow Reset Password** and **Allow Change Password**.
    - Set **Email Subject**:
      ```text
      Reset your password for {{SITE_NAME}}
      ```
    - Set **Email Body**:
      ```html
      <p>Hello,</p>
      <p>You requested a password reset for your account on {{SITE_NAME}}.</p>
      <p><a href="https://www.clientdomain.com/reset-password?email={{EMAIL}}&code={{CODE}}">Click here to reset your password</a></p>
      <p>If the link above does not work, copy and paste this URL into your browser:</p>
      <p>https://www.clientdomain.com/reset-password?email={{EMAIL}}&code={{CODE}}</p>
      <p>If you did not request this, you can safely ignore this email.</p>
      ```
- **Copy MU-Plugins**:
  - Copy the files from `wp-content/mu-plugins/` in this repository to the client's WordPress `wp-content/mu-plugins/` folder:
    - `custom-cart-endpoint.php` *(Handles persistent cart sync and cross-method OAuth linking)*
    - `custom-address-book-endpoint.php` *(Multi-address book REST endpoints)*
    - `custom-shipping-endpoint.php` *(Shiprocket / custom tracking webhook integration)*
    - `custom-email-links.php` *(Rewrites customer-facing WooCommerce email links to the Next.js storefront)*
    - `templates/emails/` *(MU-plugin email template overrides for new account notifications)*
- **Set Configuration Constants in `wp-config.php`**:
  ```php
  // Cart authentication secret for internal REST endpoints
  define('MYAPP_CART_AUTH_KEY', 'your_secure_random_key_here');

  // Next.js storefront URL for transactional email link rewriting
  define('MYAPP_STOREFRONT_URL', 'https://www.clientdomain.com');
  ```

---

## Phase 2: Repository Cloning & Initialization

### 1. Clone & Install Dependencies
```bash
# Clone the repository into a new project directory
git clone <your-repo-url> client-storefront
cd client-storefront

# Install project dependencies
pnpm install # or npm install
```

### 2. Reset Git History (For Clean Client Repository)
```bash
# Remove existing git history
rm -rf .git

# Initialize fresh repository
git init
git add .
git commit -m "feat: initial commit for client store"
git branch -M main
git remote add origin <client-github-repo-url>
git push -u origin main
```

---

## Phase 3: Environment Variables Configuration

Create a `.env.local` file in the root directory using the template below:

```env
# ─── WordPress & WooCommerce ──────────────────────────────────────────────
NEXT_PUBLIC_SITE_URL=https://www.clientdomain.com
NEXT_PUBLIC_WOOCOMMERCE_PROTCOL=https
NEXT_PUBLIC_WOOCOMMERCE_HOST=headless.clientdomain.com
WC_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WC_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ─── Authentication & Persistent Cart ─────────────────────────────────────
AUTH_KEY=your_simple_jwt_login_key
JWT_ENDPOINT=simple-jwt-login/v1/
MYAPP_CART_AUTH_KEY=your_secure_random_key_here

# ─── Stripe Payment Gateway ───────────────────────────────────────────────
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ─── Razorpay Payment Gateway (Optional / India) ──────────────────────────
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# ─── Google OAuth ────────────────────────────────────────────────────────
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com

# ─── Analytics & Tracking ────────────────────────────────────────────────
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX

# ─── Shipping & Logistics (Shiprocket) ───────────────────────────────────
SHIPROCKET_WEBHOOK_SECRET=your_shiprocket_webhook_secret
```

---

## Phase 4: Branding, Theme & Visual Identity

### 1. Color Palette & Design Tokens
Edit `app/globals.css` to update the CSS theme variables for Light and Dark modes:
- `--primary`: Brand accent/primary color (HSL format)
- `--secondary`, `--accent`, `--card`, `--background`
- `--radius`: Button and card border radiuses

### 2. Fonts & Typography
- Edit `app/layout.tsx` to configure Google Fonts matching the brand:
  ```tsx
  import { Inter, Outfit, Plus_Jakarta_Sans } from "next/font/google";
  ```

### 3. Logos, Icons & Favicons
- Replace static media in `public/`:
  - `public/favicon.ico`
  - `public/logo.svg` / `public/logo.png`
  - `public/og-image.png` (Social share preview image)
- Update Brand Logo & Navigation in:
  - `components/header/header.tsx`
  - `components/footer/footer.tsx`
- Update metadata & SEO title templates in:
  - `app/layout.tsx` (Title, description, OpenGraph metadata)
  - `app/manifest.json` (PWA name, theme color, icons)
  - `app/robots.ts` & `app/sitemap.ts`

---

## Phase 5: Homepage & Content Rebuilding

### 1. Rebuild Homepage (`app/page.tsx`)
Customize the following components/sections to fit the new store niche:
- **Hero Section**: Headline, subheadline, promotional banner, Call-To-Action (CTA) buttons.
- **Featured Categories**: Link to the client's WooCommerce category slugs.
- **Featured / Best Seller Products**: Set up queries for featured product collections.
- **Brand Value Props / Trust Badges**: Free Shipping thresholds, Cash on Delivery, Easy Returns.
- **Testimonials & Brand Story**: Customer reviews and brand mission.

### 2. Content & Policy Pages
Update content and contact details in:
- `app/about/page.tsx`
- `app/contact/page.tsx`
- `app/privacy-policy/page.tsx`
- `app/terms-of-service/page.tsx`
- `app/refund-returns/page.tsx`
- `app/shipping-policy/page.tsx`

---

## Phase 6: Third-Party Integrations & Webhooks

### 1. Google Cloud OAuth 2.0 Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**.
2. Create an **OAuth 2.0 Client ID for Web Application**.
3. Under **Authorized JavaScript Origins**, add:
   - `http://localhost:3000`
   - `https://www.clientdomain.com`
4. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000`
   - `https://www.clientdomain.com`
5. Copy the Client ID into `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

### 2. Payment Gateway Webhooks
- **Stripe**:
  - In Stripe Dashboard → **Developers → Webhooks → Add endpoint**:
  - Endpoint URL: `https://www.clientdomain.com/api/webhooks/stripe`
  - Events to send: `checkout.session.completed`
  - Copy Signing Secret to `STRIPE_WEBHOOK_SECRET`.
- **Razorpay**:
  - In Razorpay Dashboard → **Settings → Webhooks → Add new webhook**:
  - Webhook URL: `https://www.clientdomain.com/api/webhooks/razorpay`
  - Secret: Set your custom secret in `RAZORPAY_WEBHOOK_SECRET`.
  - Events: `payment.captured`, `order.paid`.

---

## Phase 7: Deployment & Production Launch

### 1. Deploy to Vercel
1. Push your repository to GitHub / GitLab / Bitbucket.
2. Log in to [Vercel](https://vercel.com/) and click **Add New Project**.
3. Import the client's repository.
4. In **Environment Variables**, paste all keys from `.env.local`:
   > **Note for `NEXT_PUBLIC_*` variables**: When adding variables starting with `NEXT_PUBLIC_` (such as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`), select **Type: Config** (not Secret).
5. Click **Deploy**.

### 2. Domain & DNS Setup
1. In Vercel Project Settings → **Domains**, add the custom domain (e.g. `clientdomain.com` and `www.clientdomain.com`).
2. Add the required `CNAME` or `A` records in your DNS provider (Cloudflare, GoDaddy, Namecheap, etc.).
3. Verify SSL certificate generation on Vercel.

---

## Launch Checklist

- [ ] **WordPress REST API**: Testing `/wp-json/wc/v3/products` returns client products.
- [ ] **Product Catalog**: Products, variable products, and categories render correctly.
- [ ] **Currency & Pricing**: Correct currency symbol (e.g. `₹` INR) and decimals show in catalog, cart, and checkout.
- [ ] **Cart & Checkout**: Adding to cart, coupon application, and shipping selection work seamlessly.
- [ ] **Payment Gateways**: Test transactions complete successfully via Stripe / Razorpay / COD.
- [ ] **Order Synchronization**: Orders appear in WooCommerce dashboard with status `processing`/`completed`.
- [ ] **Customer Authentication**: Email/Password signup & Google Sign-In log in users properly.
- [ ] **Customer Orders Page**: Customer order history lists past orders with tracking information.
- [ ] **Mobile Responsiveness**: Checked across mobile, tablet, and desktop viewports.
- [ ] **SEO & Metadata**: Favicon, OpenGraph social previews, title tags, and robots.txt verified.
