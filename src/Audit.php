<?php

namespace Rllngr\KirbyVisibilizer;

use Kirby\Cms\App;
use Kirby\Cms\File;
use Kirby\Cms\Page;
use Kirby\Cms\Pages;
use Kirby\Cms\Site;
use Kirby\Toolkit\Str;
use Kirby\Uuid\Uuid;

/**
 * Données de la vue SEO du Panel : pages, images et liens, avec un statut ok / warn / error
 * et la liste des problèmes de chacun (clés traduites côté Panel).
 */
class Audit
{
    // Longueurs, en caractères (titre complet, tel qu'il sort dans <title>)
    public const TITLE       = ['min' => 15, 'ideal' => 30, 'max' => 60, 'limit' => 70];
    public const DESCRIPTION = ['min' => 30, 'ideal' => 70, 'max' => 160, 'limit' => 200];
    public const HEAVY_IMAGE = 1024 * 1024;

    protected App $kirby;
    protected ?Pages $pages = null;

    public function __construct(App $kirby)
    {
        $this->kirby = $kirby;
    }

    /**
     * Pages auditées : celles dont le blueprint a les champs SEO du plugin
     * (exclut les pages techniques, ex. les dossiers de vignettes), sinon toutes sauf la page d'erreur.
     */
    public function pages(): Pages
    {
        if ($this->pages) return $this->pages;

        $all     = $this->kirby->site()->index()->filter(fn (Page $p) => !$p->isErrorPage());
        $exclude = $this->kirby->option('rllngr.kirby-visibilizer.panel.exclude', []);
        $all     = $all->filter(fn (Page $p) =>
            !in_array($p->intendedTemplate()->name(), $exclude['templates'] ?? [], true)
            && !in_array($p->id(), $exclude['pages'] ?? [], true)
        );

        $withFields = $all->filter(fn (Page $p) => $p->blueprint()->field('seo_title') !== null);

        return $this->pages = $withFields->count() ? $withFields : $all;
    }

    // -------------------------------------------------------------------------
    // Pages
    // -------------------------------------------------------------------------

    public function pageReport(): array
    {
        $rows = [];

        foreach ($this->pages() as $page) {
            $meta    = new Meta($this->kirby, $page);
            $sources = $meta->sources();
            $image   = $meta->ogImageFile();

            $rows[] = [
                'id'          => $page->id(),
                'title'       => $page->title()->value(),
                'path'        => '/' . $page->uri(),
                'url'         => $page->url(),
                'panel'       => $page->panel()->url(),
                'status'      => $page->status(),
                'metaTitle'   => ['value' => $meta->title(), 'source' => $sources['title'], 'field' => $sources['titleField']],
                'description' => ['value' => $meta->description(), 'source' => $sources['description'], 'field' => $sources['descriptionField']],
                'image'       => $image ? ['thumb' => $this->thumb($image), 'source' => $sources['image'], 'field' => $sources['imageField']] : null,
                'robots'      => $meta->robots(),
                'indexable'   => !str_contains($meta->robots(), 'noindex'),
            ];
        }

        // Doublons (même titre / même description personnalisée sur plusieurs pages)
        $titles = array_count_values(array_map(fn ($r) => Str::lower($r['metaTitle']['value']), $rows));
        $descs  = array_count_values(array_map(
            fn ($r) => $r['description']['source'] === 'custom' ? Str::lower($r['description']['value']) : '',
            $rows
        ));

        foreach ($rows as &$row) {
            $row['checks'] = [
                'title'       => $this->checkTitle($row, $titles),
                'description' => $this->checkDescription($row, $descs),
                'image'       => $this->checkImage($row),
            ];
            $row['level'] = $this->worst(array_column($row['checks'], 'level'));
        }

        return $rows;
    }

