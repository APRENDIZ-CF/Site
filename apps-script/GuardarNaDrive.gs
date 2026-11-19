/**
 * Aprendiz – guardar na Google Drive os ficheiros enviados pelo site
 * (comprovativos de pagamento e documentos de identificação).
 *
 * COMO INSTALAR (com a conta Google onde quer guardar os ficheiros):
 *  1. Abra https://script.google.com e clique em "Novo projeto".
 *  2. Apague o que lá estiver e cole TODO este código.
 *  3. Na linha PALAVRA_CHAVE, troque o texto entre aspas por uma palavra-chave sua
 *     (comprida, sem espaços). Guarde-a: vai pô-la também na Vercel.
 *  4. Clique em "Implementar" > "Nova implementação" > tipo "Aplicação Web":
 *       Executar como: Eu      Quem tem acesso: Qualquer pessoa
 *     Clique em "Implementar", autorize o acesso à Drive e copie o "URL da aplicação Web".
 *  5. Na Vercel (projeto aprendiz > Settings > Environment Variables) crie:
 *       DRIVE_UPLOAD_URL   = o URL copiado (termina em /exec)
 *       DRIVE_UPLOAD_TOKEN = a mesma palavra-chave do passo 3
 *
 * Os ficheiros ficam em:  A minha unidade / Site Aprendiz / Inscrições  e  / Reservas de sala
 */
var PALAVRA_CHAVE = "TROQUE-POR-UMA-PALAVRA-CHAVE-SUA";
var PASTA_PRINCIPAL = "Site Aprendiz";

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (!body || body.token !== PALAVRA_CHAVE || PALAVRA_CHAVE.indexOf("TROQUE") === 0) {
      return resposta({ ok: false, erro: "não autorizado" });
    }
    var pasta = obterPasta(obterPasta(DriveApp.getRootFolder(), PASTA_PRINCIPAL), limpar(body.pasta || "Outros"));
    var destino = pasta.createFolder(limpar(body.subpasta || new Date().toISOString()));
    (body.ficheiros || []).forEach(function (f) {
      var blob = Utilities.newBlob(Utilities.base64Decode(f.data), f.type || "application/octet-stream", limpar(f.name || "ficheiro"));
      destino.createFile(blob);
    });
    if (body.resumo) destino.createFile("dados.txt", String(body.resumo), MimeType.PLAIN_TEXT);
    return resposta({ ok: true, pasta: destino.getUrl() });
  } catch (err) {
    return resposta({ ok: false, erro: String(err) });
  }
}

/** Abrir este endereço no browser mostra se o script está ativo. */
function doGet() {
  return resposta({ ok: true, mensagem: "Script da Aprendiz ativo." });
}

function obterPasta(pai, nome) {
  var it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pai.createFolder(nome);
}

function limpar(t) {
  return String(t).replace(/[\\/:*?"<>|]/g, "-").slice(0, 120);
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
