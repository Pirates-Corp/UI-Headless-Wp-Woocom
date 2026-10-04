"use client";

import { useState, useTransition, useEffect, useRef, useCallback, useActionState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useCartStore } from "@/lib/store/cart-store";
import { useBuyNowStore } from "@/lib/store/buy-now-store";
import { useCheckoutStore } from "@/lib/store/checkout-store";
import { useAuthStore } from "@/lib/store/auth-store";
import { selectShippingRate } from "@/lib/actions/cart";
import { checkoutAction } from "@/lib/actions/checkout-submit";
import { getAddressBookAction, getSavedBillingAction } from "@/lib/actions/address";
import { getDefaultCountry } from "@/lib/config/countries";
import { buttonVariants } from "@/components/ui/defaultbutton";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { DeliveryAddressForm } from "@/components/checkout/delivery-address-form";
import { ContactSection } from "@/components/checkout/contact-section";
import { BillingAddressForm } from "@/components/checkout/billing-address-form";
import { ShippingMethodSelector } from "@/components/checkout/shipping-method-selector";
import { PaymentMethodSelector } from "@/components/checkout/payment-method-selector";
import { CheckoutOrderSummary } from "@/components/checkout/checkout-order-summary";
import { MobileCheckoutBar } from "@/components/checkout/mobile-checkout-bar";
import { CouponInput } from "@/components/checkout/coupon-input";
import { useAddressUpdate } from "@/lib/hooks/use-address-update";
import { trackBeginCheckout, trackAddShippingInfo, trackAddPaymentInfo } from "@/lib/utils/gtm-events";
import { cartItemsToEcommerceItems } from "@/lib/utils/gtm-items";
import { t } from "@/lib/i18n";
import type { SavedAddress, WooShippingPackage, WooShippingRate } from "@/lib/woocommerce/types";