    /**
     * Chaque problème a son niveau ; `fallback` = il ne vient que d'une valeur de repli
     * (la vue peut alors l'ignorer pour juger le résultat tel qu'il sort dans le <head>).
     */
    protected function checkTitle(array $row, array $counts): array
    {
        $value  = $row['metaTitle']['value'];
        $source = $row['metaTitle']['source'];
        $length = Str::length($value);
        $issues = [];

        if (($counts[Str::lower($value)] ?? 0) > 1) {
            $issues[] = ['key' => 'title_duplicate', 'level' => 'error', 'data' => ['count' => $counts[Str::lower($value)] - 1]];
        }

        $data = ['length' => $length, 'min' => self::TITLE['ideal'], 'max' => self::TITLE['max']];

        if ($length > self::TITLE['limit']) {
            $issues[] = ['key' => 'title_long', 'level' => 'error', 'data' => $data];
        } elseif ($length < self::TITLE['min']) {
            $issues[] = ['key' => 'title_short', 'level' => 'error', 'data' => $data];
        } elseif ($length > self::TITLE['max']) {
            $issues[] = ['key' => 'title_longish', 'level' => 'warn', 'data' => $data];
        } elseif ($length < self::TITLE['ideal']) {
            $issues[] = ['key' => 'title_shortish', 'level' => 'warn', 'data' => $data];
        }

        if ($source !== 'custom') {
            $issues[] = ['key' => 'title_' . $source, 'level' => 'warn', 'fallback' => true, 'data' => ['field' => $row['metaTitle']['field']]];
        }

        return $this->check($issues, $length);
    }

    protected function checkDescription(array $row, array $counts): array
    {
        $value  = $row['description']['value'];
        $source = $row['description']['source'];
        $length = Str::length($value);

        if ($source === 'none') {
            return $this->check([['key' => 'desc_missing', 'level' => 'error']], 0);
        }

        $issues = [];

        if ($source !== 'custom') {
            $issues[] = ['key' => 'desc_' . $source, 'level' => 'warn', 'fallback' => true, 'data' => ['field' => $row['description']['field']]];
        } elseif (($counts[Str::lower($value)] ?? 0) > 1) {
            $issues[] = ['key' => 'desc_duplicate', 'level' => 'error', 'data' => ['count' => $counts[Str::lower($value)] - 1]];
        }

        $data = ['length' => $length, 'min' => self::DESCRIPTION['ideal'], 'max' => self::DESCRIPTION['max']];

        if ($length > self::DESCRIPTION['limit']) {
            $issues[] = ['key' => 'desc_long', 'level' => 'error', 'data' => $data];
        } elseif ($length < self::DESCRIPTION['min']) {
            $issues[] = ['key' => 'desc_short', 'level' => 'error', 'data' => $data];
        } elseif ($length > self::DESCRIPTION['max']) {
            $issues[] = ['key' => 'desc_longish', 'level' => 'warn', 'data' => $data];
        } elseif ($length < self::DESCRIPTION['ideal']) {
            $issues[] = ['key' => 'desc_shortish', 'level' => 'warn', 'data' => $data];
        }

        return $this->check($issues, $length);
    }

    protected function checkImage(array $row): array
    {
        if (!$row['image']) {
            return $this->check([['key' => 'image_missing', 'level' => 'warn']], 0);
        }

        $source = $row['image']['source'];
        $issues = $source === 'custom' ? [] : [['key' => 'image_' . $source, 'level' => 'warn', 'fallback' => true, 'data' => ['field' => $row['image']['field']]]];

        return $this->check($issues, 0);
    }

    protected function check(array $issues, int $length): array
    {
        return ['level' => $this->worst(array_column($issues, 'level')), 'issues' => $issues, 'length' => $length];
    }

    // -------------------------------------------------------------------------
    // Images
    // -------------------------------------------------------------------------

    /** Images du site et des pages auditées */
    public function images()
    {
        $files = $this->kirby->site()->images();
        foreach ($this->pages() as $page) {
            $files = $files->add($page->images());
        }
        return $files;
    }

