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
