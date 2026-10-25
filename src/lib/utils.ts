import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format angka gaya Indonesia: 1.245 */
export function formatNumber(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

/** Persentase aman dari pembagian nol: 70,36% */
export function formatPercent(part: number, total: number, digits = 2) {
  if (total <= 0) return "0%";
  return `${new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format((part / total) * 100)}%`;
}
