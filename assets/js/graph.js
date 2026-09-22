/* ============================================================
   Obsidian-style live knowledge graph.
   Self-contained canvas force simulation — no dependencies.
   Reads nodes/links from the #graph-data JSON block.
   ============================================================ */
(function () {
  var stage = document.getElementById('graph-stage');
  var canvas = document.getElementById('graph-canvas');
  var dataEl = document.getElementById('graph-data');
  var tip = document.getElementById('graph-tooltip');
  if (!stage || !canvas || !dataEl) return;

  // JSON emitted by Liquid can carry trailing commas; strip them before parsing.
  var raw = dataEl.textContent.replace(/,(\s*[}\]])/g, '$1');
  var data;
  try { data = JSON.parse(raw); } catch (e) { console.error('graph data parse error', e); return; }

  var ctx = canvas.getContext('2d');
  var DPR = Math.max(1, window.devicePixelRatio || 1);
  var W = 0, H = 0;

  // ---- category palette (matches the CSS gradients) ----
  var COLORS = {
    root: '#8e8e93',
    lab: '#0071e3',     // The Lab
    market: '#30b67a',  // The Market
    studio: '#ff6a3d'   // The Studio
  };
  function nodeColor(n) {
    if (n.type === 'root') return COLORS.root;
    return COLORS[n.cat] || '#0071e3';
  }
  function baseRadius(n) {
    if (n.type === 'root') return 13;
    if (n.type === 'category') return 9;
    if (n.type === 'sub') return 6;
    return 4.5; // post
  }

  // ---- build node/link objects ----
  var byId = {};
  var nodes = data.nodes.map(function (n) {
    var node = {
      id: n.id, label: n.label, type: n.type, cat: n.cat, url: n.url,
      x: (Math.random() - 0.5) * 300,
      y: (Math.random() - 0.5) * 300,
      vx: 0, vy: 0
    };
    byId[n.id] = node;
    return node;
  });
  var links = data.links
    .map(function (l) { return { source: byId[l.source], target: byId[l.target] }; })
    .filter(function (l) { return l.source && l.target; });

  // adjacency for hover-highlighting
  var neighbors = {};
  nodes.forEach(function (n) { neighbors[n.id] = {}; });
  links.forEach(function (l) {
    neighbors[l.source.id][l.target.id] = true;
    neighbors[l.target.id][l.source.id] = true;
  });

  function idealLength(l) {
    // longer springs the deeper we go, so the tree fans out
    if (l.source.type === 'root') return 150;
    if (l.source.type === 'category') return 95;
    return 62;
  }

  // ---- view transform (pan + zoom) ----
  var scale = 1, offsetX = 0, offsetY = 0, fitted = false;
  function toWorld(px, py) {
    return { x: (px - offsetX) / scale, y: (py - offsetY) / scale };
  }

  // ---- sizing ----
  function resize() {
    var rect = stage.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!fitted) { offsetX = W / 2; offsetY = H / 2; }
  }

  // ---- physics ----
  var alpha = 1;                 // simulation "temperature"
  var CHARGE = -1400;            // node repulsion
  var CENTER = 0.012;            // pull toward origin
  var DAMP = 0.86;

  function tick() {
    // repulsion (O(n^2) — fine for a personal blog's node count)
    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      for (var j = i + 1; j < nodes.length; j++) {
        var b = nodes[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        var d2 = dx * dx + dy * dy || 0.01;
        var d = Math.sqrt(d2);
        var f = (CHARGE * alpha) / d2;
        var fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
    }
    // spring links
    for (var k = 0; k < links.length; k++) {
      var l = links[k], L = idealLength(l);
      var ddx = l.target.x - l.source.x, ddy = l.target.y - l.source.y;
      var dist = Math.sqrt(ddx * ddx + ddy * ddy) || 0.01;
      var force = (dist - L) * 0.06 * alpha;
      var ux = ddx / dist, uy = ddy / dist;
      l.source.vx += ux * force; l.source.vy += uy * force;
      l.target.vx -= ux * force; l.target.vy -= uy * force;
    }
    // centering + integrate
    for (var m = 0; m < nodes.length; m++) {
      var n = nodes[m];
      if (n === dragging) continue;
      n.vx += -n.x * CENTER * alpha;
      n.vy += -n.y * CENTER * alpha;
      n.vx *= DAMP; n.vy *= DAMP;
      n.x += n.vx; n.y += n.vy;
    }
    // cool down, but never fully freeze — keeps the graph gently alive
    if (alpha > 0.05) alpha *= 0.992;
    else alpha = 0.05;
  }

  // ---- rendering ----
  var hoverNode = null;

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    var dim = hoverNode ? function (n) {
      return !(n === hoverNode || neighbors[hoverNode.id][n.id]);
    } : function () { return false; };

    // links
    for (var i = 0; i < links.length; i++) {
      var l = links[i];
      var faded = hoverNode && !(l.source === hoverNode || l.target === hoverNode);
      ctx.strokeStyle = faded ? 'rgba(140,140,150,0.08)' : 'rgba(140,140,150,0.28)';
      ctx.lineWidth = (faded ? 0.6 : 1) / scale;
      ctx.beginPath();
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);
      ctx.stroke();
    }

    // nodes
    for (var j = 0; j < nodes.length; j++) {
      var n = nodes[j];
      var r = baseRadius(n);
      var faint = dim(n);
      var isHot = n === hoverNode;
      ctx.globalAlpha = faint ? 0.25 : 1;

      if (isHot) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 5 / scale, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor(n) + '33';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor(n);
      ctx.fill();
      ctx.lineWidth = 1.5 / scale;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.stroke();

      // labels: always for structural nodes; posts only when zoomed in or hovered
      var showLabel = n.type !== 'post' || scale > 1.35 || isHot ||
        (hoverNode && neighbors[hoverNode.id][n.id]);
      if (showLabel && !faint) {
        var fs = (n.type === 'root' ? 15 : n.type === 'category' ? 13 : 11) / scale;
        ctx.font = '600 ' + fs + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text') || '#1d1d1f';
        var text = n.label.length > 34 ? n.label.slice(0, 32) + '…' : n.label;
        ctx.fillText(text, n.x, n.y + r + 3 / scale);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function frame() {
    tick();
    draw();
    requestAnimationFrame(frame);
  }

  // ---- fit view to content once things settle a bit ----
  function fitToContent() {
    if (nodes.length === 0) return;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(function (n) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    var pad = 70;
    var gw = (maxX - minX) || 1, gh = (maxY - minY) || 1;
    var s = Math.min((W - pad * 2) / gw, (H - pad * 2) / gh, 1.6);
    scale = Math.max(0.4, s);
    offsetX = W / 2 - ((minX + maxX) / 2) * scale;
    offsetY = H / 2 - ((minY + maxY) / 2) * scale;
    fitted = true;
  }

  // ---- picking ----
  function nodeAt(px, py) {
    var w = toWorld(px, py);
    for (var i = nodes.length - 1; i >= 0; i--) {
      var n = nodes[i];
      var r = baseRadius(n) + 4;
      var dx = n.x - w.x, dy = n.y - w.y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }

  // ---- interaction ----
  var dragging = null, panning = false;
  var last = { x: 0, y: 0 };
  var downAt = null, moved = 0;

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    var t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  function onDown(e) {
    var p = pointerPos(e);
    downAt = p; moved = 0; last = p;
    var hit = nodeAt(p.x, p.y);
    if (hit) { dragging = hit; alpha = Math.max(alpha, 0.5); }
    else { panning = true; }
  }

  function onMove(e) {
    var p = pointerPos(e);
    if (dragging) {
      var w = toWorld(p.x, p.y);
      dragging.x = w.x; dragging.y = w.y;
      dragging.vx = 0; dragging.vy = 0;
      moved += Math.abs(p.x - last.x) + Math.abs(p.y - last.y);
    } else if (panning) {
      offsetX += p.x - last.x; offsetY += p.y - last.y;
      moved += Math.abs(p.x - last.x) + Math.abs(p.y - last.y);
    } else {
      var hit = nodeAt(p.x, p.y);
      hoverNode = hit;
      canvas.style.cursor = hit ? 'pointer' : 'grab';
      if (hit) {
        tip.hidden = false;
        tip.textContent = hit.label;
        tip.style.left = p.x + 'px';
        tip.style.top = (p.y - 12) + 'px';
      } else {
        tip.hidden = true;
      }
    }
    last = p;
  }

  function onUp(e) {
    // a click (not a drag) on a node navigates
    if (dragging && moved < 6 && dragging.url) {
      window.location.href = dragging.url;
    } else if (!dragging && !panning && downAt) {
      var hit = nodeAt(downAt.x, downAt.y);
      if (hit && hit.url && moved < 6) window.location.href = hit.url;
    }
    dragging = null; panning = false; downAt = null;
    canvas.style.cursor = 'grab';
  }

  function onWheel(e) {
    e.preventDefault();
    var p = pointerPos(e);
    var factor = Math.pow(1.0015, -e.deltaY);
    var newScale = Math.min(4, Math.max(0.3, scale * factor));
    // zoom toward cursor
    var w = toWorld(p.x, p.y);
    scale = newScale;
    offsetX = p.x - w.x * scale;
    offsetY = p.y - w.y * scale;
  }

  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('mouseleave', function () { tip.hidden = true; hoverNode = null; });

  // touch
  canvas.addEventListener('touchstart', function (e) { onDown(e); }, { passive: true });
  canvas.addEventListener('touchmove', function (e) { onMove(e); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchend', onUp);

  window.addEventListener('resize', function () { fitted = false; resize(); });

  // ---- boot ----
  resize();
  // let the layout breathe for a moment, then frame it nicely
  for (var s = 0; s < 90; s++) tick();  // warm-up steps (off-screen)
  fitToContent();
  canvas.style.cursor = 'grab';
  frame();
})();
