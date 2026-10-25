// Meniru gateway Supabase: /rest/v1/* diteruskan ke PostgREST (tanpa awalan). Hanya untuk uji lokal.
import http from "node:http";
http.createServer((req, res) => {
  const p = http.request({ host: "127.0.0.1", port: 3010, path: req.url.replace(/^\/rest\/v1/, ""), method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  p.on("error", () => { res.statusCode = 502; res.end(); }); req.pipe(p);
}).listen(3011, "127.0.0.1");
