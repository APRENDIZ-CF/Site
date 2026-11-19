/**
 * Aprendiz – script do site (conta Google da Aprendiz)
 *  1) Guarda na Google Drive os ficheiros enviados pelo site
 *     (comprovativos de pagamento e documentos de identificação).
 *  2) Reservas da sala: os botões "Confirmar" e "Anular" do e-mail de cada pedido
 *     marcam/desmarcam o horário no Google Calendar "Sala de Formação",
 *     e o calendário do site mostra esses horários como ocupados.
 *
 * COMO INSTALAR (com a conta Google onde quer guardar os ficheiros e o calendário):
 *  1. Abra https://script.google.com e clique em "Novo projeto" (ou abra o projeto que já criou).
 *  2. Apague o que lá estiver e cole TODO este código.
 *  3. Na linha PALAVRA_CHAVE, troque o texto entre aspas por uma palavra-chave sua
 *     (comprida, sem espaços). Guarde-a: vai pô-la também na Vercel.
 *  4. Clique em "Implementar" > "Nova implementação" > tipo "Aplicação Web":
 *       Executar como: Eu      Quem tem acesso: Qualquer pessoa
 *     Clique em "Implementar", autorize o acesso e copie o "URL da aplicação Web".
 *     (Se já tinha implementado: "Implementar" > "Gerir implementações" > lápis >
 *      Versão: "Nova versão" > "Implementar". O URL mantém-se.)
 *  5. Na Vercel (projeto aprendiz > Settings > Environment Variables) crie:
 *       DRIVE_UPLOAD_URL   = o URL copiado (termina em /exec)
 *       DRIVE_UPLOAD_TOKEN = a mesma palavra-chave do passo 3
 *
 * Ficheiros:  A minha unidade / Site Aprendiz / Inscrições  e  / Reservas de sala
 * Calendário: "Sala de Formação" (criado automaticamente na primeira confirmação).
 *             Também pode marcar horários ocupados à mão nesse calendário.
 */
var PALAVRA_CHAVE = "TROQUE-POR-UMA-PALAVRA-CHAVE-SUA";
var PASTA_PRINCIPAL = "Site Aprendiz";
var CALENDARIO = "Sala de Formação";
var FUSO = "Africa/Luanda";
var DIAS_FUTURO = 130;

/* ============================== Ficheiros (POST) ============================== */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (!configurado() || !body || body.token !== PALAVRA_CHAVE) {
      return json({ ok: false, erro: "não autorizado" });
    }
    var pasta = obterPasta(obterPasta(DriveApp.getRootFolder(), PASTA_PRINCIPAL), limpar(body.pasta || "Outros"));
    var destino = pasta.createFolder(limpar(body.subpasta || new Date().toISOString()));
    (body.ficheiros || []).forEach(function (f) {
      var blob = Utilities.newBlob(Utilities.base64Decode(f.data), f.type || "application/octet-stream", limpar(f.name || "ficheiro"));
      destino.createFile(blob);
    });
    if (body.resumo) destino.createFile("dados.txt", String(body.resumo), MimeType.PLAIN_TEXT);
    return json({ ok: true, pasta: destino.getUrl() });
  } catch (err) {
    return json({ ok: false, erro: String(err) });
  }
}

/* ======================= Calendário e botões do e-mail (GET) ======================= */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.acao === "ocupacao") return json(ocupacao());
  if (p.acao === "confirmar" || p.acao === "anular") return acaoReserva(p);
  return json({ ok: true, mensagem: "Script da Aprendiz ativo." });
}

/** Horários ocupados (só datas e horas, sem nomes) para o calendário do site. */
function ocupacao() {
  var cal = obterCalendario(false);
  if (!cal) return { configured: true, busy: [] };
  var agora = new Date();
  var inicio = new Date(agora.getTime() - 86400000), fim = new Date(agora.getTime() + DIAS_FUTURO * 86400000);
  var busy = [];
  cal.getEvents(inicio, fim).forEach(function (ev) {
    if (ev.isAllDayEvent()) {
      var d = new Date(ev.getAllDayStartDate());
      var ate = ev.getAllDayEndDate();
      while (d < ate) {
        busy.push({ date: Utilities.formatDate(d, FUSO, "yyyy-MM-dd"), start: "00:00", end: "23:59" });
        d = new Date(d.getTime() + 86400000);
      }
    } else {
      busy.push({
        date: Utilities.formatDate(ev.getStartTime(), FUSO, "yyyy-MM-dd"),
        start: Utilities.formatDate(ev.getStartTime(), FUSO, "HH:mm"),
        end: Utilities.formatDate(ev.getEndTime(), FUSO, "HH:mm"),
      });
    }
  });
  return { configured: true, busy: busy };
}

