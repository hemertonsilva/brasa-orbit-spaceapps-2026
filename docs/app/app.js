// Brasa Orbit — daily MODIS vs VIIRS S-NPP calendar.
// Built by Hemerton Silva during the NASA Space Apps Challenge 2026 hackathon window,
// with the help of AI coding assistants; reviewed and tested by the author.
(function () {
  "use strict";

  var DATA_URL = "data/firms_daily_2018_2020.json";
  // Same bins for both sensors, so the panels stay comparable as raw counts.
  var BINS = [
    { min: 1, max: 9, cls: "b1", label: "1–9" },
    { min: 10, max: 49, cls: "b2", label: "10–49" },
    { min: 50, max: 199, cls: "b3", label: "50–199" },
    { min: 200, max: 999, cls: "b4", label: "200–999" },
    { min: 1000, max: Infinity, cls: "b5", label: "1,000+" }
  ];
  // Monthly VIIRS / MODIS ratio, diverging around 1 (neutral band 0.8–1.25).
  var RBINS = [
    { test: function (r) { return r < 0.5; }, cls: "r-3", label: "< 0.5× (MODIS far higher)" },
    { test: function (r) { return r < 0.8; }, cls: "r-2", label: "0.5–0.8×" },
    { test: function (r) { return r < 1.25; }, cls: "r0", label: "0.8–1.25× (similar)" },
    { test: function (r) { return r < 2; }, cls: "r2", label: "1.25–2×" },
    { test: function (r) { return r < 4; }, cls: "r3", label: "2–4×" },
    { test: function () { return true; }, cls: "r4", label: "≥ 4× (VIIRS far higher)" }
  ];
  var SENSORS = [
    { key: "modis", name: "MODIS", detail: "Terra + Aqua · ~1 km" },
    { key: "viirs", name: "VIIRS", detail: "S-NPP · 375 m" }
  ];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var fmt = new Intl.NumberFormat("en-US");
  var fmt1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var fmt2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  var state = { data: null, region: "R1", index: null, years: [] };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function binOf(v) {
    for (var i = 0; i < BINS.length; i++) if (v >= BINS[i].min && v <= BINS[i].max) return BINS[i].cls;
    return "";
  }
  function rbinOf(r) {
    for (var i = 0; i < RBINS.length; i++) if (RBINS[i].test(r)) return RBINS[i].cls;
    return "";
  }
  // Color and label use the same rounded value, so equal labels never get different colors.
  function roundRatio(r) { return r < 10 ? Math.round(r * 10) / 10 : Math.round(r); }
  function isoDay(start, offset) {
    var d = new Date(start + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  }
  function swatch(cssVar) {
    var s = el("span", "swatch");
    s.style.background = "var(" + cssVar + ")";
    return s;
  }

  function renderLegends() {
    var ul = document.getElementById("legend");
    var zero = el("li");
    var zs = swatch("--empty"); zs.classList.add("hollow");
    zero.appendChild(zs);
    zero.appendChild(document.createTextNode("0 (none recorded)"));
    ul.appendChild(zero);
    BINS.forEach(function (b) {
      var li = el("li");
      li.appendChild(swatch("--seq-" + b.cls.slice(1)));
      li.appendChild(document.createTextNode(b.label));
      ul.appendChild(li);
    });
    var rl = document.getElementById("ratio-legend");
    RBINS.forEach(function (b) {
      var li = el("li");
      li.appendChild(swatch("--" + b.cls));
      li.appendChild(document.createTextNode(b.label));
      rl.appendChild(li);
    });
    var na = el("li");
    na.appendChild(swatch("--empty"));
    na.appendChild(document.createTextNode("n/a (MODIS = 0)"));
    rl.appendChild(na);
    var al = document.getElementById("anom-legend");
    ACLASSES.forEach(function (s) {
      var li = el("li");
      var sw = el("span", "swatch acell-sw " + s.cls);
      li.appendChild(sw);
      li.appendChild(document.createTextNode(s.mark + " " + s.label));
      al.appendChild(li);
    });
  }

  function monthly(series) {
    // year -> month -> {modis, viirs}
    var out = {};
    for (var i = 0; i < state.data.days; i++) {
      var iso = isoDay(state.data.start, i);
      var y = iso.slice(0, 4), m = +iso.slice(5, 7) - 1;
      out[y] = out[y] || MONTHS.map(function () { return { modis: 0, viirs: 0 }; });
      out[y][m].modis += series.modis[i];
      out[y][m].viirs += series.viirs[i];
    }
    return out;
  }

  function renderRegionPicker() {
    var host = document.getElementById("region-picker");
    Object.keys(state.data.regions).forEach(function (rid) {
      var b = el("button", "seg", rid + " · " + state.data.regions[rid].name);
      b.type = "button";
      b.dataset.region = rid;
      b.setAttribute("aria-pressed", String(rid === state.region));
      b.addEventListener("click", function () { setRegion(rid); });
      host.appendChild(b);
    });
  }

  function setRegion(rid) {
    state.region = rid;
    Array.prototype.forEach.call(document.querySelectorAll("#region-picker .seg"), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.region === rid));
    });
    try { history.replaceState(null, "", "#" + rid); } catch (e) { /* ignore */ }
    renderRegion();
  }

  function renderRegion() {
    var data = state.data, region = data.regions[state.region], series = data.series[state.region];
    document.getElementById("region-name").textContent = region.name;
    document.getElementById("region-box").textContent =
      "Box: longitude " + region.lon[0] + "° to " + region.lon[1] + "° (upper edge excluded), latitude " +
      region.lat[0] + "° to " + region.lat[1] + "° (upper edge excluded). FIRMS detections with type = 0, day and night.";
    var tm = series.modis.reduce(function (a, b) { return a + b; }, 0);
    var tv = series.viirs.reduce(function (a, b) { return a + b; }, 0);
    document.getElementById("region-totals").textContent =
      "Total detections 2018–2020: MODIS " + fmt.format(tm) + " · VIIRS " + fmt.format(tv) + ".";
    var mon = monthly(series);
    renderFinding(mon);
    renderRatio(mon);
    renderAnomaly(mon);
    renderCalendars(series);
    renderTable(mon);
  }

  function renderFinding(mon) {
    var yearly = [];
    state.years.forEach(function (y) {
      var m = 0, v = 0;
      mon[y].forEach(function (c) { m += c.modis; v += c.viirs; });
      if (m > 0) yearly.push(v / m);
    });
    var inv = [];
    state.years.forEach(function (y) {
      mon[y].forEach(function (c, i) {
        if (c.modis > 0 && c.viirs / c.modis < 0.8) inv.push(MONTHS[i] + " " + y);
      });
    });
    var p = document.getElementById("finding");
    clear(p);
    p.appendChild(el("strong", null, "What stands out: "));
    var txt = "";
    if (yearly.length) {
      txt += "over a full year, VIIRS records " + fmt1.format(Math.min.apply(null, yearly)) + "–" +
        fmt1.format(Math.max.apply(null, yearly)) + "× as many detections as MODIS here. ";
    }
    // Timing: busiest month per sensor and year.
    var peaks = state.years.map(function (y) {
      function argmax(key) {
        var best = 0;
        mon[y].forEach(function (c, i) { if (c[key] > mon[y][best][key]) best = i; });
        return best;
      }
      return { y: y, m: argmax("modis"), v: argmax("viirs") };
    });
    var agree = peaks.every(function (p0) { return p0.m === p0.v; });
    var samePeak = agree && peaks.every(function (p0) { return p0.m === peaks[0].m; });
    if (samePeak) {
      txt += "Both sensors agree on timing: the busiest month is " + MONTHS[peaks[0].m] + " in every year. ";
    } else if (agree) {
      txt += "Both sensors agree on the busiest month of each year (" +
        peaks.map(function (p0) { return MONTHS[p0.m] + " " + p0.y; }).join(", ") + "). ";
    } else {
      txt += "Busiest month, MODIS vs VIIRS: " +
        peaks.map(function (p0) { return p0.y + " " + MONTHS[p0.m] + "/" + MONTHS[p0.v]; }).join(", ") + ". ";
    }
    txt += inv.length
      ? "But the size of the gap is not constant: in " + inv.length + " month" + (inv.length > 1 ? "s" : "") +
        " MODIS records clearly more than VIIRS (ratio below 0.8: " + inv.join(", ") +
        "), so in these data no single scaling factor fits every month. This inversion is unexpected and still to be verified; " +
        "pixel size, overpass time and the number of satellites (MODIS on Terra and Aqua, VIIRS on Suomi NPP only) can all produce gaps like these. " +
        "This view shows them but does not correct for them."
      : "No month in this period has MODIS recording clearly more than VIIRS (ratio below 0.8).";
    p.appendChild(document.createTextNode(txt));
  }

  function renderRatio(mon) {
    var grid = document.getElementById("ratio-grid");
    clear(grid);
    grid.appendChild(el("span", "mlabel", ""));
    MONTHS.forEach(function (m) { grid.appendChild(el("span", "dlabel", m)); });
    state.years.forEach(function (y) {
      grid.appendChild(el("span", "mlabel", String(y)));
      mon[y].forEach(function (c, i) {
        var cell = el("span", "rcell");
        if (c.modis === 0) {
          cell.textContent = "n/a";
          cell.classList.add("na");
        } else {
          var r = c.viirs / c.modis;
          cell.classList.add(rbinOf(r));
          cell.appendChild(document.createTextNode(fmt2.format(r)));
          cell.appendChild(el("span", "x", "×"));
        }
        cell.dataset.tip = MONTHS[i] + " " + y + "|" + c.modis + "|" + c.viirs;
        grid.appendChild(cell);
      });
    });
  }

  // Unusual months: each sensor against the same month in the other two years.
  // Rules from the scientific review: minimum baseline per sensor, per-year floor,
  // and a count difference of at least 2*sqrt(baseline) before classifying.
  var ANOM_UP = 1.5, ANOM_DOWN = 0.67;
  var ANOM_MIN = { modis: { mean: 20, year: 5 }, viirs: { mean: 60, year: 15 } };
  var ACLASSES = [
    { cls: "a-up", mark: "▲▲", label: "Both sensors ≥ 1.5× the other two years" },
    { cls: "a-down", mark: "▼▼", label: "Both sensors ≤ 0.67× the other two years" },
    { cls: "a-dis", mark: "≠", label: "Sensors disagree" },
    { cls: "a-usual", mark: "·", label: "Similar to the other two years" },
    { cls: "a-low", mark: "–", label: "Insufficient data (not classified)" }
  ];
  function anomalyOf(mon, y, i) {
    var others = state.years.filter(function (o) { return o !== y; });
    var out = { valid: true };
    var dirs = {};
    ["modis", "viirs"].forEach(function (k) {
      var vals = others.map(function (o) { return mon[o][i][k]; });
      var base = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      var count = mon[y][i][k];
      out[k] = base > 0 ? count / base : null;
      out[k + "Count"] = count;
      out[k + "Base"] = base;
      var ok = base >= ANOM_MIN[k].mean && vals.every(function (v) { return v >= ANOM_MIN[k].year; });
      if (!ok) { out.valid = false; dirs[k] = 0; return; }
      var sig = Math.abs(count - base) >= 2 * Math.sqrt(base);
      var r = out[k];
      dirs[k] = !sig ? 0 : (r >= ANOM_UP ? 1 : (r <= ANOM_DOWN ? -1 : 0));
    });
    var dm = dirs.modis, dv = dirs.viirs;
    out.cls = !out.valid ? "a-low" : (dm === 1 && dv === 1 ? "a-up" : (dm === -1 && dv === -1 ? "a-down" : (dm !== dv ? "a-dis" : "a-usual")));
    return out;
  }
  function renderAnomaly(mon) {
    var grid = document.getElementById("anom-grid");
    clear(grid);
    grid.appendChild(el("span", "mlabel", ""));
    MONTHS.forEach(function (m) { grid.appendChild(el("span", "dlabel", m)); });
    var ups = [], dis = [];
    state.years.forEach(function (y) {
      grid.appendChild(el("span", "mlabel", String(y)));
      mon[y].forEach(function (c, i) {
        var a = anomalyOf(mon, y, i);
        var spec = ACLASSES.filter(function (s) { return s.cls === a.cls; })[0];
        var cell = el("span", "rcell acell " + a.cls, spec.mark);
        cell.dataset.tip = [MONTHS[i] + " " + y, a.modis === null ? "" : a.modis, a.viirs === null ? "" : a.viirs, spec.label, a.modisCount, Math.round(a.modisBase), a.viirsCount, Math.round(a.viirsBase)].join("|");
        grid.appendChild(cell);
        if (a.cls === "a-up") ups.push(MONTHS[i] + " " + y);
        if (a.cls === "a-dis") dis.push(MONTHS[i] + " " + y);
      });
    });
    var p = document.getElementById("anom-finding");
    clear(p);
    p.appendChild(el("strong", null, "Months unusual in both sensors (vs. the other two years): "));
    p.appendChild(document.createTextNode((ups.length ? ups.join(", ") : "none") + ". " +
      (dis.length ? "Sensors disagree in " + dis.length + " month" + (dis.length > 1 ? "s" : "") + " (" + dis.join(", ") + "); read those with caution." : "")));
  }

  function renderCalendars(series) {
    var host = document.getElementById("calendars");
    clear(host);
    state.years.forEach(function (year) {
      var block = el("article", "year-block");
      block.appendChild(el("h3", null, String(year)));
      var pair = el("div", "pair");
      SENSORS.forEach(function (s) {
        var panel = el("div", "panel");
        var h = el("h4");
        h.appendChild(el("span", null, s.name + " · " + s.detail));
        var yearTotal = 0;
        var grid = el("div", "grid");
        grid.setAttribute("role", "img");
        grid.appendChild(el("span", "mlabel", ""));
        for (var d = 1; d <= 31; d++) grid.appendChild(el("span", "dlabel", d % 5 === 1 ? String(d) : ""));
        for (var m = 0; m < 12; m++) {
          grid.appendChild(el("span", "mlabel", MONTHS[m]));
          for (var day = 1; day <= 31; day++) {
            var idx = state.index[year + "-" + pad(m + 1) + "-" + pad(day)];
            var cell = el("span", "cell");
            if (idx === undefined) {
              cell.classList.add("void");
            } else {
              var v = series[s.key][idx];
              yearTotal += v;
              var b = binOf(v);
              if (b) cell.classList.add(b);
              cell.dataset.v = String(idx);
            }
            grid.appendChild(cell);
          }
        }
        h.appendChild(el("span", "total", fmt.format(yearTotal) + " in " + year));
        grid.setAttribute("aria-label", s.name + " daily detections in " + year + ", total " + fmt.format(yearTotal) +
          ". The monthly table below lists the same data.");
        panel.appendChild(h);
        panel.appendChild(grid);
        pair.appendChild(panel);
      });
      block.appendChild(pair);
      host.appendChild(block);
    });
  }

  function renderTable(mon) {
    var tbody = document.getElementById("table-body");
    clear(tbody);
    state.years.forEach(function (y) {
      mon[y].forEach(function (c, i) {
        var tr = el("tr");
        var th = el("th", null, y + " " + MONTHS[i]);
        th.scope = "row";
        tr.appendChild(th);
        tr.appendChild(el("td", "num", fmt.format(c.modis)));
        tr.appendChild(el("td", "num", fmt.format(c.viirs)));
        tr.appendChild(el("td", "num", c.modis === 0 ? "n/a" : fmt2.format(c.viirs / c.modis)));
        tbody.appendChild(tr);
      });
    });
    document.getElementById("table-caption").textContent =
      "Monthly detections, " + state.data.regions[state.region].name + " (type = 0, UTC dates).";
  }

  function wireTooltip() {
    var tip = document.getElementById("tooltip");
    var active = null;
    function hide() {
      tip.hidden = true;
      if (active) active.classList.remove("active");
      active = null;
    }
    function row(label, value) {
      var r = el("div", "tt-row");
      r.appendChild(el("span", null, label));
      r.appendChild(el("span", null, value));
      tip.appendChild(r);
    }
    function place(ev) {
      var x = ev.clientX + 14, y = ev.clientY + 14;
      var w = tip.offsetWidth, h = tip.offsetHeight;
      if (x + w > window.innerWidth - 8) x = ev.clientX - w - 14;
      if (y + h > window.innerHeight - 8) y = ev.clientY - h - 14;
      tip.style.left = Math.max(8, x) + "px";
      tip.style.top = Math.max(8, y) + "px";
    }
    function onMove(ev) {
      var t = ev.target;
      var isCell = t.classList && t.classList.contains("cell") && t.dataset.v !== undefined;
      var isR = t.classList && t.classList.contains("rcell") && t.dataset.tip;
      if (!isCell && !isR) { hide(); return; }
      if (active !== t) {
        if (active) active.classList.remove("active");
        active = t;
        t.classList.add("active");
        tip.textContent = "";
        var series = state.data.series[state.region];
        if (isCell) {
          var idx = +t.dataset.v;
          tip.appendChild(el("div", "tt-date", isoDay(state.data.start, idx) + " (UTC)"));
          SENSORS.forEach(function (s) {
            var v = series[s.key][idx];
            row(s.name, v === 0 ? "0 · none recorded" : fmt.format(v));
          });
        } else if (t.classList.contains("acell")) {
          var ap = t.dataset.tip.split("|");
          tip.appendChild(el("div", "tt-date", ap[0]));
          row("MODIS", fmt.format(+ap[4]) + " vs " + fmt.format(+ap[5]) + " (" + (ap[1] === "" ? "n/a" : fmt2.format(+ap[1]) + "×") + ")");
          row("VIIRS", fmt.format(+ap[6]) + " vs " + fmt.format(+ap[7]) + " (" + (ap[2] === "" ? "n/a" : fmt2.format(+ap[2]) + "×") + ")");
          tip.appendChild(el("div", "tt-note", ap[3]));
        } else {
          var parts = t.dataset.tip.split("|");
          var m = +parts[1], v2 = +parts[2];
          tip.appendChild(el("div", "tt-date", parts[0]));
          row("MODIS", fmt.format(m));
          row("VIIRS", fmt.format(v2));
          row("VIIRS / MODIS", m === 0 ? "n/a" : fmt2.format(v2 / m) + "×");
        }
        tip.hidden = false;
      }
      place(ev);
    }
    ["calendars", "ratio-grid", "anom-grid"].forEach(function (id) {
      var n = document.getElementById(id);
      n.addEventListener("pointermove", onMove);
      n.addEventListener("click", onMove); // tap support on touch screens
      n.addEventListener("pointerleave", hide);
    });
  }

  function init(data) {
    state.data = data;
    state.index = {};
    for (var i = 0; i < data.days; i++) {
      var iso = isoDay(data.start, i);
      state.index[iso] = i;
      var y = +iso.slice(0, 4);
      if (state.years.indexOf(y) < 0) state.years.push(y);
    }
    var fromHash = (location.hash || "").replace("#", "");
    if (data.regions[fromHash]) state.region = fromHash;
    renderRegionPicker();
    renderRegion();
    wireTooltip();
  }

  renderLegends();
  fetch(DATA_URL)
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(init)
    .catch(function (err) {
      document.getElementById("calendars").appendChild(el("p", "meta", "Could not load data (" + err.message + ")."));
    });
})();
