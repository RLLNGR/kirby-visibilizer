<?php

namespace Rllngr\KirbyVisibilizer\Tests;

use Kirby\Cms\App;
use Rllngr\KirbyVisibilizer\Alt;
use Rllngr\KirbyVisibilizer\Settings;

class AltTest extends TestCase
{
    protected function site(array $options = [], array $site = []): App
    {
        return $this->app([
            'options' => ['rllngr.kirby-visibilizer' => $options],
            'site'    => [
                'content'  => ['title' => 'Studio'] + $site,
                'children' => [[
                    'slug'     => 'projet',
                    'template' => 'project',
                    'content'  => ['title' => 'Projet', 'client' => 'Acme'],
                    'files'    => [
                        ['filename' => 'a.jpg', 'content' => ['credit' => 'Ana']],
                        ['filename' => 'b.jpg', 'content' => ['alt' => 'Écrit à la main']],
                    ],
                ]],
            ],
        ]);
    }

    public function testTheFieldOfTheSiteIsTheDefault(): void
    {
        $file = $this->site([], ['alt_template' => '{{ page.title }} pour {{ page.client }}, {{ file.credit }} – {{ site.title }}'])->file('projet/a.jpg');

        $this->assertSame('Projet pour Acme, Ana – Studio', Alt::text($file));
    }

    public function testAWrittenAltWins(): void
    {
        $file = $this->site([], ['alt_template' => '{{ page.title }}'])->file('projet/b.jpg');

        $this->assertSame('Écrit à la main', Alt::text($file));
    }

    public function testTheConfigWinsOverTheField(): void
    {
        $file = $this->site(['alt' => ['template' => 'Config {{ page.title }}']], ['alt_template' => 'Champ'])->file('projet/a.jpg');

        $this->assertSame('Config Projet', Alt::text($file));
    }

    public function testTheFieldRunsNoQuery(): void
    {
        $app = $this->site(['secret' => 'cle'], ['alt_template' => implode(' ', [
            'Texte',
            '{{ kirby.option("rllngr.kirby-visibilizer.secret") }}',
            '{{ page.delete }}',
            '{{ page.parent.title }}',
            '{{ site.title.upper }}',
            '{{ page.title }}',
        ])]);

        $text = Alt::text($app->file('projet/a.jpg'));

        $this->assertSame('Texte Projet', $text);
        $this->assertNotNull($app->page('projet'));
    }

    public function testNoTemplateMeansNoText(): void
    {
        $this->assertSame('', Alt::generate($this->site()->file('projet/a.jpg')));
    }

    public function testTheFieldIsSavedAndDisabledUnderAConfigTemplate(): void
    {
        $app = $this->site();
        $app->impersonate('kirby');
        Settings::save($app, ['alt_template' => '{{ site.title }}']);
        $this->assertSame('{{ site.title }}', $app->site()->content()->get('alt_template')->value());
        $this->assertArrayNotHasKey('disabled', Settings::fields()['alt_template']);

        $this->tearDown();
        $this->setUp();
        $this->site(['alt' => ['template' => 'Config']]);
        $this->assertTrue(Settings::fields()['alt_template']['disabled']);
    }
}
