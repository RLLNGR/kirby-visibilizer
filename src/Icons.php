<?php

namespace Rllngr\KirbyVisibilizer;

use Kirby\Cms\App;
use Kirby\Cms\File;
use Kirby\Filesystem\Dir;
use Kirby\Filesystem\F;

/**
 * Icône du site : à partir d'un PNG (et d'un SVG facultatif) choisis dans les réglages,
 * génère tout ce que demandent navigateurs, moteurs de recherche et écrans d'accueil,
 * aux noms d'usage, servis à la racine du site (ou par le front en headless).
 */
class Icons
{
    /** nom => [taille, sorte] — sorte : png (transparent), solid (sur fond plein), maskable (marge de sécurité) */
    public const FILES = [
        'favicon-96x96.png'            => [96, 'png'],
        'apple-touch-icon.png'         => [180, 'solid'],
        'web-app-manifest-192x192.png' => [192, 'png'],
        'web-app-manifest-512x512.png' => [512, 'png'],
        'web-app-maskable-512x512.png' => [512, 'maskable'],
    ];
    public const ICO_SIZES = [16, 32, 48];
    public const MIN_SIZE  = 512;

    protected App $kirby;

    public function __construct(App $kirby)
    {
        $this->kirby = $kirby;
    }

    // -------------------------------------------------------------------------
    // Réglages
    // -------------------------------------------------------------------------

    /** Fichiers choisis : le premier PNG (ou JPG/WebP) pour les images, le premier SVG pour les navigateurs qui le prennent */
    public function sources(): array
    {
        $files  = $this->kirby->site()->content()->get('favicon')->toFiles();
        $raster = $files->filter(fn (File $f) => in_array($f->extension(), ['png', 'jpg', 'jpeg', 'webp'], true))->first();
        $svg    = $files->filter(fn (File $f) => $f->extension() === 'svg')->first();

        return ['raster' => $raster, 'svg' => $svg];
    }

    public function themeColor(): string
    {
        return $this->color('theme_color', '#ffffff');
    }

    public function backgroundColor(): string
    {
        return $this->color('background_color', $this->themeColor());
    }

    public function name(): string
    {
        return $this->kirby->site()->title()->value();
    }

    public function shortName(): string
    {
        return $this->kirby->site()->content()->get('app_name')->value() ?: $this->name();
    }

    public function enabled(): bool
    {
        return $this->kirby->option('rllngr.kirby-visibilizer.icons.enabled', true)
            && $this->sources()['raster'] !== null;
    }

    // -------------------------------------------------------------------------
    // Génération
    // -------------------------------------------------------------------------

    /** Empreinte de la source et des réglages : change dès que l'un d'eux change (adresses à jour, caches vidés) */
    public function hash(): string
    {
        ['raster' => $raster, 'svg' => $svg] = $this->sources();

        return substr(md5(implode('|', [
            $raster?->id(), $raster?->modified(),
            $svg?->id(), $svg?->modified(),
            $this->backgroundColor(),
        ])), 0, 10);
    }

    public function dir(): string
    {
        return $this->kirby->root('media') . '/visibilizer/icons/' . $this->hash();
    }

    public function url(string $name): string
    {
        return $this->kirby->url('media') . '/visibilizer/icons/' . $this->hash() . '/' . $name;
    }

