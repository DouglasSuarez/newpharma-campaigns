// netlify/functions/flows.js
const { klaviyo, ok, fail } = require("./_klaviyo");

exports.handler = async () => {
  try {
    const r = await klaviyo("/flows/?page[size]=50");
    const flows = (r.data || []).map((f) => ({
      name: (f.attributes && f.attributes.name) || "(sin nombre)",
      status: (f.attributes && f.attributes.status) || null,
    }));
    return ok({ flows });
  } catch (e) {
    return fail(e);
  }
};