    public function imageReport(): array
    {
        $rows = [];

        foreach ($this->images() as $file) {
            $alt       = Alt::value($file);
            $generated = $alt === '' ? Alt::generate($file) : '';
            $issues    = [];
            $level     = 'ok';

            if ($alt === '' && $generated !== '') {
                $issues[] = ['key' => 'alt_generated', 'level' => 'warn', 'fallback' => true];
                $level    = 'warn';
            } elseif ($alt === '') {
                $issues[] = ['key' => 'alt_missing', 'level' => 'error'];
                $level    = 'error';
            }

            if ($file->size() > self::HEAVY_IMAGE) {
                $issues[] = ['key' => 'image_heavy', 'level' => 'warn', 'data' => ['size' => $file->niceSize()]];
                $level    = $this->worst([$level, 'warn']);
            }

            $parent = $file->parent();

            $rows[] = [
                'id'       => $file->id(),
                'filename' => $file->filename(),
                'thumb'    => $this->thumb($file),
                'url'      => $file->url(),
                'panel'    => $file->panel()->url(),
                'parent'   => [
                    'title' => $parent->title()->value(),
                    'panel' => $parent->panel()->url(),
                ],
                'alt'      => $alt,
                'generated' => $generated,
                'size'     => $file->size(),
                'niceSize' => $file->niceSize(),
                'width'    => $file->width(),
                'height'   => $file->height(),
                'level'    => $level,
                'issues'   => $issues,
                'altOk'    => $alt !== '',
            ];
        }

        return $rows;
    }

    // -------------------------------------------------------------------------
    // Liens
    // -------------------------------------------------------------------------

    /**
     * Liens trouvés dans le contenu (html, markdown, kirbytext, champs lien), dédoublonnés,
     * avec les pages qui les contiennent. Les liens internes sont résolus ici, sans requête HTTP ;
     * les externes reprennent le dernier résultat en cache (null = pas encore vérifié).
     */
    public function linkReport(): array
    {
        $links   = [];
        $models  = $this->pages()->values();
        array_unshift($models, $this->kirby->site());

        foreach ($models as $model) {
            foreach ($model->content()->toArray() as $value) {
                if (!is_string($value) || $value === '') continue;

                foreach ($this->extractLinks($value) as $href) {
                    $links[$href] ??= ['href' => $href, 'from' => []];
                    $links[$href]['from'][$model instanceof Site ? 'site' : $model->id()] = [
                        'title' => $model->title()->value(),
                        'panel' => $model->panel()->url(),
                    ];
                }
            }
        }

        $checker = new LinkChecker($this->kirby);
        $rows    = [];

        foreach ($links as $link) {
            $result = $this->resolveInternal($link['href']) ?? $checker->cached($link['href']);

            $rows[] = [
                'href'     => $link['href'],
                'label'    => $result['label'] ?? $link['href'],
                'internal' => $result['internal'] ?? false,
                'result'   => $result,
                'from'     => array_values($link['from']),
            ];
        }

        usort($rows, fn ($a, $b) => strcmp($a['label'], $b['label']));

        return $rows;
    }

    public function extractLinks(string $value): array
    {
        $found = [];

        // href="…" (y compris échappé dans le JSON des blocs : href=\"…\")
        preg_match_all('#href=\\\\?["\']([^"\'\\\\]+)#i', $value, $m);
        array_push($found, ...$m[1]);

        // [texte](url) markdown
        preg_match_all('#\]\(([^)\s]+)\)#', $value, $m);
        array_push($found, ...$m[1]);

        // (link: url …) kirbytext
        preg_match_all('#\(link:\s*([^\s)]+)#i', $value, $m);
        array_push($found, ...$m[1]);

        // URL nue (texte, champs url, structures)
        preg_match_all('#https?://[^\s"\'<>()\[\]\\\\]+#i', $value, $m);
        array_push($found, ...$m[0]);

        // Champ lien qui ne contient qu'un page:// ou file://
        if (preg_match('#^(page|file)://[\w-]+$#', trim($value))) {
            $found[] = trim($value);
        }

        $found = array_map(fn ($href) => rtrim(html_entity_decode($href), '.,;:'), $found);

        return array_values(array_unique(array_filter($found, function ($href) {
            if ($href === '' || $href[0] === '#') return false;
            return !preg_match('#^(mailto|tel|javascript|data|sms):#i', $href);
        })));
    }