    /** Génère les fichiers s'ils manquent ; renvoie le dossier, ou null sans source */
    public function generate(): ?string
    {
        ['raster' => $raster, 'svg' => $svg] = $this->sources();
        if (!$raster) return null;

        $dir = $this->dir();
        if (is_file($dir . '/favicon.ico')) return $dir;

        // Les versions précédentes ne servent plus à rien
        Dir::remove(dirname($dir));
        Dir::make($dir);

        $source = $this->load($raster->root());
        $bg     = $this->rgb($this->backgroundColor());

        foreach (self::FILES as $name => [$size, $kind]) {
            $image = match ($kind) {
                'solid'    => $this->render($source, $size, 0.85, $bg),
                'maskable' => $this->render($source, $size, 0.8, $bg),
                default    => $this->render($source, $size),
            };
            imagepng($image, $dir . '/' . $name, 9);
        }

        $pngs = [];
        foreach (self::ICO_SIZES as $size) {
            ob_start();
            imagepng($this->render($source, $size), null, 9);
            $pngs[$size] = ob_get_clean();
        }
        F::write($dir . '/favicon.ico', $this->ico($pngs));

        if ($svg) {
            F::copy($svg->root(), $dir . '/favicon.svg');
        }

        F::write($dir . '/site.webmanifest', json_encode($this->manifest(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

        return $dir;
    }

    /** Contenu d'un fichier généré (servi par les routes), ou null */
    public function file(string $name): ?string
    {
        if (!$this->isName($name) || !($dir = $this->generate())) return null;
        $path = $dir . '/' . $name;
        return is_file($path) ? $path : null;
    }

    public function isName(string $name): bool
    {
        return isset(self::FILES[$name]) || in_array($name, ['favicon.ico', 'favicon.svg', 'site.webmanifest'], true);
    }

    // -------------------------------------------------------------------------
    // Sortie
    // -------------------------------------------------------------------------

    /** Adresse publique d'un fichier : à la racine du site (routes du plugin, ou du front en headless) */
    public function publicPath(string $name): string
    {
        return '/' . $name;
    }

    public function manifest(): array
    {
        return [
            'name'             => $this->name(),
            'short_name'       => $this->shortName(),
            'start_url'        => '/',
            'display'          => 'standalone',
            'theme_color'      => $this->themeColor(),
            'background_color' => $this->backgroundColor(),
            'icons'            => [
                ['src' => $this->publicPath('web-app-manifest-192x192.png'), 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
                ['src' => $this->publicPath('web-app-manifest-512x512.png'), 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
                ['src' => $this->publicPath('web-app-maskable-512x512.png'), 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
            ],
        ];
    }

    /** Balises du <head> : [['tag' => 'link'|'meta', attributs…], …] */
    public function tags(): array
    {
        if (!$this->enabled()) return [];

        $tags = [
            ['tag' => 'link', 'rel' => 'icon', 'type' => 'image/png', 'sizes' => '96x96', 'href' => $this->publicPath('favicon-96x96.png')],
        ];

        if ($this->sources()['svg']) {
            $tags[] = ['tag' => 'link', 'rel' => 'icon', 'type' => 'image/svg+xml', 'href' => $this->publicPath('favicon.svg')];
        }

        $tags[] = ['tag' => 'link', 'rel' => 'shortcut icon', 'href' => $this->publicPath('favicon.ico')];
        $tags[] = ['tag' => 'link', 'rel' => 'apple-touch-icon', 'sizes' => '180x180', 'href' => $this->publicPath('apple-touch-icon.png')];
        $tags[] = ['tag' => 'meta', 'name' => 'apple-mobile-web-app-title', 'content' => $this->shortName()];

        if ($this->kirby->option('rllngr.kirby-visibilizer.icons.manifest', true)) {
            $tags[] = ['tag' => 'link', 'rel' => 'manifest', 'href' => $this->publicPath('site.webmanifest')];
        }

        $tags[] = ['tag' => 'meta', 'name' => 'theme-color', 'content' => $this->themeColor()];

        return $tags;
    }

    /** Petite icône pour les aperçus du Panel (SVG s'il y en a un, sinon le PNG 96 px), ou null */
    public function previewUrl(): ?string
    {
        if (!$this->enabled() || !$this->generate()) return null;
        return $this->url($this->sources()['svg'] ? 'favicon.svg' : 'favicon-96x96.png');
    }

    /** Tout, pour un front headless (KQL `site.icons`, endpoint `__icons__`) */
    public function toArray(): array
    {
        if (!$this->enabled()) return ['enabled' => false];

        $this->generate();
        $files = [];
        foreach (array_merge(['favicon.ico'], array_keys(self::FILES), $this->sources()['svg'] ? ['favicon.svg'] : [], ['site.webmanifest']) as $name) {
            $files[$name] = $this->url($name);
        }

        return [
            'enabled'  => true,
            'tags'     => $this->tags(),
            'manifest' => $this->manifest(),
            'files'    => $files,
        ];
    }

    /** Contrôles affichés dans les réglages : [['level', 'key', 'data'], …] */
    public function checks(): array
    {
        ['raster' => $raster, 'svg' => $svg] = $this->sources();
        $checks = [];

        if (!$raster) {
            $checks[] = ['level' => 'error', 'key' => $svg ? 'icon_svg_only' : 'icon_missing'];
            return $checks;
        }

        $w = $raster->width();
        $h = $raster->height();

        $checks[] = $w !== $h
            ? ['level' => 'warn', 'key' => 'icon_not_square', 'data' => ['width' => $w, 'height' => $h]]
            : ($w < self::MIN_SIZE
                ? ['level' => 'warn', 'key' => 'icon_small', 'data' => ['width' => $w, 'min' => self::MIN_SIZE]]
                : ['level' => 'ok', 'key' => 'icon_ok', 'data' => ['width' => $w]]);

        $checks[] = $svg ? ['level' => 'ok', 'key' => 'icon_svg'] : ['level' => 'warn', 'key' => 'icon_no_svg'];

        // Un fichier statique du même nom à la racine passe avant les routes du plugin
        $mode = $this->kirby->option('rllngr.kirby-visibilizer.mode', 'classic');
        if ($mode === 'classic') {
            foreach (['favicon.ico', 'apple-touch-icon.png', 'site.webmanifest', 'favicon.svg'] as $name) {
                if (is_file($this->kirby->root('index') . '/' . $name)) {
                    $checks[] = ['level' => 'warn', 'key' => 'icon_static', 'data' => ['file' => $name]];
                }
            }
        }

        return $checks;
    }

    // -------------------------------------------------------------------------
    // GD
    // -------------------------------------------------------------------------

    protected function load(string $path): \GdImage
    {
        $image = match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'png'         => imagecreatefrompng($path),
            'jpg', 'jpeg' => imagecreatefromjpeg($path),
            'webp'        => imagecreatefromwebp($path),
        };
        imagealphablending($image, true);
        imagesavealpha($image, true);
        return $image;
    }

    /**
     * L'image source, ramenée au carré (centrée, sans déformation), réduite à `scale` de la taille
     * et posée sur un fond (`bg`) ou sur du transparent.
     */
    protected function render(\GdImage $source, int $size, float $scale = 1.0, ?array $bg = null): \GdImage
    {
        $canvas = imagecreatetruecolor($size, $size);
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);

        $fill = $bg
            ? imagecolorallocate($canvas, ...$bg)
            : imagecolorallocatealpha($canvas, 0, 0, 0, 127);
        imagefilledrectangle($canvas, 0, 0, $size, $size, $fill);
        imagealphablending($canvas, true);

        $sw    = imagesx($source);
        $sh    = imagesy($source);
        $inner = (int) round($size * $scale);
        $ratio = min($inner / $sw, $inner / $sh);
        $w     = max(1, (int) round($sw * $ratio));
        $h     = max(1, (int) round($sh * $ratio));

        imagecopyresampled($canvas, $source, (int) (($size - $w) / 2), (int) (($size - $h) / 2), 0, 0, $w, $h, $sw, $sh);

        return $canvas;
    }

    /** Fichier ICO contenant des PNG (format accepté partout depuis Windows Vista) */
    protected function ico(array $pngs): string
    {
        $count  = count($pngs);
        $header = pack('vvv', 0, 1, $count);
        $dir    = '';
        $data   = '';
        $offset = 6 + 16 * $count;

        foreach ($pngs as $size => $png) {
            $dir    .= pack('CCCCvvVV', $size >= 256 ? 0 : $size, $size >= 256 ? 0 : $size, 0, 0, 1, 32, strlen($png), $offset);
            $data   .= $png;
            $offset += strlen($png);
        }

        return $header . $dir . $data;
    }

    protected function color(string $field, string $default): string
    {
        $value = trim($this->kirby->site()->content()->get($field)->value() ?? '');
        return preg_match('/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $value) ? strtolower($value) : $default;
    }

    protected function rgb(string $hex): array
    {
        $hex = ltrim($hex, '#');
        if (strlen($hex) === 3) $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
    }
}
