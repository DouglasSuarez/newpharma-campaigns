// netlify/functions/segments.js
const { klaviyo, ok, fail } = require("./_klaviyo");

exports.handler = async () => {
  try {
    const r = await klaviyo("/segments/?additional-fields[segment]=profile_count");
    const segmentos = (r.data || [])
      .map((s) => ({
        id: s.id,
        name: (s.attributes && s.attributes.name) || "(sin nombre)",
        count: (s.attributes && s.attributes.profile_count) ?? null,
      }))
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 12);
    return ok({ segmentos });
  } catch (e) {
    return fail(e);
  }
};