// Global type declaration for Razorpay checkout.js
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: () => void) => void;
    };
  }
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const isBuyNow = searchParams?.get("buy_now") === "1" || searchParams?.get("buy_now") === "true";

  const { isAuthenticated, user } = useAuthStore();

  const {
    cart: regularCart,
    isLoading: isRegularLoading,
    cartToken: regularCartToken,
    nonce: regularNonce,
    isPending: isRegularCartPending,
    applyCoupon: regularApplyCoupon,
    removeCoupon: regularRemoveCoupon,
  } = useCartStore();

  const {
    buyNowCart,
    buyNowToken,
    buyNowNonce,
    isLoading: isBuyNowLoading,
    isPending: isBuyNowPending,
    applyCoupon: buyNowApplyCoupon,
    removeCoupon: buyNowRemoveCoupon,
    initBuyNow,
  } = useBuyNowStore();

  useEffect(() => {
    if (isBuyNow) {
      initBuyNow();
    }
  }, [isBuyNow, initBuyNow]);

  const activeCart = isBuyNow ? buyNowCart : regularCart;
  const activeCartToken = isBuyNow ? buyNowToken : regularCartToken;
  const activeNonce = isBuyNow ? buyNowNonce : regularNonce;
  const isLoading = isBuyNow ? isBuyNowLoading : isRegularLoading;
  const activeIsPending = isBuyNow ? isBuyNowPending : isRegularCartPending;
  const activeApplyCoupon = isBuyNow ? buyNowApplyCoupon : regularApplyCoupon;
  const activeRemoveCoupon = isBuyNow ? buyNowRemoveCoupon : regularRemoveCoupon;

  const { billingSameAsShipping, selectedPaymentMethod, setSelectedPaymentMethod } = useCheckoutStore();
  const router = useRouter();
  const [checkoutState, formAction, isPending] = useActionState(checkoutAction, null);
  const [isSelectingShipping, startShippingTransition] = useTransition();
  const { isUpdatingAddress } = useAddressUpdate(activeCartToken ?? null, isBuyNow);

  // Saved address state for logged-in users
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("new");
  const [saveAddressChecked, setSaveAddressChecked] = useState(true);
  const [makeDefaultChecked, setMakeDefaultChecked] = useState(false);
  const [addressLabel, setAddressLabel] = useState("Home");

  // Load saved addresses and billing on mount for logged-in users
  useEffect(() => {
    if (isAuthenticated) {
      getAddressBookAction().then((res) => {
        if (res.ok && res.data?.addresses?.length) {
          const list = res.data.addresses;
          setSavedAddresses(list);
          const defaultId = res.data.default_id || list[0].id;
          setSelectedAddressId(defaultId);
          const defaultAddr = list.find((a) => a.id === defaultId) || list[0];
          if (defaultAddr) {
            const store = useCheckoutStore.getState();
            store.updateShipping("first_name", defaultAddr.first_name);
            store.updateShipping("last_name", defaultAddr.last_name);
            store.updateShipping("company", defaultAddr.company || "");
            store.updateShipping("address_1", defaultAddr.address_1);
            store.updateShipping("address_2", defaultAddr.address_2 || "");
            store.updateShipping("city", defaultAddr.city);
            store.updateShipping("state", defaultAddr.state || "");
            store.updateShipping("postcode", defaultAddr.postcode);
            store.updateShipping("country", defaultAddr.country || getDefaultCountry());

            if (!store.billing.phone && defaultAddr.phone) {
              store.updateBilling("phone", defaultAddr.phone);
            }
          }
        }
      });

      getSavedBillingAction().then((res) => {
        if (res.ok && res.data) {
          const saved = res.data;
          const store = useCheckoutStore.getState();
          if (!store.billing.email && (saved.email || user?.email)) {
            store.updateBilling("email", saved.email || user?.email || "");
          }
          if (!store.billing.phone && saved.phone) {
            store.updateBilling("phone", saved.phone);
          }
          if (!store.billing.address_1 && saved.address_1) {
            store.updateBilling("first_name", saved.first_name || "");
            store.updateBilling("last_name", saved.last_name || "");
            store.updateBilling("company", saved.company || "");
            store.updateBilling("address_1", saved.address_1);
            store.updateBilling("address_2", saved.address_2 || "");
            store.updateBilling("city", saved.city || "");
            store.updateBilling("state", saved.state || "");
            store.updateBilling("postcode", saved.postcode || "");
            store.updateBilling("country", saved.country || getDefaultCountry());
          }
        }
      });
    }
  }, [isAuthenticated, user?.email]);

  const isStripeMethod = selectedPaymentMethod === "stripe_cc" || selectedPaymentMethod === "stripe";
  const isRazorpayMethod = selectedPaymentMethod === "razorpay";

  // Razorpay verification state
  const [isVerifyingRazorpay, setIsVerifyingRazorpay] = useState(false);

  // Razorpay modal handler — opens the checkout modal and verifies payment on success
  const handleRazorpayModal = useCallback(
    (data: {
      razorpayOrderId: string;
      wcOrderId: number;
      wcOrderKey: string;
      amount: number;
      currency: string;
      keyId: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
    }) => {
      if (typeof window === "undefined" || !window.Razorpay) {
        toast.error("Razorpay script not loaded. Please refresh the page.");
        return;
      }

      const options: Record<string, unknown> = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: process.env.NEXT_PUBLIC_SITE_URL ?? "Store",
        order_id: data.razorpayOrderId,
        prefill: {
          name: data.customerName,
          email: data.customerEmail,
          contact: data.customerPhone,
        },
        theme: { color: "#3399cc" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          // Verify payment signature on the server
          setIsVerifyingRazorpay(true);
          try {
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                wc_order_id: data.wcOrderId,
                wc_order_key: data.wcOrderKey,
                billing_email: data.customerEmail,
              }),
            });

            if (!verifyRes.ok) {
              const errBody = await verifyRes.json().catch(() => ({}));
              toast.error(
                (errBody as { error?: string }).error ?? t("checkout.razorpayFailed")
              );
              return;
            }

            const result = (await verifyRes.json()) as {
              verified: boolean;
              orderId: number;
              orderKey: string;
              billingEmail?: string;
            };

            // Redirect to order confirmation (CartClearer handles store cleanup on mount)
            const params = new URLSearchParams({
              order_id: String(result.orderId),
              order_key: result.orderKey,
              ...(result.billingEmail && { billing_email: result.billingEmail }),
              ...(isBuyNow ? { buy_now: "1" } : {}),
            });
            router.push(`/order-confirmation?${params.toString()}`);
          } catch {
            toast.error(t("checkout.razorpayFailed"));
          } finally {
            setIsVerifyingRazorpay(false);
          }
        },
        modal: {
          ondismiss: () => {
            toast.error("Payment was cancelled.");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    },
    [router, isBuyNow]
  );

  // Handle server action result
  useEffect(() => {
    if (!checkoutState) return;
    if (checkoutState.type === "error") {
      toast.error(checkoutState.message);
    } else if (checkoutState.type === "stripe_redirect") {
      window.location.href = checkoutState.url;
    } else if (checkoutState.type === "razorpay_create") {
      handleRazorpayModal({
        razorpayOrderId: checkoutState.razorpayOrderId,
        wcOrderId: checkoutState.wcOrderId,
        wcOrderKey: checkoutState.wcOrderKey,
        amount: checkoutState.amount,
        currency: checkoutState.currency,
        keyId: checkoutState.keyId,
        customerName: checkoutState.customerName,
        customerEmail: checkoutState.customerEmail,
        customerPhone: checkoutState.customerPhone,
      });
    } else if (checkoutState.type === "success") {
      const params = new URLSearchParams({
        order_id: String(checkoutState.orderId),
        order_key: checkoutState.orderKey,
        billing_email: checkoutState.email,
        ...(isBuyNow ? { buy_now: "1" } : {}),
      });
      router.push(`/order-confirmation?${params.toString()}`);
    }
  }, [checkoutState, router, handleRazorpayModal, isBuyNow]);

  // Fire begin_checkout once when cart is ready
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (!activeCart || activeCart.items.length === 0 || checkoutTracked.current) return;
    checkoutTracked.current = true;
    const currency = activeCart.totals.currency_code;
    const value = parseInt(activeCart.totals.total_price) / Math.pow(10, activeCart.totals.currency_minor_unit);
    trackBeginCheckout(cartItemsToEcommerceItems(activeCart.items), currency, value);
  }, [activeCart]);

  // Auto-select first payment method when cart loads
  const paymentInitialized = useRef(false);
  useEffect(() => {
    if (activeCart?.payment_methods?.length && !paymentInitialized.current) {
      paymentInitialized.current = true;
      if (!selectedPaymentMethod) setSelectedPaymentMethod(activeCart.payment_methods[0]);
    }
  }, [activeCart?.payment_methods, selectedPaymentMethod, setSelectedPaymentMethod]);

  const handleShippingRateChange = (packageId: number, rateId: string) => {
    startShippingTransition(async () => {
      const result = await selectShippingRate(packageId, rateId, activeCartToken, activeNonce);
      if (result.error) {
        toast.error(t("checkout.failedShipping"));
        return;
      }
      if (result.cart) {
        if (isBuyNow) {
          useBuyNowStore.setState({
            buyNowCart: result.cart,
            buyNowToken: result.cartToken ?? activeCartToken,
            buyNowNonce: result.nonce ?? activeNonce,
          });
        } else {
          useCartStore.setState({
            cart: result.cart,
            itemCount: result.cart.items_count,
            cartToken: result.cartToken ?? activeCartToken,
            nonce: result.nonce ?? activeNonce,
          });
        }
        const c = result.cart;
        const currency = c.totals.currency_code;
        const value = parseInt(c.totals.total_price) / Math.pow(10, c.totals.currency_minor_unit);
        const selectedRate = c.shipping_rates.flatMap((pkg: WooShippingPackage) => pkg.shipping_rates).find((r: WooShippingRate) => r.selected);
        trackAddShippingInfo(cartItemsToEcommerceItems(c.items), currency, value, selectedRate?.name ?? rateId);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-heading font-bold mb-8">{t("checkout.pageTitle")}</h1>
        <p className="text-muted-foreground">{t("checkout.loadingCart")}</p>
      </div>
    );
  }

  if (!activeCart || activeCart.items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground" />
        <h1 className="text-3xl font-heading font-bold mt-4">{t("checkout.emptyTitle")}</h1>
        <p className="text-muted-foreground mt-2">{t("checkout.emptyHint")}</p>
        <Link href="/shop" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
          {t("checkout.continueShopping")}
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pb-28 lg:pb-8">
      {/* Load Razorpay checkout.js */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      <h1 className="text-3xl font-heading font-bold mb-8">{t("checkout.pageTitle")}</h1>

      <form action={formAction}>
        {/* Hidden parameters */}
        <input type="hidden" name="cartToken" value={activeCartToken ?? ""} />
        <input type="hidden" name="nonce" value={activeNonce ?? ""} />
        <input type="hidden" name="cart" value={JSON.stringify(activeCart)} />
        <input type="hidden" name="paymentMethod" value={selectedPaymentMethod} />
        <input type="hidden" name="billingSameAsShipping" value={billingSameAsShipping ? "1" : "0"} />
        <input type="hidden" name="sameAsShipping" value={billingSameAsShipping ? "1" : "0"} />
        <input type="hidden" name="isBuyNow" value={isBuyNow ? "1" : "0"} />
        <input type="hidden" name="saveAddress" value={selectedAddressId === "new" && saveAddressChecked ? "1" : "0"} />
        <input type="hidden" name="makeDefault" value={selectedAddressId === "new" && makeDefaultChecked ? "1" : "0"} />
        <input type="hidden" name="addressLabel" value={addressLabel} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-6">
            {/* 1. DELIVERY ADDRESS (Always visible) */}
            <DeliveryAddressForm
              savedAddresses={savedAddresses}
              selectedAddressId={selectedAddressId}
              onSelectSavedAddress={setSelectedAddressId}
              saveAddressChecked={saveAddressChecked}
              setSaveAddressChecked={setSaveAddressChecked}
              makeDefaultChecked={makeDefaultChecked}
              setMakeDefaultChecked={setMakeDefaultChecked}
              addressLabel={addressLabel}
              setAddressLabel={setAddressLabel}
            />

            {/* 2. CONTACT (Email, Phone) */}
            <ContactSection />

            {/* 3. BILLING ADDRESS (Collapsed by default) */}
            <BillingAddressForm />

            {/* 4. Shipping Method */}
            {activeCart.needs_shipping && activeCart.shipping_rates?.length > 0 && (
              <ShippingMethodSelector
                shippingRates={activeCart.shipping_rates}
                isDisabled={isSelectingShipping || isUpdatingAddress}
                onSelect={handleShippingRateChange}
              />
            )}

            {/* 5. Payment Method */}
            {activeCart.needs_payment && parseInt(activeCart.totals?.total_price || "0") > 0 && activeCart.payment_methods?.length > 0 && (
              <PaymentMethodSelector
                paymentMethods={activeCart.payment_methods}
                isDisabled={isUpdatingAddress}
                onPaymentSelect={(method) => {
                  const currency = activeCart.totals.currency_code;
                  const value = parseInt(activeCart.totals.total_price) / Math.pow(10, activeCart.totals.currency_minor_unit);
                  trackAddPaymentInfo(cartItemsToEcommerceItems(activeCart.items), currency, value, method);
                }}
              />
            )}

            {/* 6. Coupon Input */}
            <CouponInput
              cart={activeCart}
              isPending={activeIsPending}
              applyCoupon={activeApplyCoupon}
              removeCoupon={activeRemoveCoupon}
            />
          </div>

          {/* Desktop Sticky Order Summary Column */}
          <aside className="lg:col-span-1 lg:sticky lg:top-20 self-start">
            <CheckoutOrderSummary
              cart={activeCart}
              isPending={isPending || isVerifyingRazorpay}
              isUpdatingAddress={isUpdatingAddress}
              isSelectingShipping={isSelectingShipping}
              isStripeMethod={isStripeMethod}
              isRazorpayMethod={isRazorpayMethod}
            />
          </aside>
        </div>

        {/* Mobile Sticky Checkout Pay Bar with Total Price */}
        <MobileCheckoutBar
          cart={activeCart}
          isPending={isPending || isVerifyingRazorpay}
          isUpdatingAddress={isUpdatingAddress}
          isSelectingShipping={isSelectingShipping}
          isStripeMethod={isStripeMethod}
          isRazorpayMethod={isRazorpayMethod}
        />
      </form>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-heading font-bold mb-8">{t("checkout.pageTitle")}</h1>
          <p className="text-muted-foreground">{t("checkout.loadingCart")}</p>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
