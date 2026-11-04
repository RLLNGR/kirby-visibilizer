<?php

namespace Rllngr\KirbyVisibilizer;

use Kirby\Cms\App;
use Kirby\Cms\File;
use Kirby\Cms\Page;
use Kirby\Cms\Site;
use Kirby\Toolkit\Str;

class Meta
{
    protected App        $kirby;
    protected Page|Site  $model;
    protected array      $options;
    protected bool       $compat;

    public function __construct(App $kirby, Page|Site $model)
    {
        $this->kirby   = $kirby;
        $this->model   = $model;
        $this->options = $kirby->option('rllngr.kirby-visibilizer', []);
        $this->compat  = $this->options['compat']['kirby-seo'] ?? false;
    }

    // -------------------------------------------------------------------------
    // Title
    // -------------------------------------------------------------------------

    public function title(): string
    {
        $siteTitle = $this->kirby->site()->title()->value();
        $separator = $this->options['titleSeparator'] ?? ' — ';

        if ($this->isHome()) {
            return $this->homeTitle();
        }

        $pageTitle = $this->pageTitle();

        if ($pageTitle === $siteTitle) {
            return $siteTitle;
        }

        return $pageTitle . $separator . $siteTitle;
    }

    /**
     * Site and home page: page seo_title → site seo_title → site title,
     * without the separator suffix.
     */
    protected function homeTitle(): string
    {
        if ($this->model instanceof Page && $value = $this->field('seo_title', 'metaTitle')) {
            return $value;
        }

        return $this->siteField('seo_title', 'metaTemplate') ?: $this->kirby->site()->title()->value();
    }

    /**
     * Page: seo_title → champ de repli du template → titre de la page (sans le nom du site).
     */
    protected function pageTitle(): string
    {
        return $this->field('seo_title', 'metaTitle')
            ?: $this->fallback('title')['value']
            ?: $this->model->title()->value();
    }

    /** Nom affiché pour un repli donné par une fonction (pas de nom de champ) */
    public const FUNCTION_FALLBACK = 'auto';

    /**
     * Repli configuré pour le template de la page (`fallbacks.title` / `fallbacks.description`),
     * ramené à du texte brut : ['field' => nom du champ (FUNCTION_FALLBACK pour une fonction) ou null, 'value' => texte].
     */
    public function fallback(string $type): array
    {
        $length = $type === 'title' ? 60 : ($this->options['fallbacks']['length'] ?? 160);

        foreach ($this->fallbackResolvers($type) as $resolver) {
            if ($resolver instanceof \Closure) {
                $text = Str::excerpt(static::plainText(static::resolvedText($resolver($this->model))), $length);
                if ($text !== '') return ['field' => static::FUNCTION_FALLBACK, 'value' => $text];
                continue;
            }

            $field = $this->model->content()->get($resolver);
            if ($field->isEmpty()) continue;

            $text = Str::excerpt(static::plainText($field->kirbytext()->value()), $length);
            if ($text !== '') return ['field' => $resolver, 'value' => $text];
        }

        return ['field' => null, 'value' => ''];
    }

    /** Ce que renvoie une fonction de repli (texte, champ, null…) ramené à du HTML / texte */
    protected static function resolvedText(mixed $value): string
    {
        if ($value instanceof \Kirby\Content\Field) return (string) $value->kirbytext()->value();
        if (is_array($value)) return implode(' ', array_map(static::resolvedText(...), $value));
        return is_scalar($value) || $value instanceof \Stringable ? (string) $value : '';
    }

    /** Ce que renvoie une fonction de repli d'image (fichier, champ fichiers, null…) ramené à un fichier */
    protected static function resolvedFile(mixed $value): ?File
    {
        if ($value instanceof File) return $value;
        if ($value instanceof \Kirby\Content\Field) return $value->toFile();
        if ($value instanceof \Kirby\Cms\Files) return $value->first();
        return null;
    }

    /**
     * Replis pour l'aperçu en direct : le nom du champ (lu dans le formulaire),
     * ou, pour une fonction, sa valeur calculée sur le contenu enregistré (['value' => …] / ['url' => …]).
     */
    public function fallbackPreview(string $type): array
    {
        $entries = [];

        foreach ($this->fallbackResolvers($type) as $resolver) {
            if (!$resolver instanceof \Closure) {
                $entries[] = $resolver;
            } elseif ($type === 'image') {
                $file = $this->imageOf(static::resolvedFile($resolver($this->model)));
                if ($file) $entries[] = ['url' => $this->imageUrl($file)];
            } else {
                $length = $type === 'title' ? 60 : ($this->options['fallbacks']['length'] ?? 160);
                $text   = Str::excerpt(static::plainText(static::resolvedText($resolver($this->model))), $length);
                if ($text !== '') $entries[] = ['value' => $text];
            }
        }

        return $entries;
    }

