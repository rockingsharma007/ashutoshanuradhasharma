# Ashutosh Sharma — Personal Blog

An Apple-inspired Jekyll blog hosted on GitHub Pages, organised into three
categories — **Science**, **Commerce**, and **Arts** — each with subsections.

Live at: https://rockingsharma007.github.io/ashutoshanuradhasharma/

## Publish it (one-time setup)

1. Push this repo to GitHub (`git push`).
2. On GitHub: **Settings → Pages → Build and deployment → Source = "Deploy from a branch"**, branch `main`, folder `/ (root)`.
3. Wait ~1 minute; your site goes live at the URL above.

No build tools needed — GitHub builds the Jekyll site for you on every push.

## Write a new post

Create a file in [`_posts/`](_posts/) named `YYYY-MM-DD-your-title.md`:

```markdown
---
title: "Your Title"
date: 2026-09-22
category: science        # science | commerce | arts
subcategory: Physics     # must match a subsection in _data/categories.yml
excerpt: One-line summary shown on cards.
read_time: "4 min read"  # optional
hero: /assets/img/your-image.jpg   # optional banner image
---

Your Markdown content here.
```

The post automatically appears on the home page and under its category/subsection.

## Change categories or subsections

Edit [`_data/categories.yml`](_data/categories.yml). The nav, home page, and
category pages all update from that one file.

## Customise

- **Name / tagline / URL:** [`_config.yml`](_config.yml)
- **Colors, fonts, layout:** [`assets/css/style.css`](assets/css/style.css) (theme variables at the top)
- **About page:** [`about.md`](about.md)

## Preview locally (optional)

```bash
bundle install
bundle exec jekyll serve
# open http://localhost:4000/ashutoshanuradhasharma/
```
