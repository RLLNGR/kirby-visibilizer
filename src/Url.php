<?php

namespace Rllngr\KirbyVisibilizer;

use Kirby\Cms\Page;

/**
 * Adresses publiques du site. En headless, le site visité n'est pas Kirby :
 * `siteUrl` remplace l'adresse de Kirby dans tout ce qui sort (canonical, og:url, hreflang, sitemap, robots, llms, liens du Panel).
 * Une page peut aussi fournir sa propre adresse avec une méthode `frontendUrl()`.
 * Les fichiers (images partagées) gardent l'adresse de Kirby, qui les sert.
 */
class Url
{
    /** Adresse publique du site, sans barre finale */
    public static function site(): string
    {
        $kirby = kirby();
        return rtrim($kirby->option('rllngr.kirby-visibilizer.siteUrl') ?? $kirby->site()->url(), '/');
    }

    /** Adresse publique d'une page (dans une langue donnée en multilingue) */
    public static function page(Page $page, string|null $language = null): string
    {
        if ($page->hasMethod('frontendUrl')) {
            return static::slash((string) $page->frontendUrl($language));
        }

        return static::public($page->url($language));
    }

    /** Remplace l'adresse de Kirby par l'adresse publique */
    public static function public(string $url): string
    {
        $kirbyBase = rtrim(kirby()->site()->url(), '/');
        $public    = static::site();

        if ($public !== $kirbyBase && str_starts_with($url, $kirbyBase)) {
            $url = $public . substr($url, strlen($kirbyBase));
        }

        return static::slash($url);
    }

    /** Hôtes considérés comme le site lui-même (Kirby et le front) */
    public static function hosts(): array
    {
        $hosts = [];
        foreach ([kirby()->site()->url(), static::site()] as $url) {
            $parts = parse_url($url);
            if (isset($parts['host'])) {
                $hosts[] = ['host' => strtolower($parts['host']), 'port' => $parts['port'] ?? null, 'path' => rtrim($parts['path'] ?? '', '/')];
            }
        }
        return $hosts;
    }

    protected static function slash(string $url): string
    {
        if (!kirby()->option('rllngr.kirby-visibilizer.trailingSlash', false)) return $url;

        // Pas de barre après un fichier (…/sitemap.xml) ni avant une query
        $path = parse_url($url, PHP_URL_PATH) ?? '';
        if (preg_match('#\.[a-z0-9]{2,5}$#i', $path) || str_contains($url, '?') || str_contains($url, '#')) return $url;

        return rtrim($url, '/') . '/';
    }
}
