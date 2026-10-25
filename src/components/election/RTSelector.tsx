import Link from "next/link";
import { RT_LIST } from "@/lib/constants";

/** Pilihan RT berupa tautan besar (mudah ditekan di HP). Kode RT tidak sensitif, aman di URL. */
export function RTSelector({ basePath = "/pilih" }: { basePath?: string }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {RT_LIST.map((rt) => (
        <li key={rt}>
          <Link
            href={`${basePath}/${rt.replace(" ", "").toLowerCase()}`}
            className="flex h-16 items-center justify-center rounded-lg border bg-card text-lg font-bold transition-colors hover:border-primary hover:bg-ink-soft"
          >
            {rt}
          </Link>
        </li>
      ))}
    </ul>
  );
}
