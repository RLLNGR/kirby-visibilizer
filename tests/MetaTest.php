<?php

namespace Rllngr\KirbyVisibilizer\Tests;

use Rllngr\KirbyVisibilizer\Meta;

class MetaTest extends TestCase
{
    protected function meta(array $content, array $options = [], string $slug = 'projet'): Meta
    {
        $app = $this->app([
            'options' => ['rllngr.kirby-visibilizer' => $options + ['titleSeparator' => ' – ']],
            'site'    => [
                'content'  => ['title' => 'Site'],
                'children' => [
                    ['slug' => 'home', 'template' => 'default', 'content' => ['title' => 'Accueil']],
                    ['slug' => 'projet', 'template' => 'project', 'content' => ['title' => 'Projet'] + $content],
                ],
            ],
        ]);

        return new Meta($app, $app->page($slug));
    }

    public function testTheTitleEndsWithTheSite(): void
    {
        $this->assertSame('Projet – Site', $this->meta([])->title());
    }

    public function testTheSeoFieldWinsOverTheFallback(): void
    {
        $meta = $this->meta(
            ['seo_description' => 'Écrite', 'intro' => 'Reprise'],
            ['fallbacks' => ['description' => ['project' => 'intro']]]
        );

        $this->assertSame('Écrite', $meta->description());
    }

    public function testFallsBackToTheFieldOfTheTemplate(): void
    {
        $meta = $this->meta(['intro' => 'Reprise'], ['fallbacks' => ['description' => ['project' => 'intro']]]);

        $this->assertSame('Reprise', $meta->description());
        $this->assertSame(['field' => 'intro', 'value' => 'Reprise'], $meta->fallback('description'));
    }

    // kirby-seo : le titre d'une page est dans metaTitle (metaTemplate n'existe que sur le site)
    public function testReadsTheKirbySeoTitleOfAPage(): void
    {
        $meta = $this->meta(['metaTitle' => 'Ancien titre', 'ogTitle' => 'Ancien partage'], ['compat' => ['kirby-seo' => true]]);

        $this->assertSame('Ancien titre – Site', $meta->title());
        $this->assertSame('Ancien partage', $meta->ogTitle());
        $this->assertSame('custom', $meta->sources()['title']);
    }

    // Un repli configuré pour le template passe avant le titre hérité de kirby-seo
    public function testTheConfiguredFallbackWinsOverTheKirbySeoTitle(): void
    {
        $meta = $this->meta(
            ['metaTitle' => 'Un ancien titre très long', 'mainTitle' => 'Hôtel en pierre'],
            ['compat' => ['kirby-seo' => true], 'fallbacks' => ['title' => ['project' => 'mainTitle']]]
        );

        $this->assertSame('Hôtel en pierre – Site', $meta->title());
        $this->assertSame('field', $meta->sources()['title']);
        $this->assertSame('mainTitle', $meta->sources()['titleField']);
    }

    // Sans repli configuré, rien ne change pour un site qui migre depuis kirby-seo
    public function testTheKirbySeoTitleStillWinsWithoutAConfiguredFallback(): void
    {
        $meta = $this->meta(
            ['metaTitle' => 'Ancien titre', 'mainTitle' => 'Ignoré'],
            ['compat' => ['kirby-seo' => true], 'fallbacks' => ['title' => ['autre' => 'mainTitle']]]
        );

        $this->assertSame('Ancien titre – Site', $meta->title());
        $this->assertSame('custom', $meta->sources()['title']);
    }

    // Le champ du plugin reste prioritaire sur le repli configuré
    public function testTheSeoTitleWinsOverTheConfiguredFallback(): void
    {
        $meta = $this->meta(
            ['seo_title' => 'Écrit', 'metaTitle' => 'Ancien', 'mainTitle' => 'Repli'],
            ['compat' => ['kirby-seo' => true], 'fallbacks' => ['title' => ['project' => 'mainTitle']]]
        );

        $this->assertSame('Écrit – Site', $meta->title());
        $this->assertSame('custom', $meta->sources()['title']);
    }

    // Le titre hérité reste le dernier recours quand le champ de repli est vide
    public function testTheKirbySeoTitleIsUsedWhenTheFallbackFieldIsEmpty(): void
    {
        $meta = $this->meta(
            ['metaTitle' => 'Ancien titre'],
            ['compat' => ['kirby-seo' => true], 'fallbacks' => ['title' => ['project' => 'mainTitle']]]
        );

        $this->assertSame('Ancien titre – Site', $meta->title());
        $this->assertSame('custom', $meta->sources()['title']);
    }

    // La description suit la même cascade
    public function testTheConfiguredFallbackWinsOverTheKirbySeoDescription(): void
    {
        $meta = $this->meta(
            ['metaDescription' => 'Ancienne', 'intro' => 'Reprise'],
            ['compat' => ['kirby-seo' => true], 'fallbacks' => ['description' => ['project' => 'intro']]]
        );

        $this->assertSame('Reprise', $meta->description());
        $this->assertSame('field', $meta->sources()['description']);
    }

