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
        if ($this->model instanceof Page && $value = $this->field('seo_title', 'metaTemplate')) {
            return $value;
        }

        return $this->siteField('seo_title', 'metaTemplate') ?: $this->kirby->site()->title()->value();
    }

    /**
     * Page: seo_title → champ de repli du template → titre de la page (sans le nom du site).
     */
    protected function pageTitle(): string
    {
        return $this->field('seo_title', 'metaTemplate')
            ?: $this->fallback('title')['value']
            ?: $this->model->title()->value();
    }

    /**
     * Champ de repli configuré pour le template de la page (`fallbacks.title` / `fallbacks.description`),
     * ramené à du texte brut : ['field' => nom du champ ou null, 'value' => texte].
     */
    public function fallback(string $type): array
    {
        $length = $type === 'title' ? 60 : ($this->options['fallbacks']['length'] ?? 160);

        foreach ($this->fallbackFields($type) as $name) {
            $field = $this->model->content()->get($name);
            if ($field->isEmpty()) continue;

            $text = Str::excerpt(static::plainText($field->kirbytext()->value()), $length);
            if ($text !== '') return ['field' => $name, 'value' => $text];
        }

        return ['field' => null, 'value' => ''];
    }

    /** HTML → texte : une espace entre les blocs, entités décodées (&nbsp; compris) */
    public static function plainText(string $html): string
    {
        $html = preg_replace('#<br\s*/?>|</(p|li|h[1-6]|div|blockquote|figcaption|td)>#i', ' $0', $html);
        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return trim(preg_replace('/[\s\x{00A0}]+/u', ' ', $text));
    }

    /** Noms des champs de repli pour le template de la page, dans l'ordre */
    public function fallbackFields(string $type): array
    {
        if (!$this->model instanceof Page) return [];

        $map = $this->options['fallbacks'][$type] ?? [];
        return (array) ($map[$this->model->intendedTemplate()->name()] ?? $map['*'] ?? []);
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
        $override = $this->field('og_title', 'ogTemplate');
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

    public function ogImage(): string
    {
        $file = $this->resolveFileField('og_image', 'ogImage');
        if ($file) return $file->url();

        // Site-level fallback
        $siteFile = $this->resolveSiteFileField('og_image', 'ogImage');
        if ($siteFile) return $siteFile->url();

        // Auto: first image attached to the page
        if ($this->model instanceof Page) {
            $first = $this->model->images()->first();
            if ($first) return $first->url();
        }

        return '';
    }

    public function ogImageAlt(): string
    {
        $file = $this->resolveFileField('og_image', 'ogImage');
        if ($file && $file->alt()->isNotEmpty()) {
            return $file->alt()->value();
        }
        return $this->ogTitle();
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
        if ($file) return $file->url();

        return $this->ogImage();
    }

    // -------------------------------------------------------------------------
    // Robots / Canonical
    // -------------------------------------------------------------------------

    public function robots(): string
    {
        // Unlisted and draft pages are always noindex
        if ($this->model instanceof Page && $this->model->status() !== 'listed') {
            return 'noindex, nofollow';
        }

        return $this->field('seo_robots') ?: 'index, follow';
    }

    public function canonical(): string
    {
        if ($this->model instanceof Page) {
            $custom = $this->field('seo_canonical');
            if ($custom) return $custom;
            return $this->model->url();
        }

        return $this->kirby->site()->url();
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
                'url'      => $this->model->url($language->code()),
            ];
        }

        return $result;
    }

    // -------------------------------------------------------------------------
    // Sources (used by the panel audit)
    // -------------------------------------------------------------------------

    /**
     * Where each resolved value comes from:
     * title: custom|default · description: custom|site|none · image: custom|site|auto|none
     */
    public function sources(): array
    {
        $title = match (true) {
            $this->field('seo_title', 'metaTemplate') !== ''                           => 'custom',
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

        $image = match (true) {
            $this->resolveFileField('og_image', 'ogImage') !== null     => 'custom',
            $this->resolveSiteFileField('og_image', 'ogImage') !== null => 'site',
            (bool) $this->ogImage()                                     => 'auto',
            default                                                     => 'none',
        };

        return [
            'title'            => $title,
            'titleField'       => $title === 'field' ? $this->fallback('title')['field'] : null,
            'description'      => $this->model instanceof Site && $description === 'site' ? 'custom' : $description,
            'descriptionField' => $description === 'field' ? $this->fallback('description')['field'] : null,
            'image'            => $image,
        ];
    }

    public function ogImageFile(): ?File
    {
        return $this->resolveFileField('og_image', 'ogImage')
            ?? $this->resolveSiteFileField('og_image', 'ogImage')
            ?? ($this->model instanceof Page ? $this->model->images()->first() : null);
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
            'og_type'        => $this->ogType(),
            'twitter_card'   => $this->twitterCard(),
            'twitter_image'  => $this->twitterImage(),
            'robots'         => $this->robots(),
            'canonical'      => $this->canonical(),
            'hreflang'       => $this->hreflang(),
        ];
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
