// Chip, the little tile who helps you plan the job. Chip offers a tip when
// tapped, grins when the tiles fit cleanly, looks careful when a cut would be
// a sliver, and scatters a few tiles if you tap five times fast. Everything
// Chip says goes through the bubble's live region, so a screen reader hears it
// too. Moods are driven by the app, never on a timer of its own.
(function () {
  "use strict";
  var btn = document.getElementById("chip");
  var bubble = document.getElementById("chip-bubble");
  var dock = document.getElementById("chip-dock");
  var hide = document.getElementById("chip-hide");
  if (!btn) { window.Chip = { react: function () {}, context: function () {}, say: function () {} }; return; }

  var still = matchMedia("(prefers-reduced-motion: reduce)");
  var baseMood = "calm", tipKey = "start";
  var bubbleTimer = null, flashTimer = null, taps = [], tipAt = {};

  var TIPS = {
    start: [
      "Hi, I'm Chip! Tell me the wall or floor size and your tile size, and I'll do the sums.",
      "Measure the widest and longest points, and round up. A wall is never perfectly square.",
      "Buying from one batch keeps the colour even. Order it all in one go if you can."
    ],
    quantity: [
      "The spare margin is for breakages and cuts, not waste. You'll use more of it than you think.",
      "A busier pattern means more cuts, so nudge the extra margin up for a room full of corners.",
      "Keep a few spare tiles after the job. Matching a cracked one years later is near impossible."
    ],
    setout: [
      "Starting flush from one wall is simplest, but it dumps the whole leftover at the far side.",
      "A thin cut against the wall is hard to make and catches the eye. Bigger cuts look tidier.",
      "Dry-lay a row before you fix anything. It's the cheapest way to check the plan."
    ],
    result: [
      "These are planning numbers. Always check against the tile maker's own coverage on the box.",
      "If the cut comes out thin, centring the field spreads it to both sides so each edge is fuller.",
      "Happy with it? Tap 'Copy a link' to keep this to hand or send it to whoever's buying."
    ]
  };

  function setMood(m) { btn.setAttribute("data-mood", m); }

  function say(text, ms) {
    if (dock.classList.contains("tucked")) return;
    bubble.textContent = text;
    bubble.classList.remove("pop"); void bubble.offsetWidth; bubble.classList.add("pop");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.textContent = ""; }, ms || 7000);
  }

  function flash(m, ms) {
    setMood(m);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { setMood(baseMood); }, ms || 1500);
  }

  // Cycle the tips for wherever the user is, so tapping again says something
  // new rather than repeating the same line.
  function tip() {
    var list = TIPS[tipKey] || TIPS.start;
    var i = tipAt[tipKey] || 0;
    say(list[i % list.length]);
    tipAt[tipKey] = i + 1;
  }

  function scatter() {
    if (still.matches) return;
    var rect = btn.getBoundingClientRect();
    for (var i = 0; i < 5; i++) {
      (function (n) {
        var s = document.createElement("span");
        s.className = "tile-fly"; s.textContent = "▢";
        s.style.left = (rect.left + 18) + "px";
        s.style.top = (rect.top + 10) + "px";
        s.style.setProperty("--dx", (Math.random() * 160 - 80) + "px");
        s.style.setProperty("--dy", (-60 - Math.random() * 90) + "px");
        s.style.setProperty("--dr", (Math.random() * 540 - 270) + "deg");
        s.style.animationDelay = (n * 0.05) + "s";
        document.body.appendChild(s);
        setTimeout(function () { s.remove(); }, 1200);
      })(i);
    }
  }

  btn.addEventListener("click", function () {
    var now = Date.now();
    taps = taps.filter(function (t) { return now - t < 900; });
    taps.push(now);
    if (taps.length >= 5) { taps = []; scatter(); say("Oops, dropped a few. Right, back to it."); flash("happy"); return; }
    tip();
    flash("think", 900);
  });

  hide.addEventListener("click", function () {
    var tucked = dock.classList.toggle("tucked");
    hide.textContent = tucked ? "" : "tuck away";
    if (!tucked) { say("Back! Tap me any time for a tip."); }
  });

  // Eyes track the pointer a little, so Chip feels awake. Cheap, eyes only.
  if (!still.matches) {
    document.addEventListener("pointermove", function (e) {
      var r = btn.getBoundingClientRect();
      var dx = Math.max(-2, Math.min(2, (e.clientX - (r.left + r.width / 2)) / 60));
      btn.querySelector(".chip-face").style.transform = "translateX(" + dx + "px)";
    }, { passive: true });
  }

  // Public hooks the page calls.
  window.Chip = {
    // Where the user is, so the next tip fits: "quantity", "setout" or "start".
    context: function (key) { tipKey = TIPS[key] ? key : "start"; baseMood = "calm"; setMood(baseMood); },
    // React to a result: "ok" (clean fit), "sliver" (thin edge cut), "bad".
    react: function (kind) {
      tipKey = "result";
      if (kind === "ok") { flash("happy"); say("Nice. The edges land on a decent cut."); }
      else if (kind === "sliver") { flash("warn"); say("One edge would be a thin sliver. I've shown a centred start that fixes it."); }
      else if (kind === "bad") { flash("think"); say("I couldn't read those sizes. Check the numbers and units?"); }
    },
    say: say
  };

  setTimeout(function () { if (!dock.classList.contains("tucked")) say(TIPS.start[0]); }, 900);
})();
