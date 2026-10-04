"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  getCustomerOrdersAction,
  type CustomerOrderSummary,
  type CustomerOrderLineItem,
} from "@/lib/actions/account";
import {
  getCustomerReviewedProductsAction,
  type ReviewedProductSummary,
} from "@/lib/actions/reviews";
import type { WooProductReview } from "@/lib/woocommerce/types";
import { OrderTrackingView } from "@/components/account/order-tracking-view";
import { WriteReviewDialog } from "@/components/account/write-review-dialog";
import { CancelOrderDialog } from "@/components/account/cancel-order-dialog";
import { getWhatsAppChatUrl } from "@/lib/utils/whatsapp";
import { t } from "@/lib/i18n";
import {
  Package,
  ShoppingBag,
  ArrowLeft,
  Calendar,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Truck,
  ChevronDown,
  ChevronUp,
  Star,
  Edit3,
  RotateCcw,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/defaultbutton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/format";

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/^wc-/, "");

  switch (normalized) {
    case "completed":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-xs">
          <CheckCircle2 className="w-3 h-3" />
          {t("orders.status.completed", "Delivered")}
        </Badge>
      );
    case "processing":
      return (
        <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1 text-xs">
          <Clock className="w-3 h-3" />
          {t("orders.status.processing", "Processing")}
        </Badge>
      );
    case "shipped":
      return (
        <Badge className="bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 gap-1 text-xs">
          <Truck className="w-3 h-3" />
          {t("orders.status.shipped", "Shipped")}
        </Badge>
      );
    case "rto":
      return (
        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-xs">
          <RotateCcw className="w-3 h-3" />
          {t("orders.status.rto", "Returned to Origin")}
        </Badge>
      );
    case "on-hold":
    case "pending":
      return (
        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-xs">
          <Clock className="w-3 h-3" />
          {t("orders.status.pending", "Pending")}
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1 text-xs">
          <XCircle className="w-3 h-3" />
          {t("orders.status.cancelled", "Cancelled")}
        </Badge>
      );
    case "refunded":
      return (
        <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 gap-1 text-xs">
          <RotateCcw className="w-3 h-3" />
          {t("orders.status.refunded", "Refunded")}
        </Badge>
      );
    case "return-requested":
      return (
        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-xs">
          <Clock className="w-3 h-3" />
          {t("orders.status.returnRequested", "Return Requested")}
        </Badge>
      );
    case "return-approved":
      return (
        <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1 text-xs">
          <CheckCircle2 className="w-3 h-3" />
          {t("orders.status.returnApproved", "Return Approved")}
        </Badge>
      );
    case "return-received":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-xs">
          <CheckCircle2 className="w-3 h-3" />
          {t("orders.status.returnReceived", "Return Received")}
        </Badge>
      );
    case "return-rejected":
      return (
        <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1 text-xs">
          <XCircle className="w-3 h-3" />
          {t("orders.status.returnRejected", "Return Rejected")}
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1 text-xs">
          <XCircle className="w-3 h-3" />
          {t("orders.status.failed", "Failed")}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="capitalize text-xs">
          {status}
        </Badge>
      );
  }
}

function formatOrderAmount(
  amount: string | number,
  order: CustomerOrderSummary
): string {
  const num = typeof amount === "string" ? parseFloat(amount || "0") : amount;
  const safeNum = isNaN(num) ? 0 : num;
  const formatted = safeNum.toFixed(order.currencyMinorUnit ?? 2);
  const prefix = order.currencyPrefix ?? order.currencySymbol ?? "₹";
  const suffix = order.currencySuffix ?? "";
  return `${prefix}${formatted}${suffix}`;
}

