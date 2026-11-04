<?php

namespace Rllngr\KirbyVisibilizer\Tests;

use Rllngr\KirbyVisibilizer\Meta;

class MetaTest extends TestCase
{
    protected function meta(array $content, array $options = []): Meta
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

        return new Meta($app, $app->page('projet'));
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

    public function testIgnoresTheKirbySeoTitleWithoutCompat(): void
    {
        $this->assertSame('Projet – Site', $this->meta(['metaTitle' => 'Ancien titre'])->title());
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
