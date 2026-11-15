/* APRENDIZ – Consultoria & Formação · scripts globais */
(function () {
  "use strict";
  var doc = document.documentElement;
  doc.classList.add("js");

  /* ---- Cabeçalho: transparente sobre o Hero, branco ao fazer scroll ---- */
  var header = document.querySelector(".site-header");
  var hasHero = !!document.querySelector(".hero");
  if (header && hasHero) {
    var onScroll = function () {
      header.classList.toggle("is-solid", window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- Menu móvel em ecrã inteiro ---- */
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.getElementById("mobile-menu");
  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    menu.setAttribute("aria-hidden", String(!open));
    if (open) { var first = menu.querySelector("a"); if (first) first.focus(); }
  }
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      setMenu(!document.body.classList.contains("menu-open"));
    });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("menu-open")) { setMenu(false); toggle.focus(); }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 1180 && document.body.classList.contains("menu-open")) setMenu(false);
    });
  }

  /* ---- Fade-in ao fazer scroll ---- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---- Imagens que falhem: mantém o bloco com fundo neutro ---- */
  document.querySelectorAll(".figure img, .hero__media img").forEach(function (img) {
    img.addEventListener("error", function () { img.parentElement.classList.add("img-fallback"); });
  });

  /* ---- Filtros de formações ---- */
  var filterBtns = document.querySelectorAll(".filter-btn");
  var courses = document.querySelectorAll(".course[data-cat]");
  var counter = document.getElementById("course-count");
  filterBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var f = btn.getAttribute("data-filter");
      filterBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      var n = 0;
      courses.forEach(function (c) {
        var show = f === "todas" || c.getAttribute("data-cat") === f;
        c.hidden = !show; if (show) n++;
      });
      if (counter) counter.textContent = n + (n === 1 ? " formação" : " formações");
    });
  });

  /* ---- Pré-seleção da formação no formulário (?curso=Excel) ---- */
  var params = new URLSearchParams(window.location.search);
  var curso = params.get("curso");
  var cursoSelect = document.getElementById("f-curso");
  if (curso && cursoSelect) {
    Array.prototype.forEach.call(cursoSelect.options, function (o) { if (o.value === curso) cursoSelect.value = curso; });
  }
  var assunto = params.get("assunto");
  var assuntoSelect = document.getElementById("c-assunto");
  if (assunto && assuntoSelect) {
    Array.prototype.forEach.call(assuntoSelect.options, function (o) { if (o.value === assunto) assuntoSelect.value = assunto; });
  }

  /* ---- Data mínima = hoje ---- */
  var today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  document.querySelectorAll('input[type="date"]').forEach(function (d) { d.min = today.toISOString().slice(0, 10); });

  /* ---- Validação e envio de formulários ----
     Por omissão os formulários não têm servidor. Defina o atributo
     data-endpoint="https://formspree.io/f/xxxx" (ou outro serviço) no <form>
     para que os dados sejam enviados por POST. */
  var MESSAGES = {
    valueMissing: "Este campo é obrigatório.",
    typeMismatch: "Verifique o formato introduzido.",
    patternMismatch: "Verifique o formato introduzido.",
    rangeUnderflow: "O valor é demasiado baixo.",
    rangeOverflow: "O valor é demasiado alto."
  };
  function errorFor(input) {
    var v = input.validity;
    for (var k in MESSAGES) { if (v[k]) return MESSAGES[k]; }
    return "";
  }
  function check(input) {
    var field = input.closest(".field");
    if (!field) return input.checkValidity();
    var msg = errorFor(input);
    field.classList.toggle("has-error", !!msg);
    var out = field.querySelector(".error-msg");
    if (out) out.textContent = msg;
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    return !msg;
  }

  document.querySelectorAll("form[data-form]").forEach(function (form) {
    form.setAttribute("novalidate", "");
    var inputs = form.querySelectorAll("input, select, textarea");
    inputs.forEach(function (i) {
      i.addEventListener("blur", function () { if (i.value) check(i); });
      i.addEventListener("input", function () { if (i.closest(".has-error")) check(i); });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true, firstBad = null;
      inputs.forEach(function (i) { if (!check(i)) { ok = false; firstBad = firstBad || i; } });
      if (!ok) { firstBad.focus(); return; }

      var status = form.querySelector(".form-status");
      var btn = form.querySelector('[type="submit"]');
      var success = form.getAttribute("data-success") || "Obrigado! Recebemos o seu pedido e entraremos em contacto brevemente.";
      var endpoint = form.getAttribute("data-endpoint");
      var done = function (msg) {
        status.textContent = msg; status.hidden = false; status.focus();
        if (btn) btn.disabled = false;
      };
      if (btn) btn.disabled = true;
      if (endpoint) {
        var data = {};
        new FormData(form).forEach(function (v, k) { data[k] = v; });
        data.pagina = document.title;
        fetch(endpoint, { method: "POST", body: JSON.stringify(data), headers: { "Content-Type": "application/json", Accept: "application/json" } })
          .then(function (r) { if (!r.ok) throw new Error(); form.reset(); done(success); })
          .catch(function () { done("Não foi possível enviar o pedido. Tente novamente ou contacte-nos pelo WhatsApp/telefone +244 923 35 35 34."); });
      } else {
        form.reset();
        done(success);
      }
    });
  });

})();
