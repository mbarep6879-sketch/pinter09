"use client";
import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Tautan pemilihan untuk dibagikan lewat WhatsApp. Tautan bukan pengganti verifikasi: warga tetap memasukkan Nomor KK. */
export function ShareLink({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;
  const text = `${title}\n\nMULAI PEMILIHAN:\n${url}\n\nSiapkan Kartu Keluarga Anda.`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="max-w-full truncate rounded bg-muted px-2 py-1 text-xs">{url}</code>
      <Button type="button" size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}{copied ? "Tersalin" : "Salin"}
      </Button>
      <Button asChild size="sm"><a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" aria-hidden />Bagikan ke WhatsApp</a></Button>
    </div>
  );
}