    /** HTML → texte : une espace entre les blocs, entités décodées (&nbsp; compris) */
    public static function plainText(string $html): string
    {
        $html = preg_replace('#<br\s*/?>|</(p|li|h[1-6]|div|blockquote|figcaption|td)>#i', ' $0', $html);
        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return trim(preg_replace('/[\s\x{00A0}]+/u', ' ', $text));
    }

    /** Noms des champs de repli pour le template de la page, dans l'ordre (sans les fonctions) */
    public function fallbackFields(string $type): array
    {
        return array_values(array_filter($this->fallbackResolvers($type), 'is_string'));
    }

    /**
     * Replis pour le template de la page, dans l'ordre : noms de champ et fonctions `fn (Page $page) => …`
     * (texte ou champ pour title / description, fichier ou champ fichiers pour image).
     */
    public function fallbackResolvers(string $type): array
    {
        if (!$this->model instanceof Page) return [];

        $map   = $this->options['fallbacks'][$type] ?? [];
        $entry = $map[$this->model->intendedTemplate()->name()] ?? $map['*'] ?? [];

        // (array) sur une Closure donnerait [] : une fonction seule est mise dans une liste
        $list = $entry instanceof \Closure ? [$entry] : (array) $entry;
        return array_values(array_filter($list, fn ($r) => $r instanceof \Closure || (is_string($r) && $r !== '')));
    }

    protected function isHome(): bool
    {
        return $this->model instanceof Site || $this->model->isHomePage();
    }

    // -------------------------------------------------------------------------
    // Description
    // -------------------------------------------------------------------------

    public function description(): string
    {
        $value = $this->field('seo_description', 'metaDescription')
            ?: $this->fallback('description')['value'];

        if (!$value && $this->model instanceof Page) {
            $value = $this->siteField('seo_description', 'metaDescription');
        }

        if (!$value) {
            $value = $this->kirby->site()->description()->value() ?? '';
        }

        return $value;
    }

    // -------------------------------------------------------------------------
    // OpenGraph
    // -------------------------------------------------------------------------

    public function ogTitle(): string
    {
        // kirby-seo : ogTitle sur les pages, ogTemplate sur le site
        $override = $this->field('og_title', $this->model instanceof Site ? 'ogTemplate' : 'ogTitle');
        if ($override) return $override;

        if ($this->isHome()) {
            return $this->homeTitle();
        }

        return $this->pageTitle();
    }

    public function ogDescription(): string
    {
        $override = $this->field('og_description', 'ogDescription');
        if ($override) return $override;

        return $this->description();
    }

    /**
     * Image partagée et sa provenance :
     * og_image de la page → champ de repli du template (`fallbacks.image`) → og_image du site → première image de la page.
     * @return array{file: ?File, source: string, field: ?string}
     */
    public function ogImageSource(): array
    {
        if ($file = $this->resolveFileField('og_image', 'ogImage')) {
            return ['file' => $file, 'source' => 'custom', 'field' => null];
        }

        foreach ($this->fallbackResolvers('image') as $resolver) {
            $file = $resolver instanceof \Closure
                ? static::resolvedFile($resolver($this->model))
                : $this->model->content()->get($resolver)->toFile();

            if ($file = $this->imageOf($file)) {
                return ['file' => $file, 'source' => 'field', 'field' => $resolver instanceof \Closure ? static::FUNCTION_FALLBACK : $resolver];
            }
        }

        if ($file = $this->resolveSiteFileField('og_image', 'ogImage')) {
            return ['file' => $file, 'source' => $this->model instanceof Site ? 'custom' : 'site', 'field' => null];
        }

        // Champ image du site (`fallbacks.image.site`), ex. la couverture du site
        $siteFields = (array) ($this->options['fallbacks']['image']['site'] ?? []);
        foreach ($siteFields as $name) {
            if ($file = $this->imageOf($this->kirby->site()->content()->get($name)->toFile())) {
                return ['file' => $file, 'source' => $this->model instanceof Site ? 'field' : 'site', 'field' => $this->model instanceof Site ? $name : null];
            }
        }

        if ($this->model instanceof Page && $file = $this->model->images()->first()) {
            return ['file' => $file, 'source' => 'auto', 'field' => null];
        }

        return ['file' => null, 'source' => 'none', 'field' => null];
    }

