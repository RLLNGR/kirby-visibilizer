<?php

namespace Rllngr\KirbyVisibilizer;

use Kirby\Cms\App;
use Kirby\Cms\Page;
use Kirby\Cms\Site;

class LlmGenerator
{
    protected App    $kirby;
    protected array  $options;
    protected string $siteUrl;
    protected array  $fieldNames;

    public function __construct(App $kirby)
    {
        $this->kirby      = $kirby;
        $this->options    = $kirby->option('rllngr.kirby-visibilizer.llms', []);
        $this->fieldNames = $this->options['fields'] ?? [
            'description'  => 'llmsdescription',
            'instructions' => 'llmsinstructions',
        ];

        $this->siteUrl   = Url::site();
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    public function generate(bool $full = false): string
    {
        $cacheKey = $full ? 'llms-full' : 'llms';
        $useCache = $this->kirby->option('rllngr.kirby-visibilizer.cache', true);

        if ($useCache) {
            $cache = $this->kirby->cache('rllngr.kirby-visibilizer');
            if ($cached = $cache->get($cacheKey)) return $cached;
        }

        $content = $this->build($full);

        if ($useCache) {
            $duration = $this->kirby->option('rllngr.kirby-visibilizer.cacheDuration', 60);
            $cache->set($cacheKey, $content, $duration);
        }

        return $content;
    }

    public function generateSitemap(): string
    {
        $useCache = $this->kirby->option('rllngr.kirby-visibilizer.cache', true);

        if ($useCache) {
            $cache = $this->kirby->cache('rllngr.kirby-visibilizer');
            if ($cached = $cache->get('llms-sitemap')) return $cached;
        }

        $content = $this->buildSitemap();

        if ($useCache) {
            $duration = $this->kirby->option('rllngr.kirby-visibilizer.cacheDuration', 60);
            $cache->set('llms-sitemap', $content, $duration);
        }

        return $content;
    }

    public function toArray(bool $full = false): array
    {
        $site = $this->kirby->site();

        return [
            'title'        => $site->title()->value(),
            'url'          => $this->siteUrl,
            'description'  => $this->getSiteDescription(),
            'instructions' => $this->getSiteInstructions(),
            'sections'     => $this->buildSections($full),
        ];
    }

    public static function clearCache(App $kirby): void
    {
        $cache = $kirby->cache('rllngr.kirby-visibilizer');
        $cache->remove('llms');
        $cache->remove('llms-full');
        $cache->remove('llms-sitemap');
    }

    // -------------------------------------------------------------------------
    // Content building
    // -------------------------------------------------------------------------

    protected function build(bool $full = false): string
    {
        $lines = [];

        $lines[] = '# ' . $this->kirby->site()->title()->value();
        $lines[] = '';

        $description = $this->getSiteDescription();
        if ($description) {
            $lines[] = '> ' . $this->inline($description);
            $lines[] = '';
        }

        $instructions = $this->getSiteInstructions();
        if ($instructions) {
            $lines[] = $instructions;
            $lines[] = '';
        }

        foreach ($this->buildSections($full) as $section) {
            $lines[] = '## ' . $section['title'];
            $lines[] = '';

            foreach ($section['items'] as $item) {
                $line = '- [' . $item['title'] . '](' . $item['url'] . ')';
                if (!empty($item['description'])) {
                    $line .= ': ' . $this->inline($item['description']);
                }
                $lines[] = $line;
            }

            $lines[] = '';
        }

        return implode("\n", $lines);
    }

    protected function buildSitemap(): string
    {
        $lines   = [];
        $lines[] = '<?xml version="1.0" encoding="UTF-8"?>';
        $lines[] = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        foreach ($this->options['sections'] ?? [] as $config) {
            $query = $config['pages'] ?? null;
            if (!$query) continue;

            $result = $this->resolveQuery($query);
            if (!$result) continue;

            $isSingle = $config['single'] ?? false;
            $pages    = $isSingle
                ? (($result instanceof Page) ? [$result] : [])
                : iterator_to_array($result, false);

            $limit = $config['limit'] ?? null;

            foreach ($pages as $i => $page) {
                if ($limit && $i >= $limit) break;
                if ($this->isExcluded($page)) continue;

                $url      = $this->resolveUrl($page, $config);
                $modified = $page->modified('Y-m-d') ?: date('Y-m-d');

                $lines[] = '  <url>';
                $lines[] = '    <loc>' . htmlspecialchars($url, ENT_XML1) . '</loc>';
                $lines[] = '    <lastmod>' . $modified . '</lastmod>';
                $lines[] = '  </url>';
            }
        }

        $lines[] = '</urlset>';

        return implode("\n", $lines);
    }

    protected function buildSections(bool $full = false): array
    {
        $sections = [];

        foreach ($this->options['sections'] ?? [] as $config) {
            $items = $this->resolveSection($config, $full);
            if (!empty($items)) {
                $sections[] = [
                    'title' => $config['heading'] ?? 'Section',
                    'items' => $items,
                ];
            }
        }

        return $sections;
    }

    protected function resolveSection(array $config, bool $full): array
    {
        $query = $config['pages'] ?? null;
        if (!$query) return [];

        $result = $this->resolveQuery($query);
        if (!$result) return [];

        $isSingle = $config['single'] ?? false;

        if ($isSingle) {
            if (!($result instanceof Page)) return [];
            if ($this->isExcluded($result)) return [];
            return [$this->resolveItem($result, $config, $full)];
        }

        $items = [];
        $limit = $config['limit'] ?? null;
        $count = 0;

        foreach ($result as $page) {
            if ($limit && $count >= $limit) break;
            if ($this->isExcluded($page)) continue;
            $items[] = $this->resolveItem($page, $config, $full);
            $count++;
        }

        return array_filter($items);
    }

    protected function resolveItem(Page $page, array $config, bool $full): array
    {
        return [
            'title'       => $this->resolveField($page, $config['itemTitle'] ?? null)
                             ?: $page->title()->value(),
            'url'         => $this->resolveUrl($page, $config),
            'description' => $this->resolveDescription($page, $config, $full),
        ];
    }

    // -------------------------------------------------------------------------
    // Exclusion
    // -------------------------------------------------------------------------

    protected function isExcluded(Page $page): bool
    {
        $exclude = $this->options['exclude'] ?? [];
        $include = $this->options['include'] ?? [];

        if (in_array($page->slug(), $include['pages'] ?? [], true)) {
            return false;
        }

        if (in_array($page->intendedTemplate()->name(), $exclude['templates'] ?? ['error'], true)) {
            return true;
        }

        if (in_array($page->slug(), $exclude['pages'] ?? [], true)) {
            return true;
        }

        return false;
    }

    // -------------------------------------------------------------------------
    // Field helpers
    // -------------------------------------------------------------------------

    protected function resolveQuery(mixed $query): mixed
    {
        if (is_callable($query)) {
            return $query($this->kirby);
        }

        if (is_string($query) && class_exists('\Kirby\Query\Query')) {
            return \Kirby\Query\Query::factory($query)->resolve([
                'kirby' => $this->kirby,
                'site'  => $this->kirby->site(),
            ]);
        }

        return null;
    }

    protected function resolveField(Page $page, mixed $resolver): string
    {
        if (!$resolver) return '';
        if (is_callable($resolver)) return (string) $resolver($page);
        if (is_string($resolver)) return $page->content()->get($resolver)->value() ?? '';
        return '';
    }

    protected function resolveUrl(Page $page, array $config): string
    {
        if (isset($config['itemUrl']) && is_callable($config['itemUrl'])) {
            return (string) ($config['itemUrl'])($page);
        }

        return Url::page($page);
    }

    protected function resolveDescription(Page $page, array $config, bool $full): string
    {
        if ($full && isset($config['itemContent'])) {
            $content = $this->resolveField($page, $config['itemContent']);
            if ($content) return $this->clean($content);
        }

        if (isset($config['itemDescription'])) {
            return $this->clean($this->resolveField($page, $config['itemDescription']));
        }

        return '';
    }

    protected function getSiteDescription(): string
    {
        $field = $this->fieldNames['description'] ?? 'llmsdescription';
        $site  = $this->kirby->site();
        $value = $site->content()->get($field)->value();

        if (!$value) {
            $value = $site->description()->value();
        }

        return $this->clean($value ?? '');
    }

    protected function getSiteInstructions(): string
    {
        $field = $this->fieldNames['instructions'] ?? 'llmsinstructions';
        return $this->kirby->site()->content()->get($field)->value() ?? '';
    }

    // -------------------------------------------------------------------------
    // String utilities
    // -------------------------------------------------------------------------

    protected function inline(string $text): string
    {
        return trim(preg_replace('/\s+/', ' ', strip_tags($text)));
    }

    protected function clean(string $text): string
    {
        $text = preg_replace('/<br\s*\/?>/i', "\n", $text);
        $text = preg_replace('/<\/p>/i', "\n", $text);
        $text = strip_tags($text);
        return trim(preg_replace('/\n{3,}/', "\n\n", $text));
    }
}
