/**
 * Pedido de reserva da sala de formação (página aluguer-sala.html).
 *
 * Envia UM único e-mail para a Aprendiz (CONTACT_TO), com o cliente em cópia (CC) e o
 * documento de identificação em anexo, e guarda uma cópia na Google Drive (se configurada).
 * GET /api/reserva devolve os dados bancários da conta da sala (para mostrar na página).
 * Dados bancários: api/_pagamento.js (SALA)
 */
const { table, sendMail, mailConfigured, readBody, ADMIN_TO, EMAIL_RE } = require("./_mail");
const { SALA } = require("./_pagamento");
const { ficheiroValido, slug, guardarNaDrive } = require("./_ficheiros");

const CLAUSULAS = [
  "Acesso à sala apenas nas datas e horas marcadas",
  "Troca de datas/horas só com notificação de 24 horas de antecedência e se houver vaga",
  "Ressarcimento por cancelamento só com notificação de 24 horas de antecedência",
  "Devolução de 100% se a conta for do BAI; outros bancos com desconto de 2.500 Kz",
  "Reparação ou troca de bens danificados",
];

const erro = (res, status, msg) => res.status(status).json({ ok: false, error: msg });

module.exports = async (req, res) => {
  if (req.method === "GET") {
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).json({ ok: true, iban: SALA.IBAN, titular: SALA.TITULAR, banco: SALA.BANCO });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return erro(res, 405, "Método não permitido");
  }
  const body = readBody(req);
  if (body.website) return res.status(200).json({ ok: true }); // anti-spam

  const s = (k, max = 300) => String(body[k] || "").trim().slice(0, max);
  const nome = s("nome"), empresa = s("empresa"), email = s("email"), telefone = s("telefone", 40);
  const data = s("data", 80), horario = s("horario", 60), valor = s("valor", 40), mensagem = s("mensagem", 2000);
  const hoje = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10); // Luanda

  if (!nome || !EMAIL_RE.test(email)) return erro(res, 400, "Nome e e-mail válidos são obrigatórios.");
  if (!telefone) return erro(res, 400, "O telefone é obrigatório.");
  if (!data || !horario) return erro(res, 400, "Escolha o dia e o horário no calendário.");
  for (let i = 1; i <= CLAUSULAS.length; i++) {
    if (s("aceita_" + i, 5) !== "Sim") return erro(res, 400, "É necessário concordar com todas as condições.");
  }
  const ext = ficheiroValido(body.documento_ficheiro);
  if (!ext) return erro(res, 400, "Carregue o documento de identificação (PDF ou foto, até 3 MB).");
  if (!mailConfigured()) {
    console.error("Reserva recebida mas nenhum serviço de e-mail está configurado.", { nome, email, data });
    return erro(res, 503, "Serviço de e-mail não configurado.");
  }

  const rows = [
    ["Data", data], ["Horário", horario], ["Valor estimado", valor],
    ["Nome", nome], ["Empresa", empresa], ["E-mail", email], ["Telefone", telefone], ["Mensagem", mensagem],
    ...CLAUSULAS.map((c) => [c, "Concorda"]),
    ["Pagamento", `Transferência para ${SALA.IBAN} (${SALA.BANCO} – ${SALA.TITULAR})`],
    ["Anexo", "Documento de identificação"],
    ["Data do pedido", hoje.split("-").reverse().join("/")],
    ["Estado", "A confirmar disponibilidade pela Aprendiz"],
  ].filter(([, v]) => v);
  const attachments = [{
    filename: `documento-identificacao-${slug(nome)}.${ext}`,
    content: body.documento_ficheiro.data, contentType: body.documento_ficheiro.type,
  }];
  const nota = "A Aprendiz vai confirmar a disponibilidade da sala e responder por e-mail ou WhatsApp. Este e-mail foi enviado para a Aprendiz com cópia para o cliente.";

  try {
    await sendMail({
      to: ADMIN_TO(), cc: email, replyTo: email,
      subject: `Reserva de sala – ${data}, ${horario} – ${nome}`,
      text: rows.map(([k, v]) => `${k}: ${v}`).join("\n") + "\n\n" + nota + "\n\nAprendiz – Consultoria & Formação · +244 923 35 35 34",
      html: table("Pedido de reserva da sala de formação", rows) +
        `<p style="font-family:Arial,sans-serif;font-size:14px;color:#6B6B6B">${nota}</p>` +
        `<p style="font-family:Arial,sans-serif;font-size:14px">Aprendiz – Consultoria &amp; Formação · +244 923 35 35 34</p>`,
      attachments,
    });
  } catch (err) {
    console.error("Erro ao enviar e-mail de reserva:", err);
    return erro(res, 502, "Falha no envio.");
  }
  await guardarNaDrive("Reservas de sala", `${hoje} ${nome} – ${data} ${horario}`, attachments,
    rows.map(([k, v]) => `${k}: ${v}`).join("\n"));
  return res.status(200).json({ ok: true });
};
