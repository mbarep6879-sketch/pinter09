import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Masuk panitia" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-2xl font-extrabold">Masuk panitia</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Khusus panitia pemilihan RT &amp; RW 09. Warga tidak perlu masuk di sini.</p>
      <Card><LoginForm next={next ?? "/admin"} /></Card>
      <Link href="/" className="mt-6 text-center text-sm underline">Kembali ke beranda</Link>
    </main>
  );
}
