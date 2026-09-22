/* ============================================================
   Obsidian-style live knowledge graph.
   Self-contained canvas force simulation — no dependencies.
   Fixed to fit the stage (no zoom / pan); nodes are soft,
   glowing orbs sized by their number of connections.
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

  // ---- category palette (matches the site) ----
  var COLORS = {
    root: '#8e8e93',
    lab: '#0a84ff',
    market: '#32d074',
    studio: '#ff6a3d'
  };
  function nodeColor(n) { return n.type === 'root' ? COLORS.root : (COLORS[n.cat] || '#0a84ff'); }

  // small color helpers for gradient fills / glows
  function hexToRgb(h) {
    h = h.replace('#', '');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  function rgba(hex, a) { var c = hexToRgb(hex); return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'; }
  function lighten(hex, amt) {
    var c = hexToRgb(hex);
    return 'rgb(' + Math.round(c.r + (255 - c.r) * amt) + ',' +
      Math.round(c.g + (255 - c.g) * amt) + ',' +
      Math.round(c.b + (255 - c.b) * amt) + ')';
  }

  // ---- build node/link objects ----
  var byId = {};
  var nodes = data.nodes.map(function (n) {
    var node = {
      id: n.id, label: n.label, type: n.type, cat: n.cat, url: n.url,
      x: (Math.random() - 0.5) * 300, y: (Math.random() - 0.5) * 300,
      vx: 0, vy: 0, deg: 0
    };
    byId[n.id] = node;
    return node;
  });
  var links = data.links
    .map(function (l) { return { source: byId[l.source], target: byId[l.target] }; })
    .filter(function (l) { return l.source && l.target; });

  // adjacency + degree (Obsidian sizes nodes by connection count)
  var neighbors = {};
  nodes.forEach(function (n) { neighbors[n.id] = {}; });
  links.forEach(function (l) {
    neighbors[l.source.id][l.target.id] = true;
    neighbors[l.target.id][l.source.id] = true;
    l.source.deg++; l.target.deg++;
  });

  function baseRadius(n) {
    var base = n.type === 'root' ? 12 : n.type === 'category' ? 8 : n.type === 'sub' ? 6 : 4.5;
    return base + Math.min(n.deg, 8) * 1.15; // grow with connections
  }
  function idealLength(l) {
    if (l.source.type === 'root') return 150;
    if (l.source.type === 'category') return 95;
    return 60;
  }

  // ---- fixed view transform (fit only, no user zoom/pan) ----
  var scale = 1, offsetX = 0, offsetY = 0;
  function toWorld(px, py) { return { x: (px - offsetX) / scale, y: (py - offsetY) / scale }; }

  function resize() {
    var rect = stage.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fitToContent();
  }

  // Fit the circle that circumscribes the layout, so rotation never clips.
  function fitToContent() {
    if (!nodes.length) return;
    var cx = 0, cy = 0, i;
    for (i = 0; i < nodes.length; i++) { cx += nodes[i].x; cy += nodes[i].y; }
    cx /= nodes.length; cy /= nodes.length;
    var R = 1;
    for (i = 0; i < nodes.length; i++) {
      var d = Math.hypot(nodes[i].x - cx, nodes[i].y - cy) + baseRadius(nodes[i]);
      if (d > R) R = d;
    }
    var pad = 54;
    scale = Math.min((W - pad * 2), (H - pad * 2)) / (2 * R);
    scale = Math.max(0.25, Math.min(scale, 2.2));
    offsetX = W / 2 - cx * scale;
    offsetY = H / 2 - cy * scale;
  }

  // ---- physics ----
  var alpha = 1;
  var CHARGE = -1400, CENTER = 0.012, DAMP = 0.86;

  function tick() {
    if (alpha <= 0.002) return; // fully settled — freeze, no jitter
    var i, j;
    for (i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      for (j = i + 1; j < nodes.length; j++) {
        var b = nodes[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        var d2 = dx * dx + dy * dy || 0.01, d = Math.sqrt(d2);
        var f = (CHARGE * alpha) / d2, fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
    }
    for (var k = 0; k < links.length; k++) {
      var l = links[k], L = idealLength(l);
      var ddx = l.target.x - l.source.x, ddy = l.target.y - l.source.y;
      var dist = Math.sqrt(ddx * ddx + ddy * ddy) || 0.01;
      var force = (dist - L) * 0.06 * alpha, ux = ddx / dist, uy = ddy / dist;
      l.source.vx += ux * force; l.source.vy += uy * force;
      l.target.vx -= ux * force; l.target.vy -= uy * force;
    }
    for (var m = 0; m < nodes.length; m++) {
      var n = nodes[m];
      if (n === dragging) continue;
      n.vx += -n.x * CENTER * alpha; n.vy += -n.y * CENTER * alpha;
      n.vx *= DAMP; n.vy *= DAMP;
      n.x += n.vx; n.y += n.vy;
    }
    if (alpha > 0.002) alpha *= 0.985; else alpha = 0;
  }

  // Slow whole-graph rotation once settled and idle.
  var ROT = 0.0008;
  function ambient() {
    if (alpha > 0.05 || dragging || hoverNode) return;
    var cx = 0, cy = 0, i;
    for (i = 0; i < nodes.length; i++) { cx += nodes[i].x; cy += nodes[i].y; }
    cx /= nodes.length; cy /= nodes.length;
    var cos = Math.cos(ROT), sin = Math.sin(ROT);
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i], dx = n.x - cx, dy = n.y - cy;
      n.x = cx + dx * cos - dy * sin;
      n.y = cy + dx * sin + dy * cos;
    }
  }

  // ---- rendering ----
  var hoverNode = null;

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    var connected = hoverNode ? neighbors[hoverNode.id] : null;
    function isDim(n) { return hoverNode && !(n === hoverNode || connected[n.id]); }

    // links
    for (var i = 0; i < links.length; i++) {
      var l = links[i];
      var hot = hoverNode && (l.source === hoverNode || l.target === hoverNode);
      var faded = hoverNode && !hot;
      if (hot) {
        ctx.strokeStyle = rgba(nodeColor(l.target.type === 'root' ? l.source : l.target), 0.55);
        ctx.lineWidth = 1.6 / scale;
      } else {
        ctx.strokeStyle = faded ? rgba('#8a8a90', 0.06) : rgba('#8a8a90', 0.22);
        ctx.lineWidth = 1 / scale;
      }
      ctx.beginPath();
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);
      ctx.stroke();
    }

    // nodes
    for (var j = 0; j < nodes.length; j++) {
      var n = nodes[j];
      var r = baseRadius(n);
      var col = nodeColor(n);
      var dim = isDim(n);
      var hot = n === hoverNode || (connected && connected[n.id]);
      ctx.globalAlpha = dim ? 0.22 : 1;

      // soft glow
      ctx.shadowColor = rgba(col, dim ? 0 : 0.55);
      ctx.shadowBlur = (n === hoverNode ? 26 : hot ? 16 : 9) / 1;

      // radial-gradient fill for an orb-like look
      var g = ctx.createRadialGradient(
        n.x - r * 0.35, n.y - r * 0.35, r * 0.15, n.x, n.y, r
      );
      g.addColorStop(0, lighten(col, 0.45));
      g.addColorStop(1, col);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowBlur = 0;

      // faint rim
      ctx.lineWidth = 1 / scale;
      ctx.strokeStyle = rgba('#ffffff', 0.22);
      ctx.stroke();

      // labels
      var showLabel = n.type !== 'post' || n === hoverNode || (connected && connected[n.id]);
      if (showLabel && !dim) {
        var fs = (n.type === 'root' ? 14 : n.type === 'category' ? 12.5 : 11) / scale;
        ctx.font = '500 ' + fs + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = (getComputedStyle(document.body).getPropertyValue('--text-soft') || '#6e6e73').trim();
        var text = n.label.length > 32 ? n.label.slice(0, 30) + '…' : n.label;
        ctx.fillText(text, n.x, n.y + r + 4 / scale);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function frame() { tick(); ambient(); draw(); requestAnimationFrame(frame); }

  // ---- picking ----
  function nodeAt(px, py) {
    var w = toWorld(px, py);
    for (var i = nodes.length - 1; i >= 0; i--) {
      var n = nodes[i], r = baseRadius(n) + 5;
      var dx = n.x - w.x, dy = n.y - w.y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }

  // ---- interaction (drag + hover + click; no zoom/pan) ----
  var dragging = null, downAt = null, moved = 0, last = { x: 0, y: 0 };

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
  }
  function onMove(e) {
    var p = pointerPos(e);
    if (dragging) {
      var w = toWorld(p.x, p.y);
      dragging.x = w.x; dragging.y = w.y; dragging.vx = 0; dragging.vy = 0;
      alpha = Math.max(alpha, 0.3);
      moved += Math.abs(p.x - last.x) + Math.abs(p.y - last.y);
    } else {
      var hit = nodeAt(p.x, p.y);
      hoverNode = hit;
      canvas.style.cursor = hit ? 'pointer' : 'default';
      if (hit) {
        tip.hidden = false; tip.textContent = hit.label;
        tip.style.left = p.x + 'px'; tip.style.top = (p.y - 12) + 'px';
      } else { tip.hidden = true; }
    }
    last = p;
  }
  function onUp() {
    if (dragging && moved < 6 && dragging.url) window.location.href = dragging.url;
    else if (!dragging && downAt) {
      var hit = nodeAt(downAt.x, downAt.y);
      if (hit && hit.url && moved < 6) window.location.href = hit.url;
    }
    dragging = null; downAt = null; canvas.style.cursor = 'default';
  }

  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('mouseleave', function () { tip.hidden = true; hoverNode = null; });
  canvas.addEventListener('touchstart', function (e) { onDown(e); }, { passive: true });
  canvas.addEventListener('touchmove', function (e) { onMove(e); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchend', onUp);
  window.addEventListener('resize', resize);

  // ---- boot ----
  resize();
  for (var s = 0; s < 500; s++) tick();  // settle off-screen
  fitToContent();
  frame();
})();
