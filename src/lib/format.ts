const TZ = "Asia/Jakarta";
export const fmtDateTime = (iso?: string | null) => (iso ? new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "short", timeZone: TZ }).format(new Date(iso)) + " WIB" : "-");
export const fmtDate = (iso?: string | null) => (iso ? new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: TZ }).format(new Date(iso)) : "-");
export const fmtTime = (iso?: string | null) => (iso ? new Intl.DateTimeFormat("id-ID", { timeStyle: "short", timeZone: TZ }).format(new Date(iso)) + " WIB" : "-");
/** ISO -> nilai input datetime-local (WIB). */
export const toLocalInput = (iso?: string | null) => (iso ? new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(0, 16) : "");
