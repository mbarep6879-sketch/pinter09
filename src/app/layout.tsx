import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP } from "@/lib/constants";

export const metadata: Metadata = {
  title: { default: APP.name, template: `%s | ${APP.name}` },
  description: APP.subtitle,
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#2f3a8f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
