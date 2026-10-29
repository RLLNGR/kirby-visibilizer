<?php
/**
 * kirby-visibilizer — JSON-LD snippet (Schema.org)
 *
 * Usage (at the end of <head> or before </body>):
 *   <?php snippet('seo/jsonld') ?>
 *
 * Pass an explicit model:
 *   <?php snippet('seo/jsonld', ['model' => $page]) ?>
 *
 * Pass custom schema data to merge or replace:
 *   <?php snippet('seo/jsonld', ['schema' => ['@type' => 'Article', ...]]) ?>
 */

/** @var \Kirby\Cms\Page|\Kirby\Cms\Site $model */
/** @var array|null $schema */
$model  ??= $page ?? site();
$schema ??= null;
$site     = site();
$seo      = new \Rllngr\KirbyVisibilizer\Meta(kirby(), $model);

if ($schema === null) {
    $schema = [
        '@context' => 'https://schema.org',
        '@type'    => $model instanceof \Kirby\Cms\Page ? 'WebPage' : 'WebSite',
        'name'     => $seo->ogTitle(),
        'url'      => $seo->canonical(),
    ];

    if ($desc = $seo->description()) {
        $schema['description'] = $desc;
    }

    if ($img = $seo->ogImage()) {
        $schema['image'] = $img;
    }

    // BreadcrumbList for inner pages
    if ($model instanceof \Kirby\Cms\Page) {
        $crumbs = [];
        $pos    = 1;

        foreach ($model->parents()->flip()->add($model) as $breadcrumb) {
            $crumbs[] = [
                '@type'    => 'ListItem',
                'position' => $pos++,
                'name'     => $breadcrumb->title()->value(),
                'item'     => $breadcrumb->url(),
            ];
        }

        if (count($crumbs) > 1) {
            $schema['breadcrumb'] = [
                '@type'           => 'BreadcrumbList',
                'itemListElement' => $crumbs,
            ];
        }
    }
}
?>
<script type="application/ld+json"><?= json_encode($schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>
