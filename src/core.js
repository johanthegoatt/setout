// Setout core: how many tiles a floor or wall needs, and where to start laying
// them so you don't end with an ugly sliver against the wall. No DOM in here,
// so the same file runs in the page and under `node --test`.
//
// Two jobs:
//   1) Quantity. Area of the surface, divided by the area one tile covers
//      (the tile plus its share of the grout joint), then a wastage margin on
//      top for breakages and cuts. The straight-lay 10% baseline and the
//      larger margins for diagonal and herringbone follow the figures tile
//      retailers and the TCNA handbook publish; a busy room with lots of cuts
//      needs more, so the margin is adjustable.
//   2) Set-out. Laying full tiles flush from one wall leaves whatever is left
//      over as a single cut against the far wall, and if that gap is a thin
//      sliver it looks wrong and is hard to cut. The trade rule (BS 5385) is
//      to keep cuts as large as possible and never below about half a tile, so
//      when the flush start would leave a sliver, centring the field splits
//      the leftover across both ends and every edge cut lands at half a tile
//      or more. This file works out both and says which to use.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Setout = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var IN = 25.4; // mm per inch

  // ---------------------------------------------------------------- units

  // Everything is held in millimetres inside, so lengths and tile sizes can
  // mix units freely. Room walls are usually metres or feet; tiles millimetres
  // or inches.
  var TO_MM = { mm: 1, cm: 10, m: 1000, in: IN, ft: 304.8 };

  function toMm(value, unit) {
    var n = typeof value === "number" ? value : parseFloat(String(value == null ? "" : value).replace(",", "."));
    var k = TO_MM[unit];
    if (!isFinite(n) || !k) return NaN;
    return n * k;
  }

  // Pattern wastage margins, as a percentage of the plain tile count. Straight
  // and brick/offset make the fewest cuts; a diagonal turns every edge tile
  // into an angled cut; herringbone is all angled cuts and the most waste.
  // These are the shared baselines; the busier the room, the higher you go,
  // which is what the extra margin is for.
  var PATTERN = {
    straight: { waste: 10, label: "Straight (grid)" },
    brick: { waste: 10, label: "Brick / offset" },
    diagonal: { waste: 15, label: "Diagonal (45°)" },
    herringbone: { waste: 20, label: "Herringbone" }
  };

  function round2(x) { return Math.round(x * 100) / 100; }

  // ---------------------------------------------------------- set-out (1 axis)

  // Along one wall of length L (mm), with a tile+joint repeat of `module` mm,
  // work out the flush-start cut and the centred cut.
  //
  //   flush start:  full tiles from one wall, one cut of `rem` at the far wall
  //   centred:      field centred, so both ends get an equal cut; that cut is
  //                 always at least half a tile, which is the point.
  //
  // Returns widths in mm and as a fraction of a whole tile (0..1), plus which
  // start to use and, for the centred option, the width to cut the first tile.
  function axisSetOut(L, tile, gap) {
    var module = tile + gap;               // one tile plus one joint
    if (!(L > 0) || !(module > 0)) return null;
    var full = Math.floor((L + gap + 1e-6) / module); // tiles that fit; the run
    // ends against a wall with no joint after it, so credit one joint back.
    if (full < 0) full = 0;
    var covered = full * module - gap;     // length the full tiles occupy
    var rem = L - covered;                 // leftover for the far-wall cut (mm)
    var tol = Math.min(2, tile * 0.02);    // within ~2 mm counts as no cut
    var exact = rem <= tol || rem >= tile - tol;
    if (rem >= tile - tol) { full += 1; rem = 0; } // a near-full last tile

    var halfTile = tile / 2;
    // Centred: drop one full tile and split what's left over two end cuts.
    var centredCut = exact ? tile : (rem + module) / 2 - gap / 2;
    if (centredCut > tile) centredCut = tile;

    var sliver = !exact && rem < halfTile; // flush start leaves under half a tile

    return {
      lengthMm: round2(L),
      tileMm: tile,
      gapMm: gap,
      fullTiles: full,
      flushCutMm: exact ? 0 : round2(rem),
      flushCutFrac: exact ? 1 : round2(rem / tile),
      centredCutMm: exact ? 0 : round2(centredCut),
      centredCutFrac: exact ? 1 : round2(centredCut / tile),
      sliver: sliver,
      exact: exact,
      // If centring, the first tile against the near wall is cut to this width.
      firstTileMm: exact ? tile : round2(centredCut),
      recommend: exact ? "exact" : (sliver ? "centred" : "flush")
    };
  }

  // ----------------------------------------------------------- whole surface

  // A full estimate for a rectangular floor or wall.
  //   room: { w, l, unit }         two sides of the surface
  //   tile: { w, h, unit }         one tile
  //   gapMm:  grout joint width in mm (0 for no joint)
  //   pattern: key into PATTERN
  //   extraWastePct: added on top of the pattern margin, for cut-heavy rooms
  //   perBox: tiles in a box (optional), to turn the count into boxes
  function estimate(opts) {
    opts = opts || {};
    var rw = toMm(opts.room && opts.room.w, opts.room && opts.room.unit);
    var rl = toMm(opts.room && opts.room.l, opts.room && opts.room.unit);
    var tw = toMm(opts.tile && opts.tile.w, opts.tile && opts.tile.unit);
    var th = toMm(opts.tile && opts.tile.h, opts.tile && opts.tile.unit);
    var gap = typeof opts.gapMm === "number" ? opts.gapMm : parseFloat(opts.gapMm);
    if (!isFinite(gap) || gap < 0) gap = 0;

    if (!(rw > 0) || !(rl > 0)) return { ok: false, reason: "bad-room" };
    if (!(tw > 0) || !(th > 0)) return { ok: false, reason: "bad-tile" };

    var pat = PATTERN[opts.pattern] ? opts.pattern : "straight";
    var extra = isFinite(parseFloat(opts.extraWastePct)) ? Math.max(0, parseFloat(opts.extraWastePct)) : 0;
    var wastePct = PATTERN[pat].waste + extra;

    var areaM2 = (rw / 1000) * (rl / 1000);
    // One tile covers the tile plus half a joint on each side: (tile+gap).
    var moduleAreaM2 = ((tw + gap) / 1000) * ((th + gap) / 1000);
    var baseTiles = areaM2 / moduleAreaM2;
    var withWaste = baseTiles * (1 + wastePct / 100);
    var tilesNeeded = Math.ceil(withWaste - 1e-9);

    var boxes = null, spareTiles = null;
    var perBox = parseInt(opts.perBox, 10);
    if (perBox > 0) {
      boxes = Math.ceil(tilesNeeded / perBox);
      spareTiles = boxes * perBox - tilesNeeded;
    }

    return {
      ok: true,
      areaM2: round2(areaM2),
      pattern: pat,
      patternLabel: PATTERN[pat].label,
      wastePct: round2(wastePct),
      baseTiles: Math.ceil(baseTiles - 1e-9),
      tilesNeeded: tilesNeeded,
      perBox: perBox > 0 ? perBox : null,
      boxes: boxes,
      spareTiles: spareTiles,
      // Set-out on each axis. Width of room uses tile width; length uses height.
      across: axisSetOut(rw, tw, gap),
      along: axisSetOut(rl, th, gap)
    };
  }

  // ------------------------------------------------------------ share link

  // The whole input goes in the URL fragment, which a browser never sends to a
  // server, so a shared link reopens on the same estimate without anything
  // leaving the device.
  function pack(state) {
    var json = JSON.stringify(state);
    var b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, "utf8").toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function unpack(text) {
    try {
      var b64 = String(text).replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var json = typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString("utf8");
      var o = JSON.parse(json);
      return o && typeof o === "object" ? o : null;
    } catch (e) { return null; }
  }

  return {
    IN: IN, TO_MM: TO_MM, PATTERN: PATTERN,
    toMm: toMm, axisSetOut: axisSetOut, estimate: estimate,
    pack: pack, unpack: unpack
  };
});
