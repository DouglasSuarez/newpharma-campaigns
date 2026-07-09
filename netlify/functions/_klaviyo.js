// netlify/functions/_klaviyo.js  (CommonJS, para el sitio estático de campañas)
const BASE = "https://a.klaviyo.com/api";

// Klaviyo versiona su API por fecha. Si una llamada devuelve error de "revision",
// actualiza este valor con la fecha vigente de:
// https://developers.klaviyo.com/en/reference/api_overview
const REVISION = "2024-10-15";

async function klaviyo(path, { method = "GET", body } = {}) {
  const key = process.env.KLAVIYO_API_KEY;
  if (!key) throw new Error("Falta la variable de entorno KLAVIYO_API_KEY.");

  let attempt = 0;
  while (true) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        Authorization: `Klaviyo-API-Key ${key}`,
        accept: "application/json",
        "content-type": "application/json",
        revision: REVISION,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Si Klaviyo pide esperar (límite de peticiones), reintentamos con pausa.
    if ((res.status === 429 || res.status === 503) && attempt < 3) {
      const ra = parseFloat(res.headers.get("Retry-After") || "") || 1.5 * (attempt + 1);
      await new Promise((r) => setTimeout(r, Math.min(ra, 4) * 1000));
      attempt++;
      continue;
    }

    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

    if (!res.ok) {
      const detail = (json.errors && json.errors[0] && json.errors[0].detail) || json.raw || res.statusText;
      const err = new Error(`Klaviyo ${res.status}: ${detail}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }
}

const ok = (data) => ({
  statusCode: 200,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(data),
});

const fail = (e) => ({
  statusCode: e.status || 500,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ error: e.message || "Error inesperado" }),
});

module.exports = { klaviyo, ok, fail };
