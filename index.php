<?php

use Kirby\Cms\App;
use Kirby\Exception\PermissionException;
use Kirby\Toolkit\I18n;
use Kirby\Content\Field;
use Rllngr\KirbyVisibilizer\Alt;
use Rllngr\KirbyVisibilizer\Audit;
use Rllngr\KirbyVisibilizer\LinkChecker;
use Rllngr\KirbyVisibilizer\LlmGenerator;
use Rllngr\KirbyVisibilizer\Meta;
use Rllngr\KirbyVisibilizer\Robots;
use Rllngr\KirbyVisibilizer\Sitemap;

load([
    'Rllngr\\KirbyVisibilizer\\Meta'         => __DIR__ . '/src/Meta.php',
    'Rllngr\\KirbyVisibilizer\\Sitemap'      => __DIR__ . '/src/Sitemap.php',
    'Rllngr\\KirbyVisibilizer\\Robots'       => __DIR__ . '/src/Robots.php',
    'Rllngr\\KirbyVisibilizer\\LlmGenerator' => __DIR__ . '/src/LlmGenerator.php',
    'Rllngr\\KirbyVisibilizer\\Audit'        => __DIR__ . '/src/Audit.php',
    'Rllngr\\KirbyVisibilizer\\Alt'          => __DIR__ . '/src/Alt.php',
    'Rllngr\\KirbyVisibilizer\\LinkChecker'  => __DIR__ . '/src/LinkChecker.php',
]);

/** Vue SEO du Panel : `panel.access` = true (tous), false (personne) ou une liste de rôles */
function visibilizerPanelAccess(): bool
{
    $user   = kirby()->user();
    $option = option('rllngr.kirby-visibilizer.panel.access', true);
    if (!$user || $option === false) return false;
    return $option === true || in_array($user->role()->name(), (array) $option, true);
}

App::plugin('rllngr/kirby-visibilizer', [

    // Vue SEO dans le Panel
    'areas' => [
        'visibilizer' => fn () => [
            'label' => t('visibilizer.seo'),
            'icon'  => 'search',
            'menu'  => visibilizerPanelAccess(),
            'link'  => 'seo',
            'views' => [
                [
                    'pattern' => 'seo',
                    'action'  => function () {
                        if (!visibilizerPanelAccess()) {
                            throw new PermissionException(t('visibilizer.forbidden'));
                        }
                        $audit = new Audit(kirby());
                        $tab   = get('tab', 'pages');
                        return [
                            'component' => 'k-visibilizer-seo-view',
                            'title'     => t('visibilizer.seo'),
                            'props'     => [
                                'tab'    => in_array($tab, ['pages', 'images', 'links'], true) ? $tab : 'pages',
                                'pages'  => $audit->pageReport(),
                                'images' => $audit->imageReport(),
                                'links'  => $audit->linkReport(),
                            ],
                        ];
                    },
                ],
            ],
        ],
    ],

    // $image->altText() : le champ alt, sinon le modèle `alt.template(s)`
    'fileMethods' => [
        'altText' => function () {
            return new Field($this, 'altText', Alt::text($this));
        },
    ],

    'translations' => [
        'fr' => require __DIR__ . '/translations/fr.php',
        'en' => require __DIR__ . '/translations/en.php',
    ],

    'api' => [
        'routes' => [
            [
                // Écrit le texte généré dans les champs alt vides des images auditées
                'pattern' => 'rllngr/visibilizer-audit/alts',
                'method'  => 'POST',
                'action'  => function () {
                    if (!visibilizerPanelAccess()) {
                        throw new PermissionException(t('visibilizer.forbidden'));
                    }
                    $done   = 0;
                    $failed = 0;
                    foreach ((new Audit(kirby()))->images() as $file) {
                        if (Alt::value($file) !== '' || ($text = Alt::generate($file)) === '') continue;
                        try {
                            $file->update([Alt::field() => $text]);
                            $done++;
                        } catch (Throwable $e) {
                            $failed++;
                        }
                    }
                    return ['done' => $done, 'failed' => $failed];
                },
            ],
            [
                // Vérifie un lot de liens externes (la vue les envoie par petits lots)
                'pattern' => 'rllngr/visibilizer-audit/links',
                'method'  => 'POST',
                'action'  => function () {
                    if (!visibilizerPanelAccess()) {
                        throw new PermissionException(t('visibilizer.forbidden'));
                    }
                    // Seulement des liens réellement présents dans le contenu (pas de sonde arbitraire)
                    $known = array_column(array_filter((new Audit(kirby()))->linkReport(), fn ($l) => !$l['internal']), 'href');
                    $hrefs = array_slice(array_values(array_intersect((array) get('hrefs', []), $known)), 0, 20);
                    $checker = new LinkChecker(kirby());
                    if (get('force')) $checker->forget($hrefs);
                    return $checker->check($hrefs);
                },
            ],
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
                            'siteOgImageUrl'  => null,
                            'autoImageUrl'    => null,
                        ];
                    }

                    $meta = new Meta($kirby, $page);

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
                        // Images de repli de l'aperçu (même ordre que Meta::ogImage)
                        'siteOgImageUrl'  => $site->content()->get('og_image')->toFile()?->resize(1200)->url(),
                        'autoImageUrl'    => $page->images()->first()?->resize(1200)->url(),
                        // Champs de repli lus en direct par l'aperçu
                        'fallbacks'       => [
                            'title'       => $page->isHomePage() ? [] : $meta->fallbackFields('title'),
                            'description' => $meta->fallbackFields('description'),
                            'image'       => $meta->fallbackFields('image'),
                            'length'      => $kirby->option('rllngr.kirby-visibilizer.fallbacks.length', 160),
                        ],
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

        // Width of the shared image (og:image / twitter:image); null = original file
        'ogImageWidth' => 1200,

        // Page fields used when seo_title / seo_description / og_image are empty, per template ('*' = any):
        // 'description' => ['project' => 'introduction', '*' => ['intro', 'text']], 'image' => ['project' => 'cover']
        'fallbacks' => [
            'title'       => [],
            'description' => [],
            'image'       => [],
            'length'      => 160,
        ],

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

        // Texte alternatif de repli : requêtes Kirby, ex. '{{ page.title }} — {{ page.client }}, {{ page.city }} · {{ site.title }}'
        // `templates` : par template de la page parente ('site' pour les fichiers du site)
        'alt' => [
            'template'  => null,
            'templates' => [],
        ],

        // Vue SEO du Panel
        'panel' => [
            'access'   => true, // false, or a list of roles: ['admin', 'editor']
            'altField' => 'alt',
            'exclude'  => [
                'templates' => [],
                'pages'     => [],
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
