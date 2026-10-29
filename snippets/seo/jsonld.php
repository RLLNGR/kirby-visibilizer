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
$seo      = new \Rllngr\KirbyVisibilizer\Meta(kirby(), $model);

$schema ??= $seo->schema();
?>
<script type="application/ld+json"><?= json_encode($schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>
