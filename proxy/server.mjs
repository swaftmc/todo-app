// Tiny CORS proxy for Kilo Gateway (and others). Run: node proxy/server.mjs
// Then set Proxy URL in the app Settings to http://localhost:8787
import http from "node:http";

const PORT = process.env.PORT || 8787;

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
  if (req.url === "/health" || req.url === "/") { res.end("ok"); return; }

  const target = req.headers["x-target-url"];
  if (!target) { res.statusCode = 400; res.end("missing X-Target-URL header"); return; }

  let body = "";
  for await (const chunk of req) body += chunk;

  try {
    const r = await fetch(target, {
      method: req.method,
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
        "Authorization": req.headers["authorization"] || "",
      },
      body: req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
    });
    const text = await r.text();
    res.statusCode = r.status;
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(text);
  } catch (e) {
    res.statusCode = 502;
    res.end(String(e));
  }
});

server.listen(PORT, () => console.log(`CORS proxy listening on http://localhost:${PORT}`));
