/**
 * Dados de pagamento das formações (transferência bancária / IBAN).
 *
 * >>> EDITAR AQUI <<<  Depois de alterar, basta fazer commit: a Vercel publica sozinha.
 *
 * - IBAN, TITULAR e BANCO: dados da conta que recebe os pagamentos.
 * - PRECOS: valor de cada formação para PARTICULARES, em Kwanzas (número inteiro, sem pontos).
 *   Também aceita texto (ex.: "17.000 Kz / hora") para preços por hora.
 *   Fonte: "Tabela de Preços – Aulas em grupo para particulares". Empresas: sob consulta.
 *   Se uma formação não tiver preço (ou for null), o aluno vê "valor a confirmar"
 *   e a Aprendiz envia o valor depois, por e-mail ou WhatsApp.
 */
const IBAN = "AO06 0006 0000 3381 9362 3018 4";
const TITULAR = "Jandira Dias da Silva";
const BANCO = "BFA";

const PRECOS = {
  "Excel Básico": 55000,
  "Excel Intermédio": 70000,
  "Excel Avançado": 90000,
  "Power BI do Básico ao Intermédio": 100000,
  "Power BI Avançado": 90000,
  "IA – Claude": 150000,
  "Análise de Dados I Aplicada ao Excel": 200000,
  "Análise de Dados II Aplicada ao Excel": 250000,
  "Estatística I": null,
  "Estatística II": null,
  "Contabilidade Básica": 55000,
  "Contabilidade Intermédia": 70000,
  "Contabilidade Avançada": 90000,
  "Fiscalidade para Empreendedores": 30000,
  "IRPS": 100000,
  "IRPC": 150000,
  "Processamento Salarial no Excel": 15000,
  "Word Básico": 50000,
  "Word Intermédio": 65000,
  "Word Avançado": 85000,
  "PowerPoint do Básico ao Intermédio": 90000,
  "PowerPoint Avançado": 80000,
  "Informática": 45000,
  "Contabilidade para Empreendedores": 30000,
  "Workshop Regime Jurídico das Facturas": 15000,
  // Formações privadas: preço por hora (texto). O total depende do nº de horas e é confirmado depois.
  "Formação Privada – Análise de Dados I Aplicada ao Excel": "17.000 Kz / hora",
  "Formação Privada – Outras Formações": "15.000 Kz / hora",
};

const formatKz = (n) => (typeof n === "string" ? n : typeof n === "number" ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " Kz" : null);

module.exports = { IBAN, TITULAR, BANCO, PRECOS, formatKz };
