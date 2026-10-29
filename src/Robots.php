<?php

namespace Rllngr\KirbyVisibilizer;

use Kirby\Cms\App;

class Robots
{
    protected App   $kirby;
    protected array $options;

    public function __construct(App $kirby)
    {
        $this->kirby   = $kirby;
        $this->options = $kirby->option('rllngr.kirby-visibilizer.robots', []);
    }

    public function generate(): string
    {
        $lines    = [];
        $disallow = $this->options['disallow'] ?? ['/panel/', '/api/'];
        $base     = rtrim($this->kirby->site()->url(), '/');

        $lines[] = 'User-agent: *';
        $lines[] = 'Allow: /';

        foreach ($disallow as $path) {
            $lines[] = 'Disallow: ' . $path;
        }

        if ($this->options['sitemap'] ?? true) {
            $lines[] = '';

            $sitemapEnabled = $this->kirby->option('rllngr.kirby-visibilizer.sitemap.enabled', true);
            if ($sitemapEnabled) {
                $lines[] = 'Sitemap: ' . $base . '/sitemap.xml';
            }

            $llmsEnabled = $this->kirby->option('rllngr.kirby-visibilizer.llms.enabled', true);
            $llmsSitemap = $this->kirby->option('rllngr.kirby-visibilizer.llms.sitemap', true);
            if ($llmsEnabled && $llmsSitemap) {
                $lines[] = 'Sitemap: ' . $base . '/llms-sitemap.xml';
            }
        }

        return implode("\n", $lines) . "\n";
    }
}
