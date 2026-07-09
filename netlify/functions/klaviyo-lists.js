// netlify/functions/lists.js
const { klaviyo, ok, fail } = require("./_klaviyo");

exports.handler = async () => {
  try {
    const r = await klaviyo("/lists/?additional-fields[list]=profile_count");
    const listas = (r.data || [])
      .map((l) => ({
        id: l.id,
        name: (l.attributes && l.attributes.name) || "(sin nombre)",
        count: (l.attributes && l.attributes.profile_count) ?? null,
      }))
      .sort((a, b) => (b.count || 0) - (a.count || 0));
    return ok({ listas });
  } catch (e) {
    return fail(e);
  }
};