    /**
     * Une image partageable : le fichier s'il est une image, sinon son poster
     * (`posterMethod`, ex. 'videozPanelImage' pour une vidéo de videozer).
     */
    protected function imageOf(?File $file): ?File
    {
        if (!$file) return null;
        if ($file->type() === 'image') return $file;

        $method = $this->options['posterMethod'] ?? null;
        if ($method && $file->hasMethod($method)) {
            $poster = $file->$method();
            if ($poster instanceof File && $poster->type() === 'image') return $poster;
        }

        return null;
    }

    public function ogImageFile(): ?File
    {
        return $this->ogImageSource()['file'];
    }

    public function ogImage(): string
    {
        return $this->imageUrl($this->ogImageFile());
    }

    public function ogImageAlt(): string
    {
        $file = $this->ogImageFile();
        return ($file ? Alt::text($file) : '') ?: $this->ogTitle();
    }

    /** Dimensions de l'image partagée (après redimensionnement), ou null */
    public function ogImageSize(): ?array
    {
        $file = $this->ogImageFile();
        if (!$file || !$file->isResizable()) return null;

        $image = $this->resized($file);
        return ['width' => $image->width(), 'height' => $image->height()];
    }

    /**
     * URL partagée : redimensionnée à `ogImageWidth` (1200 par défaut) pour ne pas envoyer
     * un original de plusieurs Mo aux réseaux sociaux. null = fichier original.
     */
    protected function imageUrl(?File $file): string
    {
        if (!$file) return '';
        return $file->isResizable() ? $this->resized($file)->url() : $file->url();
    }

    protected function resized(File $file)
    {
        $width = $this->options['ogImageWidth'] ?? 1200;
        return $width && $file->width() > $width ? $file->resize($width) : $file;
    }

    public function ogType(): string
    {
        return 'website';
    }

    // -------------------------------------------------------------------------
    // Twitter / X
    // -------------------------------------------------------------------------

    public function twitterCard(): string
    {
        return $this->field('twitter_card', 'twitterCardType') ?: 'summary_large_image';
    }

    public function twitterImage(): string
    {
        $file = $this->resolveFileField('twitter_image', 'twitterImage');
        if ($file) return $this->imageUrl($file);

        return $this->ogImage();
    }

    // -------------------------------------------------------------------------
    // Robots / Canonical
    // -------------------------------------------------------------------------

    public function robots(): string
    {
        // Brouillons : jamais indexés. Pages non listées : `robots.unlisted` (noindex par défaut),
        // sauf la page d'accueil, souvent non listée (dossier « home » sans numéro)
        if ($this->model instanceof Page && $this->model->isDraft()) {
            return 'noindex, nofollow';
        }

        if ($this->model instanceof Page && $this->model->isUnlisted() && !$this->model->isHomePage()) {
            $robots   = $this->options['robots'] ?? [];
            $unlisted = array_key_exists('unlisted', $robots) ? $robots['unlisted'] : 'noindex, nofollow';
            if ($unlisted) return $unlisted;
        }

        return $this->field('seo_robots') ?: 'index, follow';
    }

    public function canonical(): string
    {
        if ($this->model instanceof Page) {
            $custom = $this->field('seo_canonical');
            if ($custom) return $custom;
            return Url::page($this->model);
        }

        return Url::public($this->kirby->site()->url());
    }

    // -------------------------------------------------------------------------
    // Hreflang (multilingual)
    // -------------------------------------------------------------------------

    public function hreflang(): array
    {
        if (!$this->kirby->multilang() || !($this->model instanceof Page)) {
            return [];
        }

        $result = [];

        foreach ($this->kirby->languages() as $language) {
            $result[] = [
                'hreflang' => $language->code(),
                'url'      => Url::page($this->model, $language->code()),
            ];
        }

        return $result;
    }

    // -------------------------------------------------------------------------
    // Sources (used by the panel audit)
    // -------------------------------------------------------------------------

