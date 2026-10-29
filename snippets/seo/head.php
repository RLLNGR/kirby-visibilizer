<?php
/**
 * kirby-visibilizer — SEO head snippet
 *
 * Usage (in your layout <head>):
 *   <?php snippet('seo/head') ?>
 *
 * Pass an explicit model to override the current $page:
 *   <?php snippet('seo/head', ['model' => $page]) ?>
 */

/** @var \Kirby\Cms\Page|\Kirby\Cms\Site $model */
$model ??= $page ?? site();
$seo = new \Rllngr\KirbyVisibilizer\Meta(kirby(), $model);
?>
<title><?= esc($seo->title()) ?></title>
<meta name="description" content="<?= esc($seo->description()) ?>">
<meta name="robots" content="<?= esc($seo->robots()) ?>">
<link rel="canonical" href="<?= esc($seo->canonical()) ?>">

<!-- OpenGraph -->
<meta property="og:type" content="<?= esc($seo->ogType()) ?>">
<meta property="og:title" content="<?= esc($seo->ogTitle()) ?>">
<meta property="og:description" content="<?= esc($seo->ogDescription()) ?>">
<meta property="og:url" content="<?= esc($seo->canonical()) ?>">
<?php if ($ogImage = $seo->ogImage()): ?>
<meta property="og:image" content="<?= esc($ogImage) ?>">
<meta property="og:image:alt" content="<?= esc($seo->ogImageAlt()) ?>">
<?php if ($size = $seo->ogImageSize()): ?>
<meta property="og:image:width" content="<?= $size['width'] ?>">
<meta property="og:image:height" content="<?= $size['height'] ?>">
<?php endif ?>
<?php endif ?>

<!-- Twitter / X Card -->
<meta name="twitter:card" content="<?= esc($seo->twitterCard()) ?>">
<meta name="twitter:title" content="<?= esc($seo->ogTitle()) ?>">
<meta name="twitter:description" content="<?= esc($seo->ogDescription()) ?>">
<?php if ($twitterImage = $seo->twitterImage()): ?>
<meta name="twitter:image" content="<?= esc($twitterImage) ?>">
<?php endif ?>

<?php foreach ($seo->hreflang() as $alt): ?>
<link rel="alternate" hreflang="<?= esc($alt['hreflang']) ?>" href="<?= esc($alt['url']) ?>">
<?php endforeach ?>

<?php foreach ((new \Rllngr\KirbyVisibilizer\Icons(kirby()))->tags() as $tag): ?>
<<?= $tag['tag'] ?><?php foreach ($tag as $attr => $value): if ($attr === 'tag') continue ?> <?= $attr ?>="<?= esc($value) ?>"<?php endforeach ?>>
<?php endforeach ?>
