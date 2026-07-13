"use client";

import { useState } from "react";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export function PropertyShare({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : window.location.href;

  async function copyUrl() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={copyUrl}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Lien copié" : "Copier"}
      </Button>
      <a className={buttonVariants({ variant: "outline", size: "sm" })} href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`}>
        <Mail className="size-4" /> Email
      </a>
      <a className={buttonVariants({ variant: "outline", size: "sm" })} href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`} target="_blank" rel="noreferrer">
        <MessageCircle className="size-4" /> WhatsApp
      </a>
    </div>
  );
}
