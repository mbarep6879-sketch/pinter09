import type { Metadata } from "next";
import { RTSelector } from "@/components/election/RTSelector";

export const metadata: Metadata = { title: "Mulai pemilihan" };

export default function PilihRT() {
  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <h1 className="text-2xl font-extrabold">Pilih RT asal Anda</h1>
      <p className="mb-6 mt-2 text-muted-foreground">Anda hanya dapat memilih calon dari RT tempat Anda terdaftar.</p>
      <RTSelector />
    </main>
  );
}
