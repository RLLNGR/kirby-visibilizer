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

    public function testAFallbackIsPlainText(): void
    {
        $this->assertSame('Un texte', Meta::plainText('<p>Un&nbsp;<strong>texte</strong></p>'));
    }
}
