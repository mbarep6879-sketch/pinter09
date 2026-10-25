export const ROLES = ["SUPER_ADMIN", "PANITIA", "KOORDINATOR_RW", "KOORDINATOR_RT", "OPERATOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  PANITIA: "Panitia",
  KOORDINATOR_RW: "Koordinator RW",
  KOORDINATOR_RT: "Koordinator RT",
  OPERATOR: "Operator",
  VIEWER: "Viewer",
};

export type Section =
  | "dashboard" | "pemilih" | "import" | "undangan" | "jadwal" | "calon" | "pemilihan"
  | "manual" | "hasil" | "berita-acara" | "audit" | "wizard" | "pengguna" | "pengaturan";

const ALL: Role[] = [...ROLES];
const STAFF_ALL: Role[] = ["SUPER_ADMIN", "PANITIA"];

/** Siapa boleh MEMBUKA halaman. Penegakan sebenarnya tetap di database (RLS + pemeriksaan role di fungsi). */
const ACCESS: Record<Section, Role[]> = {
  dashboard: ALL,
  pemilih: ["SUPER_ADMIN", "PANITIA", "KOORDINATOR_RW", "KOORDINATOR_RT", "OPERATOR"],
  import: STAFF_ALL,
  undangan: STAFF_ALL,
  jadwal: ["SUPER_ADMIN", "PANITIA", "KOORDINATOR_RW"],
  calon: ["SUPER_ADMIN", "PANITIA", "KOORDINATOR_RW"],
  pemilihan: ["SUPER_ADMIN", "PANITIA", "KOORDINATOR_RW"],
  manual: ["SUPER_ADMIN", "PANITIA", "OPERATOR"],
  hasil: ["SUPER_ADMIN", "PANITIA", "KOORDINATOR_RW", "KOORDINATOR_RT"],
  "berita-acara": ["SUPER_ADMIN", "PANITIA", "KOORDINATOR_RW"],
  audit: STAFF_ALL,
  wizard: STAFF_ALL,
  pengguna: ["SUPER_ADMIN"],
  pengaturan: ["SUPER_ADMIN"],
};

export function canAccess(role: Role | null | undefined, section: Section): boolean {
  return !!role && ACCESS[section].includes(role);
}

/** Siapa boleh MENGUBAH data di halaman yang bisa dibuka beberapa role. */
export function canWrite(role: Role | null | undefined, section: Section): boolean {
  if (!role) return false;
  if (section === "manual") return ["SUPER_ADMIN", "PANITIA", "OPERATOR"].includes(role);
  return STAFF_ALL.includes(role);
}

export const NAV: { section: Section; href: string; label: string }[] = [
  { section: "dashboard", href: "/admin", label: "Dashboard" },
  { section: "wizard", href: "/admin/wizard", label: "Persiapan" },
  { section: "pemilih", href: "/admin/pemilih", label: "Pemilih" },
  { section: "jadwal", href: "/admin/jadwal", label: "Jadwal" },
  { section: "calon", href: "/admin/calon", label: "Calon" },
  { section: "pemilihan", href: "/admin/pemilihan", label: "Pemilihan" },
  { section: "manual", href: "/admin/manual", label: "Suara manual" },
  { section: "hasil", href: "/admin/hasil", label: "Hasil" },
  { section: "berita-acara", href: "/admin/berita-acara", label: "Berita Acara" },
  { section: "audit", href: "/admin/audit", label: "Audit" },
  { section: "pengguna", href: "/admin/pengguna", label: "Pengguna" },
  { section: "pengaturan", href: "/admin/pengaturan", label: "Pengaturan" },
];
