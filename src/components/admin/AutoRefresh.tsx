"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Pembaruan berkala (pengganti realtime): menyegarkan data server tanpa memuat ulang halaman. Berhenti saat tab tersembunyi. */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
