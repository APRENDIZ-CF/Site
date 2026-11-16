/**
 * Inscrição numa formação com pagamento por transferência bancária (IBAN).
 *
 * 1. Gera um código de inscrição único (ex.: AP-261116-K7QM).
 * 2. Envia um e-mail à Aprendiz com os dados do aluno.
 * 3. Envia um e-mail ao aluno com o IBAN, o valor e o código a pôr no descritivo.
 * 4. Devolve ao site os dados de pagamento para mostrar no ecrã.
 *
 * Empresas: preço sob consulta — não há passo de pagamento; a Aprendiz recebe o
 * pedido por e-mail e envia a proposta por e-mail ou WhatsApp.
 * GET /api/inscricao devolve os preços (para mostrar no formulário).
 *
 * Dados bancários e preços: api/_pagamento.js
 */
const crypto = require("crypto");
const { table, sendMail, mailConfigured, readBody, ADMIN_TO, EMAIL_RE, esc } = require("./_mail");
const { IBAN, TITULAR, BANCO, PRECOS, formatKz } = require("./_pagamento");

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O, 1/I para não confundir

function novoCodigo() {
  const d = new Date(Date.now() + 60 * 60 * 1000); // hora de Luanda (UTC+1)
  const data = d.toISOString().slice(2, 10).replace(/-/g, "");
  let sufixo = "";
  for (let i = 0; i < 4; i++) sufixo += ALFABETO[crypto.randomInt(ALFABETO.length)];
  return `AP-${data}-${sufixo}`;
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const precos = {};
    for (const k of Object.keys(PRECOS)) precos[k] = formatKz(PRECOS[k]);
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).json({ ok: true, precos });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }
  const body = readBody(req);
  if (body.website) return res.status(200).json({ ok: true }); // anti-spam

  const s = (k, max = 300) => String(body[k] || "").trim().slice(0, max);
  const nome = s("nome"), email = s("email"), telefone = s("telefone", 40), empresa = s("empresa");
  const formacao = s("formacao"), modalidade = s("modalidade", 40), obs = s("mensagem", 2000);
  const isEmpresa = s("tipo", 20) === "Empresa";

  if (!nome || !EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: "Nome e e-mail válidos são obrigatórios." });
  if (!telefone) return res.status(400).json({ ok: false, error: "O telefone é obrigatório." });
  if (isEmpresa && !empresa) return res.status(400).json({ ok: false, error: "Indique o nome da empresa." });
  if (!Object.prototype.hasOwnProperty.call(PRECOS, formacao)) return res.status(400).json({ ok: false, error: "Escolha uma formação da lista." });
  if (!mailConfigured()) {
    console.error("Inscrição recebida mas nenhum serviço de e-mail está configurado.", { nome, email, formacao });
    return res.status(503).json({ ok: false, error: "Serviço de e-mail não configurado." });
  }

  if (isEmpresa) return inscricaoEmpresa(res, { nome, email, telefone, empresa, formacao, modalidade, obs });

  const codigo = novoCodigo();
  const valor = formatKz(PRECOS[formacao]);
  const pagamento = { codigo, iban: IBAN, titular: TITULAR, banco: BANCO, valor };

  // --- E-mail para a Aprendiz ---
  const rows = [
    ["Código", codigo], ["Formação", formacao], ["Modalidade", modalidade], ["Valor", valor || "a confirmar"],
    ["Nome", nome], ["Empresa", empresa], ["E-mail", email], ["Telefone", telefone], ["Observações", obs],
    ["Estado", "Pendente – aguarda comprovativo de transferência"],
  ].filter(([, v]) => v);
  try {
    await sendMail({
      to: ADMIN_TO(), replyTo: email,
      subject: `[Inscrição] ${codigo} – ${formacao} – ${nome}`,
      text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
      html: table("Nova inscrição em formação", rows),
    });
  } catch (err) {
    console.error("Erro ao enviar e-mail de inscrição:", err);
    return res.status(502).json({ ok: false, error: "Falha no envio." });
  }

  // --- E-mail para o aluno (não bloqueia a inscrição se falhar) ---
  const passos = [
    ["Formação", formacao], ["Valor a pagar", valor || "a confirmar pela Aprendiz"],
    ["IBAN", IBAN], ["Titular", TITULAR], ["Banco", BANCO], ["Descritivo / referência", codigo],
  ].filter(([, v]) => v);
  try {
    await sendMail({
      to: email, replyTo: ADMIN_TO(),
      subject: `Inscrição ${codigo} – ${formacao} | Dados para pagamento`,
      text:
        `Olá ${nome},\n\nRecebemos a sua inscrição. Para a confirmar, faça a transferência bancária com estes dados:\n\n` +
        passos.map(([k, v]) => `${k}: ${v}`).join("\n") +
        `\n\nIMPORTANTE: escreva o código ${codigo} no descritivo da transferência.\n` +
        `Depois envie o comprovativo na página de inscrição do site, respondendo a este e-mail ou pelo WhatsApp +244 923 35 35 34.\n\n` +
        `A sua vaga fica confirmada quando validarmos o pagamento.\n\nAprendiz – Consultoria & Formação`,
      html:
        `<p style="font-family:Arial,sans-serif;font-size:15px">Olá ${esc(nome)},</p>` +
        `<p style="font-family:Arial,sans-serif;font-size:15px">Recebemos a sua inscrição. Para a confirmar, faça a transferência bancária com estes dados:</p>` +
        table("Dados para pagamento", passos) +
        `<p style="font-family:Arial,sans-serif;font-size:15px"><b>Importante:</b> escreva o código <b>${esc(codigo)}</b> no descritivo da transferência.</p>` +
        `<p style="font-family:Arial,sans-serif;font-size:15px">Depois envie o comprovativo na página de inscrição do site, respondendo a este e-mail ou pelo WhatsApp +244 923 35 35 34. A sua vaga fica confirmada quando validarmos o pagamento.</p>` +
        `<p style="font-family:Arial,sans-serif;font-size:15px">Aprendiz – Consultoria &amp; Formação</p>`,
    });
  } catch (err) {
    console.error("Erro ao enviar e-mail ao aluno:", err);
  }

  return res.status(200).json({ ok: true, ...pagamento });
};

