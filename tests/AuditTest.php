<?php

namespace Rllngr\KirbyVisibilizer\Tests;

use Rllngr\KirbyVisibilizer\Audit;

class AuditTest extends TestCase
{
    protected function page(array $content = []): array
    {
        return ['slug' => 'projet', 'template' => 'default', 'content' => ['title' => 'Projet'] + $content];
    }

    public function testSummaryScoresEachCardAndWeighsTheTotal(): void
    {
        $audit = new Audit($this->app(['site' => ['children' => [
            $this->page([
                'seo_title' => 'Un titre de page assez long pour être optimal',
                'seo_description' => 'Une description assez longue pour se situer dans la bonne fourchette de longueur.',
                'text' => '<a href="/absente">x</a> <a href="https://ailleurs.fr/">y</a>',
            ]),
        ]]]));

        $summary = $audit->summary();

        $this->assertSame(['ok' => 0, 'warn' => 0, 'error' => 1, 'pending' => 1, 'score' => 0], $summary['cards']['links']);
        $this->assertNull($summary['cards']['alts']['score']);
        $this->assertSame(100, $summary['cards']['descriptions']['score']);
        $this->assertSame(1, $summary['toFix']);
        // Liens à 0 (poids 20) et titres + descriptions à 100 (poids 60) ; images sans objet
        $this->assertSame(75, $summary['score']);
    }

    public function testSummaryWithNothingToJudgeHasNoScore(): void
    {
        $summary = (new Audit($this->app()))->summary();

        $this->assertNull($summary['score']);
        $this->assertSame(0, $summary['toFix']);
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
