<?php

namespace Rllngr\KirbyVisibilizer\Tests;

use Rllngr\KirbyVisibilizer\Url;

class UrlTest extends TestCase
{
    public function testKeepsKirbysAddressWithoutAFrontEnd(): void
    {
        $this->app();

        $this->assertSame('https://kirby.test', Url::site());
    }

    public function testRebasesOntoTheFrontEnd(): void
    {
        $app = $this->app([
            'options' => ['rllngr.kirby-visibilizer' => ['siteUrl' => 'https://front.test/']],
            'site'    => ['children' => [['slug' => 'projet', 'template' => 'default']]],
        ]);

        $this->assertSame('https://front.test', Url::site());
        $this->assertStringStartsWith('https://front.test/projet', Url::page($app->page('projet')));
    }

    public function testReadsTheSubfolderTheSiteLivesIn(): void
    {
        $this->app(['urls' => ['index' => 'https://kirby.test/un-site/']]);

        $this->assertSame('/un-site', Url::basePath());
    }

    public function testHasNoBasePathAtTheRootOfTheDomain(): void
    {
        $this->app();

        $this->assertSame('', Url::basePath());
    }

    public function testIgnoresTheLanguagePrefixOfAMultilingualSite(): void
    {
        $app = $this->app([
            'languages' => [
                ['code' => 'fr', 'default' => true, 'name' => 'Français'],
                ['code' => 'en', 'name' => 'English'],
            ],
            'options' => ['languages' => true],
            'site'    => ['children' => [['slug' => 'projet', 'template' => 'default']]],
        ]);

        $this->assertSame('https://kirby.test', Url::site());
        $this->assertSame('', Url::basePath());
        $this->assertStringStartsWith('https://kirby.test/en/projet', Url::page($app->page('projet'), 'en'));
    }

    public function testRebasesEveryLanguageOntoTheFrontEnd(): void
    {
        $app = $this->app([
            'languages' => [
                ['code' => 'fr', 'default' => true, 'name' => 'Français'],
                ['code' => 'en', 'name' => 'English'],
            ],
            'options' => [
                'languages' => true,
                'rllngr.kirby-visibilizer' => ['siteUrl' => 'https://front.test'],
            ],
            'site' => ['children' => [['slug' => 'projet', 'template' => 'default']]],
        ]);

        $this->assertStringStartsWith('https://front.test/fr/projet', Url::page($app->page('projet'), 'fr'));
    }

    public function testLeavesOtherAddressesAlone(): void
    {
        $this->app(['options' => ['rllngr.kirby-visibilizer' => ['siteUrl' => 'https://front.test']]]);

        $this->assertStringStartsWith('https://ailleurs.fr/page', Url::public('https://ailleurs.fr/page'));
    }
}
