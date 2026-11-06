# Prompt d'installation — kirby-visibilizer

À coller dans une session Claude Code ouverte sur le site à équiper. Remplace les valeurs entre `<…>` si tu les connais, sinon laisse Claude les trouver.

---

Installe et configure le plugin **rllngr/kirby-visibilizer** (SEO + GEO pour Kirby 4 et 5) sur ce site. Lis d'abord son README (`site/plugins/kirby-visibilizer/README.md` une fois installé, ou https://github.com/rllngr/kirby-visibilizer) : il fait foi pour les noms d'options et de champs.

## 1. État des lieux (avant de toucher quoi que ce soit)

Montre-moi ce que tu trouves, sans rien modifier :

- les plugins SEO déjà en place (`tobimori/kirby-seo`, `rllngr/kirby-llmsizer`, autres) dans `composer.json` et `site/plugins/` ;
- comment le `<head>` est construit : snippets qui écrivent `<title>`, `description`, Open Graph, Twitter, favicon, JSON-LD ;
- les fichiers statiques à la racine qui masqueraient les routes du plugin : `robots.txt`, `sitemap.xml`, `favicon.ico`, `site.webmanifest`, `apple-touch-icon.png`… ;
- comment les images sont affichées (snippets, `alt`, plugin `kirby-thumbzer` et son snippet `srcset-img`) et quels templates passent un `alt` en dur ;
- les blueprints de pages et de site, `panel.menu` s'il existe, et le mode du site (classique ou headless).

Le `git status` peut contenir des changements qui ne sont pas les tiens (contenu, vendor, kirby) : ne les touche pas et ne les commite pas.

## 2. Installation

- `composer require rllngr/kirby-visibilizer` (et `composer update rllngr/kirby-thumbzer` si le site l'utilise : la 1.4.0 lit `altText()`).
- Retire `rllngr/kirby-llmsizer` s'il est là : ses champs et options `llms` ont les mêmes noms.
- Si le site vient de `tobimori/kirby-seo`, active `'compat' => ['kirby-seo' => true]` pour relire `metaTitle`, `metaDescription`, `ogTitle`, `ogImage`… sans migrer le contenu, puis retire le plugin de `composer.json`.

## 3. Blueprints

- Crée `site/blueprints/tabs/seo.yml` comme dans le Quick start du README (sections `sections/seo-preview` et `sections/seo`) et ajoute `seo: tabs/seo` à chaque blueprint de page à gérer. Pas sur `error` ni les pages techniques.
- Si `panel.menu` est défini dans la config, ajoute `'visibilizer'` à la liste.
- Retire les anciens onglets / champs du plugin SEO précédent des blueprints seulement après avoir vérifié que la compat les lit.

## 4. Templates (site classique)

- Dans le `<head>` : `snippet('seo/head')` et `snippet('seo/jsonld')`, et supprime les balises que ces snippets écrivent déjà (title, description, OG, Twitter, canonical, favicon, theme-color, ancien snippet du plugin SEO précédent).
- Si l'ancien snippet favicon doit rester tant que l'icône n'est pas choisie, garde-le mais fais-le sortir quand le plugin gère l'icône :
  `<?php if ((new \Rllngr\KirbyVisibilizer\Icons(kirby()))->enabled()) return; ?>`
- Images : `alt="<?= $image->altText()->esc() ?>"` partout. Un `alt` passé en dur à un snippet doit être un repli, jamais prioritaire sur le champ alt ou le texte généré.
- Supprime (ou signale-moi) les fichiers statiques de la racine qui portent le même nom qu'une route du plugin.

Site headless : suis la section *Headless mode* du README (`mode`, `siteUrl`, `seo: true` et `altText` dans KQL, routes du front).

## 5. Configuration (`site/config/config.php`)

Ne mets que ce qui diffère des valeurs par défaut (`mode`, `cache`, `titleSeparator`, `robots`… ont déjà de bonnes valeurs). Typiquement :

```php
'rllngr.kirby-visibilizer' => [
    'fallbacks' => [
        'description' => ['*' => ['<champ intro/description>']],
        'image'       => ['<template>' => '<champ image de couverture>'],
    ],
    'sitemap' => [
        'exclude' => ['templates' => ['error'], 'pages' => ['<mentions légales…>']],
    ],
    'alt' => [
        'template' => '{{ page.title }} · {{ site.title }}',
        // 'templates' => ['<template>' => '…'] seulement si différent du modèle général
    ],
    'llms' => [
        'sitemap'  => true,
        'exclude'  => ['templates' => ['error'], 'pages' => []],
        'sections' => [ /* une section par grande collection du site, cf. README */ ],
    ],
    // 'compat' => ['kirby-seo' => true],
    // 'panel'  => ['access' => ['admin']], // pour cacher la vue SEO au client
],
```

Choisis les champs de repli en lisant les blueprints réels, pas au hasard, et propose-moi le modèle d'alt avant de l'écrire.

## 6. Vérifications

- `/panel/seo` s'ouvre et les cartes affichent des scores (pas d'alerte « redirect » : sous MAMP, c'est PHP qui plante, il faut `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES` dans l'environnement de MAMP).
- Le source de l'accueil et d'une page intérieure contient un seul `<title>`, les `og:*`, le JSON-LD, et pas de doublons avec l'ancien `<head>`.
- `/sitemap.xml`, `/robots.txt` et `/llms.txt` répondent ; les pages exclues n'y sont pas.
- Quelques images ont un `alt` cohérent (champ rempli ou texte généré), y compris celles passées par thumbzer.
- `php -l` sur les fichiers PHP modifiés.

## 7. Compte rendu

Termine par la liste de ce que tu as changé, de ce qui reste à faire dans le Panel (à faire par moi) et de ce que tu n'as pas pu vérifier. Dans le Panel, il restera en général :

- SEO → Réglages : titre de l'accueil, description par défaut, image de partage, PNG de l'icône (≥ 512 px), textes llms.txt ;
- SEO → Images : relire les alts, « Remplir les textes vides » si besoin ;
- SEO → Liens : corriger les liens cassés.

Ne commite rien sans me le demander.
