<?php

namespace Rllngr\KirbyVisibilizer;

use Kirby\Cms\App;
use Kirby\Data\Yaml;
use Kirby\Form\Form;

/**
 * Réglages SEO généraux : un formulaire sans blueprint (blueprints/settings.yml)
 * dont les valeurs vivent dans le contenu du site, avec les mêmes noms de champs que les sections seo / geo.
 */
class Settings
{
    public static function fields(): array
    {
        return Yaml::read(dirname(__DIR__) . '/blueprints/settings.yml');
    }

    /** Champs qui portent une valeur (les titres de groupe n'en ont pas) */
    public static function keys(): array
    {
        return array_keys(array_filter(static::fields(), fn ($f) => ($f['type'] ?? null) !== 'headline'));
    }

    public static function form(App $kirby, array|null $input = null): Form
    {
        $site     = $kirby->site();
        $language = $kirby->language()?->code();

        $form = new Form(fields: static::fields(), model: $site, language: $language);
        $form->fill(input: $site->content($language)->toArray());

        if ($input !== null) {
            $form->submit(input: array_intersect_key($input, array_flip(static::keys())), passthrough: false);
        }

        return $form;
    }

    /** Props de l'onglet réglages : champs, valeurs, droits et réglages venant de la config */
    public static function props(App $kirby): array
    {
        $form = static::form($kirby);

        return [
            'fields'   => $form->toProps(),
            'values'   => array_intersect_key($form->toFormValues(), array_flip(static::keys())),
            'editable' => $kirby->site()->permissions()->can('update'),
            'config'   => static::config($kirby),
        ];
    }

    public static function save(App $kirby, array $input): array
    {
        $form = static::form($kirby, $input);
        $form->validate();

        $values = array_intersect_key($form->toStoredValues(), array_flip(static::keys()));
        $kirby->site()->update($values, $kirby->language()?->code());

        return static::props($kirby);
    }

    /** Ce qui se règle dans config.php, affiché en lecture seule */
    protected static function config(App $kirby): array
    {
        $o = $kirby->option('rllngr.kirby-visibilizer', []);

        return [
            'mode'           => $o['mode'] ?? 'classic',
            'siteUrl'        => $o['siteUrl'] ?? null,
            'titleSeparator' => $o['titleSeparator'] ?? ' — ',
            'ogImageWidth'   => $o['ogImageWidth'] ?? 1200,
            'fallbacks'      => array_filter([
                'title'       => $o['fallbacks']['title'] ?? [],
                'description' => $o['fallbacks']['description'] ?? [],
                'image'       => $o['fallbacks']['image'] ?? [],
            ]),
            'alt'            => array_filter([
                '*' => $o['alt']['template'] ?? null,
                ...($o['alt']['templates'] ?? []),
            ]),
            'llmsSections'   => count($o['llms']['sections'] ?? []),
        ];
    }
}
