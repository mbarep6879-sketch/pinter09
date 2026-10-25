import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const URL_API = process.env.PGRST_URL ?? "http://127.0.0.1:3010";
export const JWT_SECRET = process.env.PGRST_JWT_SECRET ?? "uji-rahasia-jwt-minimal-32-karakter-panjang!!";
export const PEPPER = "uji-pepper-kk-minimal-32-karakter-panjang-ya";

export const STAFF = {
  admin: "00000000-0000-0000-0000-0000000000a1",
  panitia: "00000000-0000-0000-0000-0000000000a2",
  viewer: "00000000-0000-0000-0000-0000000000a3",
  operator: "00000000-0000-0000-0000-0000000000a4",
} as const;

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(claims: object) {
  const h = b64({ alg: "HS256", typ: "JWT" }), p = b64({ ...claims, exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

// PostgREST melayani di akar; supabase-js menambahkan /rest/v1 (seperti gateway Supabase).
const stripPrefix: typeof fetch = (input, init) => fetch(String(input).replace("/rest/v1", ""), init);

function client(token: string): SupabaseClient {
  return createClient("http://127.0.0.1:3010", token, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: stripPrefix, headers: { Authorization: `Bearer ${token}` } },
  });
}
export const serviceClient = () => client(jwt({ role: "service_role" }));
export const anonClient = () => client(jwt({ role: "anon" }));
export const staffClient = (uid: string) => client(jwt({ role: "authenticated", sub: uid }));
