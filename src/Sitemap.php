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

    /**
     * Entrées du sitemap (pages publiées, hors exclusions et noindex), avec les adresses publiques.
     * @return array<int, array{loc: string, lastmod: string, alternates: array}>
     */
    public function entries(): array
    {
        $entries = [];

        foreach ($this->kirby->site()->index(drafts: false) as $page) {
            if ($this->isExcluded($page)) continue;

            $alternates = [];
            if ($this->kirby->multilang()) {
                foreach ($this->kirby->languages() as $lang) {
                    $alternates[] = ['hreflang' => $lang->code(), 'href' => Url::page($page, $lang->code())];
                }
            }

            $entries[] = [
                'loc'        => Url::page($page),
                'lastmod'    => date('Y-m-d', $page->modified() ?: time()),
                'alternates' => $alternates,
            ];
        }

        return $entries;
    }

    protected function build(): string
    {
        $multilang = $this->kirby->multilang();
        $lines     = [];

        $lines[] = '<?xml version="1.0" encoding="UTF-8"?>';
        $lines[] = $multilang
            ? '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
            : '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        foreach ($this->entries() as $entry) {
            $lines[] = '  <url>';
            $lines[] = '    <loc>' . htmlspecialchars($entry['loc'], ENT_XML1) . '</loc>';
            $lines[] = '    <lastmod>' . $entry['lastmod'] . '</lastmod>';

            foreach ($entry['alternates'] as $alt) {
                $lines[] = '    <xhtml:link rel="alternate" hreflang="' . $alt['hreflang'] . '" href="' . htmlspecialchars($alt['href'], ENT_XML1) . '"/>';
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
