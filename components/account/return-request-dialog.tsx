"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/defaultbutton";
import { AlertCircle, Loader2, UploadCloud, X, Camera, RotateCcw, IndianRupee, Info } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { STORE_CONFIG } from "@/store.config";
import type { CustomerOrderSummary, CustomerOrderLineItem } from "@/lib/actions/account";
import { requestReturnAction, uploadReturnPhotoAction } from "@/lib/actions/account";
import { getReturnRefundAmount } from "@/lib/orders/eligibility";

interface ReturnRequestDialogProps {
  order: CustomerOrderSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ReturnReason = (typeof STORE_CONFIG.orders.returnReasons)[number];

interface ReturnRequestDialogContentProps {
  order: CustomerOrderSummary;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Automatically compress photos exceeding 1MB on client side
 * to guarantee fast uploads and prevent server body limits,
 * while allowing files up to 5MB.
 */
async function optimizeImageForUpload(file: File): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/") || file.size <= 1024 * 1024) {
    return file;
  }

  try {
    return await new Promise<File>((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxDimension = 2048;
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const safeName = file.name.replace(/\.[^.]+$/, ".jpg");
              resolve(new File([blob], safeName, { type: "image/jpeg" }));
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          0.85
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };

      img.src = objectUrl;
    });
  } catch {
    return file;
  }
}

