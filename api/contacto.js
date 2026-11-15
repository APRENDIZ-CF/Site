/**
 * Função serverless (Vercel) que recebe os formulários do site e envia-os por e-mail.
 *
 * Variáveis de ambiente (Vercel → Project → Settings → Environment Variables):
 *   CONTACT_TO          destinatário (por omissão: jdsaprendiz@gmail.com)
 *   Opção A – Gmail:    GMAIL_USER + GMAIL_APP_PASSWORD (palavra-passe de aplicação Google)
 *   Opção B – Resend:   RESEND_API_KEY (+ opcional RESEND_FROM)
 */
const nodemailer = require("nodemailer");

const LABELS = {
  formulario: "Formulário", nome: "Nome", empresa: "Empresa", email: "E-mail", telefone: "Telefone",
  assunto: "Assunto", formacao: "Formação", data: "Data", horario: "Horário", hora: "Hora",
  participantes: "Nº de participantes", plano: "Plano", mensagem: "Mensagem", pagina: "Página",
};

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }

  // Anti-spam: campo invisível preenchido → fingimos sucesso e ignoramos
  if (body.website) return res.status(200).json({ ok: true });

  const nome = String(body.nome || "").trim();
  const email = String(body.email || "").trim();
  if (!nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Nome e e-mail válidos são obrigatórios." });
  }

  const rows = Object.keys(LABELS)
    .filter((k) => body[k] && String(body[k]).trim())
    .map((k) => [LABELS[k], String(body[k]).slice(0, 5000)]);
  const tipo = body.formulario || "Contacto";
  const subject = `[Site Aprendiz] ${tipo} – ${nome}`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  const html =
    `<h2 style="font-family:Georgia,serif;color:#0D3A01">${esc(tipo)}</h2><table cellpadding="6" style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">` +
    rows.map(([k, v]) => `<tr><td style="color:#6B6B6B;vertical-align:top;border-bottom:1px solid #eee"><b>${esc(k)}</b></td><td style="border-bottom:1px solid #eee;white-space:pre-wrap">${esc(v)}</td></tr>`).join("") +
    "</table>";
  const to = process.env.CONTACT_TO || "jdsaprendiz@gmail.com";

  try {
    if (process.env.RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Site Aprendiz <onboarding@resend.dev>",
          to: [to], reply_to: email, subject, text, html,
        }),
      });
      if (!r.ok) throw new Error("Resend " + r.status + " " + (await r.text()));
    } else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      });
      await transporter.sendMail({ from: `"Site Aprendiz" <${process.env.GMAIL_USER}>`, to, replyTo: email, subject, text, html });
    } else {
      console.error("Formulário recebido mas nenhum serviço de e-mail está configurado.", { subject, text });
      return res.status(503).json({ ok: false, error: "Serviço de e-mail não configurado." });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Erro ao enviar e-mail:", err);
    return res.status(502).json({ ok: false, error: "Falha no envio." });
  }
};
