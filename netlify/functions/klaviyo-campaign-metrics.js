// netlify/functions/klaviyo-campaign-metrics.js
const { klaviyo, ok, fail } = require("./_klaviyo");

const TIMEFRAMES = ["last_30_days", "last_90_days", "last_12_months", "last_365_days", "this_month", "last_month"];

async function placedOrderMetricId() {
  const r = await klaviyo("/metrics/");
  const metrics = r.data || [];
  const exact = metrics.find((x) => (x.attributes && x.attributes.name) === "Placed Order");
  const fuzzy = metrics.find((x) => /placed order/i.test((x.attributes && x.attributes.name) || ""));
  return (exact || fuzzy || null) && (exact || fuzzy).id;
}

async function emailCampaignNames() {
  const filter = encodeURIComponent('equals(messages.channel,"email")');
  const map = {};
  let cursor = null, pages = 0;
  do {
    const path = `/campaigns/?filter=${filter}&sort=-created_at` + (cursor ? `&page[cursor]=${encodeURIComponent(cursor)}` : "");
    const r = await klaviyo(path);
    (r.data || []).forEach((c) => { map[c.id] = (c.attributes && c.attributes.name) || "(sin nombre)"; });
    cursor = r.links && r.links.next ? new URL(r.links.next).searchParams.get("page[cursor]") : null;
    pages++;
  } while (cursor && pages < 4);
  return map;
}

exports.handler = async (event) => {
  try {
    const p = event.queryStringParameters || {};
    let tf = p.timeframe || "last_30_days";
    if (!TIMEFRAMES.includes(tf)) tf = "last_30_days";

    const metricId = await placedOrderMetricId();
    if (!metricId) {
      const e = new Error("No encontré la métrica 'Placed Order' en tu cuenta de Klaviyo.");
      e.status = 404;
      throw e;
    }

    const body = {
      data: {
        type: "campaign-values-report",
        attributes: {
          timeframe: { key: tf },
          conversion_metric_id: metricId,
          statistics: ["recipients", "open_rate", "click_rate", "conversions", "conversion_value"],
        },
      },
    };

    const rep = await klaviyo("/campaign-values-reports/", { method: "POST", body });
    const results = (rep.data && rep.data.attributes && rep.data.attributes.results) || [];
    const names = await emailCampaignNames();

    const campanas = results
      .map((r) => {
        const g = r.groupings || {};
        const s = r.statistics || {};
        const id = g.campaign_id;
        return {
          id,
          nombre: names[id] || null,
          enviados: s.recipients || 0,
          aperturaPct: s.open_rate != null ? s.open_rate * 100 : null,
          clicPct: s.click_rate != null ? s.click_rate * 100 : null,
          conversiones: s.conversions || 0,
          ingresos: s.conversion_value || 0,
        };
      })
      .filter((c) => c.nombre) // solo campañas de email (las que aparecen en el mapa de nombres)
      .sort((a, b) => (b.ingresos || 0) - (a.ingresos || 0))
      .slice(0, 50);

    return ok({ campanas, timeframe: tf });
  } catch (e) {
    return fail(e);
  }
};
