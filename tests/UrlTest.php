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

    public function testLeavesOtherAddressesAlone(): void
    {
        $this->app(['options' => ['rllngr.kirby-visibilizer' => ['siteUrl' => 'https://front.test']]]);

        $this->assertStringStartsWith('https://ailleurs.fr/page', Url::public('https://ailleurs.fr/page'));
    }
}
