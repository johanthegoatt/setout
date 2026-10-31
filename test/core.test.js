"use strict";
var test = require("node:test");
var assert = require("node:assert");
var S = require("../src/core.js");

test("units convert to millimetres", function () {
  assert.strictEqual(S.toMm(3, "m"), 3000);
  assert.strictEqual(S.toMm(30, "cm"), 300);
  assert.ok(Math.abs(S.toMm(12, "in") - 304.8) < 1e-6);
  assert.strictEqual(Math.round(S.toMm(2, "ft")), 610);
  assert.ok(Number.isNaN(S.toMm("abc", "m")));
});

test("a plain floor count adds the straight-lay margin and rounds up", function () {
  var r = S.estimate({
    room: { w: 3, l: 4, unit: "m" },
    tile: { w: 300, h: 300, unit: "mm" },
    gapMm: 3, pattern: "straight"
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.areaM2, 12);
  assert.strictEqual(r.wastePct, 10);
  // 12 m2 / (0.303 m)^2 = 130.7 tiles, x1.10 = 143.8 -> 144.
  assert.strictEqual(r.tilesNeeded, 144);
});

test("a box size turns the count into boxes with the spares named", function () {
  var r = S.estimate({
    room: { w: 3, l: 4, unit: "m" },
    tile: { w: 300, h: 300, unit: "mm" },
    gapMm: 3, pattern: "straight", perBox: 10
  });
  assert.strictEqual(r.boxes, 15);           // 144 / 10 -> 15 boxes
  assert.strictEqual(r.spareTiles, 6);       // 150 - 144
});

test("diagonal wastes more than straight, and the extra margin adds on top", function () {
  var base = { room: { w: 3, l: 3, unit: "m" }, tile: { w: 300, h: 300, unit: "mm" }, gapMm: 2 };
  var straight = S.estimate(Object.assign({ pattern: "straight" }, base));
  var diagonal = S.estimate(Object.assign({ pattern: "diagonal" }, base));
  assert.strictEqual(straight.wastePct, 10);
  assert.strictEqual(diagonal.wastePct, 15);
  assert.ok(diagonal.tilesNeeded > straight.tilesNeeded);
  var busy = S.estimate(Object.assign({ pattern: "diagonal", extraWastePct: 5 }, base));
  assert.strictEqual(busy.wastePct, 20);
});

test("herringbone carries the largest baseline margin", function () {
  assert.strictEqual(S.PATTERN.herringbone.waste, 20);
  assert.ok(S.PATTERN.herringbone.waste > S.PATTERN.straight.waste);
});

test("bad room or tile sizes are refused, not guessed", function () {
  assert.strictEqual(S.estimate({ room: { w: 0, l: 4, unit: "m" }, tile: { w: 300, h: 300, unit: "mm" } }).reason, "bad-room");
  assert.strictEqual(S.estimate({ room: { w: 3, l: 4, unit: "m" }, tile: { w: "x", h: 300, unit: "mm" } }).reason, "bad-tile");
});

test("set-out: a thin far-wall cut is flagged as a sliver and centring is advised", function () {
  // 3400 mm wall, 300 mm tile, 3 mm joint -> 70 mm leftover, under half a tile.
  var a = S.axisSetOut(3400, 300, 3);
  assert.strictEqual(a.fullTiles, 11);
  assert.strictEqual(a.flushCutMm, 70);
  assert.strictEqual(a.sliver, true);
  assert.strictEqual(a.recommend, "centred");
  // Centred cut is larger, and lands at half a tile or more.
  assert.ok(a.centredCutMm > a.flushCutMm);
  assert.ok(a.centredCutFrac >= 0.5);
});

test("set-out: a cut already over half a tile keeps the simpler flush start", function () {
  var a = S.axisSetOut(3200, 300, 0); // 200 mm leftover, over half of 300
  assert.strictEqual(a.sliver, false);
  assert.strictEqual(a.flushCutMm, 200);
  assert.strictEqual(a.recommend, "flush");
});

test("set-out: a wall that fits whole tiles reports no cut", function () {
  var a = S.axisSetOut(3000, 300, 0);
  assert.strictEqual(a.exact, true);
  assert.strictEqual(a.flushCutMm, 0);
  assert.strictEqual(a.recommend, "exact");
  assert.strictEqual(a.fullTiles, 10);
});

test("the estimate carries a set-out for both axes", function () {
  var r = S.estimate({
    room: { w: 3.4, l: 2.1, unit: "m" },
    tile: { w: 300, h: 300, unit: "mm" },
    gapMm: 3, pattern: "straight"
  });
  assert.ok(r.across && r.along);
  assert.strictEqual(r.across.fullTiles, 11);
  assert.ok(["flush", "centred", "exact"].indexOf(r.along.recommend) >= 0);
});

test("a shared link round-trips the whole input", function () {
  var state = { rw: "3.4", rl: "2.1", ru: "m", tw: "300", th: "300", tu: "mm", gap: 3, pat: "straight", box: 10 };
  var back = S.unpack(S.pack(state));
  assert.deepStrictEqual(back, state);
  assert.strictEqual(S.unpack("@@not valid@@"), null);
});

test("a window opening comes off the area but adds the ring of cut tiles", function () {
  var base = { room: { w: 3, l: 2.4, unit: "m" }, tile: { w: 300, h: 300, unit: "mm" }, gapMm: 3, pattern: "straight" };
  var plain = S.estimate(base);
  var withWin = S.estimate(Object.assign({ openings: [{ w: 1.2, h: 1.2, unit: "m" }] }, base));
  // gross 7.2 m2, window 1.44 m2 -> net 5.76 m2 tiled
  assert.strictEqual(withWin.grossAreaM2, 7.2);
  assert.strictEqual(withWin.openingsAreaM2, 1.44);
  assert.strictEqual(withWin.areaM2, 5.76);
  // the opening still forces cut tiles around its edge
  assert.ok(withWin.openingCutTiles > 0);
  // and the net count is lower than tiling the whole wall
  assert.ok(withWin.tilesNeeded < plain.tilesNeeded);
});

test("no openings leaves the count unchanged", function () {
  var base = { room: { w: 3, l: 2.4, unit: "m" }, tile: { w: 300, h: 300, unit: "mm" }, gapMm: 3, pattern: "straight" };
  var a = S.estimate(base);
  var b = S.estimate(Object.assign({ openings: [] }, base));
  assert.strictEqual(a.tilesNeeded, b.tilesNeeded);
  assert.strictEqual(b.openingsAreaM2, 0);
  assert.strictEqual(b.openingCutTiles, 0);
  assert.strictEqual(b.grossAreaM2, b.areaM2);
});

test("a zero or malformed opening is ignored", function () {
  var base = { room: { w: 3, l: 2.4, unit: "m" }, tile: { w: 300, h: 300, unit: "mm" }, gapMm: 3 };
  var r = S.estimate(Object.assign({ openings: [{ w: 0, h: 1, unit: "m" }, { w: "x", h: "y", unit: "m" }] }, base));
  assert.strictEqual(r.openingsAreaM2, 0);
  assert.strictEqual(r.openingCutTiles, 0);
});
