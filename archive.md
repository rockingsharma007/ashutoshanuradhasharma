---
layout: default
title: Archive
permalink: /archive/
---
<section class="wrap wrap-narrow archive">
  <p class="eyebrow">Archive</p>
  <h1 class="display">Everything, by date.</h1>
  <p class="lead">The full record — every entry, newest first.</p>

  {% if site.posts.size == 0 %}
    <p class="empty">Nothing filed yet. The first entries are on their way.</p>
  {% else %}
    {% assign posts_by_year = site.posts | group_by_exp: "post", "post.date | date: '%Y'" %}
    {% for year in posts_by_year %}
      <div class="archive-year">
        <h2>{{ year.name }}</h2>
        <span class="count">{{ year.items | size }} {% if year.items.size == 1 %}entry{% else %}entries{% endif %}</span>
      </div>
      <ol class="archive-list">
        {% for post in year.items %}
          {% assign pcat = site.data.categories | where: "slug", post.category | first %}
          <li class="archive-row">
            <a href="{{ post.url | relative_url }}">
              <span class="archive-date"><time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%b %-d" }}</time></span>
              <span class="archive-title">{{ post.title }}</span>
              <span class="archive-tag">{{ pcat.name | default: post.category }}{% if post.subcategory %} · {{ post.subcategory }}{% endif %}</span>
            </a>
          </li>
        {% endfor %}
      </ol>
    {% endfor %}
  {% endif %}
</section>
