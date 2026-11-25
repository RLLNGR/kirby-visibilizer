<?php

namespace Rllngr\KirbyVisibilizer;

use Kirby\Form\Field\DisplayField;

/**
 * Aperçu SEO (Google, carte sociale, Twitter / X) et contrôles, lus en direct dans le formulaire.
 *
 * Kirby 6 n'a plus de sections personnalisées : l'aperçu est un champ sans valeur, rien n'est
 * enregistré. Les blueprints qui écrivent encore `type: seo-preview` dans `sections:` restent
 * valides, le plugin déclare la correspondance section → champ (index.php).
 */
class SeoPreviewField extends DisplayField
{
}