    /**
     * Where each resolved value comes from:
     * title: custom|field|default · description: custom|field|site|none · image: custom|field|site|auto|none
     */
    public function sources(): array
    {
        $title = match (true) {
            $this->field('seo_title', $this->model instanceof Site ? 'metaTemplate' : 'metaTitle') !== '' => 'custom',
            $this->isHome() && $this->siteField('seo_title', 'metaTemplate') !== ''    => 'custom',
            !$this->isHome() && $this->fallback('title')['field'] !== null             => 'field',
            default                                                                    => 'default',
        };

        $description = match (true) {
            (bool) $this->field('seo_description', 'metaDescription') => 'custom',
            $this->fallback('description')['field'] !== null         => 'field',
            (bool) $this->description()                              => 'site',
            default                                                  => 'none',
        };

        $image = $this->ogImageSource();

        return [
            'title'            => $title,
            'titleField'       => $title === 'field' ? $this->fallback('title')['field'] : null,
            'description'      => $this->model instanceof Site && $description === 'site' ? 'custom' : $description,
            'descriptionField' => $description === 'field' ? $this->fallback('description')['field'] : null,
            'image'            => $image['source'],
            'imageField'       => $image['field'],
        ];
    }

    // -------------------------------------------------------------------------
    // Headless array
    // -------------------------------------------------------------------------

    public function toArray(): array
    {
        return [
            'title'          => $this->title(),
            'description'    => $this->description(),
            'og_title'       => $this->ogTitle(),
            'og_description' => $this->ogDescription(),
            'og_image'       => $this->ogImage(),
            'og_image_alt'   => $this->ogImageAlt(),
            'og_image_size'  => $this->ogImageSize(),
            'og_type'        => $this->ogType(),
            'twitter_card'   => $this->twitterCard(),
            'twitter_image'  => $this->twitterImage(),
            'robots'         => $this->robots(),
            'canonical'      => $this->canonical(),
            'hreflang'       => $this->hreflang(),
            'schema'         => $this->schema(),
            // D'où vient chaque valeur : custom | field | default / site / auto | none
            'sources'        => array_intersect_key($this->sources(), array_flip(['title', 'description', 'image'])),
        ];
    }

    /**
     * Données structurées Schema.org : WebPage (ou WebSite) + fil d'Ariane pour les pages intérieures.
     */
    public function schema(): array
    {
        $schema = [
            '@context' => 'https://schema.org',
            '@type'    => $this->model instanceof Page ? 'WebPage' : 'WebSite',
            'name'     => $this->ogTitle(),
            'url'      => $this->canonical(),
        ];

        if ($desc = $this->description()) {
            $schema['description'] = $desc;
        }

        if ($img = $this->ogImage()) {
            $schema['image'] = $img;
        }

        if ($this->model instanceof Page) {
            $crumbs = [];
            $pos    = 1;

            foreach ($this->model->parents()->flip()->add($this->model) as $crumb) {
                $crumbs[] = [
                    '@type'    => 'ListItem',
                    'position' => $pos++,
                    'name'     => $crumb->title()->value(),
                    'item'     => Url::page($crumb),
                ];
            }

            if (count($crumbs) > 1) {
                $schema['breadcrumb'] = [
                    '@type'           => 'BreadcrumbList',
                    'itemListElement' => $crumbs,
                ];
            }
        }

        return $schema;
    }

    // -------------------------------------------------------------------------
    // Field resolution helpers
    // -------------------------------------------------------------------------

    /**
     * Read a field from the current model.
     * $compat is only checked when the kirby-seo compat option is enabled.
     */
    protected function field(string $primary, ?string $compat = null): string
    {
        $value = $this->model->content()->get($primary)->value();
        if ($value) return $value;

        if ($compat && $this->compat) {
            $value = $this->model->content()->get($compat)->value();
            if ($value) return $value;
        }

        return '';
    }

    protected function siteField(string $name, ?string $compat = null): string
    {
        $value = $this->kirby->site()->content()->get($name)->value();
        if ($value) return $value;

        if ($compat && $this->compat) {
            $value = $this->kirby->site()->content()->get($compat)->value();
            if ($value) return $value;
        }

        return '';
    }

    /**
     * Resolve a files field (type: files, max: 1) to its File object.
     */
    protected function resolveFileField(string $primary, ?string $compat = null): ?File
    {
        $field = $this->model->content()->get($primary);

        if ($field->isEmpty() && $compat && $this->compat) {
            $field = $this->model->content()->get($compat);
        }

        if ($field->isEmpty()) return null;

        return $field->toFile();
    }

    protected function resolveSiteFileField(string $name, ?string $compat = null): ?File
    {
        $field = $this->kirby->site()->content()->get($name);

        if ($field->isEmpty() && $compat && $this->compat) {
            $field = $this->kirby->site()->content()->get($compat);
        }

        if ($field->isEmpty()) return null;

        return $field->toFile();
    }
}
