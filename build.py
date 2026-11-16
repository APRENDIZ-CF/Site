#!/usr/bin/env python3
"""
Gerador estático do site APRENDIZ – Consultoria & Formação.

Junta o cabeçalho, o rodapé e o conteúdo de cada página (src/pages/*.html)
e escreve os ficheiros HTML finais na raiz do projeto.

Uso:  python3 build.py

Cada página em src/pages começa com um bloco de metadados:
<!--meta
title: ...
description: ...
nav: sobre            (chave do menu ativo)
hero: true            (cabeçalho transparente sobre Hero)
-->

Atalhos disponíveis no conteúdo:
  [[icon:nome]]                          ícone SVG de traço fino
  [[p:nome|texto alt|sizes|eager]]         fotografia em assets/img/photos (nome-800/1600.webp)
  {{phone}} {{email}} {{whatsapp}} ...   dados de contacto (ver SITE)
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"

# ---------------------------------------------------------------------------
# Dados de contacto — SUBSTITUIR pelos dados reais da empresa
# ---------------------------------------------------------------------------
SITE = {
    "url": "https://aprendiz2021.com",         # domínio final (para Open Graph)
    "phone": "+244 923 35 35 34",
    "phone_link": "+244923353534",
    "whatsapp": "244923353534",                   # só dígitos, com indicativo
    "email": "jdsaprendiz@gmail.com",
    "facebook": "https://www.facebook.com/share/1EQHuuKDxi/?mibextid=wwXIfr",
    "youtube": "https://www.youtube.com/@Aprendiz_2021",
    "address": "Rua Cónego Manuel das Neves, Prédio 5, Porta 9 – Kinaxixi, Luanda",
    "map_query": "-8.8152712,13.2409689",
    "map_link": "https://www.google.com/maps/dir/?api=1&amp;destination=-8.8152712%2C13.2409689",
}

NAV = [
    ("inicio", "Início", "index.html"),
    ("sobre", "Sobre", "sobre.html"),
    ("consultoria", "Consultoria", "consultoria.html"),
    ("formacoes", "Formações", "formacoes.html"),
    ("sala", "Aluguer de Sala", "aluguer-sala.html"),
    ("escritorios", "Escritórios", "escritorios.html"),
    ("contactos", "Contactos", "contactos.html"),
]

WA_PATH = ('<path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3z"/>'
           '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/>')

# Ícones de traço fino (stroke 1)
ICONS = {
    "arrow": '<svg viewBox="0 0 26 10" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M0 5h25M20 .5 25 5l-5 4.5"/></svg>',
    "ledger": '<path d="M7 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M9 3v18M12 8h4M12 12h4M12 16h2"/>',
    "analysis": '<path d="M3 21h18M6 17V11M10 17V7M14 17v-4M18 17V5"/><circle cx="18" cy="5" r="0"/>',
    "strategy": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="M12 3v2M21 12h-2M12 21v-2M3 12h2"/>',
    "finance": '<path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
    "grid": '<rect x="3.5" y="3.5" width="17" height="17"/><path d="M3.5 9.5h17M3.5 15h17M9.5 3.5v17M15 3.5v17"/>',
    "chart": '<path d="M4 20V4M4 20h16"/><path d="M7 16l4-5 3 3 5-7"/>',
    "spark": '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/><circle cx="12" cy="12" r="2"/>',
    "data": '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    "stats": '<path d="M3 20c3 0 4-14 9-14s6 14 9 14"/><path d="M3 20h18M12 6v14"/>',
    "calc": '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 14h2M12 14h2M8 17h2M12 17h2M16 14v3"/>',
    "doc": '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 15h6M9 18h4"/>',
    "receipt": '<path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z"/><path d="M9 8h6M9 11h6M9 14h4"/>',
    "building": '<path d="M4 21V5l8-2v18M12 7l8 2v12M3 21h18M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2"/>',
    "payroll": '<rect x="3" y="6" width="18" height="12"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v0M18 15v0M6 15h1M17 9h1"/>',
    "word": '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M8.5 11l1.5 6 2-4.5 2 4.5 1.5-6"/>',
    "slides": '<rect x="3" y="4" width="18" height="12"/><path d="M12 16v4M8 20h8M7 8h6M7 11h4"/>',
    "computer": '<rect x="3" y="4" width="18" height="12"/><path d="M2 20h20M9 16l-1 4M15 16l1 4"/>',
    "screen": '<rect x="2.5" y="4" width="19" height="12"/><path d="M8 20h8M12 16v4"/>',
    "desk": '<path d="M3 9h18M5 9v11M19 9v11M5 14h14M9 9V5h6v4"/>',
    "chair": '<path d="M7 3h10v8H7zM6 11h12v3H6zM8 14v7M16 14v7M8 18h8"/>',
    "light": '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    "wifi": '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r=".8"/>',
    "climate": '<path d="M12 2v20M4 6l16 12M20 6 4 18M9 3l3 3 3-3M9 21l3-3 3 3"/>',
    "quiet": '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l4 6M21 9l-4 6"/>',
    "divider": '<path d="M3 20V8h7v12M14 20V4h7v16M3 20h18M12 4v16"/>',
    "door": '<path d="M5 21V3h11v18M16 5h3v16M3 21h18"/><circle cx="13" cy="12" r=".8"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "pin": '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    "monitor": '<rect x="3" y="4" width="18" height="12"/><path d="M8 20h8M12 16v4"/>',
    "people": '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>',
    "calendar": '<rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2"/>',
    "phone": '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    "chat": '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 10h6M9 13.5h4"/>',
    "mail": '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3.5 6l8.5 7 8.5-7"/>',
    "route": '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H16a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h7.5"/>',
    "coffee": '<path d="M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M7 3v2M11 3v2M15 3v2"/>',
}


def icon(name, cls=""):
    if name == "arrow":
        return ICONS["arrow"]
    body = ICONS[name]
    c = f' class="{cls}"' if cls else ""
    return (f'<svg{c} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{body}</svg>')


PHOTO_IDS = {
    "1486406146926-c627a92ad1ab": "hero",
    "1600880292203-757bb62b4baf": "reuniao-equipa",
    "1497366216548-37526070297c": "sobre-escritorio",
    "1454165804606-c3d57bc86b40": "sobre-relatorios",
    "1552664730-d307ca884978": "sobre-colaboracao",
    "1487958449943-2429e8be8625": "sobre-arquitetura",
    "1431540015161-0bf868a2d407": "consultoria-sala",
    "1524178232363-1fb2b075b655": "formacao-empresas",
}


def photo(name, alt, sizes="100vw", eager=False):
    """Fotografia local em WebP (assets/img/photos/<nome>-<largura>.webp)."""
    name = PHOTO_IDS.get(name, name)
    small, big = (1000, 2000) if name == "hero" else (800, 1600)
    base = f"assets/img/photos/{name}"
    loading = 'fetchpriority="high"' if eager else 'loading="lazy" decoding="async"'
    return (f'<img src="{base}-{big}.webp" srcset="{base}-{small}.webp {small}w, {base}-{big}.webp {big}w" '
            f'sizes="{sizes}" alt="{alt}" width="1600" height="1067" {loading}>')


def asset_version(rel):
    """Hash curto do ficheiro, para o browser descarregar sempre a versão nova."""
    import hashlib
    return hashlib.md5((ROOT / rel).read_bytes()).hexdigest()[:10]


def render_tokens(html):
    html = re.sub(r"\[\[icon:([a-z]+)(?:\|([^\]]+))?\]\]", lambda m: icon(m.group(1), m.group(2) or ""), html)

    def _u(m):
        parts = m.group(1).split("|")
        pid, alt = parts[0], parts[1]
        sizes = parts[2] if len(parts) > 2 and parts[2] else "100vw"
        eager = len(parts) > 3 and parts[3] == "eager"
        return photo(pid, alt, sizes, eager)
    html = re.sub(r"\[\[(?:u|p):([^\]]+)\]\]", _u, html)
    for k, v in SITE.items():
        html = html.replace("{{" + k + "}}", v)
    html = html.replace("{{wa_path}}", WA_PATH)
    for rel in ("assets/css/style.css", "assets/js/main.js", "assets/js/booking.js"):
        html = html.replace(f'"{rel}"', f'"{rel}?v={asset_version(rel)}"')
    return html


def parse_page(path):
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"<!--meta\n(.*?)\n-->\n", raw, re.S)
    meta = {}
    for line in m.group(1).splitlines():
        k, _, v = line.partition(":")
        meta[k.strip()] = v.strip()
    return meta, raw[m.end():]


def nav_items(active, mobile=False):
    out = []
    for key, label, href in NAV:
        cur = ' aria-current="page"' if key == active else ""
        pad = "      " if mobile else "        "
        out.append(f'{pad}<li><a href="{href}"{cur}>{label}</a></li>')
    return "\n".join(out)


PAGE_TMPL = """<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{url}">
<meta name="theme-color" content="#0D3A01">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_PT">
<meta property="og:site_name" content="Aprendiz – Consultoria &amp; Formação">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{site_url}/assets/img/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="assets/img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/style.css">
{jsonld}
</head>
<body>
{header}
<main id="conteudo">
{content}
</main>
{footer}
<script src="assets/js/main.js" defer></script>
</body>
</html>
"""


def jsonld():
    data = {
        "@context": "https://schema.org",
        "@type": "ProfessionalService",
        "name": "Aprendiz – Consultoria & Formação",
        "url": SITE["url"],
        "logo": SITE["url"] + "/assets/img/logo.png",
        "image": SITE["url"] + "/assets/img/og-image.jpg",
        "telephone": SITE["phone"],
        "email": SITE["email"],
        "foundingDate": "2021",
        "address": {"@type": "PostalAddress", "streetAddress": "Rua Cónego Manuel das Neves, Prédio 5, Porta 9", "addressLocality": "Luanda", "addressRegion": "Kinaxixi", "addressCountry": "AO"},
    }
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + "</script>"


def build():
    socials_t = (SRC / "partials/socials.html").read_text(encoding="utf-8").strip()
    header_t = (SRC / "partials/header.html").read_text(encoding="utf-8").replace("{{socials}}", socials_t)
    footer_t = (SRC / "partials/footer.html").read_text(encoding="utf-8").replace("{{socials}}", socials_t)
    for page in sorted((SRC / "pages").glob("*.html")):
        meta, content = parse_page(page)
        active = meta.get("nav", "")
        hero = meta.get("hero", "false") == "true"
        header = (header_t
                  .replace("{{header_class}}", "" if hero else " no-hero")
                  .replace("{{nav_desktop}}", nav_items(active))
                  .replace("{{nav_mobile}}", nav_items(active, mobile=True)))
        slug = page.name
        url = SITE["url"] + "/" + ("" if slug == "index.html" else slug[:-5])
        html = PAGE_TMPL.format(
            title=meta["title"], description=meta["description"], url=url,
            site_url=SITE["url"], jsonld=jsonld() if slug == "index.html" else "",
            header=header, content=content.strip(), footer=footer_t,
        )
        (ROOT / slug).write_text(render_tokens(html), encoding="utf-8")
        print("✓", slug)


if __name__ == "__main__":
    build()
