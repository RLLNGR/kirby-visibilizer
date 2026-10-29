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
<title><?= esc($seo->title(), 'attr') ?></title>
<meta name="description" content="<?= esc($seo->description(), 'attr') ?>">
<meta name="robots" content="<?= esc($seo->robots(), 'attr') ?>">
<link rel="canonical" href="<?= esc($seo->canonical(), 'attr') ?>">

<!-- OpenGraph -->
<meta property="og:type" content="<?= esc($seo->ogType(), 'attr') ?>">
<meta property="og:title" content="<?= esc($seo->ogTitle(), 'attr') ?>">
<meta property="og:description" content="<?= esc($seo->ogDescription(), 'attr') ?>">
<meta property="og:url" content="<?= esc($seo->canonical(), 'attr') ?>">
<?php if ($ogImage = $seo->ogImage()): ?>
<meta property="og:image" content="<?= esc($ogImage, 'attr') ?>">
<meta property="og:image:alt" content="<?= esc($seo->ogImageAlt(), 'attr') ?>">
<?php endif ?>

<!-- Twitter / X Card -->
<meta name="twitter:card" content="<?= esc($seo->twitterCard(), 'attr') ?>">
<meta name="twitter:title" content="<?= esc($seo->ogTitle(), 'attr') ?>">
<meta name="twitter:description" content="<?= esc($seo->ogDescription(), 'attr') ?>">
<?php if ($twitterImage = $seo->twitterImage()): ?>
<meta name="twitter:image" content="<?= esc($twitterImage, 'attr') ?>">
<?php endif ?>

<?php foreach ($seo->hreflang() as $alt): ?>
<link rel="alternate" hreflang="<?= esc($alt['hreflang'], 'attr') ?>" href="<?= esc($alt['url'], 'attr') ?>">
<?php endforeach ?>
