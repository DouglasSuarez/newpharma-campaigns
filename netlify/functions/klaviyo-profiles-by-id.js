// netlify/functions/klaviyo-profiles-by-id.js
const { klaviyo, ok, fail } = require("./_klaviyo");

exports.handler = async (event) => {
  try {
    const p = event.queryStringParameters || {};
    const ids = (p.ids || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 90);
    if (!ids.length) return ok({ profiles: {} });

    const idFilter = encodeURIComponent(`any(id,["${ids.join('","')}"])`);
    const r = await klaviyo(`/profiles/?filter=${idFilter}&fields[profile]=email,first_name,last_name,phone_number`);

    const profiles = {};
    (r.data || []).forEach((pr) => {
      const a = pr.attributes || {};
      profiles[pr.id] = {
        email: a.email || "",
        nombre: a.first_name || "",
        apellido: a.last_name || "",
        telefono: a.phone_number || "",
      };
    });

    return ok({ profiles });
  } catch (e) {
    return fail(e);
  }
};
