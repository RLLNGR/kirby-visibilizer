# kirby-visibilizer

All-in-one **SEO + GEO** plugin for [Kirby 5](https://getkirby.com). Free and open source.

Handles everything that makes a Kirby site visible — to search engines **and** to AI engines.

## Features

- **Meta tags** — title, description, Open Graph, Twitter/X card, Discord
- **Cascade** — site-level defaults, page-level overrides, automatic fallbacks
- **Sitemap** — `sitemap.xml` auto-generated from all listed pages, with hreflang for multilingual sites
- **Robots** — `robots.txt` generated dynamically, noindex pages excluded from sitemap automatically
- **GEO** — `llms.txt`, `llms-full.txt` and `llms-sitemap.xml` for AI search engines (Perplexity, ChatGPT, Claude…)
- **JSON-LD** — Schema.org structured data with automatic BreadcrumbList
- **Headless ready** — JSON endpoints for decoupled frontends
- **Migration friendly** — built-in fallback for sites migrating from kirby-seo

## Requirements

- Kirby 5
- PHP 8.1+

## Installation

```bash
composer require rllngr/kirby-visibilizer
```

## Usage

Add both snippets inside your `<head>` layout:

```php
<?php snippet('seo/head') ?>
<?php snippet('seo/jsonld') ?>
```

Add the panel sections to your blueprints:

```yaml
# site.yml
sections:
  seo_preview:
    extends: sections/seo-preview
  seo:
    extends: sections/seo
  geo:
    extends: sections/geo
```

```yaml
# templates/article.yml (or any page blueprint)
sections:
  seo_preview:
    extends: sections/seo-preview
  seo:
    extends: sections/seo
```

The `seo-preview` section shows a live preview panel with three tabs (Google SERP, OG/social card, Twitter/X card) and a checklist of SEO issues. It reads field values in real time — changes are reflected before saving.

That's it. `sitemap.xml`, `robots.txt`, `llms.txt` and `llms-full.txt` are served automatically.

---

## Panel view — SEO

The Panel gets an **SEO** entry in its menu (`/panel/seo`), styled like the [moniter](https://github.com/rllngr/kirby-moniter) Audience view (cream, ink bars, coloured cards; follows the Panel's light / dark theme).

- **Cards** — a score for titles, descriptions, alt texts and links, with optimal / acceptable / to-fix counts. Clicking a card opens the matching tab, filtered on what needs fixing.
- **Count default values** — on (default): titles and descriptions taken from elsewhere (page title, a template field, the site) are judged on what they produce in `<head>`. Off: anything not filled in the SEO tab is flagged. The choice is remembered in the browser and also applies to the live preview.
- **Pages** — every page whose blueprint has the SEO fields: meta title and description as rendered in `<head>` (with a `default` / `site` badge when inherited), share image, indexing. Click a row to see its issues (length, duplicates, inherited values, missing image).
- **Images** — alt text and weight of every image on those pages.
- **Links** — links found in the content (HTML, Markdown, KirbyText, link fields, `page://` / `file://` UUIDs) with the pages they come from. Internal links are resolved by Kirby directly (no HTTP request); external links are checked from the server in small batches and cached for a week. *Recheck all* forces a new check.

```php
'rllngr.kirby-visibilizer' => [
    'panel' => [
        'access'   => true,           // false to hide it, or a list of roles: ['admin', 'editor']
        'altField' => 'alt',          // file field holding the alt text (see "Image alt texts")
        'exclude'  => [
            'templates' => [],
            'pages'     => [],
        ],
    ],
],
```

Labels in French and English. The Panel code lives in `src/panel.js` (ordinary `template` strings); `index.js` is generated from it with precompiled render functions, so it also works with `'panel' => ['vue' => ['compiler' => false]]`:

```bash
npm install
npm run build   # scripts/build-panel.mjs → index.js, commit both
```

---

## Configuration

All options go in `config/config.php` under the `rllngr.kirby-visibilizer` key.

```php
return [
    'rllngr.kirby-visibilizer' => [
        'mode'           => 'classic',     // 'classic' or 'headless'
        'cache'          => true,
        'cacheDuration'  => 60,            // minutes
        'titleSeparator' => ' — ',

        'sitemap' => [
            'enabled' => true,
            'exclude' => [
                'templates' => ['error'],
                'pages'     => [],
            ],
        ],

        'robots' => [
            'enabled'  => true,
            'disallow' => ['/panel/', '/api/'],
            'sitemap'  => true,
        ],

        'llms' => [
            'enabled'  => true,
            'sitemap'  => true,
            'sections' => [],
        ],
    ],
];
```

### Panel fields

The plugin reads the following fields from your content files. All are optional — the cascade fills in sensible defaults when a field is empty.

| Field | Type | Used for |
|---|---|---|
| `seo_title` | text | `<title>`, og:title fallback |
| `seo_description` | textarea | `<meta name="description">`, og:description fallback |
| `seo_robots` | select | `<meta name="robots">` |
| `seo_canonical` | url | `<link rel="canonical">` |
| `og_image` | files (max: 1) | og:image, twitter:image fallback |
| `og_title` | text | og:title override |
| `og_description` | textarea | og:description override |
| `twitter_card` | select | twitter:card |
| `twitter_image` | files (max: 1) | twitter:image override |
| `llmsdescription` | textarea | `/llms.txt` site summary |
| `llmsinstructions` | textarea | `/llms.txt` AI instructions |

Site-level fields (in `site.yml`) follow the same names and serve as defaults for all pages.

### Field fallbacks

When `seo_title` / `seo_description` / `og_image` are empty, a page can borrow one of its own fields, per template (`'*'` = any template). Text values are turned into plain text and cut at `length` characters (60 for titles); image fields use their first image.

```php
'rllngr.kirby-visibilizer' => [
    'fallbacks' => [
        'description' => [
            'project' => 'introduction',
            '*'       => ['intro', 'text'], // first non-empty field wins
        ],
        'image'  => ['project' => 'cover'],
        'title'  => [],
        'length' => 160,
    ],
],
```

Cascade: SEO field → template field → page title (titles) / site description (descriptions) / site share image, then the page's first image (images).

The shared image is resized to `ogImageWidth` (default `1200`, `null` for the original file) and `og:image:width` / `og:image:height` are written; its `og:image:alt` uses the image's alt text (see below). The live preview and the SEO view show where each value comes from.

### Image alt texts

When an image's alt field is empty, an alt text can be built from a template using Kirby queries: the parent page (`page`), the file (`file`), the site (`site`). Empty values are dropped along with their separators.

```php
'rllngr.kirby-visibilizer' => [
    'alt' => [
        'template'  => '{{ page.title }} — {{ site.title }}',
        'templates' => [ // per parent page template, 'site' for site files
            'project' => '{{ page.title }}, {{ page.city }} ({{ page.country }}) — photo {{ file.credit }} · {{ site.title }}',
        ],
    ],
],
```

Use it in your templates with `$image->altText()`: the alt field if filled in, otherwise the generated text (a regular field: `->esc()`, `->or()`…).

```php
<img src="<?= $image->url() ?>" alt="<?= $image->altText()->esc() ?>">
```

In the SEO view, generated texts are shown with an `auto` badge, and *Fill empty texts* writes them into the empty alt fields (existing texts are never overwritten) so editors can refine them.

---

## GEO — llms.txt sections

By default, `llms.txt` only contains the site header (title, description, instructions). To populate it with page sections, configure them in `config.php`:

```php
'llms' => [
    'sections' => [
        [
            'heading'         => 'Projects',
            'pages'           => 'site.find("projects").children.listed',
            'itemDescription' => 'description', // field name
        ],
        [
            'heading'         => 'Journal',
            'pages'           => 'site.find("journal").children.listed',
            'limit'           => 20,
            'itemDescription' => 'summary',
        ],
    ],
],
```

Each section accepts:

| Key | Type | Description |
|---|---|---|
| `heading` | string | Section title (`## Heading`) |
| `pages` | string \| callable | Kirby Query or `fn($kirby) => $kirby->...` |
| `itemTitle` | string \| callable | Field name or closure for the item title |
| `itemDescription` | string \| callable | Field name or closure for the short description |
| `itemContent` | string \| callable | Field name for full content (used in `llms-full.txt` only) |
| `itemUrl` | callable | `fn($page) => $page->url()` — override the URL |
| `limit` | int | Maximum number of items |
| `single` | bool | Treat the result as a single page (not a collection) |

---

## Headless mode

Set `'mode' => 'headless'` to disable file routes and expose JSON endpoints instead:

| Endpoint | Returns |
|---|---|
| `/__seo__?page=about` | Meta array for the given page ID |
| `/__seo__` | Meta array for the site |
| `/__llms__` | llms.txt data as JSON |
| `/__llms-full__` | llms-full.txt data as JSON |

---

## JSON-LD customisation

Override or extend the default schema from any template:

```php
<?php snippet('seo/jsonld', [
    'schema' => [
        '@context' => 'https://schema.org',
        '@type'    => 'Article',
        'headline' => $page->title()->value(),
        'author'   => [
            '@type' => 'Person',
            'name'  => 'Nicolas Rollinger',
        ],
        'datePublished' => $page->date()->toDate('c'),
    ],
]) ?>
```

When `$schema` is passed, the default WebPage/BreadcrumbList schema is replaced entirely.

---

## Migration

### From kirby-llmsizer

No action required. The GEO panel fields (`llmsdescription`, `llmsinstructions`) and all config options under `llms` use identical names. Remove `rllngr/kirby-llmsizer` from your `composer.json` and add `rllngr/kirby-visibilizer`.

### From kirby-seo

Enable the compatibility fallback in `config.php`:

```php
'rllngr.kirby-visibilizer' => [
    'compat' => [
        'kirby-seo' => true,
    ],
],
```

This makes the meta cascade read the old kirby-seo field names (`metaTitle`, `metaDescription`, `ogImage`, `twitterImage`, `twitterCardType`, `robots`) as a fallback when the new fields are empty. Your existing content is read without any data migration.

When you're ready to clean up, copy the old field values to the new field names in your content files and disable the compat option.

---

## License

MIT — [Nicolas Rollinger](https://rollinger.design)
