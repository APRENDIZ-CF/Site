/**
 * Ficheiros carregados nos formulários do site (comprovativos, documentos de identificação).
 *
 * - ficheiroValido: aceita PDF ou imagem até 3 MB (base64).
 * - guardarNaDrive: envia uma cópia dos ficheiros para a Google Drive, através de um
 *   Google Apps Script publicado na conta Google que deve guardar os ficheiros
 *   (ver apps-script/GuardarNaDrive.gs e o README).
 *   Variáveis de ambiente na Vercel:
 *     DRIVE_UPLOAD_URL    endereço da aplicação Web do Apps Script (termina em /exec)
 *     DRIVE_UPLOAD_TOKEN  a mesma palavra-chave definida no Apps Script
 *   Se não estiverem definidas, nada é enviado para a Drive (o e-mail continua a ser enviado).
 */
const TIPOS = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };
const MAX_BYTES = 3 * 1024 * 1024; // por ficheiro (o pedido inteiro tem de caber em 4,5 MB)

/** Valida um ficheiro { name, type, data(base64) }; devolve a extensão ou null. */
function ficheiroValido(f) {
  if (!f || typeof f.data !== "string" || !TIPOS[f.type]) return null;
  const bytes = Buffer.byteLength(f.data, "base64");
  return bytes > 0 && bytes <= MAX_BYTES ? TIPOS[f.type] : null;
}

/** Texto seguro para nomes de ficheiros e pastas. */
const slug = (t) => String(t || "").normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "sem-nome";

/**
 * Guarda os ficheiros numa pasta da Google Drive: Site Aprendiz / <pasta> / <subpasta>.
 * Nunca lança erro: se falhar, regista no log e devolve false.
 * @param {string} pasta     ex.: "Inscrições" ou "Reservas de sala"
 * @param {string} subpasta  ex.: "2026-11-19 Maria Silva – Excel Básico"
 * @param {{filename:string, content:string, contentType:string}[]} ficheiros  (content em base64)
 * @param {string} resumo    texto com os dados do formulário (fica num ficheiro dados.txt)
 */
async function guardarNaDrive(pasta, subpasta, ficheiros, resumo) {
  const url = process.env.DRIVE_UPLOAD_URL, token = process.env.DRIVE_UPLOAD_TOKEN;
  if (!url || !token) return false;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        token, pasta, subpasta, resumo,
        ficheiros: ficheiros.map((f) => ({ name: f.filename, type: f.contentType, data: f.content })),
      }),
      redirect: "follow",
    });
    const txt = await r.text();
    if (!r.ok || !/"ok"\s*:\s*true/.test(txt)) throw new Error("Drive " + r.status + " " + txt.slice(0, 200));
    return true;
  } catch (err) {
    console.error("Erro ao guardar na Google Drive:", err);
    return false;
  }
}

module.exports = { TIPOS, MAX_BYTES, ficheiroValido, slug, guardarNaDrive };
