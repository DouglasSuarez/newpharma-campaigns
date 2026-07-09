// netlify/functions/klaviyo-debug-order.js
// Diagnóstico SEGURO: no devuelve datos personales, solo nombres de campos y
// verdaderos/falsos, para entender por qué no se resuelven los clientes.
const { klaviyo, ok, fail } = require("./_klaviyo");

async function placedOrderMetricId() {
  const r = await klaviyo("/metrics/");
  const metrics = r.data || [];
  const m = metrics.find((x) => (x.attributes && x.attributes.name) === "Placed Order")
    || metrics.find((x) => /placed order/i.test((x.attributes && x.attributes.name) || ""));
  return m ? m.id : null;
}

exports.handler = async () => {
  try {
    const metricId = await placedOrderMetricId();
    if (!metricId) return ok({ error: "No se encontró la métrica Placed Order" });

    const since = new Date(Date.now() - 6 * 30 * 24 * 3600 * 1000).toISOString();
    const filter = encodeURIComponent(`and(equals(metric_id,"${metricId}"),greater-or-equal(datetime,${since}))`);
    const r = await klaviyo(`/events/?filter=${filter}&include=profile&fields[profile]=email,first_name,last_name,phone_number&sort=-datetime`);

    const ev = (r.data || [])[0] || {};
    const a = ev.attributes || {};
    const props = a.event_properties || a.properties || {};
    const relId = ev.relationships && ev.relationships.profile && ev.relationships.profile.data
      ? ev.relationships.profile.data.id : null;

    const incl = (r.included || []).find((x) => x.type === "profile");
    const inclId = incl ? incl.id : null;
    const inclAttr = (incl && incl.attributes) || {};

    // Prueba 1: buscar por lote any(id)
    let anyId_count = null, anyId_error = null;
    if (relId) {
      try {
        const f2 = encodeURIComponent(`any(id,["${relId}"])`);
        const pr = await klaviyo(`/profiles/?filter=${f2}&fields[profile]=email,first_name,last_name,phone_number`);
        anyId_count = (pr.data || []).length;
      } catch (e) { anyId_error = e.message; }
    }

    // Prueba 2: buscar por id individual
    let getById_ok = null, getById_email_present = null, getById_error = null;
    if (relId) {
      try {
        const g = await klaviyo(`/profiles/${relId}/`);
        getById_ok = !!(g && g.data);
        getById_email_present = !!(g && g.data && g.data.attributes && g.data.attributes.email);
      } catch (e) { getById_error = e.message; }
    }

    return ok({
      metricId_encontrado: !!metricId,
      total_eventos_pagina: (r.data || []).length,
      event_attr_keys: Object.keys(a),
      event_property_keys: Object.keys(props),
      relacion_profile_id_presente: !!relId,
      included_presente: !!incl,
      included_vs_relacion_mismo_id: !!(relId && inclId && relId === inclId),
      included_email_presente: !!inclAttr.email,
      included_nombre_presente: !!inclAttr.first_name,
      included_telefono_presente: !!inclAttr.phone_number,
      anyId_count: anyId_count,
      anyId_error: anyId_error,
      getById_ok: getById_ok,
      getById_email_presente: getById_email_present,
      getById_error: getById_error,
    });
  } catch (e) {
    return fail(e);
  }
};
