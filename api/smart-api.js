/**
 * Server-side proxy — keeps Supabase smart-api URL + registration token off the browser.
 *
 * Vercel Environment Variables (each event project):
 *   SMART_API_URL          = https://npdpdzutluesuwzofvcd.supabase.co/functions/v1/smart-api
 *   REGISTER_ACCESS_TOKEN  = nnrg-tara-2027-reg-k7m9x2q4w8
 *   PROXY_SECRET           = (same value as Supabase Edge secret PROXY_SECRET)
 */

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const smartApiUrl = process.env.SMART_API_URL;
  const registerToken = process.env.REGISTER_ACCESS_TOKEN || "";
  const proxySecret = process.env.PROXY_SECRET || "";

  if (!smartApiUrl) {
    return res.status(500).json({ error: "Server misconfigured: SMART_API_URL missing" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  // Never trust a client-supplied access token.
  delete body.access_token;
  // Student registration posts have no "action" — inject token only for those.
  if (!body.action) {
    body.access_token = registerToken;
  }

  const headers = {
    "Content-Type": "application/json",
  };
  if (proxySecret) {
    headers["x-nnrg-proxy-key"] = proxySecret;
  }
  if (req.headers.origin) {
    headers["x-forwarded-origin"] = String(req.headers.origin);
  }

  try {
    const upstream = await fetch(smartApiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: "Invalid upstream response", raw: text.slice(0, 200) };
    }
    return res.status(upstream.status).json(data);
  } catch {
    return res.status(502).json({ error: "Registration service temporarily unavailable" });
  }
}
