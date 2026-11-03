/* ============================================================
   Obsidian-style [[wikilinks]] + backlinks for posts.

   GitHub Pages' native build won't run a custom Jekyll plugin,
   so links are resolved in the browser. Kramdown leaves [[Title]]
   as literal text; this script walks the rendered prose, finds
   those tokens, and swaps them for real links. It also reads the
   per-post link list emitted in #wikilink-data to build a
   "Linked from" (backlinks) panel at the foot of each post.

   Supported syntax (matches Obsidian):
     [[Note Title]]              link, label is the title
     [[Note Title|shown text]]   link with a custom label (alias)

   A name that matches no post is left visible as a muted, dashed
   "unresolved" marker — same idea as Obsidian's red links.
   ============================================================ */
(function () {
  var dataEl = document.getElementById('wikilink-data');
  if (!dataEl) return;

  // Liquid emits trailing commas to keep the template simple; strip them.
  function stripCommas(s) { return s.replace(/,(\s*[}\]])/g, '$1'); }

  var posts;
  try { posts = JSON.parse(stripCommas(dataEl.textContent)); } catch (e) { return; }
  if (!posts || !posts.length) return;

  // Normalise a name so matching ignores case and spacing, and so a
  // slug-style target (harnessing-the-ai) resolves to the same post
  // as its title ("Harnessing the AI").
  function norm(s) {
    return String(s).toLowerCase().replace(/[\s_-]+/g, ' ').trim();
  }

  var byName = {};   // normalised name -> url
  var byUrl = {};    // url -> post (for backlink labels)
  for (var i = 0; i < posts.length; i++) {
    var p = posts[i];
    if (!p.url) continue;
    byUrl[p.url] = p;
    if (p.title) byName[norm(p.title)] = p.url;       // match by title
    var slug = p.url.replace(/\/$/, '').split('/').pop();
    if (slug) byName[norm(slug)] = p.url;             // match by url slug
  }

  // Resolve a raw [[target|alias]] string to { url, label, target }.
  function resolve(raw) {
    var parts = String(raw).split('|');
    var target = parts[0].trim();
    var label = (parts.length > 1 ? parts.slice(1).join('|') : target).trim();
    return { url: byName[norm(target)] || null, label: label, target: target };
  }

  /* ---------- 1. backlink index: url -> [posts that link to it] ---------- */
  var backlinks = {};
  for (var a = 0; a < posts.length; a++) {
    var src = posts[a], seen = {};
    var list = src.links || [];
    for (var b = 0; b < list.length; b++) {
      var dest = resolve(list[b]).url;
      if (!dest || dest === src.url || seen[dest]) continue; // ignore self + dupes
      seen[dest] = true;
      (backlinks[dest] = backlinks[dest] || []).push(src);
    }
  }

  /* ---------- 2. rewrite [[...]] inside rendered prose ---------- */
  var TOKEN = /\[\[([^\[\]]+?)\]\]/g;

  function makeNode(hit) {
    if (hit.url) {
      var link = document.createElement('a');
      link.className = 'wikilink';
      link.href = hit.url;
      link.textContent = hit.label;
      return link;
    }
    var span = document.createElement('span');
    span.className = 'wikilink wikilink-unresolved';
    span.textContent = hit.label;
    span.title = 'No note titled "' + hit.target + '"';
    return span;
  }

  function processText(node) {
    var text = node.nodeValue;
    if (text.indexOf('[[') === -1) return;

    var frag = document.createDocumentFragment();
    var last = 0, m, matched = false;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(text)) !== null) {
      matched = true;
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      frag.appendChild(makeNode(resolve(m[1])));
      last = m.index + m[0].length;
    }
    if (!matched) return;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }

  // Don't rewrite inside code, existing links, or scripts/styles.
  var SKIP = { A: 1, CODE: 1, PRE: 1, SCRIPT: 1, STYLE: 1, TEXTAREA: 1 };

  function scan(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || n.nodeValue.indexOf('[[') === -1) return NodeFilter.FILTER_REJECT;
        var el = n.parentNode;
        while (el && el !== root) {
          if (SKIP[el.nodeName]) return NodeFilter.FILTER_REJECT;
          el = el.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var targets = [], node;
    while ((node = walker.nextNode())) targets.push(node); // collect first — editing live breaks the walker
    for (var t = 0; t < targets.length; t++) processText(targets[t]);
  }

  var proses = document.querySelectorAll('.prose');
  for (var j = 0; j < proses.length; j++) scan(proses[j]);

  /* ---------- 3. render the "Linked from" panel ---------- */
  var panel = document.getElementById('backlinks');
  if (panel) {
    var here = panel.getAttribute('data-post-url');
    var sources = backlinks[here] || [];
    if (sources.length) {
      sources.sort(function (x, y) { return (x.title || '').localeCompare(y.title || ''); });
      var ul = panel.querySelector('.backlinks-list');
      for (var k = 0; k < sources.length; k++) {
        var s = sources[k];
        var li = document.createElement('li');
        var link2 = document.createElement('a');
        link2.href = s.url;
        link2.textContent = s.title || s.url;
        li.appendChild(link2);
        ul.appendChild(li);
      }
      panel.hidden = false;
    }
  }
})();
