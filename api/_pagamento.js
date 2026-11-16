/**
 * Dados de pagamento das formações (transferência bancária / IBAN).
 *
 * >>> EDITAR AQUI <<<  Depois de alterar, basta fazer commit: a Vercel publica sozinha.
 *
 * - IBAN, TITULAR e BANCO: dados da conta que recebe os pagamentos.
 * - PRECOS: valor de cada formação em Kwanzas (número inteiro, sem pontos).
 *   Se uma formação não tiver preço (ou for null), o aluno vê "valor a confirmar"
 *   e a Aprendiz envia o valor depois, por e-mail ou WhatsApp.
 */
const IBAN = "AO06 0000 0000 0000 0000 0000 0"; // SUBSTITUIR pelo IBAN real
const TITULAR = "Aprendiz – Consultoria & Formação"; // SUBSTITUIR pelo nome do titular da conta
const BANCO = ""; // opcional, ex.: "BAI", "BFA", "BIC"…

const PRECOS = {
  "Excel Básico": null,
  "Excel Intermédio": null,
  "Excel Avançado": null,
  "Power BI do Básico ao Intermédio": null,
  "Power BI Avançado": null,
  "IA – Claude": null,
  "Análise de Dados I Aplicada ao Excel": null,
  "Análise de Dados II Aplicada ao Excel": null,
  "Estatística I": null,
  "Estatística II": null,
  "Contabilidade Básica": null,
  "Contabilidade Intermédia": null,
  "Contabilidade Avançada": null,
  "Fiscalidade para Empreendedores": null,
  "IRPS": null,
  "IRPC": null,
  "Processamento Salarial no Excel": null,
  "Word Básico": null,
  "Word Intermédio": null,
  "Word Avançado": null,
  "PowerPoint do Básico ao Intermédio": null,
  "PowerPoint Avançado": null,
  "Informática": null,
};

const formatKz = (n) => (typeof n === "number" ? n.toLocaleString("pt-PT").replace(/ | /g, " ") + " Kz" : null);

module.exports = { IBAN, TITULAR, BANCO, PRECOS, formatKz };