/** Empresas: preço sob consulta. Avisa a Aprendiz e confirma a receção ao cliente. */
async function inscricaoEmpresa(res, d) {
  const rows = [
    ["Tipo", "Empresa – preço sob consulta"], ["Empresa", d.empresa], ["Formação", d.formacao], ["Modalidade", d.modalidade],
    ["Nome", d.nome], ["E-mail", d.email], ["Telefone", d.telefone], ["Observações", d.obs],
  ].filter(([, v]) => v);
  try {
    await sendMail({
      to: ADMIN_TO(), replyTo: d.email,
      subject: `[Inscrição Empresa] ${d.formacao} – ${d.empresa}`,
      text: rows.map(([k, v]) => `${k}: ${v}`).join("\n") + "\n\nEnviar proposta ao cliente por e-mail ou WhatsApp.",
      html: table("Pedido de inscrição – Empresa", rows) +
        `<p style="font-family:Arial,sans-serif;font-size:14px">Enviar proposta ao cliente por e-mail ou WhatsApp.</p>`,
    });
  } catch (err) {
    console.error("Erro ao enviar e-mail de inscrição (empresa):", err);
    return res.status(502).json({ ok: false, error: "Falha no envio." });
  }
  try {
    await sendMail({
      to: d.email, replyTo: ADMIN_TO(),
      subject: `Pedido de inscrição – ${d.formacao} | Aprendiz`,
      text: `Olá ${d.nome},\n\nRecebemos o pedido de inscrição da ${d.empresa} na formação ${d.formacao}.\n` +
        `Para empresas, o valor é sob consulta: vamos enviar-lhe a proposta por e-mail ou WhatsApp brevemente.\n\n` +
        `Aprendiz – Consultoria & Formação\n+244 923 35 35 34`,
      html: `<p style="font-family:Arial,sans-serif;font-size:15px">Olá ${esc(d.nome)},</p>` +
        `<p style="font-family:Arial,sans-serif;font-size:15px">Recebemos o pedido de inscrição da <b>${esc(d.empresa)}</b> na formação <b>${esc(d.formacao)}</b>.</p>` +
        `<p style="font-family:Arial,sans-serif;font-size:15px">Para empresas, o valor é sob consulta: vamos enviar-lhe a proposta por e-mail ou WhatsApp brevemente.</p>` +
        `<p style="font-family:Arial,sans-serif;font-size:15px">Aprendiz – Consultoria &amp; Formação<br>+244 923 35 35 34</p>`,
    });
  } catch (err) {
    console.error("Erro ao enviar e-mail ao cliente (empresa):", err);
  }
  return res.status(200).json({ ok: true, empresa: true });
}
