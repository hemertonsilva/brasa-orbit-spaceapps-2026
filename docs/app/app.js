// Brasa Orbit — daily MODIS vs VIIRS S-NPP calendar.
// Built during the NASA Space Apps Challenge 2026 hackathon window.
(function () {
  "use strict";

  var DATA_URL = "data/firms_daily_2018_2020.json";
  var REGION = "R1";
  // Same bins for both sensors, so the panels stay comparable as raw counts.
  var BINS = [
    { min: 1, max: 9, cls: "b1", label: "1–9" },
    { min: 10, max: 49, cls: "b2", label: "10–49" },
    { min: 50, max: 199, cls: "b3", label: "50–199" },
    { min: 200, max: 999, cls: "b4", label: "200–999" },
    { min: 1000, max: Infinity, cls: "b5", label: "1,000+" }
  ];
  var SENSORS = [
    { key: "modis", name: "MODIS", detail: "Terra + Aqua · ~1 km" },
    { key: "viirs", name: "VIIRS", detail: "S-NPP · 375 m" }
  ];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var fmt = new Intl.NumberFormat("en-US");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function binOf(v) {
    for (var i = 0; i < BINS.length; i++) if (v >= BINS[i].min && v <= BINS[i].max) return BINS[i].cls;
    return "";
  }

  function isoDay(start, offset) {
    var d = new Date(start + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  }

  function renderLegend() {
    var ul = document.getElementById("legend");
    var zero = el("li");
    var zs = el("span", "swatch");
    zs.style.background = "var(--empty)";
    zero.appendChild(zs);
    zero.appendChild(document.createTextNode("0 (none recorded)"));
    ul.appendChild(zero);
    BINS.forEach(function (b) {
      var li = el("li");
      var s = el("span", "swatch");
      s.style.background = "var(--seq-" + b.cls.slice(1) + ")";
      li.appendChild(s);
      li.appendChild(document.createTextNode(b.label));
      ul.appendChild(li);
    });
  }

  function build(data) {
    var region = data.regions[REGION];
    var series = data.series[REGION];
    document.getElementById("region-name").textContent = region.name;
    document.getElementById("region-box").textContent =
      "Box: longitude " + region.lon[0] + "° to " + region.lon[1] + "° (exclusive), latitude " +
      region.lat[0] + "° to " + region.lat[1] + "° (exclusive). FIRMS detections with type = 0, day and night.";

    // index: year -> month -> day -> offset
    var byDate = {};
    var years = [];
    for (var i = 0; i < data.days; i++) {
      var iso = isoDay(data.start, i);
      byDate[iso] = i;
      var y = +iso.slice(0, 4);
      if (years.indexOf(y) < 0) years.push(y);
    }

    var totals = { modis: 0, viirs: 0 };
    SENSORS.forEach(function (s) { totals[s.key] = series[s.key].reduce(function (a, b) { return a + b; }, 0); });
    document.getElementById("region-totals").textContent =
      "Total detections 2018–2020: MODIS " + fmt.format(totals.modis) + " · VIIRS " + fmt.format(totals.viirs) + ".";

    var host = document.getElementById("calendars");
    years.forEach(function (year) {
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
            var iso = year + "-" + String(m + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
            var idx = byDate[iso];
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
        grid.setAttribute("aria-label", s.name + " daily detections in " + year + ", total " + fmt.format(yearTotal) + ". See the notes for limits.");
        panel.appendChild(h);
        panel.appendChild(grid);
        pair.appendChild(panel);
      });
      block.appendChild(pair);
      host.appendChild(block);
    });

    wireTooltip(data, series);
  }

  function wireTooltip(data, series) {
    var tip = document.getElementById("tooltip");
    var active = null;
    function hide() {
      tip.hidden = true;
      if (active) active.classList.remove("active");
      active = null;
    }
    document.getElementById("calendars").addEventListener("pointermove", function (ev) {
      var t = ev.target;
      if (!t.classList || !t.classList.contains("cell") || t.dataset.v === undefined) { hide(); return; }
      var idx = +t.dataset.v;
      if (active !== t) {
        if (active) active.classList.remove("active");
        active = t;
        t.classList.add("active");
        tip.textContent = "";
        tip.appendChild(el("div", "tt-date", isoDay(data.start, idx) + " (UTC)"));
        SENSORS.forEach(function (s) {
          var row = el("div", "tt-row");
          var v = series[s.key][idx];
          row.appendChild(el("span", null, s.name));
          row.appendChild(el("span", null, v === 0 ? "0 · none recorded" : fmt.format(v)));
          tip.appendChild(row);
        });
        tip.hidden = false;
      }
      var x = ev.clientX + 14, y = ev.clientY + 14;
      var w = tip.offsetWidth, h = tip.offsetHeight;
      if (x + w > window.innerWidth - 8) x = ev.clientX - w - 14;
      if (y + h > window.innerHeight - 8) y = ev.clientY - h - 14;
      tip.style.left = x + "px";
      tip.style.top = y + "px";
    });
    document.getElementById("calendars").addEventListener("pointerleave", hide);
  }

  renderLegend();
  fetch(DATA_URL)
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(build)
    .catch(function (err) {
      var host = document.getElementById("calendars");
      host.appendChild(el("p", "meta", "Could not load data (" + err.message + ")."));
    });
})();
