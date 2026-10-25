const STEPS = ["Verifikasi", "Pilih calon", "Konfirmasi", "Selesai"] as const;

/** Indikator progres 4 tahap (teks + angka, tidak hanya warna). */
export function VotingProgress({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <ol className="mb-6 grid grid-cols-4 gap-1 text-center text-xs" aria-label="Tahap pemilihan">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === current ? "step" : undefined}
          className={`rounded-md py-2 font-semibold ${i < current ? "bg-success-soft text-success" : i === current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          {i + 1}. {s}
        </li>
      ))}
    </ol>
  );
}
