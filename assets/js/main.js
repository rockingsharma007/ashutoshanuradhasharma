// Theme toggle: cycles between light and dark, remembers the choice.
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;

  function current() {
    var set = root.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    // Fall back to the OS preference.
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  btn.addEventListener('click', function () {
    var next = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });
})();

// Soft scroll: eases the page toward a wheel target instead of jumping.
// Deliberately conservative — it only smooths discrete mouse wheels, and
// steps aside for touch, reduced-motion, pinch-zoom, and inner scrollers
// (like the editor textarea) so it never fights the browser.
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  if (reduce || coarse) return; // native scrolling is best here

  var current = window.scrollY || window.pageYOffset || 0;
  var target = current;
  var running = false;
  var EASE = 0.14;

  function maxScroll() {
    var doc = document.documentElement;
    return Math.max(0, doc.scrollHeight - window.innerHeight);
  }

  // If the wheel is over something that can itself scroll in this direction,
  // let that element handle it natively.
  function innerScroller(el, dy) {
    while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
      if (el.scrollHeight > el.clientHeight) {
        var oy = getComputedStyle(el).overflowY;
        if (oy === 'auto' || oy === 'scroll') {
          var atTop = el.scrollTop <= 0;
          var atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
          if (!((dy < 0 && atTop) || (dy > 0 && atBottom))) return true;
        }
      }
      el = el.parentElement;
    }
    return false;
  }

  function animate() {
    current += (target - current) * EASE;
    if (Math.abs(target - current) < 0.5) { current = target; running = false; }
    window.scrollTo(0, current);
    if (running) requestAnimationFrame(animate);
  }

  window.addEventListener('wheel', function (e) {
    if (e.ctrlKey) return; // pinch-zoom gesture

    var dy = e.deltaY;
    if (e.deltaMode === 0) {
      // Pixel mode: trackpads emit small, already-smooth deltas — leave them alone.
      if (Math.abs(dy) < 50) return;
    } else if (e.deltaMode === 1) {
      dy *= 16;                    // line mode (e.g. a mouse wheel in Firefox)
    } else {
      dy *= window.innerHeight;    // page mode
    }

    if (innerScroller(e.target, dy)) return;

    e.preventDefault();
    if (!running) { current = window.scrollY || window.pageYOffset || 0; target = current; }
    target = Math.max(0, Math.min(target + dy, maxScroll()));
    if (!running) { running = true; requestAnimationFrame(animate); }
  }, { passive: false });

  // Resync when the page is scrolled by other means (keys, scrollbar, anchors).
  window.addEventListener('scroll', function () {
    if (!running) { current = target = window.scrollY || window.pageYOffset || 0; }
  }, { passive: true });
  window.addEventListener('resize', function () {
    target = Math.max(0, Math.min(target, maxScroll()));
  });
})();
