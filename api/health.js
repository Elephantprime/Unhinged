// api/health.js
module.exports = (req, res) => {
  const allowed = new Set([
    "http://localhost:3000",
    "http://localhost:5173",
    "https://unhinged-8c6da.web.app",
    "https://unhinged-8c6da.firebaseapp.com",
    "https://unhinged.app",
    "https://uh-iota.vercel.app"
  ]);

  const origin = req.headers.origin;
  const allowOrigin = origin && allowed.has(origin) ? origin : "https://uh-iota.vercel.app";

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  res.status(200).json({ ok: true, msg: "health ok" });
};