<?php

namespace Rllngr\KirbyVisibilizer\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase as Base;
use Rllngr\KirbyVisibilizer\LinkChecker;

class LinkCheckerTest extends Base
{
    public static function refused(): array
    {
        return [
            'ftp'        => ['ftp://example.com/file', 'link_scheme'],
            'gopher'     => ['gopher://example.com', 'link_scheme'],
            'sans hôte'  => ['http:///chemin', 'link_scheme'],
            'localhost'  => ['http://localhost:3000/', 'link_private'],
            '*.localhost' => ['http://app.localhost/', 'link_private'],
            'boucle'     => ['http://127.0.0.1/', 'link_private'],
            'privé'      => ['https://192.168.1.10/admin', 'link_private'],
            'métadonnées' => ['http://169.254.169.254/latest/', 'link_private'],
            'ipv6'       => ['http://[::1]/', 'link_private'],
        ];
    }

    #[DataProvider('refused')]
    public function testRefusesWithoutARequest(string $href, string $key): void
    {
        $this->assertSame($key, LinkChecker::refusal($href)['key']);
    }

    public function testAcceptsAPublicAddress(): void
    {
        $this->assertNull(LinkChecker::refusal('http://93.184.216.34/page'));
    }

    public static function redirects(): array
    {
        return [
            'https'         => ['http://a.fr/page', 'https://a.fr/page', true],
            'www'           => ['https://a.fr/', 'https://www.a.fr/', true],
            'barre finale'  => ['https://a.fr/page', 'https://a.fr/page/', true],
            'casse de l\'hôte' => ['http://A.fr/', 'https://a.fr/', true],
            'autre chemin'  => ['http://a.fr/page', 'https://a.fr/autre', false],
            'autre domaine' => ['http://a.fr/', 'https://a.com/', false],
            'autre requête' => ['http://a.fr/?x=1', 'https://a.fr/?x=2', false],
        ];
    }

    #[DataProvider('redirects')]
    public function testMinorRedirects(string $from, string $to, bool $minor): void
    {
        $this->assertSame($minor, LinkChecker::isMinorRedirect($from, $to));
    }
}
