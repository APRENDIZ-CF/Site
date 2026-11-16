/**
 * Envio de e-mails partilhado pelas funções do site (Resend ou Gmail).
 * Ver api/contacto.js para as variáveis de ambiente.
 */
const nodemailer = require("nodemailer");

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ADMIN_TO = () => process.env.CONTACT_TO || "jdsaprendiz@gmail.com";

const mailConfigured = () => !!(process.env.RESEND_API_KEY || (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD));

/** Tabela HTML simples com pares [rótulo, valor]. */
const table = (title, rows) =>
  `<h2 style="font-family:Georgia,serif;color:#0D3A01">${esc(title)}</h2><table cellpadding="6" style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">` +
  rows.map(([k, v]) => `<tr><td style="color:#6B6B6B;vertical-align:top;border-bottom:1px solid #eee"><b>${esc(k)}</b></td><td style="border-bottom:1px solid #eee;white-space:pre-wrap">${esc(v)}</td></tr>`).join("") +
  "</table>";

/**
 * Envia um e-mail (content dos anexos em base64).
 * @param {{to:string, replyTo?:string, subject:string, text:string, html:string,
 *          attachments?: {filename:string, content:string, contentType?:string}[]}} m
 */
async function sendMail(m) {
  const attachments = m.attachments || [];
  if (process.env.RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Site Aprendiz <onboarding@resend.dev>",
        to: [m.to], reply_to: m.replyTo, subject: m.subject, text: m.text, html: m.html,
        attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })),
      }),
    });
    if (!r.ok) throw new Error("Resend " + r.status + " " + (await r.text()));
  } else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    await transporter.sendMail({
      from: `"Aprendiz – Consultoria & Formação" <${process.env.GMAIL_USER}>`,
      to: m.to, replyTo: m.replyTo, subject: m.subject, text: m.text, html: m.html,
      attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, encoding: "base64", contentType: a.contentType })),
    });
  } else {
    throw new Error("Nenhum serviço de e-mail configurado.");
  }
}

/** Lê o corpo JSON do pedido (a Vercel já o converte, mas por vezes chega como texto). */
const readBody = (req) => {
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  return body;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = { esc, table, sendMail, mailConfigured, readBody, ADMIN_TO, EMAIL_RE };
