<?php

namespace Rllngr\KirbyVisibilizer;

use Kirby\Cms\File;
use Kirby\Toolkit\Str;

/**
 * Texte alternatif des images : le champ alt du fichier, sinon un modèle configurable
 * (`alt.template`, ou `alt.templates` par template de la page parente) avec les requêtes Kirby :
 * {{ page.title }}, {{ page.client }}, {{ site.title }}, {{ file.credit }}, {{ page.parent.title }}…
 * À défaut, le champ `alt_template` des réglages du site : écrit depuis le Panel, il ne donne accès
 * qu'aux champs de contenu. Une requête Kirby peut appeler n'importe quelle méthode (`kirby.users…`) :
 * c'est réservé à la config, jamais à ce qu'un éditeur saisit.
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
        $kirby  = kirby();
        $parent = $file->parent();

        if ($template = static::template($file)) {
            $text = Str::template($template, [
                'file'  => $file,
                'page'  => $parent,
                'site'  => $kirby->site(),
                'kirby' => $kirby,
            ], ['fallback' => '']);
        } else {
            $text = static::fill($kirby->site()->content()->get('alt_template')->value() ?? '', [
                'file' => $file,
                'page' => $parent,
                'site' => $kirby->site(),
            ]);
        }

        return static::clean(Meta::plainText($text));
    }

    /** Remplace {{ page.champ }}, {{ file.champ }}, {{ site.champ }} par la valeur du champ ; tout le reste disparaît */
    public static function fill(string $template, array $models): string
    {
        return preg_replace_callback(
            '/\{\{\s*(?:(page|file|site)\.(\w+)\s*)?.*?\}\}/s',
            fn ($m) => isset($m[2]) && preg_match('/^\{\{\s*\w+\.\w+\s*\}\}$/', $m[0])
                ? (string) $models[$m[1]]->content()->get($m[2])->value()
                : '',
            $template
        );
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
