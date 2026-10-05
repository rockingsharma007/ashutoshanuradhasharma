/*
 * topic-tree.js — shared taxonomy backbone for the blog.
 *
 * One dependency-free module used by three places:
 *   - the category pages (nav tree + content pane)
 *   - the home-page knowledge graph
 *   - the owner-only /admin/ editor (manage tree + YAML writer)
 *
 * Loads as a UMD module: `window.TopicTree` in the browser, `module.exports`
 * in Node (so the serializer and the pure helpers can be unit-tested without
 * a browser). Anything that touches `document` is only reached in the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TopicTree = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- slugs & labels -----------------------------------------------------

  // Same rule the admin editor has always used to turn a title into a slug.
  function slugify(s) {
    return String(s == null ? '' : s)
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // Turn a slug segment ("negative-space") into a label ("Negative Space").
  function humanizeSeg(seg) {
    return String(seg == null ? '' : seg).split('-').map(function (w) {
      return w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    }).join(' ');
  }

  // ---- path annotation ----------------------------------------------------

  // Attach node.path (category-relative, e.g. "physics/optics") and node.ref
  // (category-qualified, e.g. "lab/physics/optics") to every node, in place.
  function annotatePaths(topics, catSlug, parentPath) {
    var list = topics || [];
    for (var i = 0; i < list.length; i++) {
      var node = list[i];
      if (!node || typeof node !== 'object') continue;
      var seg = node.slug || slugify(node.name) || '';
      var path = parentPath ? parentPath + '/' + seg : seg;
      node.path = path;
      node.ref = catSlug ? catSlug + '/' + path : path;
      if (node.children && node.children.length) {
        annotatePaths(node.children, catSlug, path);
      }
    }
    return topics;
  }

  // Flat list of every topic across every category — for the related-topics
  // picker and for resolving see-also refs. Operates on the live tree so the
  // picker can toggle `node.related` directly.
  function walkFlat(categories) {
    var out = [];
    var cats = categories || [];
    for (var i = 0; i < cats.length; i++) {
      var cat = cats[i];
      if (!cat) continue;
      annotatePaths(cat.topics || [], cat.slug);
      walkInto(cat.topics || [], cat, [cat.name], 1, out);
    }
    return out;
  }
  function walkInto(nodes, cat, trail, depth, out) {
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node) continue;
      var labelTrail = trail.concat([node.name]);
      out.push({
        catSlug: cat.slug,
        catName: cat.name,
        node: node,
        path: node.path,
        ref: node.ref,
        depth: depth,
        labelTrail: labelTrail
      });
      if (node.children && node.children.length) {
        walkInto(node.children, cat, labelTrail, depth + 1, out);
      }
    }
  }

  // ---- buckets & counts ---------------------------------------------------

  function cloneTopics(nodes) {
    var out = [];
    var list = nodes || [];
    for (var i = 0; i < list.length; i++) {
      var n = list[i] || {};
      var c = { name: n.name, slug: n.slug };
      if (n.blurb != null) c.blurb = n.blurb;
      if (n.related && n.related.length) c.related = n.related.slice();
      if (n.children && n.children.length) c.children = cloneTopics(n.children);
      out.push(c);
    }
    return out;
  }

  function indexNodes(nodes, index) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.path != null) index[n.path] = n;
      if (n.children && n.children.length) indexNodes(n.children, index);
    }
  }

  // Find the declared node for a topic path, or synthesize nodes along the
  // whole path so an orphaned `topic:` is still visible (never silently lost).
  function findOrCreate(roots, index, topicPath, catSlug) {
    if (index[topicPath]) return index[topicPath];
    var segs = topicPath.split('/');
    var acc = '';
    var parentChildren = roots;
    var node = null;
    for (var i = 0; i < segs.length; i++) {
      acc = acc ? acc + '/' + segs[i] : segs[i];
      if (index[acc]) {
        node = index[acc];
      } else {
        node = {
          name: humanizeSeg(segs[i]),
          slug: segs[i],
          synthetic: true,
          path: acc,
          ref: catSlug ? catSlug + '/' + acc : acc,
          children: []
        };
        parentChildren.push(node);
        index[acc] = node;
      }
      node.children = node.children || [];
      parentChildren = node.children;
    }
    return node;
  }

  // Clone the declared tree, attach each post to its deepest node (creating
  // synthetic nodes for orphan paths), and return {roots, rootPosts}. Posts
  // with no `topic` land in rootPosts (the category root).
  function bucketPosts(posts, topics, catSlug) {
    var roots = cloneTopics(topics || []);
    annotatePaths(roots, catSlug);
    var index = {};
    indexNodes(roots, index);
    var rootPosts = [];
    var list = posts || [];
    for (var i = 0; i < list.length; i++) {
      var post = list[i];
      var tp = (post.topic || '').trim();
      if (!tp) { rootPosts.push(post); continue; }
      var node = findOrCreate(roots, index, tp, catSlug);
      (node.posts = node.posts || []).push(post);
    }
    return { roots: roots, rootPosts: rootPosts };
  }

  // Every post at `path` or nested beneath it. '' (or null) → all posts.
  // The trailing-'/' guard gives whole-subtree selection and stops a prefix
  // like "physi" from matching "physics".
  function postsUnder(posts, path) {
    var list = posts || [];
    if (path === '' || path == null) return list.slice();
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var t = (list[i].topic || '').trim();
      if (t === path || t.indexOf(path + '/') === 0) out.push(list[i]);
    }
    return out;
  }

  // Direct posts on a node plus every post nested beneath it — the count badge.
  function subtreeCount(node) {
    var n = node.posts ? node.posts.length : 0;
    var ch = node.children || [];
    for (var i = 0; i < ch.length; i++) n += subtreeCount(ch[i]);
    return n;
  }

  // ---- recursive DOM tree (browser only) ----------------------------------

  function openFolder(li, row, open) {
    if (open) { li.classList.add('open'); row.setAttribute('aria-expanded', 'true'); }
    else { li.classList.remove('open'); row.setAttribute('aria-expanded', 'false'); }
  }
  function toggleFolder(li, row) {
    var isOpen = li.classList.toggle('open');
    row.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }
  function selectRow(ctx, row, node) {
    if (ctx.selectedRow) {
      ctx.selectedRow.classList.remove('is-selected');
      ctx.selectedRow.removeAttribute('aria-selected');
    }
    row.classList.add('is-selected');
    row.setAttribute('aria-selected', 'true');
    ctx.selectedRow = row;
    if (ctx.onSelect) ctx.onSelect(node);
  }
  function openAncestors(ctx, path) {
    var r = ctx.rowByPath[''];
    if (r) openFolder(r.li, r.row, true);
    if (!path) return;
    var segs = path.split('/');
    var acc = '';
    for (var i = 0; i < segs.length - 1; i++) {
      acc = acc ? acc + '/' + segs[i] : segs[i];
      var e = ctx.rowByPath[acc];
      if (e) openFolder(e.li, e.row, true);
    }
  }
  function selectByPath(ctx, path, fireSelect) {
    var entry = ctx.rowByPath[path];
    if (!entry) return false;
    openAncestors(ctx, path);
    if (entry.li.querySelector('.tree-children')) openFolder(entry.li, entry.row, true);
    selectRow(ctx, entry.row, entry.node);
    return !!fireSelect || true;
  }

  function buildFolder(ul, node, level, ctx) {
    var li = document.createElement('li');
    li.className = 'tree-folder';

    var row = document.createElement('div');
    row.className = 'tree-row tree-row--folder';
    row.style.setProperty('--lvl', level);
    row.setAttribute('role', 'treeitem');
    row.tabIndex = 0;

    var twisty = document.createElement('span');
    twisty.className = 'tree-twisty';
    row.appendChild(twisty);

    var label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = node.label || node.name || '';
    row.appendChild(label);

    if (ctx.countOf) {
      var count = ctx.countOf(node);
      if (count != null) {
        var badge = document.createElement('span');
        badge.className = 'tree-count';
        badge.textContent = count;
        row.appendChild(badge);
      }
    }
    li.appendChild(row);

    var childUl = document.createElement('ul');
    childUl.className = 'tree-children';
    var childNodes = node.children || [];
    var posts = (ctx.mode === 'explorer') ? (node.posts || []) : [];
    var hasChildren = childNodes.length > 0;
    var hasLeaves = posts.length > 0;

    if (hasChildren) buildNodes(childUl, childNodes, level + 1, ctx);
    if (hasLeaves && ctx.leafRenderer) {
      for (var p = 0; p < posts.length; p++) {
        childUl.appendChild(ctx.leafRenderer(posts[p], level + 1));
      }
    }

    var expandable = hasChildren || hasLeaves;
    if (expandable) {
      li.appendChild(childUl);
      row.setAttribute('aria-expanded', 'false');
    } else {
      twisty.style.visibility = 'hidden';
    }

    if (node.path != null) {
      ctx.rowByPath[node.path] = { row: row, li: li, node: node };
    }

    twisty.addEventListener('click', function (e) {
      if (expandable) { e.stopPropagation(); toggleFolder(li, row); }
    });
    row.addEventListener('click', function () {
      if (ctx.mode === 'nav') {
        if (expandable) openFolder(li, row, true);
        selectRow(ctx, row, node);
      } else if (expandable) {
        toggleFolder(li, row);
      }
    });
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
    });

    ul.appendChild(li);
  }

  function buildNodes(ul, nodes, level, ctx) {
    for (var i = 0; i < nodes.length; i++) buildFolder(ul, nodes[i], level, ctx);
    return ul;
  }

  // Render a tree into `container`. opts:
  //   mode        'nav' (category pages) | 'explorer' (admin manage card)
  //   peek        true → add `tree--peek` so hover auto-expands (admin only)
  //   onSelect    fn(node) when a folder row is chosen (nav)
  //   selectedPath initial selection to highlight + reveal
  //   countOf     fn(node) → badge number (null to omit)
  //   leafRenderer fn(post, level) → <li> (explorer mode leaves)
  // Returns a ctx with `select(path)` for programmatic navigation.
  function renderTree(container, nodes, opts) {
    opts = opts || {};
    var ctx = {
      mode: opts.mode || 'nav',
      peek: !!opts.peek,
      onSelect: opts.onSelect,
      countOf: opts.countOf,
      leafRenderer: opts.leafRenderer,
      rowByPath: {},
      selectedRow: null
    };
    var ul = document.createElement('ul');
    ul.className = 'tree' + (ctx.peek ? ' tree--peek' : '');
    buildNodes(ul, nodes, 0, ctx);
    container.innerHTML = '';
    container.appendChild(ul);
    ctx.select = function (path) { return selectByPath(ctx, path, true); };
    if (opts.selectedPath != null) selectByPath(ctx, opts.selectedPath, true);
    container._treeCtx = ctx;
    return ctx;
  }

  // ---- YAML writer --------------------------------------------------------

  var CATS_HEADER = [
    '# The three top-level categories and their nested topics.',
    '# Add, rename, or nest topics in the /admin/ editor — pages update automatically.',
    '# NOTE: `slug` is used in post front matter and graph/URLs — changing it breaks links.'
  ].join('\n');

  var RESERVED = ['true', 'false', 'yes', 'no', 'on', 'off', 'null', '~'];

  function needsQuote(s) {
    if (s === '') return true;
    if (!/^[A-Za-z0-9][A-Za-z0-9 ._/&-]*$/.test(s)) return true;
    if (RESERVED.indexOf(s.toLowerCase()) !== -1) return true;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return true; // looks numeric
    return false;
  }
  function yamlScalar(s) {
    s = String(s == null ? '' : s);
    if (!needsQuote(s)) return s;
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  function sp(n) { return new Array(n + 1).join(' '); }

  function serializeNodes(nodes, dashIndent, lines) {
    var pad = sp(dashIndent);
    var keyPad = sp(dashIndent + 2);
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      lines.push(pad + '- name: ' + yamlScalar(n.name));
      lines.push(keyPad + 'slug: ' + yamlScalar(n.slug));
      if (n.blurb != null && String(n.blurb) !== '') {
        lines.push(keyPad + 'blurb: ' + yamlScalar(n.blurb));
      }
      if (n.related && n.related.length) {
        lines.push(keyPad + 'related:');
        for (var r = 0; r < n.related.length; r++) {
          lines.push(keyPad + '  - ' + yamlScalar(n.related[r]));
        }
      }
      if (n.children && n.children.length) {
        lines.push(keyPad + 'children:');
        serializeNodes(n.children, dashIndent + 4, lines);
      }
    }
  }

  // Deterministic 2-space block YAML for the whole categories list. Comments
  // live only in CATS_HEADER (prepended at write time); this emits data only.
  function serializeCategories(categories) {
    var lines = [];
    var cats = categories || [];
    for (var i = 0; i < cats.length; i++) {
      var cat = cats[i];
      lines.push('- name: ' + yamlScalar(cat.name));
      lines.push('  slug: ' + yamlScalar(cat.slug));
      if (cat.blurb != null && String(cat.blurb) !== '') {
        lines.push('  blurb: ' + yamlScalar(cat.blurb));
      }
      if (cat.topics && cat.topics.length) {
        lines.push('  topics:');
        serializeNodes(cat.topics, 4, lines);
      }
      if (i < cats.length - 1) lines.push('');
    }
    return lines.join('\n') + '\n';
  }

  return {
    slugify: slugify,
    humanizeSeg: humanizeSeg,
    annotatePaths: annotatePaths,
    walkFlat: walkFlat,
    bucketPosts: bucketPosts,
    postsUnder: postsUnder,
    subtreeCount: subtreeCount,
    renderTree: renderTree,
    serializeCategories: serializeCategories,
    needsQuote: needsQuote,
    CATS_HEADER: CATS_HEADER
  };
}));
