"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getAddressBookAction,
  createAddressAction,
  updateAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  getSavedBillingAction,
  saveBillingAction,
} from "@/lib/actions/address";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/defaultbutton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AddressFields } from "@/components/checkout/address-fields";
import { getDefaultCountry } from "@/lib/config/countries";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Star,
  Loader2,
  CreditCard,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type { AddressBook, BillingAddress, SavedAddress } from "@/lib/woocommerce/types";

export function AddressBookSection() {
  const [addressBook, setAddressBook] = useState<AddressBook>({ addresses: [], default_id: null });
  const [billing, setBilling] = useState<BillingAddress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditBillingOpen, setIsEditBillingOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Address form editing state
  const [currentAddress, setCurrentAddress] = useState<Partial<SavedAddress>>({
    label: "Home",
    first_name: "",
    last_name: "",
    company: "",
    phone: "",
    address_1: "",
    address_2: "",
    city: "",
    state: "",
    postcode: "",
    country: getDefaultCountry(),
    is_default: false,
  });

  const [currentBilling, setCurrentBilling] = useState<BillingAddress>({
    first_name: "",
    last_name: "",
    company: "",
    phone: "",
    address_1: "",
    address_2: "",
    city: "",
    state: "",
    postcode: "",
    country: getDefaultCountry(),
    email: "",
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [bookRes, billRes] = await Promise.all([
        getAddressBookAction(),
        getSavedBillingAction(),
      ]);

      if (bookRes.ok && bookRes.data) {
        setAddressBook(bookRes.data);
      }
      if (billRes.ok && billRes.data) {
        setBilling(billRes.data);
        setCurrentBilling(billRes.data);
      }
    } catch (err) {
      console.warn("[AddressBookSection] Error loading data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set as default handler with optimistic UI
  const handleSetDefault = async (id: string) => {
    const prevBook = { ...addressBook };
    const optimisticAddresses = addressBook.addresses.map((a) => ({
      ...a,
      is_default: a.id === id,
    }));

    setAddressBook({
      addresses: optimisticAddresses,
      default_id: id,
    });

    const res = await setDefaultAddressAction(id);
    if (res.ok && res.data) {
      setAddressBook(res.data);
      toast.success("Default address updated");
    } else {
      setAddressBook(prevBook);
      toast.error(res.error || "Failed to set default address");
    }
  };

  // Delete address handler
  const handleDeleteAddress = async () => {
    if (!deleteConfirmId) return;

    setIsSubmitting(true);
    try {
      const res = await deleteAddressAction(deleteConfirmId);
      if (res.ok && res.data) {
        setAddressBook(res.data);
        toast.success("Address removed successfully");
      } else {
        toast.error(res.error || "Failed to delete address");
      }
    } catch {
      toast.error("An error occurred while deleting address.");
    } finally {
      setIsSubmitting(false);
      setDeleteConfirmId(null);
    }
  };

  // Open add modal
  const openAddModal = () => {
    setCurrentAddress({
      label: "Home",
      first_name: "",
      last_name: "",
      company: "",
      phone: "",
      address_1: "",
      address_2: "",
      city: "",
      state: "",
      postcode: "",
      country: getDefaultCountry(),
      is_default: addressBook.addresses.length === 0,
    });
    setIsAddOpen(true);
  };

  // Open edit modal
  const openEditModal = (addr: SavedAddress) => {
    setCurrentAddress({ ...addr });
    setIsEditOpen(true);
  };

  // Save (Create or Update) Address
  const handleSaveAddress = async (isNew: boolean) => {
    if (!currentAddress.first_name || !currentAddress.last_name || !currentAddress.address_1 || !currentAddress.city || !currentAddress.postcode) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isNew) {
        const res = await createAddressAction(currentAddress);
        if (res.ok && res.data) {
          setAddressBook(res.data);
          toast.success("Address added successfully");
          setIsAddOpen(false);
        } else {
          toast.error(res.error || "Failed to save address");
        }
      } else if (currentAddress.id) {
        const res = await updateAddressAction(currentAddress.id, currentAddress);
        if (res.ok && res.data) {
          setAddressBook(res.data);
          toast.success("Address updated successfully");
          setIsEditOpen(false);
        } else {
          toast.error(res.error || "Failed to update address");
        }
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save Billing Address
  const handleSaveBilling = async () => {
    if (!currentBilling.first_name || !currentBilling.last_name || !currentBilling.address_1 || !currentBilling.city || !currentBilling.postcode) {
      toast.error("Please fill in all required billing address fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveBillingAction(currentBilling);
      if (res.ok && res.data) {
        setBilling(res.data);
        toast.success("Billing address updated successfully");
        setIsEditBillingOpen(false);
      } else {
        toast.error(res.error || "Failed to update billing address");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLimitReached = addressBook.addresses.length >= 10;

  if (isLoading) {
    return (
      <div className="p-8 rounded-2xl border border-border/80 bg-card flex flex-col items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
        <p className="text-xs text-muted-foreground">Loading addresses...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Saved Delivery Addresses Section */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-heading text-lg font-semibold flex items-center gap-2 text-foreground">
              <MapPin className="h-5 w-5 text-primary" />
              <span>{t("account.addresses.title")}</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t("account.addresses.description")}
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={openAddModal}
            disabled={isLimitReached}
            className="text-xs font-medium h-9 shrink-0 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>{t("account.addresses.addNew")}</span>
          </Button>
        </div>

        {isLimitReached && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{t("account.addresses.limitReached")}</span>
          </div>
        )}

        {addressBook.addresses.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-xl border border-dashed border-border/70 bg-muted/20">
            <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium text-foreground">No saved addresses yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add a delivery address to speed up checkout on your future orders.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openAddModal}
              className="mt-4 text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add First Address
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addressBook.addresses.map((addr) => {
              const formattedAddress = [
                addr.address_1,
                addr.address_2,
                addr.city,
                addr.state,
                addr.postcode,
                addr.country,
              ]
                .filter(Boolean)
                .join(", ");

              return (
                <div
                  key={addr.id}
                  className={`rounded-xl border p-5 flex flex-col justify-between transition-all ${
                    addr.is_default
                      ? "border-primary/50 bg-primary/5 shadow-xs"
                      : "border-border/70 bg-card hover:border-border"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">
                          {addr.label || "Address"}
                        </span>
                        {addr.is_default && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary font-medium border-primary/20"
                          >
                            {t("account.addresses.defaultBadge")}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <p className="text-sm font-medium text-foreground">
                      {addr.first_name} {addr.last_name}
                    </p>
                    {addr.company && (
                      <p className="text-xs text-muted-foreground">{addr.company}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {formattedAddress}
                    </p>
                    {addr.phone && (
                      <p className="text-xs text-muted-foreground/80 mt-1">
                        Phone: {addr.phone}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2 flex-wrap">
                    {!addr.is_default && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(addr.id)}
                        className="text-xs h-7 px-2 text-muted-foreground hover:text-primary"
                      >
                        <Star className="h-3.5 w-3.5 mr-1" />
                        <span>{t("account.addresses.setDefault")}</span>
                      </Button>
                    )}
                    <div className="flex items-center gap-1 ml-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(addr)}
                        className="text-xs h-7 px-2.5"
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        <span>{t("account.addresses.edit")}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirmId(addr.id)}
                        className="text-xs h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">{t("account.addresses.delete")}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Native WooCommerce Billing Address Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-heading text-lg font-semibold flex items-center gap-2 text-foreground">
              <CreditCard className="h-5 w-5 text-primary" />
              <span>{t("account.addresses.billingTitle")}</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t("account.addresses.billingDesc")}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (billing) setCurrentBilling(billing);
              setIsEditBillingOpen(true);
            }}
            className="text-xs font-medium h-9 shrink-0 gap-1.5"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Edit Billing Address</span>
          </Button>
        </div>

        {billing && (billing.address_1 || billing.first_name) ? (
          <div className="p-4 rounded-xl bg-muted/30 border border-border/60 text-xs sm:text-sm space-y-1">
            <p className="font-medium text-foreground">
              {billing.first_name} {billing.last_name}
            </p>
            {billing.company && (
              <p className="text-muted-foreground">{billing.company}</p>
            )}
            <p className="text-muted-foreground leading-relaxed">
              {[
                billing.address_1,
                billing.address_2,
                billing.city,
                billing.state,
                billing.postcode,
                billing.country,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
            <div className="pt-2 text-xs text-muted-foreground space-y-0.5">
              {billing.email && <p>Email: {billing.email}</p>}
              {billing.phone && <p>Phone: {billing.phone}</p>}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-muted/20 border border-dashed border-border text-xs text-muted-foreground">
            No billing address saved yet. It will automatically be created on your first order.
          </div>
        )}
      </div>

      {/* Add Address Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Address</DialogTitle>
            <DialogDescription>
              Enter the delivery address details to save to your account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block text-foreground">
                Address Label
              </label>
              <Input
                value={currentAddress.label || "Home"}
                onChange={(e) =>
                  setCurrentAddress((prev) => ({ ...prev, label: e.target.value }))
                }
                placeholder="e.g. Home, Office"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block text-foreground">
                Phone Number
              </label>
              <Input
                type="tel"
                value={currentAddress.phone || ""}
                onChange={(e) =>
                  setCurrentAddress((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="Phone number"
              />
            </div>

            <AddressFields
              namePrefix="shipping"
              showCompany={true}
              values={currentAddress}
              onChange={(field, val) =>
                setCurrentAddress((prev) => ({ ...prev, [field]: val }))
              }
            />

            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={Boolean(currentAddress.is_default)}
                onChange={(e) =>
                  setCurrentAddress((prev) => ({ ...prev, is_default: e.target.checked }))
                }
                className="h-4 w-4 rounded border-input text-primary"
              />
              <span className="text-xs sm:text-sm font-medium text-foreground">
                Set as default delivery address
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSaveAddress(true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                "Save Address"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Address Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Address</DialogTitle>
            <DialogDescription>
              Update your delivery address details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block text-foreground">
                Address Label
              </label>
              <Input
                value={currentAddress.label || "Home"}
                onChange={(e) =>
                  setCurrentAddress((prev) => ({ ...prev, label: e.target.value }))
                }
                placeholder="e.g. Home, Office"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block text-foreground">
                Phone Number
              </label>
              <Input
                type="tel"
                value={currentAddress.phone || ""}
                onChange={(e) =>
                  setCurrentAddress((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="Phone number"
              />
            </div>

            <AddressFields
              namePrefix="shipping"
              showCompany={true}
              values={currentAddress}
              onChange={(field, val) =>
                setCurrentAddress((prev) => ({ ...prev, [field]: val }))
              }
            />

            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={Boolean(currentAddress.is_default)}
                onChange={(e) =>
                  setCurrentAddress((prev) => ({ ...prev, is_default: e.target.checked }))
                }
                className="h-4 w-4 rounded border-input text-primary"
              />
              <span className="text-xs sm:text-sm font-medium text-foreground">
                Set as default delivery address
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSaveAddress(false)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Updating...
                </>
              ) : (
                "Update Address"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Billing Address Dialog */}
      <Dialog open={isEditBillingOpen} onOpenChange={setIsEditBillingOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Billing Address</DialogTitle>
            <DialogDescription>
              Update your primary billing details for receipts and invoices.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <AddressFields
              namePrefix="billing"
              showCompany={true}
              showContactFields={true}
              values={currentBilling}
              onChange={(field, val) =>
                setCurrentBilling((prev) => ({ ...prev, [field]: val }))
              }
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditBillingOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveBilling}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                "Save Billing Address"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteConfirmId)}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Address</DialogTitle>
            <DialogDescription>
              {t("account.addresses.deleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAddress}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
