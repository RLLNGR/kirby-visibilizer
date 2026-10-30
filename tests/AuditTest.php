<?php

namespace Rllngr\KirbyVisibilizer\Tests;

use Rllngr\KirbyVisibilizer\Audit;

class AuditTest extends TestCase
{
    protected function page(array $content = []): array
    {
        return ['slug' => 'projet', 'template' => 'default', 'content' => ['title' => 'Projet'] + $content];
    }

    public function testExtractsEveryWayOfWritingALink(): void
    {
        $audit = new Audit($this->app());

        $found = $audit->extractLinks(
            '<a href="https://html.fr/a">x</a> [y](https://md.fr/b) (link: https://kt.fr/c text: z) voir https://nu.fr/d.'
        );

        $this->assertSame(['https://html.fr/a', 'https://md.fr/b', 'https://kt.fr/c', 'https://nu.fr/d'], $found);
    }

    public function testReadsAnEscapedHrefInBlocksJson(): void
    {
        $audit = new Audit($this->app());

        $this->assertSame(['https://bloc.fr/'], $audit->extractLinks('{"text":"<a href=\\"https://bloc.fr/\\">x</a>"}'));
    }

    public function testIgnoresWhatIsNotAPage(): void
    {
        $audit = new Audit($this->app());

        $this->assertSame([], $audit->extractLinks('<a href="mailto:a@b.fr">m</a> <a href="#ancre">a</a> <a href="tel:+33">t</a>'));
    }

    public function testResolvesInternalLinks(): void
    {
        $audit = new Audit($this->app(['site' => ['children' => [
            $this->page(),
            ['slug' => 'cachee', 'isDraft' => true, 'template' => 'default'],
        ]]]));

        $this->assertSame('ok', $audit->resolveInternal('/projet')['level']);
        $this->assertSame('ok', $audit->resolveInternal('https://kirby.test/projet')['level']);
        $this->assertSame('link_notfound', $audit->resolveInternal('/absente')['key']);
        $this->assertNull($audit->resolveInternal('https://ailleurs.fr/projet'));
    }

    public function testTheFrontEndAddressIsInternalToo(): void
    {
        $audit = new Audit($this->app([
            'options' => ['rllngr.kirby-visibilizer' => ['siteUrl' => 'https://front.test']],
            'site'    => ['children' => [$this->page()]],
        ]));

        $this->assertSame('ok', $audit->resolveInternal('https://front.test/projet')['level']);
    }

    public function testReportsLinksOfEveryLanguage(): void
    {
        $audit = new Audit($this->app([
            'languages' => [
                ['code' => 'fr', 'default' => true, 'name' => 'Français'],
                ['code' => 'en', 'name' => 'English'],
            ],
            'options' => ['languages' => true],
            'site' => ['children' => [[
                'slug'         => 'projet',
                'template'     => 'default',
                'translations' => [
                    ['code' => 'fr', 'content' => ['title' => 'Projet', 'text' => 'https://fr.example.org/']],
                    ['code' => 'en', 'content' => ['title' => 'Project', 'text' => 'https://en.example.org/']],
                ],
            ]]],
        ]));

        $hrefs = array_column($audit->linkReport(), 'href');

        $this->assertContains('https://fr.example.org/', $hrefs);
        $this->assertContains('https://en.example.org/', $hrefs);
    }
}
