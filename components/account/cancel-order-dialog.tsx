"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/defaultbutton";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { STORE_CONFIG } from "@/store.config";
import { cancelOrderAction } from "@/lib/actions/account";

interface CancelOrderDialogProps {
  orderId: number;
  orderNumber: string;
  isPrepaid?: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CancelOrderDialog({
  orderId,
  orderNumber,
  isPrepaid = false,
  isOpen,
  onOpenChange,
  onSuccess,
}: CancelOrderDialogProps) {
  const cancelReasons = STORE_CONFIG.orders.cancelReasons;
  const [reason, setReason] = useState<string>(cancelReasons[0] || "ordered_by_mistake");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!reason) {
      setErrorMessage("Please select a cancellation reason.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await cancelOrderAction(orderId, reason, note);

      if (!res.success) {
        const err = res.error || "Failed to cancel order. Please try again or contact support.";
        setErrorMessage(err);
        toast.error(err);
        return;
      }

      toast.success(res.message || t("orders.cancelSuccessToast", "Order cancelled successfully."));
      onOpenChange(false);
      onSuccess?.();
    } catch {
      const err = "An unexpected error occurred. Please try again.";
      setErrorMessage(err);
      toast.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("orders.cancelDialogTitle", "Cancel Order")} #{orderNumber}
          </DialogTitle>
          <DialogDescription>
            {t(
              "orders.cancelDialogDesc",
              "Are you sure you want to cancel this order? Once cancelled, this action cannot be undone."
            )}
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs sm:text-sm flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="flex-1">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleCancelSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor={`cancel-reason-${orderId}`}
              className="text-xs font-medium text-foreground block"
            >
              {t("orders.cancelReasonLabel", "Reason for cancellation")} *
            </label>
            <select
              id={`cancel-reason-${orderId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            >
              {cancelReasons.map((r) => (
                <option key={r} value={r}>
                  {t(`orders.cancelReasons.${r}`, r.replace(/_/g, " "))}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`cancel-note-${orderId}`}
              className="text-xs font-medium text-foreground block"
            >
              {t("orders.cancelNoteLabel", "Additional comments (optional)")}
            </label>
            <textarea
              id={`cancel-note-${orderId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              placeholder={t(
                "orders.cancelNotePlaceholder",
                "Let us know if you have any additional feedback..."
              )}
              className="w-full p-3 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {isPrepaid && (
            <div className="p-3 rounded-lg bg-muted/60 text-xs text-muted-foreground">
              💡 <strong>Prepaid Order</strong>: The full payment amount will be automatically refunded to your original payment method.
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Keep Order
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isSubmitting}
              className="w-full sm:w-auto gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("orders.cancelInProgress", "Cancelling order...")}
                </>
              ) : (
                t("orders.cancelConfirmButton", "Confirm Cancellation")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