    // La compat peut être coupée champ par champ : ['kirby-seo' => ['title' => false]]
    public function testCompatCanBeDisabledPerType(): void
    {
        $meta = $this->meta(
            ['metaTitle' => 'Ancien titre', 'metaDescription' => 'Ancienne description'],
            ['compat' => ['kirby-seo' => ['title' => false]]]
        );

        $this->assertSame('Projet – Site', $meta->title());
        $this->assertSame('Ancienne description', $meta->description());
    }

    public function testIgnoresTheKirbySeoTitleWithoutCompat(): void
    {
        $this->assertSame('Projet – Site', $this->meta(['metaTitle' => 'Ancien titre'])->title());
    }

    // titleSuffix : par défaut, le titre du site, comme avant
    public function testTheTitleSuffixDefaultsToTheSiteTitle(): void
    {
        $meta = $this->meta([]);

        $this->assertSame('Projet – Site', $meta->title());
        $this->assertSame('Site', $meta->titleSuffix());
    }

    public function testTheTitleSuffixCanBeConfigured(): void
    {
        $meta = $this->meta([], ['titleSuffix' => 'Court']);

        $this->assertSame('Projet – Court', $meta->title());
        $this->assertSame('Court', $meta->titleSuffix());
    }

    // Une valeur vide ou null supprime le suffixe, séparateur compris
    public function testAnEmptyTitleSuffixDropsTheSeparator(): void
    {
        $this->assertSame('Projet', $this->meta([], ['titleSuffix' => ''])->title());
    }

    public function testANullTitleSuffixDropsTheSeparator(): void
    {
        $this->assertSame('Projet', $this->meta([], ['titleSuffix' => null])->title());
    }

    // Le titre de page déjà égal au suffixe n'est pas répété
    public function testTheSuffixIsNotRepeatedWhenTheTitleAlreadyMatchesIt(): void
    {
        $meta = $this->meta(['seo_title' => 'Court'], ['titleSuffix' => 'Court']);

        $this->assertSame('Court', $meta->title());
    }

    // Page d'accueil : pas de suffixe accolé, et le suffixe sert de dernier recours
    public function testTheHomeTitleUsesTheSuffixAsItsLastResort(): void
    {
        $meta = $this->meta([], ['titleSuffix' => 'Court'], 'home');

        $this->assertSame('Court', $meta->title());
    }

    public function testTheHomeTitleFallsBackToTheSiteTitleWithoutASuffix(): void
    {
        $meta = $this->meta([], ['titleSuffix' => ''], 'home');

        $this->assertSame('Site', $meta->title());
    }

    public function testAFallbackIsPlainText(): void
    {
        $this->assertSame('Un texte', Meta::plainText('<p>Un&nbsp;<strong>texte</strong></p>'));
    }

    public function testAFunctionCanBeTheFallback(): void
    {
        $meta = $this->meta(['client' => 'Hermès', 'skills' => 'Identité visuelle'], ['fallbacks' => [
            'description' => ['project' => fn ($page) => $page->client() . ' — ' . $page->skills()],
        ]]);

        $this->assertSame('Hermès — Identité visuelle', $meta->description());
        $this->assertSame(['field' => Meta::FUNCTION_FALLBACK, 'value' => 'Hermès — Identité visuelle'], $meta->fallback('description'));
        $this->assertSame('field', $meta->sources()['description']);
        $this->assertSame([], $meta->fallbackFields('description'));
        $this->assertSame([['value' => 'Hermès — Identité visuelle']], $meta->fallbackPreview('description'));
    }

    protected function mixedFallbacks(): array
    {
        return ['fallbacks' => ['description' => ['project' => ['intro', fn ($page) => $page->client()]]]];
    }

    public function testAFieldBeforeAFunctionWins(): void
    {
        $meta = $this->meta(['intro' => 'Reprise', 'client' => 'Hermès'], $this->mixedFallbacks());

        $this->assertSame('Reprise', $meta->description());
        $this->assertSame(['intro'], $meta->fallbackFields('description'));
    }

    public function testTheFunctionIsTriedWhenTheFieldIsEmpty(): void
    {
        $this->assertSame('Hermès', $this->meta(['client' => 'Hermès'], $this->mixedFallbacks())->description());
    }

    public function testAnEmptyFunctionFallsThroughToTheSite(): void
    {
        $meta = $this->meta([], ['fallbacks' => ['description' => ['project' => fn () => null]]]);

        $this->assertSame(['field' => null, 'value' => ''], $meta->fallback('description'));
        $this->assertSame([], $meta->fallbackPreview('description'));
    }

    public function testAFunctionFallbackIsCutAndPlain(): void
    {
        $meta = $this->meta([], ['fallbacks' => [
            'title' => ['project' => fn () => '<p>Un&nbsp;titre</p>'],
            'description' => ['*' => fn () => str_repeat('mot ', 60)],
            'length' => 20,
        ]]);

        $this->assertSame('Un titre – Site', $meta->title());
        $this->assertLessThanOrEqual(22, mb_strlen($meta->description()));
    }
}
