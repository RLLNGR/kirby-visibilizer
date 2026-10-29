<?php

namespace Rllngr\KirbyVisibilizer;

use Kirby\Cms\App;
use Kirby\Cms\Page;

class Sitemap
{
    protected App   $kirby;
    protected array $options;

    public function __construct(App $kirby)
    {
        $this->kirby   = $kirby;
        $this->options = $kirby->option('rllngr.kirby-visibilizer.sitemap', []);
    }

    public function generate(): string
    {
        $useCache = $this->kirby->option('rllngr.kirby-visibilizer.cache', true);

        if ($useCache) {
            $cache = $this->kirby->cache('rllngr.kirby-visibilizer');
            if ($cached = $cache->get('sitemap')) return $cached;
        }

        $content = $this->build();

        if ($useCache) {
            $duration = $this->kirby->option('rllngr.kirby-visibilizer.cacheDuration', 60);
            $cache->set('sitemap', $content, $duration);
        }

        return $content;
    }

    protected function build(): string
    {
        $multilang = $this->kirby->multilang();
        $lines     = [];

        $lines[] = '<?xml version="1.0" encoding="UTF-8"?>';

        if ($multilang) {
            $lines[] = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">';
        } else {
            $lines[] = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        }

        foreach ($this->kirby->site()->index(drafts: false) as $page) {
            if ($this->isExcluded($page)) continue;

            $modified = $page->modified('Y-m-d') ?: date('Y-m-d');
            $loc      = htmlspecialchars($page->url(), ENT_XML1);

            $lines[] = '  <url>';
            $lines[] = '    <loc>' . $loc . '</loc>';
            $lines[] = '    <lastmod>' . $modified . '</lastmod>';

            if ($multilang) {
                foreach ($this->kirby->languages() as $lang) {
                    $altUrl = htmlspecialchars($page->url($lang->code()), ENT_XML1);
                    $lines[] = '    <xhtml:link rel="alternate" hreflang="' . $lang->code() . '" href="' . $altUrl . '"/>';
                }
            }

            $lines[] = '  </url>';
        }

        $lines[] = '</urlset>';

        return implode("\n", $lines);
    }

    protected function isExcluded(Page $page): bool
    {
        $exclude = $this->options['exclude'] ?? ['templates' => ['error'], 'pages' => []];

        if (in_array($page->intendedTemplate()->name(), $exclude['templates'] ?? ['error'], true)) {
            return true;
        }

        if (in_array($page->slug(), $exclude['pages'] ?? [], true)) {
            return true;
        }

        // Exclude noindex pages from the sitemap
        $meta = new Meta($this->kirby, $page);
        if (str_contains($meta->robots(), 'noindex')) {
            return true;
        }

        return false;
    }

    public static function clearCache(App $kirby): void
    {
        $kirby->cache('rllngr.kirby-visibilizer')->remove('sitemap');
    }
}
