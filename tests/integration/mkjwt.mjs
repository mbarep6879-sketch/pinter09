import { createHmac } from "node:crypto";
const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const h = b({ alg: "HS256", typ: "JWT" }), p = b({ role: process.argv[2], exp: Math.floor(Date.now() / 1000) + 7200 });
process.stdout.write(`${h}.${p}.${createHmac("sha256", "uji-rahasia-jwt-minimal-32-karakter-panjang!!").update(`${h}.${p}`).digest("base64url")}`);
