/**
 * Pedido de reserva da sala de formação (página aluguer-sala.html).
 *
 * Envia um e-mail para a Aprendiz (CONTACT_TO) com o comprovativo de pagamento e o documento de identificação em anexo e os
 * botões "Confirmar reserva" / "Anular reserva" (tratados pelo Apps Script, que marca o horário
 * no Google Calendar "Sala de Formação"), e uma cópia do pedido ao cliente (sem os botões).
 * Guarda também o documento na Google Drive (se configurada).
 * GET /api/reserva devolve os dados bancários da conta da sala (para mostrar na página).
 * Dados bancários: api/_pagamento.js (SALA)
 */
const { table, sendMail, mailConfigured, readBody, ADMIN_TO, EMAIL_RE } = require("./_mail");
const { SALA } = require("./_pagamento");
const crypto = require("crypto");
const { ficheiroValido, slug, guardarNaDrive } = require("./_ficheiros");

const CLAUSULAS = [
  "Acesso à sala apenas nas datas e horas marcadas",
  "Troca de datas/horas só com notificação de 24 horas de antecedência e se houver vaga",
  "Ressarcimento por cancelamento só com notificação de 24 horas de antecedência",
  "Reparação ou troca de bens danificados",
];

/** Ligações assinadas (HMAC com DRIVE_UPLOAD_TOKEN) para o Apps Script confirmar/anular. */
function acoes(p) {
  const url = process.env.DRIVE_UPLOAD_URL, token = process.env.DRIVE_UPLOAD_TOKEN;
  if (!url || !token) return null;
  const link = (acao) => {
    const sig = crypto.createHmac("sha256", token).update([acao, p.id, p.data, p.inicio, p.fim, p.nome, p.email].join("|"), "utf8").digest("hex");
    const q = new URLSearchParams({ acao, id: p.id, data: p.data, inicio: p.inicio, fim: p.fim, nome: p.nome, email: p.email, sig });
    return `${url}?${q.toString()}`;
  };
  return { confirmar: link("confirmar"), anular: link("anular") };
}

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
  const dataIso = s("data_iso", 10), inicio = s("inicio", 5), fim = s("fim", 5);
  const hoje = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10); // Luanda

  if (!nome || !EMAIL_RE.test(email)) return erro(res, 400, "Nome e e-mail válidos são obrigatórios.");
  if (!telefone) return erro(res, 400, "O telefone é obrigatório.");
  if (!data || !horario || !/^\d{4}-\d{2}-\d{2}$/.test(dataIso) || !/^\d{2}:\d{2}$/.test(inicio) || !/^\d{2}:\d{2}$/.test(fim)) {
    return erro(res, 400, "Escolha o dia e o horário no calendário.");
  }
  for (let i = 1; i <= CLAUSULAS.length; i++) {
    if (s("aceita_" + i, 5) !== "Sim") return erro(res, 400, "É necessário concordar com todas as condições.");
  }
  const extComp = ficheiroValido(body.comprovativo);
  if (!extComp) return erro(res, 400, "Carregue o comprovativo de pagamento (PDF ou foto, até 3 MB).");
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
    ["Anexos", "Comprovativo de pagamento e documento de identificação"],
    ["Data do pedido", hoje.split("-").reverse().join("/")],
    ["Estado", "A confirmar disponibilidade e pagamento pela Aprendiz"],
  ].filter(([, v]) => v);
  const attachments = [{
    filename: `comprovativo-${slug(nome)}.${extComp}`,
    content: body.comprovativo.data, contentType: body.comprovativo.type,
  }, {
    filename: `documento-identificacao-${slug(nome)}.${ext}`,
    content: body.documento_ficheiro.data, contentType: body.documento_ficheiro.type,
  }];
  const nota = "A Aprendiz vai confirmar a disponibilidade da sala e enviar a confirmação da reserva por e-mail.";

  // Botões Confirmar / Anular (ligações assinadas para o Apps Script)
  const botoes = acoes({ id: crypto.randomBytes(5).toString("hex"), data: dataIso, inicio, fim, nome: nome.slice(0, 80), email });
  const htmlBotoes = botoes
    ? `<p style="font-family:Arial,sans-serif;font-size:15px;margin:24px 0 8px"><b>Depois de verificar a disponibilidade e o pagamento:</b></p>` +
      `<p><a href="${botoes.confirmar}" style="display:inline-block;background:#0D3A01;color:#fff;padding:12px 22px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;border-radius:4px">✅ Confirmar reserva</a>&nbsp;&nbsp;` +
      `<a href="${botoes.anular}" style="display:inline-block;background:#B3261E;color:#fff;padding:12px 22px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;border-radius:4px">❌ Anular reserva</a></p>` +
      `<p style="font-family:Arial,sans-serif;font-size:13px;color:#6B6B6B">Confirmar marca o horário como ocupado no calendário do site e avisa o cliente por e-mail. Anular liberta o horário (use-o se a reserva já tinha sido confirmada).</p>`
    : `<p style="font-family:Arial,sans-serif;font-size:13px;color:#6B6B6B">(Os botões Confirmar/Anular aparecem quando o script da Google estiver configurado na Vercel.)</p>`;
  const textoBotoes = botoes ? `\n\nConfirmar reserva: ${botoes.confirmar}\nAnular reserva: ${botoes.anular}` : "";
  const assunto = `Reserva de sala – ${data}, ${horario} – ${nome}`;
  const corpoTexto = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  const rodape = `<p style="font-family:Arial,sans-serif;font-size:14px">Aprendiz – Consultoria &amp; Formação · +244 923 35 35 34</p>`;

  try {
    await sendMail({
      to: ADMIN_TO(), replyTo: email, subject: assunto,
      text: corpoTexto + textoBotoes + "\n\nAprendiz – Consultoria & Formação · +244 923 35 35 34",
      html: table("Pedido de reserva da sala de formação", rows) + htmlBotoes + rodape,
      attachments,
    });
  } catch (err) {
    console.error("Erro ao enviar e-mail de reserva:", err);
    return erro(res, 502, "Falha no envio.");
  }
  // Cópia para o cliente (sem anexo e sem botões); não bloqueia o pedido se falhar
  try {
    await sendMail({
      to: email, replyTo: ADMIN_TO(), subject: "Recebemos o seu pedido de reserva – " + data + ", " + horario,
      text: corpoTexto + "\n\n" + nota + "\n\nAprendiz – Consultoria & Formação · +244 923 35 35 34",
      html: table("Pedido de reserva da sala de formação", rows.filter(([k]) => k !== "Anexos")) +
        `<p style="font-family:Arial,sans-serif;font-size:14px;color:#6B6B6B">${nota}</p>` + rodape,
    });
  } catch (err) {
    console.error("Erro ao enviar cópia ao cliente:", err);
  }
  await guardarNaDrive("Reservas de sala", `${hoje} ${nome} – ${data} ${horario}`, attachments,
    rows.map(([k, v]) => `${k}: ${v}`).join("\n"));
  return res.status(200).json({ ok: true });
};
