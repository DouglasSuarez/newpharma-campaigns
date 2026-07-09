// netlify/functions/profiles.js
const { klaviyo, ok, fail } = require("./_klaviyo");

const MAX_PAGES = 8; // 8 x 100 = hasta 800 perfiles (evita timeout de 10s)

const rangoEtario = (age) => {
  if (age == null || isNaN(age)) return null;
  if (age < 18) return "<18";
  if (age < 25) return "18-24";
  if (age < 35) return "25-34";
  if (age < 45) return "35-44";
  if (age < 55) return "45-54";
  if (age < 65) return "55-64";
  return "65+";
};
const edadDe = (props) => {
  if (props && props.age != null && !isNaN(Number(props.age))) return Number(props.age);
  const b = props && (props.birthday || props.birth_date || props.fecha_nacimiento);
  if (b) { const y = new Date(b).getFullYear(); if (!isNaN(y)) return new Date().getFullYear() - y; }
  return null;
};
const generoDe = (props) => {
  const g = props && (props.gender || props.genero || props.sexo);
  if (!g) return null;
  const s = String(g).trim().toLowerCase();
  if (["f", "female", "femenino", "mujer", "w"].includes(s)) return "Femenino";
  if (["m", "male", "masculino", "hombre"].includes(s)) return "Masculino";
  return String(g);
};

exports.handler = async () => {
  try {
    const genero = {}, edad = {}, ubic = {};
    let total = 0, cursor = null, pages = 0, truncado = false;

    do {
      const q = cursor
        ? `?page[size]=100&page[cursor]=${encodeURIComponent(cursor)}`
        : "?page[size]=100";
      const r = await klaviyo(`/profiles/${q}`);
      for (const p of r.data || []) {
        total++;
        const a = p.attributes || {};
        const props = a.properties || {};
        const loc = a.location || {};
        const lugar = loc.region || loc.city || loc.country;
        if (lugar) ubic[lugar] = (ubic[lugar] || 0) + 1;
        const g = generoDe(props);
        if (g) genero[g] = (genero[g] || 0) + 1;
        const rr = rangoEtario(edadDe(props));
        if (rr) edad[rr] = (edad[rr] || 0) + 1;
      }
      const next = r.links && r.links.next;
      cursor = next ? new URL(next).searchParams.get("page[cursor]") : null;
      pages++;
      if (cursor && pages >= MAX_PAGES) { truncado = true; cursor = null; }
    } while (cursor);

    const pct = (obj) => {
      const sum = Object.values(obj).reduce((a, b) => a + b, 0) || 1;
      return Object.entries(obj).map(([k, v]) => ({ k, v, p: (v / sum) * 100 }));
    };
    const orden = ["<18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

    const generoArr = pct(genero).map((x) => ({ categoria: x.k, porcentaje: +x.p.toFixed(1) }));
    const edadArr = pct(edad).sort((a, b) => orden.indexOf(a.k) - orden.indexOf(b.k))
      .map((x) => ({ rango: x.k, porcentaje: +x.p.toFixed(1) }));
    const ubicArr = pct(ubic).sort((a, b) => b.v - a.v).slice(0, 8)
      .map((x) => ({ lugar: x.k, perfiles: x.v, porcentaje: +x.p.toFixed(1) }));

    const partes = [`Muestra de ${total} perfiles${truncado ? " (limitada para evitar timeout)" : ""}.`];
    if (!generoArr.length) partes.push("Sin propiedad de género en los perfiles.");
    if (!edadArr.length) partes.push("Sin edad/cumpleaños en los perfiles.");

    return ok({ muestra: total, genero: generoArr, edad: edadArr, ubicacion: ubicArr, nota: partes.join(" ") });
  } catch (e) {
    return fail(e);
  }
};
