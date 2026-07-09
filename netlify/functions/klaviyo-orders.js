// netlify/functions/klaviyo-orders.js
const { klaviyo, ok, fail } = require("./_klaviyo");

async function placedOrderMetricId() {
  const r = await klaviyo("/metrics/");
  const metrics = r.data || [];
  const exact = metrics.find((x) => (x.attributes && x.attributes.name) === "Placed Order");
  const fuzzy = metrics.find((x) => /placed order/i.test((x.attributes && x.attributes.name) || ""));
  return (exact || fuzzy || null) && (exact || fuzzy).id;
}

exports.handler = async (event) => {
  try {
    const p = event.queryStringParameters || {};
    const months = Math.max(1, parseInt(p.months || "6"));
    const cursor = p.cursor || "";
    let metricId = p.metricId || "";

    if (!metricId) {
      metricId = await placedOrderMetricId();
      if (!metricId) {
        const e = new Error("No encontré la métrica 'Placed Order' en tu cuenta de Klaviyo.");
        e.status = 404;
        throw e;
      }
    }

    const since = new Date(Date.now() - months * 30 * 24 * 3600 * 1000).toISOString();
    const filter = encodeURIComponent(`and(equals(metric_id,"${metricId}"),greater-or-equal(datetime,${since}))`);
    const base = `/events/?filter=${filter}&include=profile&fields[profile]=email,first_name,last_name,phone_number&sort=-datetime`;
    const path = cursor ? `${base}&page[cursor]=${encodeURIComponent(cursor)}` : base;

    const r = await klaviyo(path);

    // Mapa de perfiles desde "included"
    const profiles = {};
    (r.included || []).forEach((inc) => {
      if (inc.type === "profile") {
        const a = inc.attributes || {};
        profiles[inc.id] = {
          email: a.email || "",
          nombre: a.first_name || "",
          apellido: a.last_name || "",
          telefono: a.phone_number || "",
        };
      }
    });

    const rows = (r.data || []).map((ev) => {
      const a = ev.attributes || {};
      const props = a.event_properties || a.properties || {};
      const valor = Number(props["$value"] || props.value || a.value || 0) || 0;
      const pid = ev.relationships && ev.relationships.profile && ev.relationships.profile.data
        ? ev.relationships.profile.data.id : null;
      const prof = (pid && profiles[pid]) || {};
      return {
        profileId: pid,
        email: prof.email || "",
        nombre: prof.nombre || "",
        apellido: prof.apellido || "",
        telefono: prof.telefono || "",
        valor,
        fecha: a.datetime || a.timestamp || "",
      };
    });

    const next = r.links && r.links.next
      ? new URL(r.links.next).searchParams.get("page[cursor]")
      : null;

    return ok({ rows, next, metricId, months });
  } catch (e) {
    return fail(e);
  }
};
