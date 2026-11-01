// Setout page glue: read the form, run the engine in core.js, draw the result,
// keep the share link in sync, and tell Chip what's going on. All the real
// work lives in core.js so it can be tested without a browser.
(function () {
  "use strict";
  var S = window.Setout;
  var $ = function (id) { return document.getElementById(id); };

  var ids = ["room-w", "room-l", "room-unit", "tile-w", "tile-h", "tile-t", "tile-unit", "gap", "pattern", "extra", "per-box", "grout-density", "tub-kg", "open-w", "open-h"];
  var el = {};
  ids.forEach(function (id) { el[id] = $(id); });
  var out = $("out");

  function readState() {
    return {
      rw: el["room-w"].value.trim(), rl: el["room-l"].value.trim(), ru: el["room-unit"].value,
      tw: el["tile-w"].value.trim(), th: el["tile-h"].value.trim(), tt: el["tile-t"].value.trim(), tu: el["tile-unit"].value,
      gap: el.gap.value.trim(), pat: el.pattern.value, box: el["per-box"].value.trim(),
      gd: el["grout-density"].value.trim(), tk: el["tub-kg"].value.trim(),
      ow: el["open-w"].value.trim(), oh: el["open-h"].value.trim()
    };
  }

  function writeState(s) {
    if (!s) return;
    if (s.rw != null) el["room-w"].value = s.rw;
    if (s.rl != null) el["room-l"].value = s.rl;
    if (s.ru) el["room-unit"].value = s.ru;
    if (s.tw != null) el["tile-w"].value = s.tw;
    if (s.th != null) el["tile-h"].value = s.th;
    if (s.tt != null) el["tile-t"].value = s.tt;
    if (s.tu) el["tile-unit"].value = s.tu;
    if (s.gap != null) el.gap.value = s.gap;
    if (s.pat) el.pattern.value = s.pat;
    if (s.box != null) el["per-box"].value = s.box;
    if (s.gd != null) el["grout-density"].value = s.gd;
    if (s.tk != null) el["tub-kg"].value = s.tk;
    if (s.ow != null) el["open-w"].value = s.ow;
    if (s.oh != null) el["open-h"].value = s.oh;
  }

  // mm -> a friendly length, in cm for small cuts and mm for the exact value.
  function mm(v) {
    if (v >= 100) return (Math.round(v / 10 * 10) / 10) + " cm";
    return Math.round(v) + " mm";
  }

  function pct(frac) { return Math.round(frac * 100) + "% of a tile"; }

  function axisRow(name, a) {
    if (!a) return "";
    if (a.exact) {
      return '<div class="axis"><div class="axis-h">' + name + '</div>' +
        '<p class="axis-line"><strong>' + a.fullTiles + ' tiles</strong> fit across with no cut needed. Lovely.</p></div>';
    }
    var rec = a.recommend;
    var flush = '<li' + (rec === "flush" ? ' class="pick"' : '') + '><span class="way">Start flush from one wall</span>' +
      '<span class="cut">' + a.fullTiles + ' full tiles, then a ' + mm(a.flushCutMm) + ' cut (' + pct(a.flushCutFrac) + ') at the far wall</span></li>';
    var centred = '<li' + (rec === "centred" ? ' class="pick"' : '') + '><span class="way">Start centred</span>' +
      '<span class="cut">a ' + mm(a.firstTileMm) + ' cut tile each end (' + pct(a.centredCutFrac) + '), full tiles between</span></li>';
    var warn = a.sliver
      ? '<p class="axis-warn">A flush start finishes on a thin sliver here. Centre the field so each edge cut is at least half a tile.</p>'
      : '';
    return '<div class="axis"><div class="axis-h">' + name + '</div>' +
      '<ul class="ways">' + flush + centred + '</ul>' + warn + '</div>';
  }

  function render(r) {
    if (!r || !r.ok) {
      out.innerHTML = '<div class="result bad"><h3>Can\'t work that out yet</h3>' +
        '<p class="msg">' + (r && r.reason === "bad-tile" ? "Check the tile size." : "Fill in the surface and tile sizes to get started.") + '</p></div>';
      return "bad";
    }

    var boxLine = r.boxes != null
      ? '<div class="cell"><span class="k">Boxes</span><span class="v">' + r.boxes + '</span></div>' +
        '<div class="cell"><span class="k">Spare tiles</span><span class="v">' + r.spareTiles + '</span></div>'
      : "";

    var slivers = (r.across && r.across.sliver) || (r.along && r.along.sliver);

    var groutBlock = "";
    if (r.grout) {
      var g = r.grout;
      var tubLine = g.tubs != null
        ? ' — about ' + g.tubs + ' × ' + g.tubKg + ' kg tub' + (g.tubs === 1 ? '' : 's')
        : '';
      groutBlock =
        '<div class="result">' +
          '<h3>Grout</h3>' +
          '<div class="grid">' +
            '<div class="cell big"><span class="k">Grout to buy</span><span class="v">' + g.totalKg + ' kg</span></div>' +
            '<div class="cell"><span class="k">Per m²</span><span class="v">' + g.kgPerM2 + '</span></div>' +
          '</div>' +
          '<p class="msg">About ' + g.totalKg + ' kg of grout for the joints at ' + g.thickMm + ' mm deep' + tubLine +
          '. Based on a ' + g.density + ' kg/dm³ cement grout; check your product\'s own figure, and buy a little over.</p>' +
        '</div>';
    }

    out.innerHTML =
      '<div class="result">' +
        '<h3>' + r.areaM2 + ' m² · ' + r.patternLabel + ' · ' + r.wastePct + '% spare</h3>' +
        '<div class="grid">' +
          '<div class="cell big"><span class="k">Tiles to buy</span><span class="v">' + r.tilesNeeded + '</span></div>' +
          boxLine +
        '</div>' +
        '<p class="msg">Covers ' + r.areaM2 + ' m² at ' + r.wastePct + '% over the bare count, for breakages and cuts. Keep a few spare for repairs.' +
          (r.openingsAreaM2 > 0 ? ' Takes ' + r.openingsAreaM2 + ' m² off for the opening and adds ' + r.openingCutTiles + ' tiles back for the cuts around its edge.' : '') + '</p>' +
      '</div>' +
      groutBlock +
      '<div class="result setout">' +
        '<h3>Where to start laying</h3>' +
        axisRow("Across the width", r.across) +
        axisRow("Along the length", r.along) +
      '</div>';

    return slivers ? "sliver" : "ok";
  }

  function recompute() {
    var s = readState();
    var r = S.estimate({
      room: { w: s.rw, l: s.rl, unit: s.ru },
      tile: { w: s.tw, h: s.th, thickness: s.tt, unit: s.tu },
      gapMm: parseFloat(s.gap), pattern: s.pat,
      extraWastePct: parseFloat(s.extra || "0"), perBox: s.box,
      groutDensity: s.gd, tubKg: s.tk,
      openings: (s.ow && s.oh) ? [{ w: s.ow, h: s.oh, unit: s.ru }] : []
    });
    var kind = render(r);
    if (window.Chip) {
      if (r.ok) window.Chip.react(kind);
      // else: stay quiet until there's enough to read, so Chip isn't nagging.
    }
    syncLink(s);
  }

  // Keep the state in the URL fragment without spamming history.
  var linkState = "";
  function syncLink(s) {
    linkState = S.pack(s);
    try { history.replaceState(null, "", "#" + linkState); } catch (e) { /* ignore */ }
  }

  $("share").addEventListener("click", function () {
    var url = location.origin + location.pathname + "#" + linkState;
    var done = $("share-done");
    function ok() { done.textContent = "Link copied"; setTimeout(function () { done.textContent = ""; }, 2500); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, function () { done.textContent = url; });
    else { done.textContent = url; }
  });

  // Tips follow where the eye is: the tile fields talk about quantity, the
  // pattern and gap about set-out.
  ["tile-w", "tile-h", "tile-t", "per-box", "extra", "grout-density", "tub-kg"].forEach(function (id) {
    el[id].addEventListener("focus", function () { if (window.Chip) window.Chip.context("quantity"); });
  });
  ["pattern", "gap"].forEach(function (id) {
    el[id].addEventListener("focus", function () { if (window.Chip) window.Chip.context("setout"); });
  });

  ids.forEach(function (id) {
    el[id].addEventListener("input", recompute);
    el[id].addEventListener("change", recompute);
  });

  // Open on a shared link if there is one, otherwise a sensible starting point.
  var frag = location.hash.replace(/^#/, "");
  var initial = frag ? S.unpack(frag) : null;
  if (initial) { writeState(initial); recompute(); }
})();
