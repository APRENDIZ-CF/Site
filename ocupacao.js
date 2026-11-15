/**
 * Devolve os horários ocupados da sala de formação, lidos de um calendário Google.
 *
 * Variável de ambiente (Vercel → Settings → Environment Variables):
 *   GCAL_ICS_URL  endereço iCal do calendário "Sala de Formação"
 *                 (Google Calendar → Definições do calendário → "Endereço público/secreto no formato iCal")
 *
 * Resposta: { configured, busy: [{ date: "YYYY-MM-DD", start: "HH:MM", end: "HH:MM" }] } em hora de Luanda.
 * Os detalhes dos eventos (títulos, participantes) nunca são enviados ao navegador.
 */
const ical = require("node-ical");

const TZ_OFFSET_MIN = 60;          // Luanda = UTC+1 (sem horário de verão)
const OPEN = 8 * 60, CLOSE = 20 * 60;
const DAYS_AHEAD = 130;

const pad = (n) => String(n).padStart(2, "0");
const toLocal = (d) => new Date(d.getTime() + TZ_OFFSET_MIN * 60000); // usar getUTC* depois
const dateKey = (l) => `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}`;
const hm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

// Converte um intervalo [start,end) em blocos diários dentro do horário de funcionamento
function split(start, end, out) {
  let s = toLocal(start), e = toLocal(end);
  while (s < e) {
    const dayStart = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const segEnd = e < dayEnd ? e : dayEnd;
    const from = Math.max(OPEN, (s - dayStart) / 60000);
    const to = Math.min(CLOSE, (segEnd - dayStart) / 60000);
    if (to > from) out.push({ date: dateKey(dayStart), start: hm(Math.floor(from)), end: hm(Math.ceil(to)) });
    s = dayEnd;
  }
}

// Eventos de dia inteiro vêm como datas "flutuantes"; tratamo-las como o dia inteiro em Luanda
function bounds(ev, start, end) {
  if (ev.datetype === "date") {
    const s = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) - TZ_OFFSET_MIN * 60000);
    const e = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - TZ_OFFSET_MIN * 60000);
    return [s, e > s ? e : new Date(s.getTime() + 86400000)];
  }
  return [start, end];
}

async function busyFromIcs(text, now = new Date()) {
  const data = ical.sync.parseICS(text);
  const winStart = new Date(now.getTime() - 86400000);
  const winEnd = new Date(now.getTime() + DAYS_AHEAD * 86400000);
  const out = [];
  for (const ev of Object.values(data)) {
    if (!ev || ev.type !== "VEVENT" || !ev.start) continue;
    if (ev.transparency === "TRANSPARENT" || ev.status === "CANCELLED") continue;
    const dur = (ev.end ? ev.end.getTime() : ev.start.getTime() + 3600000) - ev.start.getTime();
    if (ev.rrule) {
      const occ = ev.rrule.between(new Date(winStart.getTime() - dur), winEnd, true);
      for (const o of occ) {
        const key = o.toISOString().slice(0, 10);
        if (ev.exdate && Object.keys(ev.exdate).some((k) => k.slice(0, 10) === key)) continue;
        const override = ev.recurrences && Object.entries(ev.recurrences).find(([k]) => k.slice(0, 10) === key);
        if (override) continue; // tratado abaixo como evento próprio
        const s = ev.datetype === "date" ? new Date(o.getUTCFullYear(), o.getUTCMonth(), o.getUTCDate()) : o;
        const e = new Date(s.getTime() + dur);
        const [bs, be] = bounds(ev, s, e);
        if (be > winStart && bs < winEnd) split(bs, be, out);
      }
      for (const r of Object.values(ev.recurrences || {})) {
        if (r.status === "CANCELLED") continue;
        const [bs, be] = bounds(r, r.start, r.end || new Date(r.start.getTime() + dur));
        if (be > winStart && bs < winEnd) split(bs, be, out);
      }
    } else {
      const [bs, be] = bounds(ev, ev.start, ev.end || new Date(ev.start.getTime() + 3600000));
      if (be > winStart && bs < winEnd) split(bs, be, out);
    }
  }
  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  const url = process.env.GCAL_ICS_URL;
  if (!url) return res.status(200).json({ configured: false, busy: [] });
  try {
    const r = await fetch(url, { headers: { "User-Agent": "aprendiz-site" } });
    if (!r.ok) throw new Error("ICS " + r.status);
    const busy = await busyFromIcs(await r.text());
    return res.status(200).json({ configured: true, busy });
  } catch (err) {
    console.error("Erro ao ler o calendário:", err);
    return res.status(200).json({ configured: true, error: true, busy: [] });
  }
};
module.exports.busyFromIcs = busyFromIcs;
