<?php

namespace Rllngr\KirbyVisibilizer;

use Kirby\Cms\App;

/**
 * Vérifie les liens externes (HEAD, puis GET si le serveur refuse HEAD), en parallèle,
 * et garde le résultat en cache une semaine. Seulement en http(s), et jamais vers une adresse
 * du réseau interne : le contenu du site ne doit pas permettre de sonder le serveur.
 */
class LinkChecker
{
    public const TTL     = 60 * 24 * 7; // minutes
    public const TIMEOUT = 8;

    protected App $kirby;

    public function __construct(App $kirby)
    {
        $this->kirby = $kirby;
    }

    public function cached(string $href): ?array
    {
        $result = $this->cache()->get($this->key($href));
        return $result ? ['internal' => false, 'label' => $href] + $result : null;
    }

    /**
     * @param string[] $hrefs
     * @return array<string, array> résultat par lien
     */
    public function check(array $hrefs): array
    {
        $results = [];
        $retry   = [];
        $allowed = [];

        foreach ($hrefs as $href) {
            if ($refused = static::refusal($href)) {
                $results[$href] = $refused;
            } else {
                $allowed[] = $href;
            }
        }

        foreach ($this->run($allowed, 'HEAD') as $href => $result) {
            // HEAD refusé ou mal géré par certains serveurs : on retente en GET
            if (in_array($result['code'], [0, 403, 404, 405, 406, 429, 501, 999], true)) {
                $retry[] = $href;
            }
            $results[$href] = $result;
        }

        if ($retry) {
            foreach ($this->run($retry, 'GET') as $href => $result) {
                if ($result['code'] !== 0 || $results[$href]['code'] === 0) {
                    $results[$href] = $result;
                }
            }
        }

        foreach ($results as $href => $result) {
            $result += ['checked' => time()];
            $this->cache()->set($this->key($href), $result, self::TTL);
            $results[$href] = ['internal' => false, 'label' => $href] + $result;
        }

        return $results;
    }

    /** Résultat à la place d'une requête : autre protocole que http(s), ou adresse interne */
    public static function refusal(string $href): ?array
    {
        $url = parse_url($href);

        if (!in_array(strtolower($url['scheme'] ?? ''), ['http', 'https'], true) || empty($url['host'])) {
            return ['level' => 'warn', 'code' => null, 'key' => 'link_scheme'];
        }

        return static::isPrivateHost($url['host'])
            ? ['level' => 'warn', 'code' => null, 'key' => 'link_private']
            : null;
    }

    /** Un nom qui ne se résout pas n'est pas refusé ici : curl le dira injoignable */
    public static function isPrivateHost(string $host): bool
    {
        $host = strtolower(trim($host, '[]'));

        if ($host === 'localhost' || str_ends_with($host, '.localhost')) return true;

        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);

        foreach ($ips as $ip) {
            if (static::isPrivateIp($ip)) return true;
        }

        return false;
    }

    public static function isPrivateIp(string $ip): bool
    {
        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
    }

    /** Même adresse au protocole, au www et à la barre finale près : rien à corriger */
    public static function isMinorRedirect(string $from, string $to): bool
    {
        $normalize = function (string $url) {
            $parts = parse_url($url);
            $host  = preg_replace('/^www\./', '', strtolower($parts['host'] ?? ''));
            return $host . rtrim($parts['path'] ?? '', '/') . (isset($parts['query']) ? '?' . $parts['query'] : '');
        };

        return $normalize($from) === $normalize($to);
    }

    public function forget(array $hrefs): void
    {
        foreach ($hrefs as $href) {
            $this->cache()->remove($this->key($href));
        }
    }

    protected function run(array $hrefs, string $method): array
    {
        $multi   = curl_multi_init();
        $handles = [];

        foreach ($hrefs as $href) {
            $ch = curl_init($href);
            curl_setopt_array($ch, [
                CURLOPT_NOBODY         => $method === 'HEAD',
                CURLOPT_CUSTOMREQUEST  => $method,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS      => 5,
                CURLOPT_PROTOCOLS      => CURLPROTO_HTTP | CURLPROTO_HTTPS,
                CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_TIMEOUT        => self::TIMEOUT,
                CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; kirby-visibilizer link checker)',
                CURLOPT_HTTPHEADER     => ['Accept: text/html,*/*;q=0.8'],
                // On ne lit que le début de la réponse en GET
                CURLOPT_RANGE          => $method === 'GET' ? '0-2047' : null,
            ]);
            curl_multi_add_handle($multi, $ch);
            $handles[$href] = $ch;
        }

        do {
            $status = curl_multi_exec($multi, $running);
            if ($running) curl_multi_select($multi, 1);
        } while ($running && $status === CURLM_OK);

        $results = [];

        foreach ($handles as $href => $ch) {
            $code      = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $final     = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
            $redirects = (int) curl_getinfo($ch, CURLINFO_REDIRECT_COUNT);
            $error     = curl_errno($ch);
            $ip        = (string) curl_getinfo($ch, CURLINFO_PRIMARY_IP);

            // 206 = réponse partielle à notre Range
            if ($code === 206) $code = 200;

            $results[$href] = match (true) {
                // Une redirection a pu mener vers le réseau interne : rien de sa réponse ne ressort
                $ip !== '' && static::isPrivateIp($ip) => ['level' => 'warn', 'code' => null, 'key' => 'link_private'],
                $code === 0                          => ['level' => 'error', 'code' => 0, 'key' => $error === CURLE_OPERATION_TIMEDOUT ? 'link_timeout' : 'link_unreachable'],
                // Anti-robots (LinkedIn répond 999, Cloudflare & co 403 / 429) : le lien marche sûrement dans un navigateur
                in_array($code, [403, 429, 999], true) => ['level' => 'warn', 'code' => $code, 'key' => 'link_blocked'],
                $code >= 400                         => ['level' => 'error', 'code' => $code, 'key' => $code === 404 || $code === 410 ? 'link_notfound' : 'link_http'],
                $redirects > 0 && static::isMinorRedirect($href, $final) => ['level' => 'ok', 'code' => $code, 'key' => 'link_redirect_minor', 'redirect' => $final],
                $redirects > 0 && $final !== $href   => ['level' => 'warn', 'code' => $code, 'key' => 'link_redirect', 'redirect' => $final],
                default                              => ['level' => 'ok', 'code' => $code],
            };

            curl_multi_remove_handle($multi, $ch);
            curl_close($ch);
        }

        curl_multi_close($multi);

        return $results;
    }

    protected function cache()
    {
        return $this->kirby->cache('rllngr.kirby-visibilizer');
    }

    protected function key(string $href): string
    {
        return 'link.' . md5($href);
    }
}
