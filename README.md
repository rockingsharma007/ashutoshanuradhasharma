# Ashutosh Anuradha Sharma — Personal Blog

A literary Jekyll blog — *"an atlas of a curious mind"* — hosted on GitHub
Pages, organised into three rooms: **Lab** (science), **Market** (commerce),
and **Studio** (arts), each holding a tree of nested topics. Set in Fraunces +
Newsreader across a porcelain (light) / observatory-ink (dark) palette. The home
page shows a live, Obsidian-style constellation of everything, generated from
your content.

Live at: https://rockingsharma007.github.io/ashutoshanuradhasharma/

## Publish it (one-time setup)

1. Push this repo to GitHub (`git push`).
2. On GitHub: **Settings → Pages → Build and deployment → Source = "Deploy from a branch"**, branch `main`, folder `/ (root)`.
3. Wait ~1 minute; your site goes live at the URL above.

No build tools needed — GitHub builds the Jekyll site for you on every push.

## Write posts from the site itself (owner-only)

Go to **`/admin/`** on your live site. It's an in-browser editor that commits
a new post straight to this repo through the GitHub API.

**How only you can post:** the page is public, but publishing requires a
GitHub **personal access token with write access to this repo** — which only
you hold. Anyone else who opens `/admin/` has no valid token and simply can't
publish. The token is stored only in your own browser (localStorage) and is
sent only to GitHub.

Set-up (once):
1. Create a **fine-grained** token at
   https://github.com/settings/tokens?type=beta
   — **Repository access:** only `ashutoshanuradhasharma`;
   **Permissions → Contents:** *Read and write*.
2. Open `/admin/`, paste the token, click **Connect**.
3. Fill in the form and hit **Publish**. Your post appears after the ~1-minute rebuild.

> Keep the token private. If it ever leaks, revoke it on the same GitHub page —
> that instantly disables publishing until you issue a new one.

## Write a post manually (alternative)

Create a file in [`_posts/`](_posts/) named `YYYY-MM-DD-your-title.md`:

```markdown
---
title: "Your Title"
date: 2026-09-22
category: lab            # lab | market | studio (drives the post URL)
topic: physics/optics    # optional slug path into _data/categories.yml;
                         # omit entirely to file at the category root
excerpt: One-line summary shown on cards.
read_time: "4 min read"  # optional
hero: /assets/img/your-image.jpg   # optional banner image
---

Your Markdown content here.
```

`topic` is a **category-relative slug path** — `physics`, `physics/optics`, or
`physics/optics/scattering` — pointing at a node in that category's topic tree.
It's metadata only: the post URL is still driven by `category`, so changing a
post's topic never breaks its link. A topic path with no matching node still
shows up (under an auto-generated label), so nothing is ever hidden.

## Change categories or topics

Edit [`_data/categories.yml`](_data/categories.yml) — each category has a `name`
(display label), a `slug` (used in URLs and post front matter), and a tree of
`topics`. A topic node is `{ name, slug, blurb?, related?, children? }`:
`children` nests to any depth, and `related` lists category-qualified refs
(e.g. `lab/physics/optics`) that render as "see also" cross-links on the topic's
page and dashed edges in the home graph. The `/admin/` editor writes this file
for you when you pick a topic path or set related topics while publishing — the
nav, home graph, category pages, and editor all update from that one file.

> **Heads-up:** changing a `slug` breaks the front-matter `topic:` paths and
> graph/URLs that reference it; rename the display `name` freely, but treat
> slugs as stable.

## Customise

- **Name / tagline / URL / repo:** [`_config.yml`](_config.yml)
- **Colors, fonts, layout:** [`assets/css/style.css`](assets/css/style.css) (theme variables at the top)
- **Home graph behaviour:** [`assets/js/graph.js`](assets/js/graph.js)
- **About page:** [`about.md`](about.md)

## Preview locally (optional)

```bash
bundle install
bundle exec jekyll serve
# open http://localhost:4000/ashutoshanuradhasharma/
```