function ReturnRequestDialogContent({
  order,
  onClose,
  onSuccess,
}: ReturnRequestDialogContentProps) {
  const initialItems = useMemo(() => {
    const initial: Record<number, number> = {};
    order.lineItems.forEach((item) => {
      initial[item.id] = item.quantity;
    });
    return initial;
  }, [order]);

  const [selectedReason, setSelectedReason] = useState<ReturnReason>("damaged");
  const [note, setNote] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>(initialItems);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Live Camera Viewfinder State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">("environment");
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const fallbackFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // COD Refund Details
  const [codRefundType, setCodRefundType] = useState<"upi" | "bank">("upi");
  const [upiId, setUpiId] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankHolderName, setBankHolderName] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requiresPhotos =
    selectedReason === "damaged" ||
    selectedReason === "defective" ||
    selectedReason === "wrong_item";

  const isCod = !order.isPrepaid;

  // Calculate estimated refund preview
  const estimatedRefund = useMemo(() => {
    const orderTotal = parseFloat(order.total || "0");
    const shippingTotal = 0; // standard shipping preview
    return getReturnRefundAmount({
      reason: selectedReason,
      orderTotal,
      shippingTotal,
    });
  }, [order, selectedReason]);

  const handleItemToggle = (itemId: number, maxQty: number) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId];
      } else {
        next[itemId] = maxQty;
      }
      return next;
    });
  };

  const handleItemQtyChange = (itemId: number, qty: number, maxQty: number) => {
    const validQty = Math.max(1, Math.min(maxQty, qty));
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: validQty,
    }));
  };

  const stopCamera = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  // Ensure camera streams are stopped on unmount
  React.useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Connect stream to video element when camera is mounted
  React.useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraActive]);

  const startCamera = async (facing: "environment" | "user" = cameraFacingMode) => {
    if (photoUrls.length >= 4) {
      toast.error("You can upload a maximum of 4 photos.");
      return;
    }

    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      toast.info("Opening photo capture option.");
      fallbackFileInputRef.current?.click();
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      console.warn("[startCamera] Error accessing camera:", err);
      stopCamera();
      toast.info("Could not start camera preview. Opening file upload option.");
      fallbackFileInputRef.current?.click();
    }
  };

  const toggleCamera = () => {
    const nextFacing = cameraFacingMode === "environment" ? "user" : "environment";
    setCameraFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  const uploadSinglePhoto = async (file: File): Promise<boolean> => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error(`File "${file.name}" exceeds the 5 MB limit.`);
      return false;
    }

    try {
      const processedFile = await optimizeImageForUpload(file);
      const formData = new FormData();
      formData.append("file", processedFile);
      const res = await uploadReturnPhotoAction(formData);

      if (res.success && res.url) {
        setPhotoUrls((prev) => [...prev, res.url!]);
        return true;
      } else {
        toast.error(res.error || `Failed to upload ${file.name}`);
        return false;
      }
    } catch {
      toast.error(`Failed to process ${file.name}`);
      return false;
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error("Camera is warming up. Please try again in a moment.");
      return;
    }

    setIsCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context failed");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9)
      );

      if (!blob) throw new Error("Could not capture image from camera");

      const file = new File([blob], `proof-camera-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      stopCamera();
      setIsUploadingPhoto(true);
      await uploadSinglePhoto(file);
    } catch (err) {
      console.error("[capturePhoto] Failed:", err);
      toast.error("Failed to capture photo from camera.");
    } finally {
      setIsCapturing(false);
      setIsUploadingPhoto(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photoUrls.length + files.length > 4) {
      toast.error("You can upload a maximum of 4 photos.");
      return;
    }

    setIsUploadingPhoto(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadSinglePhoto(files[i]);
      }
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const itemsArray = Object.entries(selectedItems).map(([id, quantity]) => ({
      id: Number(id),
      quantity,
    }));

    if (itemsArray.length === 0) {
      setErrorMessage("Please select at least one item to return.");
      return;
    }

    if (requiresPhotos && photoUrls.length === 0) {
      setErrorMessage("Please attach at least one photo showing the issue with the item.");
      return;
    }

    if (isCod) {
      if (codRefundType === "upi" && !upiId.trim()) {
        setErrorMessage("Please provide a valid UPI ID for your refund.");
        return;
      }
      if (
        codRefundType === "bank" &&
        (!bankAccount.trim() || !bankIfsc.trim() || !bankHolderName.trim())
      ) {
        setErrorMessage("Please provide complete bank account details for your refund.");
        return;
      }
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await requestReturnAction({
        orderId: order.id,
        reason: selectedReason,
        note: note.trim() || undefined,
        items: itemsArray,
        photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
        refundAccount: isCod
          ? codRefundType === "upi"
            ? { type: "upi", upiId: upiId.trim() }
            : {
                type: "bank",
                accountNumber: bankAccount.trim(),
                ifsc: bankIfsc.trim(),
                holderName: bankHolderName.trim(),
              }
          : undefined,
      });

      if (res.success) {
        toast.success(res.message || "Return request submitted successfully.");
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setErrorMessage(res.error || "Failed to submit return request.");
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred while requesting return."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5 pb-1">
        <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
          <RotateCcw className="w-5 h-5 text-primary" />
          <span>Request Return — Order #{order.number}</span>
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Select the items and reason for return. Once reviewed and approved by our team, we will coordinate pickup and refund.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 pt-1">
        {errorMessage && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2.5 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Item Selection */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-foreground block">
            Select Items to Return <span className="text-destructive">*</span>
          </label>
          <div className="space-y-2 border border-border/70 rounded-xl p-3 bg-muted/20">
            {order.lineItems.map((item: CustomerOrderLineItem) => {
              const isChecked = Boolean(selectedItems[item.id]);
              const qty = selectedItems[item.id] || item.quantity;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id={`item-${item.id}`}
                      checked={isChecked}
                      onChange={() => handleItemToggle(item.id, item.quantity)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label
                      htmlFor={`item-${item.id}`}
                      className="font-medium cursor-pointer text-foreground"
                    >
                      {item.name}
                    </label>
                  </div>

                  {isChecked && item.quantity > 1 && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-muted-foreground text-[11px]">Qty:</span>
                      <input
                        type="number"
                        min={1}
                        max={item.quantity}
                        value={qty}
                        onChange={(e) =>
                          handleItemQtyChange(
                            item.id,
                            parseInt(e.target.value) || 1,
                            item.quantity
                          )
                        }
                        className="w-12 h-7 px-1.5 text-center text-xs rounded border border-border bg-background"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Reason Selection */}
        <div className="space-y-2">
          <label htmlFor="return-reason" className="text-xs font-semibold text-foreground block">
            Reason for Return <span className="text-destructive">*</span>
          </label>
          <select
            id="return-reason"
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value as ReturnReason)}
            disabled={isSubmitting}
            className="w-full h-10 px-3 rounded-xl border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {STORE_CONFIG.orders.returnReasons.map((r) => (
              <option key={r} value={r}>
                {t(`orders.returnReasons.${r}`, r.replace(/_/g, " "))}
              </option>
            ))}
          </select>
        </div>

        {/* Estimated Refund Preview */}
        <div className="space-y-1.5">
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground font-medium">Estimated Refund:</span>
            </div>
            <span className="font-bold text-sm text-primary">
              ₹{estimatedRefund.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-start gap-1.5 px-1 text-[11px] text-muted-foreground leading-relaxed">
            <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <span>
              Note: This is an estimated amount and may vary based on item condition inspection and applicable return shipping charges. Our team will review the request and get back with the confirmed refund estimate.
            </span>
          </div>
        </div>

        {/* Photo Upload for Damaged/Defective/Wrong Item */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              Proof Photos {requiresPhotos && <span className="text-destructive">*</span>}
            </label>
            <span className="text-[11px] text-muted-foreground">Max 4 photos (5MB each)</span>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Supported formats: <span className="font-medium text-foreground">JPG, JPEG, PNG, WEBP</span>
          </p>

          {photoUrls.length > 0 && (
            <div className="flex flex-wrap gap-2.5 pt-1">
              {photoUrls.map((url, idx) => (
                <div key={url} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1 right-1 p-0.5 bg-black/70 text-white rounded-full hover:bg-black transition-colors"
                    title="Remove photo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden fallback file input with capture="environment" */}
          <input
            ref={fallbackFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={isUploadingPhoto || isSubmitting}
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Live Camera Viewfinder Overlay */}
          {isCameraActive ? (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex flex-col items-center justify-center border border-border shadow-lg mt-2">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Top controls: switch camera and close */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-2 z-10">
                <button
                  type="button"
                  onClick={toggleCamera}
                  className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors backdrop-blur-sm cursor-pointer"
                  title="Switch camera"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors backdrop-blur-sm cursor-pointer"
                  title="Close camera"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Bottom controls: capture button */}
              <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center z-10">
                <button
                  type="button"
                  disabled={isCapturing}
                  onClick={capturePhoto}
                  className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-2 shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  {isCapturing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  <span>{isCapturing ? "Capturing..." : "Take Snapshot"}</span>
                </button>
              </div>
            </div>
          ) : (
            photoUrls.length < 4 && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {/* Option 1: Choose File / Gallery */}
                <label className="border border-dashed border-border/80 hover:border-primary/50 bg-card/60 hover:bg-muted/40 rounded-xl p-3.5 flex flex-col items-center justify-center cursor-pointer transition-colors text-center space-y-1 group">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={isUploadingPhoto || isSubmitting}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {isUploadingPhoto ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : (
                    <UploadCloud className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                  <span className="text-xs font-semibold text-foreground">Upload Files</span>
                  <span className="text-[10px] text-muted-foreground">Choose from gallery / files</span>
                </label>

                {/* Option 2: Take Photo with Live Camera */}
                <button
                  type="button"
                  onClick={() => startCamera()}
                  disabled={isUploadingPhoto || isSubmitting}
                  className="border border-dashed border-border/80 hover:border-primary/50 bg-card/60 hover:bg-muted/40 rounded-xl p-3.5 flex flex-col items-center justify-center cursor-pointer transition-colors text-center space-y-1 group"
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : (
                    <Camera className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                  <span className="text-xs font-semibold text-foreground">Take Photo</span>
                  <span className="text-[10px] text-muted-foreground">Use live camera</span>
                </button>
              </div>
            )
          )}
        </div>

        {/* COD Refund Account Fields */}
        {isCod && (
          <div className="space-y-3 pt-2 border-t border-border/60">
            <label className="text-xs font-semibold text-foreground block">
              Refund Payment Method (COD Order) <span className="text-destructive">*</span>
            </label>
            <div className="flex gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="codRefundType"
                  value="upi"
                  checked={codRefundType === "upi"}
                  onChange={() => setCodRefundType("upi")}
                />
                <span>UPI ID</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="codRefundType"
                  value="bank"
                  checked={codRefundType === "bank"}
                  onChange={() => setCodRefundType("bank")}
                />
                <span>Bank Account</span>
              </label>
            </div>

            {codRefundType === "upi" ? (
              <div className="space-y-1">
                <label htmlFor="upi-id" className="text-[11px] text-muted-foreground block">
                  UPI ID (e.g. name@okhdfcbank)
                </label>
                <input
                  id="upi-id"
                  placeholder="yourname@upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  placeholder="Account Holder Name"
                  value={bankHolderName}
                  onChange={(e) => setBankHolderName(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  placeholder="Account Number"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  placeholder="IFSC Code"
                  value={bankIfsc}
                  onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                  className="w-full h-9 px-3 rounded-xl border border-input bg-background text-foreground text-xs uppercase focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </div>
        )}

        {/* Additional Note */}
        <div className="space-y-2">
          <label htmlFor="return-note" className="text-xs font-semibold text-foreground block">
            Additional Details (optional)
          </label>
          <textarea
            id="return-note"
            placeholder="Describe what went wrong or details regarding pickup..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isSubmitting}
            rows={3}
            className="w-full p-3 rounded-xl border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none min-h-[60px]"
          />
        </div>

        <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || isUploadingPhoto}
            className="text-xs rounded-xl gap-2 font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <span>Submit Return Request</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ReturnRequestDialog({
  order,
  isOpen,
  onClose,
  onSuccess,
}: ReturnRequestDialogProps) {
  const [isDesktop, setIsDesktop] = useState(true);

  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    setIsDesktop(media.matches);
    const onChange = () => setIsDesktop(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  if (!order) return null;

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          {isOpen && (
            <ReturnRequestDialogContent
              key={order.id}
              order={order}
              onClose={onClose}
              onSuccess={onSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[88vh] overflow-hidden flex flex-col p-0">
        <div className="overflow-y-auto p-5 pb-8">
          {isOpen && (
            <ReturnRequestDialogContent
              key={order.id}
              order={order}
              onClose={onClose}
              onSuccess={onSuccess}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
