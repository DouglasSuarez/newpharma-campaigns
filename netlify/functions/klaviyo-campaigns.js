// netlify/functions/campaigns.js
const { klaviyo, ok, fail } = require("./_klaviyo");

async function porCanal(channel) {
  const filter = encodeURIComponent(`equals(messages.channel,"${channel}")`);
  const r = await klaviyo(`/campaigns/?filter=${filter}&sort=-created_at&page[size]=10`);
  return (r.data || []).map((c) => ({
    name: (c.attributes && c.attributes.name) || "(sin nombre)",
    channel,
    status: (c.attributes && c.attributes.status) || null,
    created: (c.attributes && c.attributes.created_at) || null,
  }));
}

exports.handler = async () => {
  try {
    const [email, sms] = await Promise.all([
      porCanal("email"),
      porCanal("sms").catch(() => []),
    ]);
    const campanas = [...email, ...sms]
      .sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0))
      .slice(0, 15);
    return ok({ campanas });
  } catch (e) {
    return fail(e);
  }
};
