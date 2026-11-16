/**
 * Recebe o comprovativo de transferência de uma inscrição e envia-o por e-mail
 * (em anexo) à Aprendiz, que confirma o pagamento e responde ao aluno.
 *
 * Corpo JSON: { codigo, nome, email, ficheiro: { name, type, data (base64) } }
 */
const { table, sendMail, mailConfigured, readBody, ADMIN_TO, EMAIL_RE } = require("./_mail");

const TIPOS = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
const MAX_BYTES = 3 * 1024 * 1024; // 3 MB (limite da Vercel para o pedido inteiro: 4,5 MB)

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }
  const body = readBody(req);
  if (body.website) return res.status(200).json({ ok: true });

  const codigo = String(body.codigo || "").trim().toUpperCase().slice(0, 30);
  const nome = String(body.nome || "").trim().slice(0, 200);
  const email = String(body.email || "").trim().slice(0, 200);
  const f = body.ficheiro || {};

  if (!/^AP-\d{6}-[A-Z0-9]{4}$/.test(codigo)) return res.status(400).json({ ok: false, error: "Código de inscrição inválido." });
  if (!nome || !EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: "Nome e e-mail válidos são obrigatórios." });
  const ext = TIPOS[f.type];
  if (!ext || typeof f.data !== "string") return res.status(400).json({ ok: false, error: "Envie um PDF ou uma imagem (JPG, PNG)." });
  const bytes = Buffer.byteLength(f.data, "base64");
  if (!bytes || bytes > MAX_BYTES) return res.status(413).json({ ok: false, error: "O ficheiro tem de ter até 3 MB." });
  if (!mailConfigured()) return res.status(503).json({ ok: false, error: "Serviço de e-mail não configurado." });

  const rows = [["Código", codigo], ["Nome", nome], ["E-mail", email], ["Ficheiro", String(f.name || "").slice(0, 200)]];
  try {
    await sendMail({
      to: ADMIN_TO(), replyTo: email,
      subject: `[Comprovativo] ${codigo} – ${nome}`,
      text: rows.map(([k, v]) => `${k}: ${v}`).join("\n") + "\n\nConfirme o valor no extrato e responda ao aluno a confirmar a vaga.",
      html: table("Comprovativo de pagamento recebido", rows) +
        `<p style="font-family:Arial,sans-serif;font-size:14px">Confirme o valor no extrato bancário e responda a este e-mail para confirmar a vaga ao aluno.</p>`,
      attachments: [{ filename: `comprovativo-${codigo}.${ext}`, content: f.data, contentType: f.type }],
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Erro ao enviar comprovativo:", err);
    return res.status(502).json({ ok: false, error: "Falha no envio." });
  }
};
