/* APRENDIZ – calendário de reserva da sala de formação
   - Mostra dias e horários (intervalos de 30 min) com a ocupação vinda de /api/ocupacao
   - Calcula o valor estimado (preço por hora consoante o dia da semana)
   - Envia o pedido pelo WhatsApp e, em paralelo, para /api/contacto (e-mail, quando configurado) */
(function () {
  "use strict";
  var root = document.getElementById("booking");
  if (!root) return;

  var WHATSAPP = root.getAttribute("data-whatsapp") || "244923353534";
  var RATES = JSON.parse(root.getAttribute("data-rates"));
  var OPEN = toMin(root.getAttribute("data-open"));
  var CLOSE = toMin(root.getAttribute("data-close"));
  var STEP = parseInt(root.getAttribute("data-step"), 10);
  var MAX_DAYS_AHEAD = 120;
  var SLOTS = [];
  for (var m = OPEN; m < CLOSE; m += STEP) SLOTS.push(m);

  var MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  var DOW_LONG = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

  var grid = root.querySelector(".cal__grid");
  var title = root.querySelector(".cal__title");
  var prevBtn = root.querySelector('[data-cal="prev"]');
  var nextBtn = root.querySelector('[data-cal="next"]');
  var slotsGrid = root.querySelector(".slots__grid");
  var slotsDate = root.querySelector(".slots__date");
  var summary = root.querySelector(".booking__summary");
  var form = document.getElementById("booking-form");

  /* Hora de Luanda (UTC+1, sem horário de verão) */
  var nowL = new Date(Date.now() + 3600 * 1000);
  var TODAY = ymd(nowL.getUTCFullYear(), nowL.getUTCMonth(), nowL.getUTCDate());
  var NOW_MIN = nowL.getUTCHours() * 60 + nowL.getUTCMinutes();
  var LAST_DAY = (function () { var d = new Date(Date.UTC(nowL.getUTCFullYear(), nowL.getUTCMonth(), nowL.getUTCDate() + MAX_DAYS_AHEAD)); return ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); })();

  var state = { y: nowL.getUTCFullYear(), m: nowL.getUTCMonth(), date: null, start: null, end: null };
  var busy = {}; // "YYYY-MM-DD" -> array de booleanos por slot

  function toMin(s) { var p = s.split(":"); return +p[0] * 60 + +p[1]; }
  function hhmm(min) { return pad(Math.floor(min / 60)) + "h" + pad(min % 60); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
  function dow(date) { var p = date.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay(); }
  function rateFor(date) { var d = dow(date); return d === 0 ? RATES.sunday : d === 6 ? RATES.saturday : RATES.weekday; }
  function kz(v) { return v.toLocaleString("pt-PT").replace(/\s/g, ".") + " Kz"; }
  function longDate(date) { var p = date.split("-"); return DOW_LONG[dow(date)] + ", " + (+p[2]) + " de " + MONTHS[+p[1] - 1] + " de " + p[0]; }

  function slotState(date, i) {
    if (date < TODAY || date > LAST_DAY) return "past";
    if (date === TODAY && SLOTS[i] <= NOW_MIN) return "past";
    if (busy[date] && busy[date][i]) return "busy";
    return "free";
  }
  function dayState(date) {
    if (date < TODAY || date > LAST_DAY) return "disabled";
    var free = 0, taken = 0;
    for (var i = 0; i < SLOTS.length; i++) {
      var s = slotState(date, i);
      if (s === "free") free++; else if (s === "busy") taken++;
    }
    if (free < 2) return "full";            // menos de 1 hora livre
    return taken ? "partial" : "free";
  }

  /* ---- Calendário ---- */
  function renderCalendar() {
    title.textContent = MONTHS[state.m] + " " + state.y;
    grid.innerHTML = "";
    DOW.forEach(function (d) { var h = document.createElement("div"); h.className = "cal__dow"; h.textContent = d; h.setAttribute("aria-hidden", "true"); grid.appendChild(h); });
    var first = new Date(Date.UTC(state.y, state.m, 1)).getUTCDay(); // 0 = domingo
    var offset = (first + 6) % 7;
    var days = new Date(Date.UTC(state.y, state.m + 1, 0)).getUTCDate();
    var startDay = 1;
    // No mês atual, não mostrar as semanas que já passaram (começa na segunda-feira desta semana)
    if (state.y === nowL.getUTCFullYear() && state.m === nowL.getUTCMonth()) {
      var todayD = nowL.getUTCDate();
      var mondayOffset = (nowL.getUTCDay() + 6) % 7;
      startDay = Math.max(1, todayD - mondayOffset);
      if (startDay > 1) offset = 0;
    }
    for (var e = 0; e < offset; e++) { var x = document.createElement("span"); x.className = "cal__day is-empty"; grid.appendChild(x); }
    for (var d = startDay; d <= days; d++) {
      var date = ymd(state.y, state.m, d);
      var st = dayState(date);
      var b = document.createElement("button");
      b.type = "button"; b.className = "cal__day"; b.textContent = d; b.dataset.date = date;
      var label = longDate(date);
      if (st === "disabled") { b.disabled = true; }
      else if (st === "full") { b.classList.add("is-full"); b.setAttribute("aria-disabled", "true"); label += " — esgotado"; }
      else if (st === "partial") { b.classList.add("is-partial"); label += " — parcialmente ocupado"; }
      else { label += " — disponível"; }
      if (date === TODAY) b.classList.add("is-today");
      if (date === state.date) { b.classList.add("is-selected"); b.setAttribute("aria-pressed", "true"); }
      b.setAttribute("aria-label", label);
      grid.appendChild(b);
    }
    var cur = state.y * 12 + state.m;
    prevBtn.disabled = cur <= nowL.getUTCFullYear() * 12 + nowL.getUTCMonth();
    var lp = LAST_DAY.split("-");
    nextBtn.disabled = cur >= +lp[0] * 12 + (+lp[1] - 1);
  }

  grid.addEventListener("click", function (e) {
    var b = e.target.closest(".cal__day");
    if (!b || b.disabled || b.classList.contains("is-full")) return;
    state.date = b.dataset.date; state.start = state.end = null;
    renderCalendar(); renderSlots();
  });
  prevBtn.addEventListener("click", function () { if (--state.m < 0) { state.m = 11; state.y--; } renderCalendar(); });
  nextBtn.addEventListener("click", function () { if (++state.m > 11) { state.m = 0; state.y++; } renderCalendar(); });

  /* ---- Horários ---- */
  function renderSlots() {
    slotsGrid.innerHTML = "";
    if (!state.date) {
      slotsDate.textContent = "— escolha primeiro um dia";
      slotsGrid.innerHTML = '<p class="slots__empty">Selecione um dia disponível no calendário.</p>';
      updateSummary(); return;
    }
    slotsDate.textContent = "— " + longDate(state.date);
    SLOTS.forEach(function (min, i) {
      var s = slotState(state.date, i);
      var b = document.createElement("button");
      b.type = "button"; b.className = "slot"; b.dataset.i = i;
      b.textContent = hhmm(min);
      var label = "Das " + hhmm(min) + " às " + hhmm(min + STEP);
      if (s !== "free") { b.disabled = true; if (s === "past") b.classList.add("is-past"); label += s === "busy" ? " — ocupado" : " — indisponível"; }
      if (state.start !== null) {
        var end = state.end !== null ? state.end : state.start;
        if (i === state.start) b.classList.add("is-start");
        if (state.end !== null && i === state.end) b.classList.add("is-end");
        if (i > state.start && i < end) b.classList.add("is-in");
      }
      b.setAttribute("aria-label", label);
      slotsGrid.appendChild(b);
    });
    updateSummary();
  }

  slotsGrid.addEventListener("click", function (e) {
    var b = e.target.closest(".slot");
    if (!b || b.disabled) return;
    var i = +b.dataset.i;
    if (state.start === null || state.end !== null) { state.start = i; state.end = null; }
    else if (i === state.start) { state.start = null; }
    else if (i < state.start) { state.start = i; }
    else {
      var clear = true;
      for (var k = state.start; k <= i; k++) if (slotState(state.date, k) !== "free") { clear = false; break; }
      if (clear) state.end = i; else { state.start = i; }
    }
    renderSlots();
  });

  function selection() {
    if (!state.date || state.start === null || state.end === null) return null;
    var from = SLOTS[state.start], to = SLOTS[state.end] + STEP;
    var hours = (to - from) / 60;
    return { date: state.date, from: from, to: to, hours: hours, price: Math.round(hours * rateFor(state.date)) };
  }

  function updateSummary() {
    var sel = selection();
    var hint = root.querySelector(".slots__hint");
    if (!sel) {
      summary.hidden = true;
      if (hint) hint.textContent = state.start !== null ? "Agora clique na hora de fim (mínimo 1 hora)." : "Clique na hora de início e depois na hora de fim (mínimo 1 hora).";
      return;
    }
    if (hint) hint.textContent = "Horário selecionado. Para alterar, clique noutra hora de início.";
    summary.hidden = false;
    summary.querySelector('[data-sum="date"]').textContent = longDate(sel.date);
    summary.querySelector('[data-sum="time"]').textContent = hhmm(sel.from) + " – " + hhmm(sel.to);
    summary.querySelector('[data-sum="hours"]').textContent = (sel.hours % 1 ? sel.hours.toString().replace(".", ",") : sel.hours) + (sel.hours === 1 ? " hora" : " horas");
    summary.querySelector('[data-sum="price"]').textContent = kz(sel.price);
    var err = form && form.querySelector(".booking__error"); if (err) err.hidden = true;
  }

  /* ---- Ocupação (Google Calendar via /api/ocupacao) ---- */
  function loadBusy() {
    return fetch("/api/ocupacao", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : { busy: [] }; })
      .then(function (data) {
        busy = {};
        (data.busy || []).forEach(function (b) {
          var from = toMin(b.start), to = toMin(b.end);
          var arr = busy[b.date] || (busy[b.date] = []);
          SLOTS.forEach(function (min, i) { if (min < to && min + STEP > from) arr[i] = true; });
        });
      })
      .catch(function () { busy = {}; });
  }

  /* ---- Documento de identificação: fotos são reduzidas (JPEG) para caberem no envio ---- */
  function lerBase64(blob) {
    return new Promise(function (ok, ko) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).split(",")[1] || ""); };
      r.onerror = ko; r.readAsDataURL(blob);
    });
  }
  function reduzirFoto(file) {
    return new Promise(function (ok) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var e = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * e); c.height = Math.round(img.naturalHeight * e);
        var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { ok(b); }, "image/jpeg", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); ok(null); };
      img.src = url;
    });
  }
  function prepararFicheiro(file) {
    var p = file.type.indexOf("image/") === 0 ? reduzirFoto(file) : Promise.resolve(null);
    return p.then(function (b) {
      return lerBase64(b || file).then(function (data) {
        return { name: b ? file.name.replace(/\.[^.]+$/, "") + ".jpg" : file.name, type: b ? "image/jpeg" : (file.type || "application/octet-stream"), data: data };
      });
    });
  }

  /* ---- Dados bancários da sala (botão Copiar e valores atualizados do servidor) ---- */
  var payBox = form && form.querySelector(".pay-box");
  if (payBox) {
    payBox.addEventListener("click", function (e) {
      var b = e.target.closest("[data-copy]");
      if (!b || !navigator.clipboard) return;
      navigator.clipboard.writeText(payBox.querySelector('[data-pay="' + b.getAttribute("data-copy") + '"]').textContent).then(function () {
        b.textContent = "Copiado ✓"; setTimeout(function () { b.textContent = "Copiar"; }, 2000);
      }, function () {});
    });
    fetch("/api/reserva", { headers: { Accept: "application/json" } }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ok) ["iban", "titular", "banco"].forEach(function (k) { if (j[k]) payBox.querySelector('[data-pay="' + k + '"]').textContent = j[k]; });
    }).catch(function () {});
  }

  /* ---- Envio ---- */
  if (form) {
    form.setAttribute("novalidate", "");
    form.querySelectorAll("input, select, textarea").forEach(function (i) {
      var clear = function () {
        var f = i.closest(".field");
        if (f && f.classList.contains("has-error") && i.checkValidity()) {
          f.classList.remove("has-error"); var o = f.querySelector(".error-msg"); if (o) o.textContent = "";
        }
      };
      i.addEventListener("input", clear); i.addEventListener("change", clear);
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var sel = selection();
      var err = form.querySelector(".booking__error");
      if (!sel) { err.hidden = false; root.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      var firstBad = null;
      form.querySelectorAll("input:not([type=hidden]), select, textarea").forEach(function (i) {
        var f = i.closest(".field"); if (!f) return;
        var bad = !i.checkValidity();
        f.classList.toggle("has-error", bad);
        var out = f.querySelector(".error-msg");
        if (out) out.textContent = bad ? (i.type === "checkbox" ? "É necessário concordar para continuar." : i.validity.valueMissing ? "Este campo é obrigatório." : "Verifique o formato introduzido.") : "";
        if (bad && !firstBad) firstBad = i;
      });
      if (firstBad) { firstBad.focus(); return; }

      var fd = new FormData(form);
      var horario = hhmm(sel.from) + " – " + hhmm(sel.to);
      form.querySelector("#b-data").value = longDate(sel.date);
      form.querySelector("#b-horario").value = horario;
      form.querySelector("#b-valor").value = kz(sel.price);

      var lines = [
        "Olá! Enviei pelo site um pedido de reserva da sala de formação.",
        "",
        "📅 Data: " + longDate(sel.date),
        "🕒 Horário: " + horario + " (" + String(sel.hours).replace(".", ",") + " h)",
        "💰 Valor estimado: " + kz(sel.price),
        "",
        "Nome: " + fd.get("nome"),
        fd.get("empresa") ? "Empresa: " + fd.get("empresa") : null,
        "Telefone: " + fd.get("telefone")
      ].filter(function (l) { return l !== null; });
      var waUrl = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(lines.join("\n"));

      var data = {};
      fd.forEach(function (v, k) { if (typeof v === "string") data[k] = v; });
      var hm = function (m) { return pad(Math.floor(m / 60)) + ":" + pad(m % 60); };
      data.data_iso = sel.date; data.inicio = hm(sel.from); data.fim = hm(sel.to);
      data.data = longDate(sel.date); data.horario = horario + " (" + String(sel.hours).replace(".", ",") + " h)"; data.valor = kz(sel.price);
      var status = form.querySelector(".form-status");
      var btn = form.querySelector('[type="submit"]');
      var btnText = btn.textContent;
      btn.disabled = true; btn.textContent = "A enviar…"; status.hidden = true;

      prepararFicheiro(form.querySelector("#r-docfile").files[0])
        .then(function (f) {
          if (f.data.length > 4000000) { var e2 = new Error("O ficheiro é demasiado grande (máximo 3 MB). Envie uma foto em vez de PDF, ou um PDF mais pequeno."); e2.local = true; throw e2; }
          data.documento_ficheiro = f;
          return fetch("/api/reserva", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
        })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            if (!r.ok || !j.ok) { var e3 = new Error(j.error || ""); e3.local = r.status === 400 || r.status === 413; throw e3; }
          });
        })
        .then(function () {
          form.reset();
          status.innerHTML = "<strong>Pedido de reserva enviado.</strong> Recebeu uma cópia no seu e-mail. Vamos confirmar a disponibilidade e responder brevemente. " +
            'Se preferir, avise-nos também pelo <a href="' + waUrl + '" target="_blank" rel="noopener">WhatsApp</a>.';
          status.hidden = false; status.focus();
        })
        .catch(function (err) {
          status.textContent = err && err.local && err.message ? err.message :
            "Não foi possível enviar o pedido. Tente novamente ou contacte-nos pelo WhatsApp/telefone +244 923 35 35 34.";
          status.hidden = false; status.focus();
        })
        .then(function () { btn.disabled = false; btn.textContent = btnText; });
    });
  }

  renderCalendar(); renderSlots();
  loadBusy().then(function () { renderCalendar(); renderSlots(); });
})();