export function OrdersPageContent() {
  const router = useRouter();
  const { isAuthenticated, isInitialized } = useAuthStore();
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
  const [reviewedProductsMap, setReviewedProductsMap] = useState<
    Map<number, ReviewedProductSummary>
  >(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTracking, setExpandedTracking] = useState<Record<number, boolean>>({});

  // Review Dialog State
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedReviewProduct, setSelectedReviewProduct] = useState<{
    id: number;
    name: string;
    price?: number | string;
    image?: string;
  } | null>(null);
  const [selectedExistingReview, setSelectedExistingReview] =
    useState<ReviewedProductSummary | null>(null);
  const [selectedReviewOrderNumber, setSelectedReviewOrderNumber] = useState<string>("");

  // Cancel Dialog State
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [selectedCancelOrder, setSelectedCancelOrder] = useState<CustomerOrderSummary | null>(null);

  const toggleTracking = (orderId: number) => {
    setExpandedTracking((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const handleOpenCancelModal = (order: CustomerOrderSummary) => {
    setSelectedCancelOrder(order);
    setIsCancelOpen(true);
  };

  const handleOpenReviewModal = (
    item: CustomerOrderLineItem,
    orderNumber: string,
    existingReview?: ReviewedProductSummary | null
  ) => {
    setSelectedReviewProduct({
      id: item.productId || item.id,
      name: item.name,
      price: item.price,
      image: item.image,
    });
    setSelectedReviewOrderNumber(orderNumber);
    setSelectedExistingReview(existingReview || null);
    setIsReviewOpen(true);
  };

  const loadOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getCustomerOrdersAction();
      if (!result.success) {
        setError(result.error || "Failed to load orders");
      } else {
        setOrders(result.orders);
        try {
          const reviewsRes = await getCustomerReviewedProductsAction();
          if (reviewsRes.success && reviewsRes.reviewedProducts) {
            const map = new Map<number, ReviewedProductSummary>();
            for (const r of reviewsRes.reviewedProducts) {
              map.set(r.productId, r);
            }
            setReviewedProductsMap(map);
          }
        } catch (revErr) {
          console.warn("[OrdersPageContent] Failed to fetch customer reviews:", revErr);
        }
      }
    } catch {
      setError("An unexpected error occurred while loading your orders.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewSuccess = (productId: number, review: WooProductReview) => {
    setReviewedProductsMap((prev) => {
      const next = new Map(prev);
      next.set(productId, {
        productId: review.product_id || productId,
        reviewId: review.id,
        rating: review.rating,
        dateCreated: review.date_created || review.date_created_gmt || "",
        review: review.review ? review.review.replace(/<[^>]*>?/gm, "").trim() : "",
      });
      return next;
    });
  };

  useEffect(() => {
    let isMounted = true;

    if (isInitialized && !isAuthenticated) {
      router.push("/auth?returnUrl=/account/orders");
      return;
    }

    if (isAuthenticated) {
      Promise.all([
        getCustomerOrdersAction(),
        getCustomerReviewedProductsAction(),
      ])
        .then(([ordersRes, reviewsRes]) => {
          if (!isMounted) return;

          if (ordersRes.success) {
            setOrders(ordersRes.orders);
          } else {
            setError(ordersRes.error || "Failed to load orders");
          }

          if (reviewsRes.success && reviewsRes.reviewedProducts) {
            const map = new Map<number, ReviewedProductSummary>();
            reviewsRes.reviewedProducts.forEach((r) => {
              map.set(r.productId, r);
            });
            setReviewedProductsMap(map);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          setError(err instanceof Error ? err.message : "An unexpected error occurred");
        })
        .finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [isInitialized, isAuthenticated, router]);

  if (!isInitialized || (!isAuthenticated && isLoading)) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Checking authentication...</p>
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 max-w-5xl">
      {/* Navigation Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Account</span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">
            My Orders
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            View your order history, manage product reviews, and check shipment status.
          </p>
        </div>

        {orders.length > 0 && (
          <Badge variant="secondary" className="self-start sm:self-auto text-xs font-semibold px-3 py-1">
            {orders.length} {orders.length === 1 ? "Order" : "Orders"}
          </Badge>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-border/60 bg-card p-6 space-y-4"
            >
              <div className="flex justify-between items-center">
                <div className="h-4 bg-muted rounded w-32" />
                <div className="h-5 bg-muted rounded-full w-20" />
              </div>
              <div className="h-3 bg-muted rounded w-48" />
              <div className="h-10 bg-muted/60 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="mt-2 text-xs"
          >
            Retry
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card/60 p-12 sm:p-16 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="font-heading text-xl font-bold">No orders placed yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            You haven&apos;t made any purchases with this account yet. Explore our
            fragrance catalog to get started.
          </p>
          <Link
            href="/shop"
            className={cn(
              buttonVariants({ variant: "default" }),
              "mt-4 gap-2"
            )}
          >
            <ShoppingBag className="h-4 w-4" />
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => {
            const isTrackingOpen = Boolean(expandedTracking[order.id]);
            const isCompleted = order.status.toLowerCase() === "completed";

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm hover:border-primary/40 transition-all duration-200 space-y-4"
              >
                {/* Order Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                      #{order.number}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base text-foreground">
                        Order #{order.number}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {order.dateCreated ? formatDate(order.dateCreated) : "—"}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          {order.paymentMethodTitle}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 self-end sm:self-auto">
                    <div className="flex items-center gap-3">
                      <StatusBadge status={order.status} />
                      <span className="font-heading font-bold text-base text-foreground">
                        {formatOrderAmount(order.total, order)}
                      </span>
                    </div>
                    {order.refundStatus && (
                      <span
                        className={cn(
                          "text-[11px] font-medium block text-right",
                          order.refundStatus === "processed"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {t(
                          `orders.refund.${order.refundStatus}`,
                          order.refundStatus === "processed"
                            ? "Refund completed"
                            : order.refundStatus === "initiated"
                            ? "Refund initiated"
                            : "Refund pending, our team will contact you"
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Items Summary with Review and Edit Option */}
                {order.lineItems.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                      Purchased Items ({order.itemCount})
                    </span>
                    <div className="divide-y divide-border/40 rounded-xl bg-muted/30 border border-border/40 px-3 py-1">
                      {order.lineItems.map((item) => {
                        const targetProductId = item.productId || item.id;
                        const existingReview = reviewedProductsMap.get(targetProductId);

                        return (
                          <div
                            key={item.id}
                            className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs sm:text-sm"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 max-w-full sm:max-w-[60%]">
                              <div className="min-w-0">
                                <span className="font-medium text-foreground truncate block">
                                  {item.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Qty: {item.quantity} • {formatOrderAmount(item.total, order)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0 flex-wrap">
                              {/* Write Review or Edit Review for Completed Orders */}
                              {isCompleted && (
                                <>
                                  {existingReview ? (
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                        <span>{existingReview.rating} ★</span>
                                      </span>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleOpenReviewModal(item, order.number, existingReview)
                                        }
                                        className="text-xs h-7 px-2.5 gap-1.5 rounded-lg border-border/80 hover:border-primary/50 hover:bg-primary/10 transition-all font-medium text-foreground"
                                      >
                                        <Edit3 className="w-3 h-3 text-muted-foreground" />
                                        <span>Edit Review</span>
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenReviewModal(item, order.number, null)}
                                      className="text-xs h-7 px-2.5 gap-1.5 rounded-lg border-primary/30 text-primary hover:bg-primary/10 hover:border-primary transition-all font-medium"
                                    >
                                      <Star className="w-3 h-3 text-primary" />
                                      <span>Write Review</span>
                                    </Button>
                                  )}
                                </>
                              )}

                              <span className="font-medium text-foreground hidden sm:inline-block">
                                {formatOrderAmount(item.total, order)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tracking & Cancellation Action Bar */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTracking(order.id)}
                    className={cn(
                      "text-xs gap-2 rounded-xl transition-all",
                      isTrackingOpen
                        ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/15"
                        : "hover:border-primary/40"
                    )}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>{isTrackingOpen ? "Hide Tracking" : "Track Shipment"}</span>
                    {isTrackingOpen ? (
                      <ChevronUp className="w-3 h-3 ml-0.5" />
                    ) : (
                      <ChevronDown className="w-3 h-3 ml-0.5" />
                    )}
                  </Button>

                  <div className="flex items-center gap-2">
                    {order.canCancel && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenCancelModal(order)}
                        className="text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive rounded-xl font-medium"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{t("orders.cancelButton", "Cancel order")}</span>
                      </Button>
                    )}

                    {!order.canCancel &&
                      (order.status === "processing" ||
                        order.status === "pending" ||
                        order.status === "on-hold") &&
                      Boolean(order.shipmentAwb) && (
                        <a
                          href={getWhatsAppChatUrl(
                            `Hi, I need assistance modifying Order #${order.number}`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors hover:underline"
                        >
                          <span>
                            {t(
                              "orders.supportHintAwb",
                              "Shipment in progress. Need help? Contact us on WhatsApp."
                            )}
                          </span>
                        </a>
                      )}
                  </div>
                </div>

                {/* Collapsible Tracking Detail Section */}
                {isTrackingOpen && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <OrderTrackingView
                      orderId={order.id}
                      orderNumber={order.number}
                      orderStatus={order.status}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Order Modal Dialog */}
      {selectedCancelOrder && (
        <CancelOrderDialog
          orderId={selectedCancelOrder.id}
          orderNumber={selectedCancelOrder.number}
          isPrepaid={selectedCancelOrder.isPrepaid}
          isOpen={isCancelOpen}
          onOpenChange={setIsCancelOpen}
          onSuccess={loadOrders}
        />
      )}

      {/* Write / Edit Product Review Modal Dialog */}
      <WriteReviewDialog
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        product={selectedReviewProduct}
        existingReview={selectedExistingReview}
        orderNumber={selectedReviewOrderNumber}
        onSuccess={handleReviewSuccess}
      />
    </main>
  );
}
