"use client";
import { useEffect, useRef } from "react";

declare global { interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void } } }

/** Cloudflare Turnstile (anti-bot). Tidak dirender bila site key belum diisi. */
export function Turnstile({ siteKey, onToken }: { siteKey?: string; onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey || !ref.current) return;
    const mount = () => window.turnstile && ref.current && window.turnstile.render(ref.current, { sitekey: siteKey, callback: onToken, "expired-callback": () => onToken("") });
    if (window.turnstile) { mount(); return; }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true; s.onload = mount;
    document.head.appendChild(s);
  }, [siteKey, onToken]);
  return siteKey ? <div ref={ref} className="my-2" /> : null;
}