function acaoReserva(p) {
  if (!configurado()) return pagina("Script por configurar", "Defina a PALAVRA_CHAVE no script.", false);
  var campos = [p.acao, p.id, p.data, p.inicio, p.fim, p.nome, p.email].join("|");
  if (!p.sig || p.sig !== assinatura(campos)) {
    return pagina("Ligação inválida", "Esta ligação não é válida ou foi alterada.", false);
  }
  var inicio = Utilities.parseDate(p.data + " " + p.inicio, FUSO, "yyyy-MM-dd HH:mm");
  var fim = Utilities.parseDate(p.data + " " + p.fim, FUSO, "yyyy-MM-dd HH:mm");
  var quando = Utilities.formatDate(inicio, FUSO, "dd/MM/yyyy") + ", " + p.inicio + " – " + p.fim;
  var marca = "Reserva site: " + p.id;
  var cal = obterCalendario(p.acao === "confirmar");
  var existentes = cal ? cal.getEvents(new Date(inicio.getTime() - 86400000), new Date(fim.getTime() + 86400000))
    .filter(function (ev) { return (ev.getDescription() || "").indexOf(marca) !== -1; }) : [];

  if (p.acao === "confirmar") {
    if (existentes.length) return pagina("Reserva já confirmada", "A reserva de " + esc(p.nome) + " (" + quando + ") já estava confirmada.", true);
    var conflito = cal.getEvents(inicio, fim);
    if (conflito.length) {
      return pagina("Horário ocupado", "Não foi possível confirmar: já existe uma marcação no calendário entre " + p.inicio + " e " + p.fim + " de " +
        Utilities.formatDate(inicio, FUSO, "dd/MM/yyyy") + ". Fale com o cliente para escolher outro horário.", false);
    }
    cal.createEvent("Reservado – " + p.nome, inicio, fim, {
      description: marca + "\nCliente: " + p.nome + "\nE-mail: " + p.email + "\nConfirmado em " + Utilities.formatDate(new Date(), FUSO, "dd/MM/yyyy HH:mm"),
    });
    avisarCliente(p.email, "Reserva da sala confirmada – " + quando,
      "Olá " + p.nome + ",\n\nA sua reserva da sala de formação da Aprendiz está confirmada:\n" + quando +
      "\n\nMorada: Rua Cónego Manuel das Neves, Prédio 5, Porta 9 – Kinaxixi, Luanda\n\nAprendiz – Consultoria & Formação\n+244 923 35 35 34");
    return pagina("Reserva confirmada", "A reserva de " + esc(p.nome) + " (" + quando + ") foi confirmada. O horário já aparece como ocupado no site e o cliente foi avisado por e-mail.", true);
  }

  // anular
  if (!existentes.length) return pagina("Nada a anular", "A reserva de " + esc(p.nome) + " (" + quando + ") não está confirmada no calendário (ou já foi anulada).", true);
  existentes.forEach(function (ev) { ev.deleteEvent(); });
  avisarCliente(p.email, "Reserva da sala anulada – " + quando,
    "Olá " + p.nome + ",\n\nA sua reserva da sala de formação da Aprendiz para " + quando + " foi anulada.\n" +
    "Se tiver dúvidas, fale connosco pelo +244 923 35 35 34.\n\nAprendiz – Consultoria & Formação");
  return pagina("Reserva anulada", "A reserva de " + esc(p.nome) + " (" + quando + ") foi anulada. O horário voltou a ficar livre no site e o cliente foi avisado por e-mail.", true);
}

/* ================================== Auxiliares ================================== */
function configurado() { return PALAVRA_CHAVE && PALAVRA_CHAVE.indexOf("TROQUE") !== 0; }

function assinatura(texto) {
  var bytes = Utilities.computeHmacSha256Signature(texto, PALAVRA_CHAVE, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var h = ((b + 256) % 256).toString(16); return h.length === 1 ? "0" + h : h; }).join("");
}

function obterCalendario(criar) {
  var cals = CalendarApp.getCalendarsByName(CALENDARIO);
  if (cals.length) return cals[0];
  if (!criar) return null;
  var c = CalendarApp.createCalendar(CALENDARIO);
  c.setTimeZone(FUSO);
  return c;
}

function avisarCliente(email, assunto, texto) {
  if (!email || email.indexOf("@") < 1) return;
  try { MailApp.sendEmail({ to: email, subject: assunto, body: texto, name: "Aprendiz – Consultoria & Formação" }); } catch (err) {}
}

function obterPasta(pai, nome) {
  var it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pai.createFolder(nome);
}

function limpar(t) { return String(t).replace(/[\\/:*?"<>|]/g, "-").slice(0, 120); }

function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function pagina(titulo, texto, ok) {
  var cor = ok ? "#0D3A01" : "#B3261E";
  var html = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<div style="font-family:Arial,sans-serif;max-width:560px;margin:48px auto;padding:28px;border-left:4px solid ' + cor + ';background:#F7F5F0">' +
    '<h1 style="font-family:Georgia,serif;color:' + cor + ';margin:0 0 12px">' + esc(titulo) + '</h1>' +
    '<p style="font-size:16px;line-height:1.6;color:#1E1E1E">' + texto + '</p>' +
    '<p style="font-size:14px;color:#6B6B6B">Aprendiz – Consultoria &amp; Formação</p></div>';
  return HtmlService.createHtmlOutput(html).setTitle(titulo);
}
