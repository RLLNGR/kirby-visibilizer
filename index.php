<?php

use Kirby\Cms\App;
use Kirby\Toolkit\I18n;
use Rllngr\KirbyVisibilizer\LlmGenerator;
use Rllngr\KirbyVisibilizer\Meta;
use Rllngr\KirbyVisibilizer\Robots;
use Rllngr\KirbyVisibilizer\Sitemap;

load([
    'Rllngr\\KirbyVisibilizer\\Meta'         => __DIR__ . '/src/Meta.php',
    'Rllngr\\KirbyVisibilizer\\Sitemap'      => __DIR__ . '/src/Sitemap.php',
    'Rllngr\\KirbyVisibilizer\\Robots'       => __DIR__ . '/src/Robots.php',
    'Rllngr\\KirbyVisibilizer\\LlmGenerator' => __DIR__ . '/src/LlmGenerator.php',
]);

App::plugin('rllngr/kirby-visibilizer', [

    'api' => [
        'routes' => [
            [
                'pattern' => 'rllngr/visibilizer/(:any)',
                'method'  => 'GET',
                'action'  => function (string $panelId) {
                    $kirby   = kirby();
                    $site    = $kirby->site();
                    $pageId  = str_replace('+', '/', $panelId);
                    $page    = $kirby->page($pageId);

                    $separator = $kirby->option('rllngr.kirby-visibilizer.titleSeparator', ' — ');
                    $homeTitle = $site->content()->get('seo_title')->or($site->title())->value();

                    if (!$page) {
                        return [
                            'siteTitle' => $site->title()->value(),
                            'pageTitle' => $site->title()->value(),
                            'pageUrl'   => $site->url(),
                            'siteUrl'   => $site->url(),
                            'separator' => $separator,
                            'isHome'    => true,
                            // Site values come from the edited fields themselves
                            'homeTitle' => $site->title()->value(),
                            'siteDescription' => '',
                            'siteOgImage'     => false,
                        ];
                    }

                    return [
                        'siteTitle' => $site->title()->value(),
                        'pageTitle' => $page->title()->value(),
                        'pageUrl'   => $page->url(),
                        'siteUrl'   => $site->url(),
                        'separator' => $separator,
                        'isHome'    => $page->isHomePage(),
                        'homeTitle' => $homeTitle,
                        'siteDescription' => $site->content()->get('seo_description')->or($site->description())->value() ?? '',
                        'siteOgImage'     => $site->content()->get('og_image')->toFile() !== null,
                    ];
                },
            ],
        ],
    ],

    'options' => [
        // 'classic' — Kirby serves all files directly
        // 'headless' — exposes JSON endpoints for the frontend
        'mode'          => 'classic',
        'cache'         => true,
        'cacheDuration' => 60, // minutes
        'siteUrl'       => null, // auto-detected; override in headless mode
        'trailingSlash' => false,

        // Separator between page title and site name
        'titleSeparator' => ' — ',

        // sitemap.xml (classic mode)
        'sitemap' => [
            'enabled' => true,
            'exclude' => [
                'templates' => ['error'],
                'pages'     => [],
            ],
        ],

        // robots.txt (classic mode)
        'robots' => [
            'enabled'  => true,
            'disallow' => ['/panel/', '/api/'],
            'sitemap'  => true, // reference sitemap(s) at the bottom
        ],

        // GEO — llms.txt + llms-sitemap.xml
        'llms' => [
            'enabled'  => true,
            'sitemap'  => true,
            'sections' => [], // see README
            'exclude'  => [
                'templates' => ['error'],
                'pages'     => [],
            ],
            'include' => [
                'pages' => [],
            ],
            // Panel field names (keep in sync with geo.yml blueprint)
            'fields' => [
                'description'  => 'llmsdescription',
                'instructions' => 'llmsinstructions',
            ],
        ],

        // Migration compatibility — reads old kirby-seo field names as cascade fallback
        'compat' => [
            'kirby-seo' => false,
        ],
    ],

    'sections' => [
        'seo-preview' => [
            'props' => [
                'label' => fn ($label = null) => I18n::translate($label, $label),
            ],
        ],
    ],

    'blueprints' => [
        'sections/seo'         => __DIR__ . '/blueprints/sections/seo.yml',
        'sections/seo-preview' => __DIR__ . '/blueprints/sections/seo-preview.yml',
        'sections/geo'         => __DIR__ . '/blueprints/sections/geo.yml',
    ],

    'snippets' => [
        'seo/head'   => __DIR__ . '/snippets/seo/head.php',
        'seo/jsonld' => __DIR__ . '/snippets/seo/jsonld.php',
    ],

    'routes' => function (App $kirby) {
        $opt    = $kirby->option('rllngr.kirby-visibilizer');
        $mode   = $opt['mode'] ?? 'classic';
        $routes = [];

        if ($mode === 'classic') {

            if ($opt['sitemap']['enabled'] ?? true) {
                $routes[] = [
                    'pattern' => 'sitemap.xml',
                    'method'  => 'GET',
                    'action'  => function () use ($kirby) {
                        $sitemap = new Sitemap($kirby);
                        header('Content-Type: application/xml; charset=utf-8');
                        header('Cache-Control: public, max-age=3600');
                        die($sitemap->generate());
                    },
                ];
            }

            if ($opt['robots']['enabled'] ?? true) {
                $routes[] = [
                    'pattern' => 'robots.txt',
                    'method'  => 'GET',
                    'action'  => function () use ($kirby) {
                        $robots = new Robots($kirby);
                        header('Content-Type: text/plain; charset=utf-8');
                        die($robots->generate());
                    },
                ];
            }

            if ($opt['llms']['enabled'] ?? true) {
                $routes[] = [
                    'pattern' => 'llms.txt',
                    'method'  => 'GET',
                    'action'  => function () use ($kirby) {
                        $llm = new LlmGenerator($kirby);
                        header('Content-Type: text/plain; charset=utf-8');
                        header('Cache-Control: public, max-age=3600');
                        die($llm->generate());
                    },
                ];

                $routes[] = [
                    'pattern' => 'llms-full.txt',
                    'method'  => 'GET',
                    'action'  => function () use ($kirby) {
                        $llm = new LlmGenerator($kirby);
                        header('Content-Type: text/plain; charset=utf-8');
                        header('Cache-Control: public, max-age=3600');
                        die($llm->generate(full: true));
                    },
                ];

                if ($opt['llms']['sitemap'] ?? true) {
                    $routes[] = [
                        'pattern' => 'llms-sitemap.xml',
                        'method'  => 'GET',
                        'action'  => function () use ($kirby) {
                            $llm = new LlmGenerator($kirby);
                            header('Content-Type: application/xml; charset=utf-8');
                            header('Cache-Control: public, max-age=3600');
                            die($llm->generateSitemap());
                        },
                    ];
                }
            }
        }

        if ($mode === 'headless') {
            $routes[] = [
                'pattern' => '__seo__',
                'method'  => 'GET',
                'action'  => function () use ($kirby) {
                    $id    = $kirby->request()->get('page', '');
                    $model = $id ? ($kirby->page($id) ?? $kirby->site()) : $kirby->site();
                    $meta  = new Meta($kirby, $model);
                    header('Content-Type: application/json; charset=utf-8');
                    die(json_encode(['result' => $meta->toArray()]));
                },
            ];

            $routes[] = [
                'pattern' => '__llms__',
                'method'  => 'GET',
                'action'  => function () use ($kirby) {
                    $llm = new LlmGenerator($kirby);
                    header('Content-Type: application/json; charset=utf-8');
                    die(json_encode(['result' => $llm->toArray()]));
                },
            ];

            $routes[] = [
                'pattern' => '__llms-full__',
                'method'  => 'GET',
                'action'  => function () use ($kirby) {
                    $llm = new LlmGenerator($kirby);
                    header('Content-Type: application/json; charset=utf-8');
                    die(json_encode(['result' => $llm->toArray(full: true)]));
                },
            ];
        }

        return $routes;
    },

    'hooks' => [
        'page.update:after'       => function () {
            $k = kirby();
            Sitemap::clearCache($k);
            LlmGenerator::clearCache($k);
        },
        'page.create:after'       => function () {
            $k = kirby();
            Sitemap::clearCache($k);
            LlmGenerator::clearCache($k);
        },
        'page.delete:after'       => function () {
            $k = kirby();
            Sitemap::clearCache($k);
            LlmGenerator::clearCache($k);
        },
        'page.changeStatus:after' => function () {
            $k = kirby();
            Sitemap::clearCache($k);
            LlmGenerator::clearCache($k);
        },
        'site.update:after'       => function () {
            $k = kirby();
            Sitemap::clearCache($k);
            LlmGenerator::clearCache($k);
        },
    ],

]);
