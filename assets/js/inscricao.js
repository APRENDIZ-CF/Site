/* Inscrição em formações com pagamento por IBAN (página inscricao.html) */
(function () {
  "use strict";
  var WHATSAPP = "244923353534";
  var ERRO = "Não foi possível enviar. Tente novamente ou contacte-nos pelo WhatsApp/telefone +244 923 35 35 34.";
  var MSG = {
    valueMissing: "Este campo é obrigatório.",
    typeMismatch: "Verifique o formato introduzido.",
    patternMismatch: "Verifique o formato introduzido."
  };
  var MAX_BYTES = 3 * 1024 * 1024;

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var passoDados = $("#passo-dados"), passoPag = $("#passo-pagamento"), passoComp = $("#passo-comprovativo");
  var fInsc = $("#form-inscricao"), fComp = $("#form-comprovativo");
  if (!fInsc || !fComp) return;

  var store = {
    get: function () { try { return JSON.parse(localStorage.getItem("aprendiz-inscricao") || "null"); } catch (e) { return null; } },
    set: function (v) { try { localStorage.setItem("aprendiz-inscricao", JSON.stringify(v)); } catch (e) {} }
  };

  function check(input) {
    var field = input.closest(".field");
    var msg = "";
    for (var k in MSG) { if (input.validity[k]) { msg = MSG[k]; break; } }
    if (!msg && input.type === "file" && input.files[0] && input.files[0].size > MAX_BYTES) msg = "O ficheiro tem de ter até 3 MB.";
    if (field) {
      field.classList.toggle("has-error", !!msg);
      var out = field.querySelector(".error-msg");
      if (out) out.textContent = msg;
    }
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    return !msg;
  }
  function validate(form) {
    var first = null;
    form.querySelectorAll("input:not([type=hidden]), select, textarea").forEach(function (i) {
      if (i.closest(".hp-field") || i.disabled) return;
      if (!check(i) && !first) first = i;
    });
    if (first) first.focus();
    return !first;
  }
  function status(form, msg) {
    var s = $(".form-status", form);
    s.textContent = msg; s.hidden = !msg; if (msg) s.focus();
  }
  function post(url, data) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || ""); return j; }); });
  }
  [fInsc, fComp].forEach(function (form) {
    form.querySelectorAll("input, select, textarea").forEach(function (i) {
      i.addEventListener("blur", function () { if (i.value) check(i); });
      i.addEventListener("input", function () { if (i.closest(".has-error")) check(i); });
      i.addEventListener("change", function () { if (i.type === "file") check(i); });
    });
  });

  /* Pré-seleção da formação (?curso=Excel%20Básico) */
  var curso = new URLSearchParams(location.search).get("curso");
  var sel = $("#i-curso");
  if (curso) Array.prototype.forEach.call(sel.options, function (o) { if (o.value === curso) sel.value = curso; });

  /* Preço da formação escolhida */
  var precos = null, precoEl = $("#i-preco");
  var btnInsc = $('[type="submit"]', fInsc);
  function atualizar() {
    if (!sel.value || !precos) { precoEl.hidden = true; return; }
    var v = precos[sel.value];
    precoEl.textContent = "Valor (particulares): " + (v || "a confirmar") + (/hora/.test(v || "") ? " — o total depende do nº de horas; confirmamos por e-mail" : "");
    precoEl.hidden = false;
  }
  sel.addEventListener("change", atualizar);
  fetch("/api/inscricao", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.json(); })
    .then(function (j) { if (j && j.precos) { precos = j.precos; atualizar(); } })
    .catch(function () {});

  /* Data de hoje (só leitura) e data mínima da formação */
  var hoje = new Date(); hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  $("#i-hoje").value = hoje.toISOString().slice(0, 10);
  $("#i-data").min = hoje.toISOString().slice(0, 10);

  function mostrarPagamento(p) {
    passoPag.querySelectorAll("[data-pay]").forEach(function (el) { el.textContent = p[el.getAttribute("data-pay")] || ""; });
    if (!p.valor) $('[data-pay="valor"]', passoPag).textContent = "A confirmar (enviamos o valor por e-mail/WhatsApp)";
    var rowBanco = $('[data-pay-row="banco"]', passoPag);
    if (rowBanco) rowBanco.hidden = !p.banco;
    $("#p-codigo").value = p.codigo || "";
    $("#p-nome").value = p.nome || "";
    $("#p-email").value = p.email || "";
    var txt = "Olá! Envio o comprovativo da inscrição " + p.codigo + " (" + p.formacao + "), em nome de " + p.nome + ".";
    $("#pay-whatsapp").href = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(txt);
    passoDados.hidden = true; passoPag.hidden = false; passoComp.hidden = false;
    $("h2", passoPag).focus();
  }

  fInsc.addEventListener("submit", function (e) {
    e.preventDefault();
    status(fInsc, "");
    if (!validate(fInsc)) return;
    var btn = btnInsc; btn.disabled = true;
    var data = {};
    new FormData(fInsc).forEach(function (v, k) { data[k] = v; });
    post(fInsc.getAttribute("data-endpoint"), data)
      .then(function (r) {
        var p = { codigo: r.codigo, iban: r.iban, titular: r.titular, banco: r.banco, valor: r.valor, formacao: data.formacao, nome: data.nome, email: data.email };
        store.set(p);
        mostrarPagamento(p);
      })
      .catch(function () { status(fInsc, ERRO); })
      .then(function () { btn.disabled = false; });
  });

  /* "Já tenho código": mostra só o passo 3 (preenchido com a última inscrição feita neste aparelho) */
  document.querySelectorAll("[data-show-comprovativo]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var p = store.get();
      if (p && p.codigo) { mostrarPagamento(p); return; }
      passoDados.hidden = true; passoComp.hidden = false;
      $("h2", passoComp).focus();
    });
  });

  /* Botões "Copiar" */
  passoPag.addEventListener("click", function (e) {
    var b = e.target.closest("[data-copy]");
    if (!b) return;
    var v = $('[data-pay="' + b.getAttribute("data-copy") + '"]', passoPag).textContent;
    var ok = function () { b.textContent = "Copiado ✓"; setTimeout(function () { b.textContent = "Copiar"; }, 2000); };
    if (navigator.clipboard) navigator.clipboard.writeText(v).then(ok, function () {});
  });

  fComp.addEventListener("submit", function (e) {
    e.preventDefault();
    status(fComp, "");
    if (!validate(fComp)) return;
    var file = $("#p-file").files[0];
    var btn = $('[type="submit"]', fComp); btn.disabled = true;
    var reader = new FileReader();
    reader.onerror = function () { status(fComp, ERRO); btn.disabled = false; };
    reader.onload = function () {
      var data = {
        website: fComp.website.value,
        codigo: fComp.codigo.value.trim().toUpperCase(),
        nome: fComp.nome.value.trim(),
        email: fComp.email.value.trim(),
        ficheiro: { name: file.name, type: file.type, data: String(reader.result).split(",")[1] || "" }
      };
      post(fComp.getAttribute("data-endpoint"), data)
        .then(function () {
          $("#p-file").value = "";
          status(fComp, "Comprovativo recebido! Vamos validar o pagamento e confirmar a sua vaga por e-mail.");
        })
        .catch(function (err) { status(fComp, err && err.message && /ficheiro|PDF|Código/.test(err.message) ? err.message : ERRO); })
        .then(function () { btn.disabled = false; });
    };
    reader.readAsDataURL(file);
  });
})();
