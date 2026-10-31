# Setout

Work out how many tiles a floor or wall needs, with the right number of spares, and where to start laying them so the job doesn't finish on a thin sliver cut against the wall. It runs entirely in your browser; nothing you type is uploaded.

Live: https://setout.johanthegoat.xyz

## What it does

- **Count.** Give the surface size and the tile size and it works out the tiles to buy. It folds the grout joint into each tile's coverage and adds a spare margin on top for breakages and cuts. If you enter how many tiles come in a box, it turns the count into boxes and tells you how many spares you'll have left over for repairs later.
- **Set-out.** The useful part. Laying full tiles flush from one wall leaves the whole leftover as a single cut against the far wall, and if that comes out thin it is fiddly to cut and the eye goes straight to it. Setout works out that cut on each axis, flags it when it would be a sliver, and shows a centred start that splits the leftover across both ends so every edge cut lands at half a tile or more.
- **Openings.** An area you won't tile, a window or a door, comes off the count. But every tile that meets the opening's edge is cut and the offcut is usually too small to use elsewhere, so the ring of cut tiles around each opening is added back as whole tiles rather than pretending the whole opening is saved.
- **Share.** The whole input lives in the link, in the part of the URL a browser never sends to a server, so you can send a plan to whoever is buying without anything leaving your device.

## How it's built

Plain HTML, CSS and JavaScript, no framework and no build step. All the arithmetic is in one file, [`src/core.js`](src/core.js), with no reference to the page, so the same code runs in the browser and under the tests. [`src/app.js`](src/app.js) only reads the form, draws the result and keeps the link in sync. Chip, the tile mascot, lives in [`src/chip.js`](src/chip.js): it reacts to the result through a live region, so a screen reader hears its tips too, and it goes quiet under reduced-motion.

```
npm test
```

runs the engine tests on Node (no dependencies). CI runs them on Node 20, 22 and 24.

## Where the numbers come from

- **Spare margins.** The baselines follow the figures tile retailers and the Tile Council of North America handbook publish: about **10%** for a straight or brick lay, **15%** for a diagonal, and **20%** for herringbone, because angled cuts waste more. A room full of corners, pipes and alcoves needs more, which is what the adjustable extra margin is for. Guides put a cut-heavy room at 25–30%.
- **Set-out rule.** British Standard BS 5385 for wall and floor tiling says cuts should be kept to a minimum, decided in advance, made as large as possible and put where they are least noticeable. Trade guides put a number on "as large as possible": aim for no perimeter cut smaller than half a tile, with about a third as the absolute minimum. Centring the field is the standard way to get there, so that is what Setout recommends when a flush start would leave a sliver.

These are planning figures. Tiles, trowels and rooms all vary, so always check against the coverage printed on the tile box and dry-lay a row before you fix anything.

## Mascot

**Chip** is a tile. Tap for a tip that fits where you are on the page, watch the mood change when a cut would be thin, and tap five times fast if you want to see Chip drop a few.
