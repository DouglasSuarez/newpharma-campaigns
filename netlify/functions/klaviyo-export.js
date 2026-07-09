// netlify/functions/export-profiles.js
const { klaviyo, ok, fail } = require("./_klaviyo");

function pathFor(source, id, cursor) {
  const size = "page[size]=100";
  const cur = cursor ? `&page[cursor]=${encodeURIComponent(cursor)}` : "";
  if (source === "segment") return `/segments/${id}/profiles/?${size}${cur}`;
  if (source === "list") return `/lists/${id}/profiles/?${size}${cur}`;
  return `/profiles/?${size}&additional-fields[profile]=subscriptions${cur}`;
}

const consentOf = (subs, canal) => {
  try { return (subs[canal] && subs[canal].marketing && subs[canal].marketing.consent) || ""; }
  catch { return ""; }
};

exports.handler = async (event) => {
  try {
    const p = event.queryStringParameters || {};
    const source = p.source || "all";
    const id = p.id || "";
    const cursor = p.cursor || "";

    if ((source === "segment" || source === "list") && !id) {
      const err = new Error("Falta el id de la lista o segmento.");
      err.status = 400;
      throw err;
    }

    const r = await klaviyo(pathFor(source, id, cursor));

    const rows = (r.data || []).map((pr) => {
      const a = pr.attributes || {};
      const loc = a.location || {};
      const subs = a.subscriptions || {};
      return {
        id: pr.id,
        email: a.email || "",
        telefono: a.phone_number || "",
        nombre: a.first_name || "",
        apellido: a.last_name || "",
        organizacion: a.organization || "",
        cargo: a.title || "",
        region: loc.region || "",
        ciudad: loc.city || "",
        pais: loc.country || "",
        direccion: loc.address1 || "",
        codigo_postal: loc.zip || "",
        creado: a.created || "",
        consentimiento_email: consentOf(subs, "email"),
        consentimiento_sms: consentOf(subs, "sms"),
      };
    });

    const next = r.links && r.links.next
      ? new URL(r.links.next).searchParams.get("page[cursor]")
      : null;

    return ok({ rows, next });
  } catch (e) {
    return fail(e);
  }
};