    /**
     * Statut d'un lien interne, ou null s'il est externe.
     */
    public function resolveInternal(string $href): ?array
    {
        // page://… / file://…
        if (preg_match('#^(page|file)://#', $href)) {
            $model = Uuid::for($href)?->model();

            if (!$model) {
                return ['internal' => true, 'label' => $href, 'level' => 'error', 'code' => 404, 'key' => 'link_uuid'];
            }

            $label = $model instanceof File ? $model->url() : '/' . $model->uri();
            return $this->pageStatus($model, $label);
        }

        $site = parse_url($this->kirby->site()->url());
        $url  = parse_url($href);

        if ($url === false) {
            return ['internal' => true, 'label' => $href, 'level' => 'error', 'code' => 0, 'key' => 'link_invalid'];
        }

        $isAbsolute = isset($url['host']);
        $isSameHost = $isAbsolute && strcasecmp($url['host'], $site['host'] ?? '') === 0
            && ($url['port'] ?? null) === ($site['port'] ?? null);

        if ($isAbsolute && !$isSameHost) return null;
        if (isset($url['scheme']) && !$isAbsolute) return null; // autre protocole

        // Chemin relatif à la racine du site (sous-dossier éventuel)
        $base = rtrim($site['path'] ?? '', '/');
        $path = $url['path'] ?? '/';
        if ($base && str_starts_with($path, $base)) $path = substr($path, strlen($base));
        $path  = trim($path, '/');
        $label = '/' . $path;

        if ($path === '') {
            return ['internal' => true, 'label' => '/', 'level' => 'ok', 'code' => 200];
        }

        if ($page = $this->kirby->page($path) ?? $this->kirby->site()->find($path)) {
            return $this->pageStatus($page, $label);
        }

        // Fichiers statiques (assets, media) et routes du plugin
        if (is_file($this->kirby->root('index') . '/' . $path) || in_array($path, ['sitemap.xml', 'robots.txt', 'llms.txt', 'llms-full.txt', 'llms-sitemap.xml'], true)) {
            return ['internal' => true, 'label' => $label, 'level' => 'ok', 'code' => 200];
        }

        if (str_starts_with($path, 'media/')) {
            return ['internal' => true, 'label' => $label, 'level' => 'warn', 'code' => null, 'key' => 'link_media'];
        }

        return ['internal' => true, 'label' => $label, 'level' => 'error', 'code' => 404, 'key' => 'link_notfound'];
    }

    protected function pageStatus(Page|File $model, string $label): array
    {
        if ($model instanceof Page && $model->isDraft()) {
            return ['internal' => true, 'label' => $label, 'level' => 'error', 'code' => 404, 'key' => 'link_draft'];
        }

        return ['internal' => true, 'label' => $label, 'level' => 'ok', 'code' => 200];
    }

    // -------------------------------------------------------------------------

    protected function thumb(File $file): ?string
    {
        if (!$file->isResizable()) return $file->type() === 'image' ? $file->url() : null;
        return $file->thumb(['width' => 240, 'height' => 160, 'crop' => true])->url();
    }

    protected function worst(array $levels): string
    {
        return match (true) {
            in_array('error', $levels, true) => 'error',
            in_array('warn', $levels, true)  => 'warn',
            default                          => 'ok',
        };
    }
}
