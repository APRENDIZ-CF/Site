/* Inscrição em formações com pagamento por IBAN (página inscricao.html)
   Um só passo: dados + comprovativo + documento de identificação → um único e-mail. */
(function () {
  "use strict";
  var ERRO = "Não foi possível enviar. Tente novamente ou contacte-nos pelo WhatsApp/telefone +244 923 35 35 34.";
  var MSG = {
    valueMissing: "Este campo é obrigatório.",
    typeMismatch: "Verifique o formato introduzido.",
    patternMismatch: "Verifique o formato introduzido."
  };
  var MAX_TOTAL_B64 = 4000000;      // ~3 MB de ficheiros (limite da Vercel: 4,5 MB por pedido)
  var MAX_LADO = 1800;              // fotos são reduzidas para no máximo 1800 px

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var form = $("#form-inscricao");
  if (!form) return;
  var sel = $("#i-curso"), precoEl = $("#i-preco"), btn = $('[type="submit"]', form);
  var temaField = $("#i-tema-field"), temaInput = $("#i-tema");
  var payBox = $(".pay-box", form);

  /* ---- Validação ---- */
  function check(input) {
    var field = input.closest(".field");
    var msg = "";
    for (var k in MSG) { if (input.validity[k]) { msg = MSG[k]; break; } }
    if (field) {
      field.classList.toggle("has-error", !!msg);
      var out = field.querySelector(".error-msg");
      if (out) out.textContent = msg;
    }
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    return !msg;
  }
  function validate() {
    var first = null;
    form.querySelectorAll("input, select, textarea").forEach(function (i) {
      if (i.closest(".hp-field") || i.disabled) return;
      if (!check(i) && !first) first = i;
    });
    if (first) first.focus();
    return !first;
  }
  function status(msg) {
    var s = $(".form-status", form);
    s.textContent = msg; s.hidden = !msg; if (msg) s.focus();
  }
  form.querySelectorAll("input, select, textarea").forEach(function (i) {
    i.addEventListener("blur", function () { if (i.value) check(i); });
    i.addEventListener("input", function () { if (i.closest(".has-error")) check(i); });
    i.addEventListener("change", function () { if (i.type === "file" || i.type === "checkbox") check(i); });
  });

  /* ---- Formação, preço e dados bancários ---- */
  var curso = new URLSearchParams(location.search).get("curso");
  if (curso) Array.prototype.forEach.call(sel.options, function (o) { if (o.value === curso) sel.value = curso; });

  var precos = null;
  function atualizar() {
    var plano = /^Formação Privada – Plano /.test(sel.value);
    temaField.hidden = !plano; temaInput.disabled = !plano; temaInput.required = plano;
    var v = precos && sel.value ? precos[sel.value] : null;
    if (!sel.value || !precos) { precoEl.hidden = true; }
    else { precoEl.textContent = "Valor (particulares): " + (v || "a confirmar"); precoEl.hidden = false; }
    $('[data-pay="valor"]', payBox).textContent = !sel.value ? "Escolha a formação" : (v || "A confirmar (contacte-nos antes de pagar)");
  }
  sel.addEventListener("change", atualizar);
  atualizar();
  fetch("/api/inscricao", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || !j.precos) return;
      precos = j.precos;
      ["iban", "titular", "banco"].forEach(function (k) { $('[data-pay="' + k + '"]', payBox).textContent = j[k] || ""; });
      $('[data-pay-row="banco"]', payBox).hidden = !j.banco;
      atualizar();
    })
    .catch(function () {});

  payBox.addEventListener("click", function (e) {
    var b = e.target.closest("[data-copy]");
    if (!b || !navigator.clipboard) return;
    navigator.clipboard.writeText($('[data-pay="' + b.getAttribute("data-copy") + '"]', payBox).textContent).then(function () {
      b.textContent = "Copiado ✓"; setTimeout(function () { b.textContent = "Copiar"; }, 2000);
    }, function () {});
  });

  /* ---- Datas ---- */
  var hoje = new Date(); hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  $("#i-hoje").value = hoje.toISOString().slice(0, 10);
  $("#i-data").min = hoje.toISOString().slice(0, 10);

  /* ---- Ficheiros: fotos são reduzidas (JPEG) para caberem no envio; PDFs seguem como estão ---- */
  function lerBase64(blob) {
    return new Promise(function (ok, ko) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).split(",")[1] || ""); };
      r.onerror = ko;
      r.readAsDataURL(blob);
    });
  }
  function reduzirFoto(file) {
    return new Promise(function (ok) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var esc = Math.min(1, MAX_LADO / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * esc); c.height = Math.round(img.naturalHeight * esc);
        var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { ok(b ? { blob: b, type: "image/jpeg", ext: "jpg" } : null); }, "image/jpeg", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); ok(null); }; // ex.: HEIC no Chrome → envia o original
      img.src = url;
    });
  }
  function prepararFicheiro(file) {
    var p = file.type.indexOf("image/") === 0 ? reduzirFoto(file) : Promise.resolve(null);
    return p.then(function (red) {
      var blob = red ? red.blob : file;
      var type = red ? red.type : (file.type || "application/octet-stream");
      var name = red ? file.name.replace(/\.[^.]+$/, "") + ".jpg" : file.name;
      return lerBase64(blob).then(function (data) { return { name: name, type: type, data: data }; });
    });
  }

  /* ---- Envio ---- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    status("");
    if (!validate()) return;
    btn.disabled = true;
    var textoBtn = btn.textContent; btn.textContent = "A enviar…";
    var data = {};
    new FormData(form).forEach(function (v, k) { if (typeof v === "string") data[k] = v; });
    Promise.all([prepararFicheiro($("#i-comp").files[0]), prepararFicheiro($("#i-docfile").files[0])])
      .then(function (f) {
        if (f[0].data.length + f[1].data.length > MAX_TOTAL_B64) {
          var err = new Error("Os ficheiros são demasiado grandes (máximo 3 MB no total). Envie uma foto em vez de PDF, ou um PDF mais pequeno.");
          err.local = true; throw err;
        }
        data.comprovativo = f[0]; data.documento_ficheiro = f[1];
        return fetch(form.getAttribute("data-endpoint"), {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data)
        });
      })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok || !j.ok) { var err = new Error(j.error || ""); err.local = r.status === 400 || r.status === 413; throw err; }
        });
      })
      .then(function () {
        $("#inscricao-form").hidden = true;
        var ok = $("#inscricao-ok"); ok.hidden = false; $("h2", ok).focus();
        window.scrollTo({ top: ok.getBoundingClientRect().top + window.scrollY - 140, behavior: "smooth" });
      })
      .catch(function (err) { status(err && err.local && err.message ? err.message : ERRO); })
      .then(function () { btn.disabled = false; btn.textContent = textoBtn; });
  });
})();
