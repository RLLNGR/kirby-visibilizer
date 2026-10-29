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

Add the panel sections to your page blueprints:

```yaml
# blueprints/pages/article.yml (or any page blueprint)
sections:
  seo_preview:
    extends: sections/seo-preview
  seo:
    extends: sections/seo
```

Site-wide defaults (home page title, default description and share image, llms.txt description and instructions) are edited in the **Settings** tab of the SEO view (`/panel/seo?tab=settings`) — nothing to add to `site.yml`. They are stored in the site content with the same field names, so templates, KQL and the cascade read them as usual. If you'd rather edit them on the Site page, the sections still work there:

```yaml
# site.yml (optional)
sections:
  seo:
    extends: sections/seo
  geo:
    extends: sections/geo
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
- **Site icon** — in the Settings tab, a square PNG (≥ 512 px, plus an optional SVG), a short name and two colours. The plugin generates `favicon.ico` (16/32/48), `favicon-96x96.png`, `favicon.svg`, `apple-touch-icon.png` (180, on the background colour), `web-app-manifest-192x192.png` / `-512x512.png`, a maskable 512 icon and `site.webmanifest`, serves them at the site root and writes the `<link>` / `theme-color` tags from `seo/head`. A static file of the same name at the root wins over the plugin's route: the Settings tab flags it. The icon also shows in the Google, social and X previews.
- **Site files** — the site's files with what uses each one (icon, share image, a page) or an *unused* badge, and an upload button.
- **Settings** — site-wide defaults, saved straight into the site content (no draft / publish step), in the Panel's current language; requires the permission to update the site. Below them, what is set in `config.php` (fallbacks, alt templates, separator…) is shown read-only.
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

For a decoupled front end (Nuxt, Next, Astro…), set the mode and the public address of the front end:

```php
'rllngr.kirby-visibilizer' => [
    'mode'          => 'headless',
    'siteUrl'       => 'https://example.com', // the front end, not Kirby
    'trailingSlash' => false,                  // match the front end's routes
],
```

`siteUrl` replaces Kirby's address in everything that is output: canonical, `og:url`, hreflang, JSON-LD, sitemap, robots.txt, llms.txt, and the page links of the Panel (preview, SEO view). A page can provide its own address with a `frontendUrl()` page method. Files (share images) keep Kirby's address, since Kirby serves them — proxy them on the front end if Kirby is not public.

The file routes (`sitemap.xml`, `robots.txt`, `llms*.txt`) are disabled and the data is exposed instead:

### KQL

`page.seo` and `site.seo` return the whole computed `<head>`, and `file.altText` the alt text with its template fallback. They are allowed in KQL out of the box (`@kql-allowed`), so the SEO data comes with the page in a single query:

```js
{
  query: 'page("projects/moncler")',
  select: {
    title: true,
    seo: true, // title, description, og_title, og_description, og_image, og_image_alt,
               // og_image_size {width, height}, og_type, twitter_card, twitter_image,
               // robots, canonical, hreflang [{hreflang, url}], schema (JSON-LD)
    cover: { query: 'page.cover.toFile', select: { url: true, altText: true } },
  },
}
```

### Endpoints

| Endpoint | Returns |
|---|---|
| `/__seo__?page=projects/moncler` | `{ result: seo }` for the page — `404` with `{ result: null }` if it does not exist or is a draft |
| `/__seo__` | `{ result: seo }` for the site |
| `/__seo-sitemap__` | `{ result: [{ loc, lastmod, alternates: [{ hreflang, href }] }] }` — published pages, exclusions and noindex removed |
| `/__icons__` | `{ result: { enabled, tags, manifest, files } }` — the icon's `<head>` tags, the web manifest and the URL of every generated file (also `site.icons` in KQL) |
| `/__icons__/favicon.ico` … | the generated files themselves — serve them at the front end's root (`/favicon.ico`, `/apple-touch-icon.png`, `/site.webmanifest`…) |
| `/__robots__` | `{ result: { text } }` — robots.txt to serve as is |
| `/__llms__` · `/__llms-full__` | llms.txt data as JSON |
| `/__llms-sitemap__` | `{ result: { xml } }` |

These endpoints are public (it is public data), whatever the KQL authentication.

### On the front end

- Fill the `<head>` from `seo` (e.g. Nuxt's `useSeoMeta` / `useHead`), with `schema` in a `<script type="application/ld+json">`.
- Serve `/sitemap.xml`, `/robots.txt`, `/llms.txt` (and `/llms-sitemap.xml`) from server routes built on the endpoints above.
- Use `altText` instead of `alt` in image queries.
- Write `site.icons.tags` in the `<head>` and proxy `/favicon.ico`, `/favicon.svg`, `/favicon-96x96.png`, `/apple-touch-icon.png`, `/web-app-*.png` and `/site.webmanifest` to `/__icons__/<name>`.
- In the Panel, everything works as in classic mode: SEO tabs, live preview, SEO view and its settings.

---|---|
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
