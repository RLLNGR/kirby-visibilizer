<?php

namespace Rllngr\KirbyVisibilizer\Tests;

use Rllngr\KirbyVisibilizer\Icons;

class IconsTest extends TestCase
{
    public function testServesFromTheRootOfTheDomain(): void
    {
        $app = $this->app(['site' => ['content' => ['title' => 'Site']]]);

        $this->assertSame('/favicon.ico', (new Icons($app))->publicPath('favicon.ico'));
        $this->assertSame('/', (new Icons($app))->manifest()['start_url']);
    }

    public function testKeepsTheSubfolderWhenKirbyIsNotAtTheRoot(): void
    {
        $app = $this->app([
            'urls' => ['index' => 'https://kirby.test/un-site'],
            'site' => ['content' => ['title' => 'Site']],
        ]);
        $icons = new Icons($app);

        $this->assertSame('/un-site/favicon.ico', $icons->publicPath('favicon.ico'));
        $this->assertSame('/un-site/', $icons->manifest()['start_url']);
        $this->assertSame('/un-site/web-app-manifest-192x192.png', $icons->manifest()['icons'][0]['src']);
    }

    public function testFollowsTheFrontEndInHeadlessMode(): void
    {
        $app = $this->app([
            'urls'    => ['index' => 'https://kirby.test/panel-host'],
            'options' => ['rllngr.kirby-visibilizer' => ['mode' => 'headless', 'siteUrl' => 'https://front.test']],
        ]);

        $this->assertSame('/favicon.ico', (new Icons($app))->publicPath('favicon.ico'));
    }
}
