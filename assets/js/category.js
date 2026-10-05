/*
 * category.js — turns a category page into a two-pane browser:
 * a topic tree on the left, the posts for the selected topic on the right.
 * Progressive enhancement: the server-rendered #cat-fallback list stays in the
 * DOM (crawlable, link-reachable) until this script hides it and reveals the app.
 */
(function () {
  'use strict';
  var T = window.TopicTree;
  var app = document.getElementById('cat-app');
  var treeEl = document.getElementById('cat-tree');
  var contentEl = document.getElementById('cat-content');
  var fallback = document.getElementById('cat-fallback');
  if (!app || !treeEl || !contentEl || !T) return;

  var catSlug = app.getAttribute('data-cat-slug') || '';
  var catName = app.getAttribute('data-cat-name') || catSlug;
  var base = app.getAttribute('data-base') || '';

  function parseJSON(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  var topics = parseJSON('cat-topics-data') || [];
  var posts = parseJSON('cat-posts-data') || [];

  var bucket = T.bucketPosts(posts, topics, catSlug);
  var rootNode = {
    label: 'All of ' + catName,
    name: catName,
    path: '',
    ref: catSlug,
    children: bucket.roots,
    posts: bucket.rootPosts
  };

  // path -> node, for see-also resolution and ?topic= validation.
  var byPath = { '': rootNode };
  (function collect(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      byPath[n.path] = n;
      if (n.children) collect(n.children);
    }
  })(bucket.roots);

  var ctx = null;

  function renderContent(node) {
    contentEl.innerHTML = '';
    var list = T.postsUnder(posts, node.path);

    var head = document.createElement('header');
    head.className = 'cat-content-head';
    var h = document.createElement('h2');
    h.className = 'cat-content-title';
    h.textContent = node.path ? node.name : ('All of ' + catName);
    head.appendChild(h);
    var meta = document.createElement('p');
    meta.className = 'cat-content-meta';
    meta.textContent = list.length + (list.length === 1 ? ' entry' : ' entries');
    head.appendChild(meta);
    if (node.blurb) {
      var b = document.createElement('p');
      b.className = 'cat-content-blurb';
      b.textContent = node.blurb;
      head.appendChild(b);
    }
    contentEl.appendChild(head);

    if (node.related && node.related.length) {
      var chips = buildRelated(node.related);
      if (chips) contentEl.appendChild(chips);
    }

    if (!list.length) {
      var empty = document.createElement('p');
      empty.className = 'cat-empty';
      empty.textContent = "Nothing filed here yet — it's on the way.";
      contentEl.appendChild(empty);
      return;
    }

    var ol = document.createElement('ol');
    ol.className = 'cat-entries';
    for (var i = 0; i < list.length; i++) ol.appendChild(entryLi(list[i]));
    contentEl.appendChild(ol);
  }

  function entryLi(post) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.className = 'cat-entry';
    a.href = post.url;

    var main = document.createElement('span');
    main.className = 'cat-entry-main';
    var title = document.createElement('span');
    title.className = 'cat-entry-title';
    title.textContent = post.title;
    main.appendChild(title);
    if (post.excerpt) {
      var ex = document.createElement('span');
      ex.className = 'cat-entry-excerpt';
      ex.textContent = post.excerpt;
      main.appendChild(ex);
    }
    a.appendChild(main);

    if (post.topic) {
      var tag = document.createElement('span');
      tag.className = 'cat-entry-topic';
      tag.textContent = T.humanizeSeg(String(post.topic).split('/').pop());
      a.appendChild(tag);
    }
    var time = document.createElement('time');
    time.className = 'cat-entry-date';
    if (post.date) time.setAttribute('datetime', post.date);
    time.textContent = post.date_display || '';
    a.appendChild(time);

    li.appendChild(a);
    return li;
  }

  function buildRelated(refs) {
    var wrap = document.createElement('div');
    wrap.className = 'topic-related';
    var label = document.createElement('span');
    label.className = 'topic-related-label';
    label.textContent = 'See also';
    wrap.appendChild(label);
    var any = false;
    for (var i = 0; i < refs.length; i++) {
      var ref = String(refs[i] || '');
      if (!ref) continue;
      var slash = ref.indexOf('/');
      var refCat = slash === -1 ? ref : ref.slice(0, slash);
      var relPath = slash === -1 ? '' : ref.slice(slash + 1);
      if (refCat === catSlug) {
        var n = byPath[relPath];
        if (!n) continue; // dead same-category ref — drop
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'topic-chip';
        chip.textContent = n.name;
        (function (path) {
          chip.addEventListener('click', function () { if (ctx) ctx.select(path); });
        })(relPath);
        wrap.appendChild(chip);
      } else {
        var link = document.createElement('a');
        link.className = 'topic-chip';
        link.href = base + '/' + refCat + '/' + (relPath ? ('?topic=' + encodeURIComponent(relPath)) : '');
        link.textContent = ref.split('/').map(T.humanizeSeg).join(' ▸ ');
        wrap.appendChild(link);
      }
      any = true;
    }
    return any ? wrap : null;
  }

  function selectNode(node) {
    renderContent(node);
    try {
      var url = node.path
        ? (location.pathname + '?topic=' + encodeURIComponent(node.path))
        : location.pathname;
      history.replaceState(null, '', url);
    } catch (e) { /* history unavailable — fine */ }
  }

  function initialPath() {
    var p = '';
    var m = /[?&]topic=([^&]+)/.exec(location.search);
    if (m) { try { p = decodeURIComponent(m[1]); } catch (e) { p = m[1]; } }
    else if (location.hash && location.hash.length > 1) {
      try { p = decodeURIComponent(location.hash.slice(1)); } catch (e) { p = location.hash.slice(1); }
    }
    return (p && byPath[p]) ? p : '';
  }

  if (fallback) fallback.hidden = true;
  app.hidden = false;

  ctx = T.renderTree(treeEl, [rootNode], {
    mode: 'nav',
    countOf: T.subtreeCount,
    onSelect: selectNode,
    selectedPath: initialPath()
  });

  window.addEventListener('popstate', function () {
    if (ctx) ctx.select(initialPath());
  });

  // Test hook (headless harness only; harmless in production).
  window.__selectForTest = function (path) { if (ctx) ctx.select(path); };
})();
