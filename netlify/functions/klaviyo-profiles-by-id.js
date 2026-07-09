// netlify/functions/klaviyo-profiles-by-id.js
const { klaviyo, ok, fail } = require("./_klaviyo");

// Resuelve los datos de cada cliente pidiéndolo por su propio id (endpoint
// más confiable). Se limita a 15 por llamada para no exceder el timeout;
// el frontend hace varias llamadas en tandas.
exports.handler = async (event) => {
  try {
    const p = event.queryStringParameters || {};
    const ids = (p.ids || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 15);
    const profiles = {};
    for (const id of ids) {
      try {
        const r = await klaviyo(`/profiles/${id}/`);
        const a = (r.data && r.data.attributes) || {};
        profiles[id] = {
          email: a.email || "",
          nombre: a.first_name || "",
          apellido: a.last_name || "",
          telefono: a.phone_number || "",
        };
      } catch (_) { /* si un perfil no se puede leer, se omite */ }
    }
    return ok({ profiles });
  } catch (e) {
    return fail(e);
  }
};
