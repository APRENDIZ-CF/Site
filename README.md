# APRENDIZ – Consultoria & Formação · Website

Site estático multipágina (HTML + CSS + JS, sem dependências). Pode ser alojado em qualquer servidor (cPanel, Netlify, Vercel, GitHub Pages…).

## Estrutura
- `index.html`, `sobre.html`, `consultoria.html`, `formacoes.html`, `aluguer-sala.html`, `escritorios.html`, `contactos.html`: páginas finais (geradas)
- `src/pages/`: conteúdo de cada página (editar aqui)
- `src/partials/`: cabeçalho e rodapé comuns
- `assets/css/style.css`: estilos · `assets/js/main.js`: menu, animações, filtros, formulários
- `build.py`: junta tudo. Depois de qualquer alteração em `src/` ou `build.py`, correr: `python3 build.py`

## Publicar na Vercel
1. Na pasta do projeto: `npx vercel --prod` (ou importar o repositório GitHub em vercel.com/new — sem framework, sem comando de build).
2. Em **Vercel → Projeto → Settings → Environment Variables**, configurar o envio dos formulários (escolher uma opção):
   - **Gmail**: `GMAIL_USER` = jdsaprendiz@gmail.com e `GMAIL_APP_PASSWORD` = palavra-passe de aplicação
     (Conta Google → Segurança → Verificação em 2 passos → Palavras-passe de aplicações).
   - **Resend**: `RESEND_API_KEY` (conta gratuita em resend.com criada com jdsaprendiz@gmail.com).
   - Opcional: `CONTACT_TO` para mudar o destinatário (por omissão jdsaprendiz@gmail.com).
3. Fazer *Redeploy* para as variáveis entrarem em vigor.

Os três formulários (contacto, reserva de sala, agendar visita) enviam para `/api/contacto` (`api/contacto.js`), que manda um e-mail com todos os campos e "Responder a" o e-mail do cliente. Inclui proteção anti-spam (campo invisível).

## Editar
- Contactos e morada: dicionário `SITE` no topo de `build.py`, depois `python3 build.py`.
- Fotografias: `assets/img/SF_6`, `CW_3`, `CW_6` (`.jpg`, `.webp` e `-720.webp`), `logo.png`, `logo-white.png`.

## Calendário da sala (ocupação)
A página Aluguer de Sala mostra os horários ocupados lidos de um calendário Google.
1. No Google Calendar, crie um calendário chamado "Sala de Formação" e registe lá cada reserva confirmada (título: "Reservado").
2. Em Definições do calendário → "Endereço secreto no formato iCal", copie o endereço.
3. Na Vercel → Settings → Environment Variables, crie `GCAL_ICS_URL` com esse endereço e faça Redeploy.
