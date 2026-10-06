"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ContactCopyButtonProps {
  textToCopy: string;
  label: string;
  className?: string;
}

export function ContactCopyButton({
  textToCopy,
  label,
  className,
}: ContactCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label}: ${textToCopy}`}
      title={`Copy ${label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-brand-brown hover:bg-brand-brown/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none",
        className
      )}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          <span className="text-emerald-700 font-medium">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}
