/**
 * Inscrição numa formação (particulares) com pagamento por transferência bancária (IBAN).
 *
 * O formando transfere o valor, preenche a ficha e carrega o comprovativo de pagamento
 * e o documento de identificação. É enviado UM único e-mail:
 *   - para a Aprendiz (CONTACT_TO), com os dois ficheiros em anexo;
 *   - com o formando em cópia (CC), para ficar com o registo da inscrição.
 * "Responder" ao e-mail responde ao formando.
 *
 * GET /api/inscricao devolve os preços e os dados bancários (para mostrar no formulário).
 * Empresas: preço sob consulta, tratado por e-mail/WhatsApp (fora deste formulário).
 * Dados bancários e preços: api/_pagamento.js
 */
const crypto = require("crypto");
const { table, sendMail, mailConfigured, readBody, ADMIN_TO, EMAIL_RE } = require("./_mail");
const { IBAN, TITULAR, BANCO, PRECOS, formatKz } = require("./_pagamento");

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O, 1/I para não confundir
const TIPOS = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };
const MAX_BYTES = 3 * 1024 * 1024; // por ficheiro (o pedido inteiro tem de caber em 4,5 MB)

function novoCodigo() {
  const d = new Date(Date.now() + 60 * 60 * 1000); // hora de Luanda (UTC+1)
  const data = d.toISOString().slice(2, 10).replace(/-/g, "");
  let sufixo = "";
  for (let i = 0; i < 4; i++) sufixo += ALFABETO[crypto.randomInt(ALFABETO.length)];
  return `AP-${data}-${sufixo}`;
}

/** Valida um ficheiro { name, type, data(base64) }; devolve a extensão ou null. */
function ficheiroValido(f) {
  if (!f || typeof f.data !== "string" || !TIPOS[f.type]) return null;
  const bytes = Buffer.byteLength(f.data, "base64");
  return bytes > 0 && bytes <= MAX_BYTES ? TIPOS[f.type] : null;
}

const erro = (res, status, msg) => res.status(status).json({ ok: false, error: msg });

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const precos = {};
    for (const k of Object.keys(PRECOS)) precos[k] = formatKz(PRECOS[k]);
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).json({ ok: true, precos, iban: IBAN, titular: TITULAR, banco: BANCO });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return erro(res, 405, "Método não permitido");
  }
  const body = readBody(req);
  if (body.website) return res.status(200).json({ ok: true }); // anti-spam

  const s = (k, max = 300) => String(body[k] || "").trim().slice(0, max);
  const nome = s("nome"), email = s("email"), telefone = s("telefone", 40);
  const formacao = s("formacao"), modalidade = s("modalidade", 40), tema = s("tema", 120);
  const documento = s("documento", 40), dataFormacao = s("data_formacao", 10), horario = s("horario", 60);
  const aceitaCancel = s("aceita_cancelamento", 5) === "Sim", aceitaRegras = s("aceita_regras", 5) === "Sim";
  const hoje = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10); // Luanda
  const fmtData = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split("-").reverse().join("/") : d);
  const plano = /^Formação Privada – Plano /.test(formacao);

  // Todos os campos são obrigatórios
  if (!nome || !EMAIL_RE.test(email)) return erro(res, 400, "Nome e e-mail válidos são obrigatórios.");
  if (!telefone) return erro(res, 400, "O telefone é obrigatório.");
  if (!["Presencial", "Online"].includes(modalidade)) return erro(res, 400, "Escolha a modalidade.");
  if (!Object.prototype.hasOwnProperty.call(PRECOS, formacao)) return erro(res, 400, "Escolha uma formação da lista.");
  if (plano && !tema) return erro(res, 400, "Indique o tema das aulas privadas.");
  if (!documento) return erro(res, 400, "Indique o nº do documento de identificação.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataFormacao)) return erro(res, 400, "Indique a data da formação.");
  if (!horario) return erro(res, 400, "Indique o horário da formação.");
  if (!aceitaCancel || !aceitaRegras) return erro(res, 400, "É necessário concordar com as condições.");
  const extComp = ficheiroValido(body.comprovativo);
  if (!extComp) return erro(res, 400, "Carregue o comprovativo de pagamento (PDF ou foto, até 3 MB).");
  const extDoc = ficheiroValido(body.documento_ficheiro);
  if (!extDoc) return erro(res, 400, "Carregue o documento de identificação (PDF ou foto, até 3 MB).");
  if (!mailConfigured()) {
    console.error("Inscrição recebida mas nenhum serviço de e-mail está configurado.", { nome, email, formacao });
    return erro(res, 503, "Serviço de e-mail não configurado.");
  }

  const codigo = novoCodigo();
  const valor = formatKz(PRECOS[formacao]) || "a confirmar";
  const slug = nome.normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "formando";

  const rows = [
    ["Referência", codigo], ["Formação", formacao], ["Tema (aulas privadas)", plano ? tema : ""], ["Modalidade", modalidade],
    ["Valor", valor], ["Nome completo", nome], ["E-mail", email], ["Telefone", telefone],
    ["Nº documento de identificação", documento], ["Data da formação", fmtData(dataFormacao)], ["Horário da formação", horario],
    ["Condições de cancelamento", "Concorda"], ["Regras da formação", "Concorda"], ["Data da inscrição", fmtData(hoje)],
    ["Pagamento", `Transferência para ${IBAN} (${TITULAR}${BANCO ? ", " + BANCO : ""}) – comprovativo em anexo`],
    ["Anexos", "Comprovativo de pagamento e documento de identificação"],
    ["Estado", "A validar pela Aprendiz"],
  ].filter(([, v]) => v);
  const nota = "A Aprendiz vai validar o pagamento e confirmar a vaga por e-mail. Este e-mail foi enviado para a Aprendiz com cópia para o formando.";

  try {
    await sendMail({
      to: ADMIN_TO(), cc: email, replyTo: email,
      subject: `Inscrição ${codigo} – ${formacao} – ${nome}`,
      text: rows.map(([k, v]) => `${k}: ${v}`).join("\n") + "\n\n" + nota + "\n\nAprendiz – Consultoria & Formação · +244 923 35 35 34",
      html: table("Inscrição em formação", rows) +
        `<p style="font-family:Arial,sans-serif;font-size:14px;color:#6B6B6B">${nota}</p>` +
        `<p style="font-family:Arial,sans-serif;font-size:14px">Aprendiz – Consultoria &amp; Formação · +244 923 35 35 34</p>`,
      attachments: [
        { filename: `comprovativo-${slug}.${extComp}`, content: body.comprovativo.data, contentType: body.comprovativo.type },
        { filename: `documento-identificacao-${slug}.${extDoc}`, content: body.documento_ficheiro.data, contentType: body.documento_ficheiro.type },
      ],
    });
  } catch (err) {
    console.error("Erro ao enviar e-mail de inscrição:", err);
    return erro(res, 502, "Falha no envio.");
  }
  return res.status(200).json({ ok: true, codigo });
};
