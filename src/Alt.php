<?php

namespace Rllngr\KirbyVisibilizer;

use Kirby\Cms\File;
use Kirby\Toolkit\Str;

/**
 * Texte alternatif des images : le champ alt du fichier, sinon un modèle configurable
 * (`alt.template`, ou `alt.templates` par template de la page parente) avec les requêtes Kirby :
 * {{ page.title }}, {{ page.client }}, {{ site.title }}, {{ file.credit }}, {{ page.parent.title }}…
 */
class Alt
{
    public static function field(): string
    {
        return kirby()->option('rllngr.kirby-visibilizer.panel.altField', 'alt');
    }

    public static function value(File $file): string
    {
        return trim($file->content()->get(static::field())->value() ?? '');
    }

    /** Modèle applicable au fichier, ou null */
    public static function template(File $file): ?string
    {
        $options = kirby()->option('rllngr.kirby-visibilizer.alt', []);
        $parent  = $file->parent();
        $name    = method_exists($parent, 'intendedTemplate') ? $parent->intendedTemplate()->name() : 'site';

        return ($options['templates'] ?? [])[$name] ?? $options['template'] ?? null;
    }

    /** Texte généré par le modèle (vide si aucun modèle ou si toutes les valeurs manquent) */
    public static function generate(File $file): string
    {
        $template = static::template($file);
        if (!$template) return '';

        $kirby  = kirby();
        $parent = $file->parent();
        $text   = Str::template($template, [
            'file'  => $file,
            'page'  => $parent,
            'site'  => $kirby->site(),
            'kirby' => $kirby,
        ], ['fallback' => '']);

        return static::clean(Meta::plainText($text));
    }

    /** Le champ alt, sinon le texte généré */
    public static function text(File $file): string
    {
        return static::value($file) ?: static::generate($file);
    }

    /**
     * Retire ce que laissent les valeurs vides : séparateurs doublés ou en bout de chaîne, parenthèses vides.
     * « La Mamounia — , Marrakech · » → « La Mamounia — Marrakech »
     */
    public static function clean(string $text): string
    {
        $sep  = '[—–|·,;:\/]|(?<=\s)-(?=\s)';
        $text = preg_replace('/\(\s*\)|\[\s*\]/u', '', $text);
        $text = preg_replace('/\s+/u', ' ', $text);
        // Un séparateur suivi d'un autre : on garde le dernier
        $text = preg_replace('/\s*(?:' . $sep . ')\s*(?=(?:' . $sep . '))/u', ' ', $text);
        $text = preg_replace('/^(?:\s|' . $sep . ')+|(?:\s|' . $sep . ')+$/u', '', $text);

        $text = preg_replace('/\s+([,;:])/u', '$1', $text);

        return trim(preg_replace('/\s+/u', ' ', $text));
    }
}
