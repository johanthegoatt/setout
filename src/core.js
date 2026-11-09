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

  // -------------------------------------------------------- movement joints

  // A tiled floor expands and contracts with heat and moisture. Without breaks
  // to take up that movement the stress cracks tiles or lifts them off the bed,
  // so BS 5385 calls for movement (expansion) joints: one around the whole
  // perimeter and at door thresholds, one over any structural joint, and
  // intermediate joints that divide a large floor into bays. For a normal
  // internal floor the bays run up to about 10 m each way, kept roughly square;
  // over underfloor heating they're tighter (around 5 m, and no bay much over
  // 25 m2), and outdoors tighter still (3-5 m). These follow the installer
  // guidance published around BS 5385-3; the standard is the authority, so
  // Setout flags where joints are likely needed rather than designing them.
  var MOVEMENT = {
    normal:   { spacingM: 10, bayCapM2: 100, label: "Internal floor" },
    heated:   { spacingM: 5,  bayCapM2: 25,  label: "Underfloor heating" },
    external: { spacingM: 4,  bayCapM2: 20,  label: "External / exposed" }
  };

  // Count the intermediate joints each way to keep every bay within the bay
  // size and area for its kind. `wMm`,`lMm` are the room sides in millimetres.
  function movementJoints(wMm, lMm, kind) {
    var m = MOVEMENT[kind] ? MOVEMENT[kind] : MOVEMENT.normal;
    var w = (wMm > 0 ? wMm : 0) / 1000, l = (lMm > 0 ? lMm : 0) / 1000;
    if (!(w > 0) || !(l > 0)) return null;

    // Start from the span rule: a joint whenever a run passes the spacing.
    var across = Math.max(0, Math.ceil(w / m.spacingM) - 1);
    var along = Math.max(0, Math.ceil(l / m.spacingM) - 1);

    // Then tighten if a bay is still over the area cap, splitting the longer
    // side until the bay area is within the cap (keeps bays roughly square).
    function bayArea() {
      return (w / (across + 1)) * (l / (along + 1));
    }
    var guard = 0;
    while (bayArea() > m.bayCapM2 + 1e-9 && guard < 200) {
      if (w / (across + 1) >= l / (along + 1)) across += 1; else along += 1;
      guard += 1;
    }

    return {
      kind: m === MOVEMENT[kind] ? kind : "normal",
      label: m.label,
      spacingM: m.spacingM,
      bayCapM2: m.bayCapM2,
      perimeter: true,              // always a perimeter joint
      across: across,               // intermediate joints across the width
      along: along,                 // intermediate joints along the length
      intermediate: across + along, // total intermediate joints
      bays: (across + 1) * (along + 1),
      bayAreaM2: round2(bayArea())
    };
  }

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

    var grossAreaM2 = (rw / 1000) * (rl / 1000);

    // Openings (a window, a door) aren't tiled, so their area comes off the
    // count. But every tile that meets an opening's edge is cut, and the offcut
    // is usually too small to use elsewhere, so the ring of cut tiles around
    // each opening is added back as whole tiles. The waste margin covers the
    // odd cut; these are the extra, interior cuts an opening forces.
    var openingsAreaM2 = 0, openingCutTiles = 0;
    var modAvgMm = (tw + th) / 2 + gap;
    (opts.openings || []).forEach(function (o) {
      var ow = toMm(o && o.w, o && o.unit);
      var oh = toMm(o && o.h, o && o.unit);
      if (!(ow > 0) || !(oh > 0)) return;
      openingsAreaM2 += (ow / 1000) * (oh / 1000);
      if (modAvgMm > 0) openingCutTiles += Math.ceil((2 * (ow + oh)) / modAvgMm);
    });
    var areaM2 = Math.max(0, grossAreaM2 - openingsAreaM2);

    // One tile covers the tile plus half a joint on each side: (tile+gap).
    var moduleAreaM2 = ((tw + gap) / 1000) * ((th + gap) / 1000);
    var baseTiles = areaM2 / moduleAreaM2;
    var withWaste = baseTiles * (1 + wastePct / 100) + openingCutTiles;
    var tilesNeeded = Math.ceil(withWaste - 1e-9);

    var boxes = null, spareTiles = null;
    var perBox = parseInt(opts.perBox, 10);
    if (perBox > 0) {
      boxes = Math.ceil(tilesNeeded / perBox);
      spareTiles = boxes * perBox - tilesNeeded;
    }

    // Grout. The powder that fills the joints, by the tiler's standard sum:
    //   kg/m2 = ((L + W) / (L x W)) x joint x depth x density      (L,W,joint,depth in mm)
    // The joint depth is the tile thickness. Density is about 1.7 kg/dm3 for a
    // cement-based grout (a 300x300x8 mm tile at a 3 mm joint works out to
    // ~0.27 kg/m2); it varies by product, so it's editable. A tub size turns
    // the total into tubs. Only worked out once a tile thickness is given.
    var grout = null;
    var thick = toMm(opts.tile && opts.tile.thickness, opts.tile && opts.tile.unit);
    if (thick > 0 && gap > 0 && tw > 0 && th > 0) {
      var density = parseFloat(opts.groutDensity);
      if (!(density > 0)) density = 1.7;
      var kgPerM2 = ((tw + th) / (tw * th)) * gap * thick * density;
      var totalKg = kgPerM2 * areaM2;
      var tubKg = parseFloat(opts.tubKg);
      var tubs = tubKg > 0 ? Math.ceil(totalKg / tubKg - 1e-9) : null;
      grout = {
        density: round2(density),
        thickMm: round2(thick),
        kgPerM2: round2(kgPerM2),
        totalKg: round2(totalKg),
        tubKg: tubKg > 0 ? tubKg : null,
        tubs: tubs
      };
    }

    // Adhesive. How much tile adhesive the floor needs, and the trowel notch to
    // spread it with. The notch (and so the bed depth, and so the usage) steps up
    // with the tile size, per BS 5385 / adhesive-maker guidance: small tiles take
    // a fine notch, large-format tiles a deep notch or a solid bed. The minimum
    // bonded coverage is 65% for a dry internal area, but 95% for wet areas, any
    // external work and all large-format tiles, which is why those use more. The
    // kg/m2 are mid-range figures from the makers' coverage tables and vary by
    // product, so they're an estimate; the notch and coverage rule are the firm
    // part. A bag size turns the total into bags.
    var adhesive = null;
    if (tw > 0 && th > 0) {
      var maxEdge = Math.max(tw, th);
      var notchMm, kgPerM2A, bed;
      if (maxEdge <= 150) { notchMm = 3; kgPerM2A = 2.5; bed = "notch"; }
      else if (maxEdge <= 300) { notchMm = 6; kgPerM2A = 3.8; bed = "notch"; }
      else if (maxEdge <= 600) { notchMm = 10; kgPerM2A = 5.5; bed = "notch"; }
      else { notchMm = 12; kgPerM2A = 8.0; bed = "solid"; }
      var largeFormat = maxEdge > 600;
      // Wet areas, external work and large-format tiles need near-full coverage.
      var wet = !!opts.wet;
      var coverPct = (wet || largeFormat) ? 95 : 65;
      var totalKgA = kgPerM2A * areaM2;
      var bagKgA = parseFloat(opts.adhesiveBagKg);
      if (!(bagKgA > 0)) bagKgA = 20;
      adhesive = {
        maxEdgeMm: round2(maxEdge),
        notchMm: notchMm,
        solidBed: bed === "solid",
        largeFormat: largeFormat,
        backButter: largeFormat,
        coverPct: coverPct,
        kgPerM2: round2(kgPerM2A),
        totalKg: round2(totalKgA),
        bagKg: bagKgA,
        bags: Math.ceil(totalKgA / bagKgA - 1e-9)
      };
    }

    // Tile trim (edge trim). A tiled area that ends in mid-wall, wraps an
    // external corner or frames a window reveal needs a trim strip over the
    // exposed tile edge, both to finish it and to protect the glaze. Trim is
    // sold in fixed lengths (commonly 2.5 m), so you take the total exposed edge
    // and round up to whole lengths, keeping a little spare for mitred corner
    // cuts. Only worked out when an exposed edge length is given.
    var trim = null;
    var edgeM = parseFloat(opts.trimEdgeM);
    if (isFinite(edgeM) && edgeM > 0) {
      var pieceM = parseFloat(opts.trimLengthM);
      if (!(pieceM > 0)) pieceM = 2.5;
      // A 10% allowance for mitres and offcuts, as with the tile waste.
      var withSpare = edgeM * 1.1;
      trim = {
        edgeM: round2(edgeM),
        pieceM: round2(pieceM),
        withSpareM: round2(withSpare),
        pieces: Math.ceil(withSpare / pieceM - 1e-9)
      };
    }

    return {
      ok: true,
      grout: grout,
      adhesive: adhesive,
      trim: trim,
      areaM2: round2(areaM2),
      grossAreaM2: round2(grossAreaM2),
      openingsAreaM2: round2(openingsAreaM2),
      openingCutTiles: openingCutTiles,
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
      along: axisSetOut(rl, th, gap),
      // Movement joints for the floor's size and setting (BS 5385).
      movement: movementJoints(rw, rl, opts.movementKind)
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
    IN: IN, TO_MM: TO_MM, PATTERN: PATTERN, MOVEMENT: MOVEMENT,
    toMm: toMm, axisSetOut: axisSetOut, movementJoints: movementJoints,
    estimate: estimate, pack: pack, unpack: unpack
  };
});
