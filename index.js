// GÉNÉRÉ par scripts/build-panel.mjs depuis src/panel.js — ne pas modifier ici, puis : npm run build
import { createCommentVNode as _createCommentVNode, toDisplayString as _toDisplayString, createElementVNode as _createElementVNode, createTextVNode as _createTextVNode, normalizeClass as _normalizeClass, renderList as _renderList, Fragment as _Fragment, openBlock as _openBlock, createElementBlock as _createElementBlock, normalizeStyle as _normalizeStyle, resolveComponent as _resolveComponent, withCtx as _withCtx, createBlock as _createBlock, createVNode as _createVNode, withModifiers as _withModifiers, withKeys as _withKeys, mergeProps as _mergeProps, vModelText as _vModelText, withDirectives as _withDirectives } from 'vue'
const worst = levels => (levels.includes('error') ? 'error' : levels.includes('warn') ? 'warn' : 'ok')
const STORE = 'visibilizer.fallbacks'

// Préférence gardée dans le navigateur (peut être indisponible : navigation privée, etc.)
const readPref = () => {
  try {
    return window.localStorage.getItem(STORE) !== '0'
  } catch (e) {
    return true
  }
}

// Champ « Aperçu SEO » des pages (aperçu Google / réseaux sociaux + contrôles), valeurs lues en direct.
const SeoPreview = {

  // -----------------------------------------------------------------------
  // Props (from blueprint YAML)
  // -----------------------------------------------------------------------

  props: {
    label:  { type: [String, Object], default: 'SEO Preview' },
    parent: String,
    // Hors d'une vue de page (onglet réglages) : valeurs et contexte fournis par le parent
    liveValues:  Object,
    liveContext: Object,
    initialTab:  { type: String, default: 'google' },
  },

  // -----------------------------------------------------------------------
  // Local state
  // -----------------------------------------------------------------------

  data() {
    return {
      fileUrls: {},
      tab: this.initialTab,
      ctx: this.liveContext || {
        siteTitle: '',
        pageTitle: '',
        pageUrl:   '',
        siteUrl:   '',
        separator: ' — ',
        titleSuffix: '',
        isHome:    false,
        homeTitle: '',
        siteDescription: '',
        siteOgImage: false,
        siteOgImageUrl: null,
        autoImageUrl: null,
        faviconUrl: null,
      },
    };
  },

  // -----------------------------------------------------------------------
  // Computed
  // -----------------------------------------------------------------------

  computed: {

    // Live field values (includes unsaved edits)
    values() {
      if (this.liveValues) return this.liveValues;
      try {
        return this.$panel.content.version('changes') || {};
      } catch {
        return {};
      }
    },

    // Repli lu en direct dans les champs de la page (fallbacks.title / fallbacks.description)
    fallbackTitle() {
      return this.fallbackText('title');
    },

    fallbackDescription() {
      return this.fallbackText('description');
    },

    titleSource() {
      if (this.values.seo_title) return 'custom';
      if (this.ctx.isHome) return this.ctx.homeTitle !== this.ctx.siteTitle ? 'custom' : 'default';
      return this.fallbackTitle ? 'field' : 'default';
    },

    descSource() {
      if (this.values.seo_description) return 'custom';
      if (this.fallbackDescription) return 'field';
      return this.ctx.siteDescription ? 'site' : 'none';
    },

    seoTitle() {
      if (this.ctx.isHome) return this.values.seo_title || this.ctx.homeTitle || '';
      return this.values.seo_title || this.fallbackTitle || this.ctx.pageTitle || '';
    },

    fullTitle() {
      const t = this.seoTitle;
      // Suffixe réellement utilisé côté PHP ; vide = titre de page seul, sans séparateur
      const s = this.ctx.titleSuffix !== undefined ? this.ctx.titleSuffix : this.ctx.siteTitle;
      if (this.ctx.isHome) return t || s || this.ctx.siteTitle;
      if (!t) return s || this.ctx.siteTitle;
      if (!s || t === s) return t;
      return `${t}${this.ctx.separator}${s}`;
    },

    seoDescription() {
      return this.values.seo_description || this.fallbackDescription || this.ctx.siteDescription || '';
    },

    ogTitle() {
      return this.values.og_title || this.seoTitle;
    },

    ogDescription() {
      return this.values.og_description || this.seoDescription;
    },

    hasOgImage() {
      const v = this.values.og_image;
      if (Array.isArray(v)) return v.length > 0;
      return !!(v && v.trim() && v.trim() !== '-');
    },

    // Image réellement partagée : champ de la page (valeur en direct), sinon image du site, sinon première image
    // Champ image de repli du template (fallbacks.image), lu en direct
    fallbackImageUrl() {
      for (const entry of this.ctx.fallbacks?.image || []) {
        // fonction de repli : URL calculée côté serveur
        const url = typeof entry === 'string' ? this.fileUrl(this.values[entry]) : entry?.url;
        if (url) return url;
      }
      return null;
    },

    ogImageUrl() {
      return this.fileUrl(this.values.og_image) || this.fallbackImageUrl || this.ctx.siteOgImageUrl || this.ctx.autoImageUrl || null;
    },

    // Icône du site : en direct dans les réglages (champ favicon), sinon celle générée
    faviconUrl() {
      return (this.liveValues && (this.fileUrl(this.values.icon_svg) || this.fileUrl(this.values.icon_png))) || this.ctx.faviconUrl || null;
    },

    twitterImageUrl() {
      return this.fileUrl(this.values.twitter_image) || this.ogImageUrl;
    },

    twitterCard() {
      return this.values.twitter_card || 'summary_large_image';
    },

    robots() {
      return this.values.seo_robots || 'index, follow';
    },

    isIndexed() {
      return !this.robots.includes('noindex');
    },

    displayDomain() {
      return (this.ctx.siteUrl || this.ctx.pageUrl || '')
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '');
    },

    displayPath() {
      const url  = this.ctx.pageUrl || this.ctx.siteUrl || '';
      const path = url.replace(/^https?:\/\/[^/]+/, '');
      return path || '/';
    },

    // --- Character counts ---

    titleLength() {
      return this.fullTitle.length;
    },

    descLength() {
      return this.seoDescription.length;
    },

    titleBar() {
      const pct = Math.min(100, (this.titleLength / 60) * 100);
      let color = '#3c8f47'; // ok
      if (this.titleLength > 60) color = '#cc3333';
      else if (this.titleLength < 30) color = '#cc8800';
      return { width: `${pct}%`, background: color };
    },

    descBar() {
      const pct = Math.min(100, (this.descLength / 160) * 100);
      let color = '#3c8f47';
      if (this.descLength > 160) color = '#cc3333';
      else if (this.descLength < 80 && this.descLength > 0) color = '#cc8800';
      else if (this.descLength === 0) color = '#cc3333';
      return { width: `${pct}%`, background: color };
    },

    // --- Checks (mêmes seuils que la vue SEO, src/Audit.php) ---

    checks() {
      const items = [];
      const t = (key, data) => this.$t('visibilizer.preview.' + key, data);
      // Valeur de repli : simple information si on compte les valeurs par défaut
      const fallback = readPref() ? 'info' : 'warn';

      // Title
      const tl = this.titleLength;
      if (tl > 70) items.push({ status: 'error', msg: t('title.long', { length: tl }) });
      else if (tl < 15) items.push({ status: 'error', msg: t('title.short', { length: tl }) });
      else if (tl > 60) items.push({ status: 'warn', msg: t('title.longish', { length: tl }) });
      else if (tl < 30) items.push({ status: 'warn', msg: t('title.shortish', { length: tl }) });
      else items.push({ status: 'ok', msg: t('title.ok', { length: tl }) });
      if (this.titleSource !== 'custom') {
        items.push({ status: fallback, msg: t('title.' + this.titleSource, { field: this.fallbackNames('title') }) });
      }

      // Description
      const dl = this.descLength;
      if (this.descSource === 'none') {
        items.push({ status: 'error', msg: t('desc.missing') });
      } else {
        if (dl > 200) items.push({ status: 'error', msg: t('desc.long', { length: dl }) });
        else if (dl < 30) items.push({ status: 'error', msg: t('desc.short', { length: dl }) });
        else if (dl > 160) items.push({ status: 'warn', msg: t('desc.longish', { length: dl }) });
        else if (dl < 70) items.push({ status: 'warn', msg: t('desc.shortish', { length: dl }) });
        else items.push({ status: 'ok', msg: t('desc.ok', { length: dl }) });
        if (this.descSource !== 'custom') {
          items.push({ status: fallback, msg: t('desc.' + this.descSource, { field: this.fallbackNames('description') }) });
        }
      }

      // OG image
      if (!this.hasOgImage && this.fallbackImageUrl) {
        items.push({ status: fallback, msg: t('image.field', { field: this.fallbackNames('image') }) });
      } else if (!this.hasOgImage && this.ctx.siteOgImage) {
        items.push({ status: fallback, msg: t('image.site') });
      } else if (!this.hasOgImage && this.ctx.autoImageUrl) {
        items.push({ status: fallback, msg: t('image.auto') });
      } else if (!this.hasOgImage) {
        items.push({ status: 'warn', msg: t('image.missing') });
      } else {
        items.push({ status: 'ok', msg: t('image.ok') });
      }

      // Robots
      items.push({ status: this.isIndexed ? 'ok' : 'warn', msg: `Robots : ${this.robots}` });

      return items;
    },

    score() {
      const counted = this.checks.filter(c => c.status !== 'info');
      const ok = counted.filter(c => c.status === 'ok').length;
      return counted.length ? Math.round((ok / counted.length) * 100) : 0;
    },

    scoreLabel() {
      if (this.score >= 75) return this.$t('visibilizer.preview.score.good');
      if (this.score >= 50) return this.$t('visibilizer.preview.score.average');
      return this.$t('visibilizer.preview.score.poor');
    },

    scoreClass() {
      if (this.score >= 75) return 'ok';
      if (this.score >= 50) return 'warn';
      return 'error';
    },

    resolvedLabel() {
      const l = this.label;
      if (typeof l === 'string') return l;
      const lang = document.documentElement.lang || 'en';
      return l[lang] || l.en || Object.values(l)[0] || 'SEO Preview';
    },
  },

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async created() {
    if (this.liveContext) return;
    await this.loadContext();
  },

  // -----------------------------------------------------------------------
  // Methods
  // -----------------------------------------------------------------------

  methods: {
    // Champ fichiers : Kirby 6 ne garde que des UUID dans les valeurs en direct (« file://… ») ;
    // l'adresse est demandée une fois au serveur, puis gardée.
    fileUrl(value) {
      const first = Array.isArray(value) ? value[0] : null;
      if (!first) return null;
      if (typeof first === 'object') return first.image?.url || first.url || null;
      if (!(first in this.fileUrls)) {
        this.fileUrls[first] = null;
        this.$api
          .get('rllngr/visibilizer-file', { id: first })
          .then(res => (this.fileUrls[first] = res?.url || null))
          .catch(() => {});
      }
      return this.fileUrls[first];
    },

    // Noms des replis pour les messages ; une fonction n'a pas de nom de champ
    fallbackNames(type) {
      return (this.ctx.fallbacks?.[type] || []).map(entry => typeof entry === 'string' ? entry : 'auto').join(', ');
    },

    // Texte brut (le champ peut contenir du HTML), coupé comme Str::excerpt côté PHP
    fallbackText(type) {
      const max = type === 'title' ? 60 : (this.ctx.fallbacks?.length || 160);
      for (const entry of this.ctx.fallbacks?.[type] || []) {
        // fonction de repli : texte déjà calculé (et coupé) côté serveur
        if (typeof entry !== 'string') {
          if (entry?.value) return entry.value;
          continue;
        }
        const raw = this.values[entry];
        if (typeof raw !== 'string' || !raw.trim()) continue;
        const el = document.createElement('div');
        el.innerHTML = raw.replace(/<br\s*\/?>|<\/(p|li|h[1-6]|div|blockquote|figcaption|td)>/gi, ' $&');
        const text = el.textContent.replace(/\s+/g, ' ').trim();
        if (!text) continue;
        if (text.length <= max) return text;
        const cut = text.slice(0, max);
        return cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : max).trim() + ' …';
      }
      return '';
    },

    async loadContext() {
      try {
        // e.g. "pages/projects+hospitality" or "site"
        const parent = this.parent || this.$panel?.view?.props?.api || '';
        const match  = parent.replace(/^\//, '').match(/^pages\/(.+)$/);
        const slug   = match ? match[1].replace(/\//g, '+') : 'site';
        const data = await this.$api.get(`rllngr/visibilizer/${slug}`);
        if (data) this.ctx = data;
      } catch {
        /* silent */
      }
    },
  },

  // -----------------------------------------------------------------------
  // Template
  // -----------------------------------------------------------------------

  render: (() => {
function render(_ctx, _cache) {
  const _component_k_field = _resolveComponent("k-field")

  return (_openBlock(), _createBlock(_component_k_field, {
    label: _ctx.resolvedLabel,
    input: false,
    class: "k-seo-preview-field"
  }, {
    default: _withCtx(() => [
      _createElementVNode("div", { class: "vis-preview" }, [
        _createCommentVNode(" Score badge "),
        _createElementVNode("div", {
          class: _normalizeClass(["vis-score", 'vis-score--' + _ctx.scoreClass])
        }, [
          _createElementVNode("span", { class: "vis-score-number" }, [
            _createTextVNode(_toDisplayString(_ctx.score), 1 /* TEXT */),
            _createElementVNode("small", null, "%")
          ]),
          _createElementVNode("span", { class: "vis-score-label" }, _toDisplayString(_ctx.scoreLabel), 1 /* TEXT */)
        ], 2 /* CLASS */),
        _createCommentVNode(" Tabs "),
        _createElementVNode("div", { class: "vis-tabs" }, [
          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList([['google','Google'],['social',_ctx.$t('visibilizer.preview.tab.social')],['twitter','Twitter / X']], (t) => {
            return (_openBlock(), _createElementBlock("button", {
              key: t[0],
              class: _normalizeClass(['vis-tab', _ctx.tab === t[0] && 'vis-tab--active']),
              onClick: $event => (_ctx.tab = t[0])
            }, _toDisplayString(t[1]), 11 /* TEXT, CLASS, PROPS */, ["onClick"]))
          }), 128 /* KEYED_FRAGMENT */))
        ]),
        _createCommentVNode(" Google SERP preview "),
        (_ctx.tab === 'google')
          ? (_openBlock(), _createElementBlock("div", {
              key: 0,
              class: "vis-google"
            }, [
              _createElementVNode("div", { class: "vis-google-header" }, [
                _createElementVNode("div", {
                  class: _normalizeClass(["vis-google-favicon", { 'vis-has-icon': _ctx.faviconUrl }])
                }, [
                  (_ctx.faviconUrl)
                    ? (_openBlock(), _createElementBlock("img", {
                        key: 0,
                        src: _ctx.faviconUrl,
                        alt: ""
                      }, null, 8 /* PROPS */, ["src"]))
                    : (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                        _createTextVNode("G")
                      ], 64 /* STABLE_FRAGMENT */))
                ], 2 /* CLASS */),
                _createElementVNode("div", null, [
                  _createElementVNode("div", { class: "vis-google-site" }, _toDisplayString(_ctx.ctx.siteTitle), 1 /* TEXT */),
                  _createElementVNode("div", { class: "vis-google-url" }, _toDisplayString(_ctx.displayDomain) + _toDisplayString(_ctx.displayPath), 1 /* TEXT */)
                ])
              ]),
              _createElementVNode("div", {
                class: _normalizeClass(["vis-google-title", _ctx.titleLength > 60 ? 'vis-truncated' : ''])
              }, _toDisplayString(_ctx.fullTitle || _ctx.$t('visibilizer.preview.placeholder.title')), 3 /* TEXT, CLASS */),
              _createElementVNode("div", { class: "vis-google-desc" }, _toDisplayString(_ctx.seoDescription || _ctx.$t('visibilizer.preview.placeholder.description')), 1 /* TEXT */),
              _createElementVNode("div", { class: "vis-char-row" }, [
                _createElementVNode("span", { class: "vis-char-label" }, _toDisplayString(_ctx.$t('visibilizer.preview.chars.title')), 1 /* TEXT */),
                _createElementVNode("div", { class: "vis-char-bar" }, [
                  _createElementVNode("div", {
                    class: "vis-char-fill",
                    style: _normalizeStyle(_ctx.titleBar)
                  }, null, 4 /* STYLE */)
                ]),
                _createElementVNode("span", {
                  class: _normalizeClass(["vis-char-count", _ctx.titleLength > 60 ? 'vis-over' : ''])
                }, _toDisplayString(_ctx.titleLength) + "/60", 3 /* TEXT, CLASS */)
              ]),
              _createElementVNode("div", { class: "vis-char-row" }, [
                _createElementVNode("span", { class: "vis-char-label" }, _toDisplayString(_ctx.$t('visibilizer.preview.chars.description')), 1 /* TEXT */),
                _createElementVNode("div", { class: "vis-char-bar" }, [
                  _createElementVNode("div", {
                    class: "vis-char-fill",
                    style: _normalizeStyle(_ctx.descBar)
                  }, null, 4 /* STYLE */)
                ]),
                _createElementVNode("span", {
                  class: _normalizeClass(["vis-char-count", _ctx.descLength > 160 ? 'vis-over' : ''])
                }, _toDisplayString(_ctx.descLength) + "/160", 3 /* TEXT, CLASS */)
              ])
            ]))
          : _createCommentVNode("v-if", true),
        _createCommentVNode(" OG / Social card "),
        (_ctx.tab === 'social')
          ? (_openBlock(), _createElementBlock("div", {
              key: 1,
              class: "vis-og"
            }, [
              _createElementVNode("div", {
                class: _normalizeClass(["vis-og-image", !_ctx.ogImageUrl ? 'vis-og-image--empty' : ''])
              }, [
                (_ctx.ogImageUrl)
                  ? (_openBlock(), _createElementBlock("img", {
                      key: 0,
                      src: _ctx.ogImageUrl,
                      alt: ""
                    }, null, 8 /* PROPS */, ["src"]))
                  : (_openBlock(), _createElementBlock("span", {
                      key: 1,
                      class: "vis-og-placeholder"
                    }, _toDisplayString(_ctx.$t('visibilizer.preview.placeholder.ogimage')), 1 /* TEXT */))
              ], 2 /* CLASS */),
              _createElementVNode("div", { class: "vis-og-body" }, [
                _createElementVNode("div", { class: "vis-og-domain" }, [
                  (_ctx.faviconUrl)
                    ? (_openBlock(), _createElementBlock("img", {
                        key: 0,
                        class: "vis-domain-icon",
                        src: _ctx.faviconUrl,
                        alt: ""
                      }, null, 8 /* PROPS */, ["src"]))
                    : _createCommentVNode("v-if", true),
                  _createTextVNode(" " + _toDisplayString(_ctx.displayDomain.split('/')[0].toUpperCase()), 1 /* TEXT */)
                ]),
                _createElementVNode("div", { class: "vis-og-title" }, _toDisplayString(_ctx.ogTitle || _ctx.$t('visibilizer.preview.placeholder.title')), 1 /* TEXT */),
                _createElementVNode("div", { class: "vis-og-desc" }, _toDisplayString(_ctx.ogDescription || _ctx.$t('visibilizer.preview.placeholder.description')), 1 /* TEXT */)
              ])
            ]))
          : _createCommentVNode("v-if", true),
        _createCommentVNode(" Twitter / X card "),
        (_ctx.tab === 'twitter')
          ? (_openBlock(), _createElementBlock("div", {
              key: 2,
              class: "vis-twitter"
            }, [
              _createElementVNode("div", {
                class: _normalizeClass(["vis-twitter-image", !_ctx.twitterImageUrl ? 'vis-twitter-image--empty' : ''])
              }, [
                (_ctx.twitterImageUrl)
                  ? (_openBlock(), _createElementBlock("img", {
                      key: 0,
                      src: _ctx.twitterImageUrl,
                      alt: ""
                    }, null, 8 /* PROPS */, ["src"]))
                  : (_openBlock(), _createElementBlock("span", {
                      key: 1,
                      class: "vis-og-placeholder"
                    }, _toDisplayString(_ctx.$t('visibilizer.preview.placeholder.image')), 1 /* TEXT */))
              ], 2 /* CLASS */),
              _createElementVNode("div", { class: "vis-twitter-body" }, [
                _createElementVNode("div", { class: "vis-twitter-title" }, _toDisplayString(_ctx.ogTitle || _ctx.$t('visibilizer.preview.placeholder.title')), 1 /* TEXT */),
                _createElementVNode("div", { class: "vis-twitter-desc" }, _toDisplayString(_ctx.ogDescription || _ctx.$t('visibilizer.preview.placeholder.description')), 1 /* TEXT */),
                _createElementVNode("div", {
                  class: _normalizeClass(["vis-twitter-domain", { 'vis-has-icon': _ctx.faviconUrl }])
                }, [
                  (_ctx.faviconUrl)
                    ? (_openBlock(), _createElementBlock("img", {
                        key: 0,
                        class: "vis-domain-icon",
                        src: _ctx.faviconUrl,
                        alt: ""
                      }, null, 8 /* PROPS */, ["src"]))
                    : _createCommentVNode("v-if", true),
                  _createTextVNode(" " + _toDisplayString(_ctx.displayDomain.split('/')[0]), 1 /* TEXT */)
                ], 2 /* CLASS */)
              ])
            ]))
          : _createCommentVNode("v-if", true),
        _createCommentVNode(" Checks "),
        _createElementVNode("ul", { class: "vis-checks" }, [
          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.checks, (c, i) => {
            return (_openBlock(), _createElementBlock("li", {
              key: i,
              class: _normalizeClass(['vis-check', 'vis-check--' + c.status])
            }, [
              _createElementVNode("span", { class: "vis-check-icon" }, [
                (c.status === 'ok')
                  ? (_openBlock(), _createElementBlock("span", { key: 0 }, "✓"))
                  : (c.status === 'warn')
                    ? (_openBlock(), _createElementBlock("span", { key: 1 }, "⚠"))
                    : (c.status === 'info')
                      ? (_openBlock(), _createElementBlock("span", { key: 2 }, "i"))
                      : (_openBlock(), _createElementBlock("span", { key: 3 }, "✗"))
              ]),
              _createTextVNode(" " + _toDisplayString(c.msg), 1 /* TEXT */)
            ], 2 /* CLASS */))
          }), 128 /* KEYED_FRAGMENT */))
        ])
      ])
    ]),
    _: 1 /* STABLE */
  }, 8 /* PROPS */, ["label"]))
}
return render
})(),
};

// -----------------------------------------------------------------------------
// Vue SEO du Panel — données calculées en PHP (src/Audit.php), passées en props par la zone `visibilizer`.
// Habillage de moniter : crème, barres d'encre en minuscules, blocs blancs, pastilles.
// -----------------------------------------------------------------------------

const TABS = ['pages', 'images', 'links']
const LEVELS = ['error', 'warn', 'ok']
const BATCH = 5

// Une carte par famille de contrôles, avec sa couleur de pastille et l'onglet qu'elle ouvre
const CARDS = [
  { key: 'titles', tab: 'pages' },
  { key: 'descriptions', tab: 'pages' },
  { key: 'alts', tab: 'images' },
  { key: 'links', tab: 'links' },
]

// Couleur de témoin, mêmes seuils que l'aperçu : vert, orange, rouge ; bleu tant qu'il n'y a rien à juger
const scoreColor = score => (score === null ? 'blue' : score >= 75 ? 'green' : score >= 50 ? 'orange' : 'red')

const count = (items, level) => items.filter(l => l === level).length

// Onglets Images et Liens : regroupés par page (défaut) ou en liste, choix gardé dans le navigateur
const GROUPED = ['images', 'links']
const readMode = tab => {
  try {
    return window.localStorage.getItem('visibilizer.' + tab) === 'list' ? 'list' : 'pages'
  } catch (e) {
    return 'pages'
  }
}

// Niveau d'un lien : celui de sa vérification, « pending » tant qu'il n'est pas vérifié
const linkLevel = link => (link.result ? link.result.level : 'pending')

// Lignes affichées d'un coup dans les tableaux, puis « afficher plus »
const LIMIT = 100

const altLevel = image => (image.alt ? 'ok' : image.generated ? 'warn' : 'error')

// Tiroir « images de la page » : un champ texte alternatif par image, enregistré en quittant le champ
const AltsDrawer = {
  props: {
    // Props de k-drawer
    current: { default: true, type: Boolean },
    icon: String,
    id: String,
    options: Array,
    size: { default: 'large', type: String },
    title: String,
    visible: { default: false, type: Boolean },

    page: Object,
    images: Array,
    only: Boolean,
    // Prévient la vue de chaque enregistrement : une prop plutôt qu'un événement, car Kirby retire
    // les écouteurs du tiroir dès sa fermeture, alors qu'un enregistrement peut finir après
    onSaved: { type: Function, default: () => {} },
  },
  emits: ['cancel', 'submit'],
  data() {
    return {
      items: this.images.map(i => ({ ...i })),
      drafts: Object.fromEntries(this.images.map(i => [i.id, i.alt])),
      saving: {},
      done: {},
      filling: false,
      // Images sans texte au moment du filtre : elles restent affichées une fois remplies
      pinned: this.only ? this.images.filter(i => !i.alt).map(i => i.id) : null,
    }
  },
  computed: {
    shown() {
      return this.pinned ? this.items.filter(i => this.pinned.includes(i.id)) : this.items
    },
    missing() {
      return this.items.filter(i => !i.alt).length
    },
    fillable() {
      return this.items.filter(i => !i.alt && i.generated).length
    },
  },
  methods: {
    level: altLevel,
    heavy(item) {
      return item.issues.some(i => i.key === 'image_heavy')
    },
    toggleOnly() {
      this.pinned = this.pinned ? null : this.items.filter(i => !i.alt).map(i => i.id)
    },
    replace(rows) {
      for (const row of rows) {
        const n = this.items.findIndex(i => i.id === row.id)
        if (n === -1) continue
        this.items[n] = row
        this.drafts[row.id] = row.alt
      }
      this.onSaved(rows)
    },
    // Fermeture du tiroir alors qu'un champ a encore le focus : le blur n'arrive pas toujours
    flush() {
      for (const item of this.items) this.save(item)
    },
    async save(item) {
      const value = (this.drafts[item.id] || '').trim()
      if (value === item.alt || this.saving[item.id]) return
      this.saving[item.id] = true
      try {
        const row = await this.$api.post('rllngr/visibilizer-audit/alt', { id: item.id, alt: value })
        this.replace([row])
        this.done[item.id] = true
      } catch (e) {
        this.$panel.notification.error(e)
      } finally {
        this.saving[item.id] = false
      }
    },
    useGenerated(item) {
      this.drafts[item.id] = item.generated
      this.save(item)
    },
    // Entrée : enregistre et passe à l'image suivante (Maj + Entrée pour un retour à la ligne)
    next(event) {
      const li = event.target.closest('li')
      event.target.blur()
      li?.nextElementSibling?.querySelector('textarea')?.focus()
    },
    async fill() {
      this.filling = true
      try {
        const res = await this.$api.post('rllngr/visibilizer-audit/alts', { parent: this.page.id })
        this.replace(res.rows)
        this.$panel.notification.success(this.$t('visibilizer.fill.done', { count: res.done }))
      } catch (e) {
        this.$panel.notification.error(e)
      } finally {
        this.filling = false
      }
    },
  },
  watch: {
    visible(visible) {
      if (!visible) this.flush()
    },
  },
  beforeUnmount() {
    this.flush()
  },
  render: (() => {
function render(_ctx, _cache) {
  const _component_k_button = _resolveComponent("k-button")
  const _component_k_link = _resolveComponent("k-link")
  const _component_k_drawer = _resolveComponent("k-drawer")

  return (_openBlock(), _createBlock(_component_k_drawer, _mergeProps(_ctx.$props, {
    class: "k-vis-alts-drawer",
    onCancel: _cache[1] || (_cache[1] = $event => (_ctx.$emit('cancel'))),
    onSubmit: _cache[2] || (_cache[2] = $event => (_ctx.$emit('submit')))
  }), {
    options: _withCtx(() => [
      (_ctx.fillable)
        ? (_openBlock(), _createBlock(_component_k_button, {
            key: 0,
            class: "k-drawer-option",
            icon: "wand",
            text: _ctx.$t('visibilizer.fill') + ' (' + _ctx.fillable + ')',
            disabled: _ctx.filling,
            onClick: _ctx.fill
          }, null, 8 /* PROPS */, ["text", "disabled", "onClick"]))
        : _createCommentVNode("v-if", true),
      _createVNode(_component_k_button, {
        class: "k-drawer-option",
        icon: "filter",
        theme: _ctx.pinned ? 'notice' : null,
        text: _ctx.$t('visibilizer.alts.only'),
        disabled: !_ctx.pinned && !_ctx.missing,
        onClick: _ctx.toggleOnly
      }, null, 8 /* PROPS */, ["theme", "text", "disabled", "onClick"]),
      _createVNode(_component_k_button, {
        class: "k-drawer-option",
        icon: "edit",
        link: _ctx.page.panel,
        title: _ctx.$t('visibilizer.open.panel')
      }, null, 8 /* PROPS */, ["link", "title"])
    ]),
    default: _withCtx(() => [
      _createElementVNode("p", { class: "k-vis-alts-summary" }, [
        _createTextVNode(_toDisplayString(_ctx.$t('visibilizer.alts.summary', { count: _ctx.items.length, missing: _ctx.missing })) + " ", 1 /* TEXT */),
        _createElementVNode("span", { class: "k-vis-alts-path" }, _toDisplayString(_ctx.page.path), 1 /* TEXT */)
      ]),
      (!_ctx.shown.length)
        ? (_openBlock(), _createElementBlock("p", {
            key: 0,
            class: "k-vis-alts-empty"
          }, _toDisplayString(_ctx.$t('visibilizer.empty.filter')), 1 /* TEXT */))
        : _createCommentVNode("v-if", true),
      _createElementVNode("ul", { class: "k-vis-alts" }, [
        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.shown, (item) => {
          return (_openBlock(), _createElementBlock("li", {
            key: item.id,
            "data-level": _ctx.level(item)
          }, [
            _createElementVNode("a", {
              href: item.url,
              target: "_blank",
              rel: "noopener",
              class: "k-vis-alts-thumb",
              title: _ctx.$t('visibilizer.open.site')
            }, [
              (item.thumb)
                ? (_openBlock(), _createElementBlock("img", {
                    key: 0,
                    src: item.thumb,
                    alt: "",
                    loading: "lazy"
                  }, null, 8 /* PROPS */, ["src"]))
                : _createCommentVNode("v-if", true)
            ], 8 /* PROPS */, ["href", "title"]),
            _createElementVNode("div", { class: "k-vis-alts-body" }, [
              _createElementVNode("div", { class: "k-vis-alts-head" }, [
                _createElementVNode("span", {
                  class: "k-vis-dot",
                  "data-level": _ctx.level(item)
                }, null, 8 /* PROPS */, ["data-level"]),
                _createVNode(_component_k_link, {
                  to: item.panel,
                  class: "k-vis-alts-name"
                }, {
                  default: _withCtx(() => [
                    _createTextVNode(_toDisplayString(item.filename), 1 /* TEXT */)
                  ]),
                  _: 2 /* DYNAMIC */
                }, 1032 /* PROPS, DYNAMIC_SLOTS */, ["to"]),
                _createElementVNode("span", {
                  class: "k-vis-alts-meta",
                  "data-heavy": _ctx.heavy(item) ? 'true' : null
                }, _toDisplayString(item.niceSize) + " · " + _toDisplayString(item.width) + " × " + _toDisplayString(item.height), 9 /* TEXT, PROPS */, ["data-heavy"])
              ]),
              _createElementVNode("textarea", {
                rows: "2",
                value: _ctx.drafts[item.id],
                placeholder: item.generated || _ctx.$t('visibilizer.alts.placeholder'),
                onInput: $event => {_ctx.drafts[item.id] = $event.target.value; _ctx.done[item.id] = false},
                onBlur: $event => (_ctx.save(item)),
                onKeydown: _cache[0] || (_cache[0] = _withKeys(_withModifiers((...args) => (_ctx.next && _ctx.next(...args)), ["exact","prevent"]), ["enter"]))
              }, null, 40 /* PROPS, NEED_HYDRATION */, ["value", "placeholder", "onInput", "onBlur"]),
              _createElementVNode("div", { class: "k-vis-alts-foot" }, [
                (!_ctx.drafts[item.id] && item.generated)
                  ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      type: "button",
                      class: "k-vis-alts-use",
                      onClick: $event => (_ctx.useGenerated(item))
                    }, _toDisplayString(_ctx.$t('visibilizer.alts.use')), 9 /* TEXT, PROPS */, ["onClick"]))
                  : _createCommentVNode("v-if", true),
                (_ctx.saving[item.id])
                  ? (_openBlock(), _createElementBlock("span", { key: 1 }, _toDisplayString(_ctx.$t('visibilizer.settings.saving')), 1 /* TEXT */))
                  : (_ctx.done[item.id])
                    ? (_openBlock(), _createElementBlock("span", {
                        key: 2,
                        "data-level": "ok"
                      }, _toDisplayString(_ctx.$t('visibilizer.alts.saved')), 1 /* TEXT */))
                    : _createCommentVNode("v-if", true)
              ])
            ])
          ], 8 /* PROPS */, ["data-level"]))
        }), 128 /* KEYED_FRAGMENT */))
      ])
    ]),
    _: 1 /* STABLE */
  }, 16 /* FULL_PROPS */))
}
return render
})(),
}

// Tiroir « liens de la page » : leur état, lu en direct dans la vue (la vérification peut être en cours)
const LinksDrawer = {
  props: {
    // Props de k-drawer
    current: { default: true, type: Boolean },
    icon: String,
    id: String,
    options: Array,
    size: { default: 'large', type: String },
    title: String,
    visible: { default: false, type: Boolean },

    page: Object,
    // Fonctions de la vue : les liens de la page, le texte d'état d'un lien
    links: Function,
    detail: Function,
  },
  emits: ['cancel', 'submit'],
  computed: {
    rows() {
      return this.links()
    },
    broken() {
      return this.rows.filter(l => linkLevel(l) === 'error').length
    },
  },
  methods: {
    level: linkLevel,
  },
  render: (() => {
function render(_ctx, _cache) {
  const _component_k_button = _resolveComponent("k-button")
  const _component_k_drawer = _resolveComponent("k-drawer")

  return (_openBlock(), _createBlock(_component_k_drawer, _mergeProps(_ctx.$props, {
    class: "k-vis-alts-drawer",
    onCancel: _cache[0] || (_cache[0] = $event => (_ctx.$emit('cancel'))),
    onSubmit: _cache[1] || (_cache[1] = $event => (_ctx.$emit('submit')))
  }), {
    options: _withCtx(() => [
      _createVNode(_component_k_button, {
        class: "k-drawer-option",
        icon: "edit",
        link: _ctx.page.panel,
        title: _ctx.$t('visibilizer.open.panel')
      }, null, 8 /* PROPS */, ["link", "title"])
    ]),
    default: _withCtx(() => [
      _createElementVNode("p", { class: "k-vis-alts-summary" }, [
        _createTextVNode(_toDisplayString(_ctx.$t('visibilizer.links.summary', { count: _ctx.rows.length, broken: _ctx.broken })) + " ", 1 /* TEXT */),
        _createElementVNode("span", { class: "k-vis-alts-path" }, _toDisplayString(_ctx.page.path), 1 /* TEXT */)
      ]),
      _createElementVNode("ul", { class: "k-vis-alts k-vis-links" }, [
        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.rows, (row) => {
          return (_openBlock(), _createElementBlock("li", {
            key: row.href,
            "data-level": _ctx.level(row)
          }, [
            _createElementVNode("div", { class: "k-vis-alts-body" }, [
              _createElementVNode("div", { class: "k-vis-alts-head" }, [
                _createElementVNode("span", {
                  class: "k-vis-dot",
                  "data-level": _ctx.level(row)
                }, null, 8 /* PROPS */, ["data-level"]),
                _createElementVNode("a", {
                  href: row.result && row.result.internal ? row.label : row.href,
                  target: "_blank",
                  rel: "noopener",
                  class: "k-vis-alts-name",
                  title: row.href
                }, _toDisplayString(row.label), 9 /* TEXT, PROPS */, ["href", "title"]),
                _createElementVNode("span", { class: "k-vis-alts-meta" }, _toDisplayString(row.result && row.result.code ? row.result.code : '—'), 1 /* TEXT */)
              ]),
              _createElementVNode("div", { class: "k-vis-alts-foot" }, [
                _createElementVNode("span", null, _toDisplayString(_ctx.$t(row.internal ? 'visibilizer.internal' : 'visibilizer.external')) + " · " + _toDisplayString(_ctx.detail(row)), 1 /* TEXT */),
                (row.from.length > 1)
                  ? (_openBlock(), _createElementBlock("span", { key: 0 }, _toDisplayString(_ctx.$t('visibilizer.links.elsewhere', { count: row.from.length - 1 })), 1 /* TEXT */))
                  : _createCommentVNode("v-if", true)
              ])
            ])
          ], 8 /* PROPS */, ["data-level"]))
        }), 128 /* KEYED_FRAGMENT */))
      ])
    ]),
    _: 1 /* STABLE */
  }, 16 /* FULL_PROPS */))
}
return render
})(),
}

const SeoView = {
  props: {
    tab: String,
    pages: Array,
    images: Array,
    links: Array,
    settings: Object,
  },
  data() {
    return {
      current: this.tab || 'pages',
      level: 'all',
      query: '',
      open: {},
      results: {},
      failed: {},
      checking: null,
      fallbacks: readPref(),
      form: { ...this.settings.values },
      saving: false,
      modes: Object.fromEntries(GROUPED.map(tab => [tab, readMode(tab)])),
      expanded: {},
      saved: {},
      limit: LIMIT,
      step: LIMIT,
    }
  },
  computed: {
    // Images, avec les textes enregistrés depuis le tiroir sans recharger la vue
    imageRows() {
      return this.images.map(i => this.saved[i.id] || i)
    },
    linkRows() {
      return this.links.map(l => ({ ...l, result: this.results[l.href] || l.result }))
    },
    // Niveau de chaque élément, par carte (null = lien externe pas encore vérifié)
    levels() {
      return {
        titles: this.pages.map(p => this.checkLevel(p.checks.title)),
        descriptions: this.pages.map(p => this.checkLevel(p.checks.description)),
        alts: this.imageRows.map(i => this.issuesLevel(i.issues.filter(x => x.key.startsWith('alt_')))),
        links: this.linkRows.map(l => (l.result ? l.result.level : null)),
      }
    },
    cards() {
      return CARDS.map(card => {
        const levels = this.levels[card.key]
        const counts = { ok: count(levels, 'ok'), warn: count(levels, 'warn'), error: count(levels, 'error'), pending: count(levels, null) }
        const done = counts.ok + counts.warn + counts.error
        const score = done ? Math.round(((counts.ok + counts.warn * 0.5) / done) * 100) : null
        const prefix = card.key === 'links' ? 'links.' : card.key === 'alts' ? 'alts.' : ''
        const legend = ['ok', 'warn', 'error', 'pending']
          .filter(l => counts[l])
          .map(l => ({ level: l, text: this.countText('visibilizer.count.' + (l === 'pending' ? 'links.' + (this.checking ? 'pending' : 'unchecked') : prefix + l), counts[l]) }))
        return {
          ...card,
          color: scoreColor(score),
          counts,
          total: levels.length,
          legend,
          text: score === null ? '—' : String(score),
          unit: score === null ? '' : '%',
          segments: ['ok', 'warn', 'error', 'pending'].map(l => ({ level: l, width: levels.length ? (counts[l] / levels.length) * 100 : 0 })),
        }
      })
    },
    tabs() {
      return TABS.map(key => ({ key, count: this.source(key).length, errors: this.source(key).filter(r => this.levelOf(r) === 'error').length }))
        .concat([{ key: 'settings', count: null }])
    },
    // Champs du formulaire de réglages, branchés sur l'API du plugin (pas sur /site/fields, absents du blueprint)
    settingsFields() {
      const fields = {}
      for (const [name, field] of Object.entries(this.settings.fields)) {
        fields[name] = {
          ...field,
          disabled: field.disabled || !this.settings.editable,
          endpoints: { field: 'rllngr/visibilizer-settings/fields/' + name, section: null, model: 'site' },
        }
      }
      return fields
    },
    // Un groupe par titre ; le premier (valeurs par défaut) a l'aperçu à sa gauche, comme l'onglet SEO des pages
    settingsGroups() {
      const groups = []
      for (const [name, field] of Object.entries(this.settingsFields)) {
        if (field.type === 'headline' || !groups.length) groups.push({ key: name, fields: {} })
        groups[groups.length - 1].fields[name] = field
      }
      return groups
    },
    previewContext() {
      const c = this.settings.context
      return {
        siteTitle: c.siteTitle,
        pageTitle: c.siteTitle,
        pageUrl: c.siteUrl,
        siteUrl: c.siteUrl,
        separator: c.separator,
        titleSuffix: c.titleSuffix,
        isHome: true,
        homeTitle: c.siteTitle,
        siteDescription: '',
        siteOgImage: false,
        siteOgImageUrl: null,
        autoImageUrl: c.fallbackImageUrl || null,
        faviconUrl: this.settings.icons.files['favicon-96x96.png'] || null,
        fallbacks: {},
      }
    },
    // Icônes générées, montrées comme elles apparaissent : onglet, écran d'accueil iOS et Android
    iconPreviews() {
      const f = this.settings.icons.files
      if (!f || !f['favicon.ico']) return []
      return [
        { key: 'tab', src: f['favicon.svg'] || f['favicon-96x96.png'], label: 'favicon', size: '32' },
        { key: 'apple', src: f['apple-touch-icon.png'], label: 'iOS', size: '180' },
        { key: 'maskable', src: f['web-app-maskable-512x512.png'], label: 'Android', size: '512' },
      ]
    },
    fileUsage() {
      const icon = this.$t('visibilizer.files.favicon')
      const names = { favicon: icon, icon_png: icon, icon_svg: icon, og_image: this.$t('visibilizer.files.og_image') }
      return file => file.used.map(u => (u.page ? u.page : names[u.field] || u.field))
    },
    settingsChanged() {
      return JSON.stringify(this.form) !== JSON.stringify(this.settings.values)
    },
    configRows() {
      const c = this.settings.config
      const list = obj => Object.entries(obj || {}).map(([k, v]) => k + ' → ' + [].concat(v).join(', ')).join(' · ')
      return [
        ['mode', c.mode + (c.siteUrl ? ' · ' + c.siteUrl : '')],
        ['titleSeparator', '« ' + c.titleSeparator + ' »'],
        ['titleSuffix', c.titleSuffix ? '« ' + c.titleSuffix + ' »' : this.$t('visibilizer.none')],
        ['ogImageWidth', c.ogImageWidth ? c.ogImageWidth + ' px' : this.$t('visibilizer.config.original')],
        ['fallbacks.title', list(c.fallbacks.title)],
        ['fallbacks.description', list(c.fallbacks.description)],
        ['fallbacks.image', list(c.fallbacks.image)],
        ['alt', list(c.alt)],
        ['llms.sections', String(c.llmsSections)],
      ].map(([key, value]) => ({ key, value: value || this.$t('visibilizer.none') }))
    },
    rows() {
      const q = this.query.trim().toLowerCase()
      return this.source(this.current).filter(row => {
        if (this.level !== 'all' && this.levelOf(row) !== this.level) return false
        return !q || this.haystack(row).includes(q)
      })
    },
    filters() {
      const rows = this.source(this.current)
      return [{ key: 'all', count: rows.length }].concat(LEVELS.map(key => ({ key, count: rows.filter(r => this.levelOf(r) === key).length })))
    },
    // Images sans texte alternatif mais avec un texte généré par le modèle
    fillable() {
      return this.imageRows.filter(i => !i.alt && i.generated).length
    },
    visibleRows() {
      return this.rows.slice(0, this.limit)
    },
    // Onglet regroupé par page
    byPage() {
      return GROUPED.includes(this.current) && this.modes[this.current] === 'pages'
    },
    pageIndex() {
      return Object.fromEntries(this.pages.map((p, n) => [p.id, { ...p, rank: n }]))
    },
    /*
     * Pages qui ont au moins un élément dans le filtre, rangées sous leurs parents (projects → projects/ben…).
     * Un parent sans élément à lui apparaît quand même, pour regrouper ses enfants ; les compteurs d'un
     * parent portent sur toutes ses sous-pages, ceux d'une page sur tous ses éléments (pas seulement le filtre).
     */
    pageTree() {
      if (!this.byPage) return []
      const own = {}
      for (const row of this.source(this.current)) {
        for (const page of this.pagesOf(row)) (own[page.id] ||= { page, items: [] }).items.push(row)
      }
      const nodes = {}
      const node = id => {
        if (nodes[id]) return nodes[id]
        const info = own[id]?.page || this.pageIndex[id] || { id, title: id.split('/').pop(), path: '/' + id, panel: null }
        const slash = id.lastIndexOf('/')
        return (nodes[id] = {
          id,
          title: info.title,
          path: info.path,
          panel: info.panel,
          rank: id === 'site' ? -1 : this.pageIndex[id]?.rank ?? Infinity,
          parent: slash === -1 ? null : id.slice(0, slash),
          items: own[id]?.items || [],
          children: [],
        })
      }
      for (const row of this.rows) {
        for (const page of this.pagesOf(row)) {
          let n = node(page.id)
          while (n.parent) {
            const p = node(n.parent)
            if (!p.children.includes(n)) p.children.push(n)
            n = p
          }
        }
      }
      const sort = list => list.sort((a, b) => a.rank - b.rank || a.path.localeCompare(b.path))
      for (const n of Object.values(nodes)) sort(n.children)
      return sort(Object.values(nodes).filter(n => !n.parent))
    },
    // Lignes affichées : l'arbre déplié (tout est ouvert pendant une recherche ou un filtre)
    pageRows() {
      const all = this.query.trim() || this.level !== 'all'
      const rows = []
      const walk = (list, depth) => {
        for (const n of list) {
          const open = all || this.expanded[n.id]
          rows.push(this.summary(n, depth, open))
          if (n.children.length && open) walk(n.children, depth + 1)
        }
      }
      walk(this.pageTree, 0)
      return rows
    },
    pendingLinks() {
      return this.linkRows.filter(l => !l.internal && !l.result).map(l => l.href)
    },
  },
  watch: {
    // Vue rechargée : les textes enregistrés depuis le tiroir y sont déjà
    images() {
      this.saved = {}
    },
    current() {
      this.limit = LIMIT
    },
    level() {
      this.limit = LIMIT
    },
    query() {
      this.limit = LIMIT
    },
  },
  mounted() {
    // Vérifie les liens externes jamais vérifiés (ou sortis du cache)
    if (this.pendingLinks.length) this.check(this.pendingLinks)
  },
  methods: {
    source(tab) {
      return tab === 'pages' ? this.pages : tab === 'images' ? this.imageRows : this.linkRows
    },
    levelOf(row) {
      if (this.current === 'links' || row.href) return row.result ? row.result.level : 'pending'
      if (row.checks) return this.pageLevel(row)
      return this.issuesLevel(row.issues)
    },
    issuesLevel(issues) {
      return worst(issues.filter(this.counts).map(i => i.level))
    },
    // Avec « compter les valeurs par défaut », un titre / une description de repli n'est pas un problème en soi
    counts(issue) {
      return !(this.fallbacks && issue.fallback)
    },
    checkLevel(check) {
      return worst(check.issues.filter(this.counts).map(i => i.level))
    },
    pageLevel(row) {
      return worst([row.checks.title, row.checks.description, row.checks.image].map(this.checkLevel))
    },
    toggleFallbacks() {
      this.fallbacks = !this.fallbacks
      try {
        window.localStorage.setItem(STORE, this.fallbacks ? '1' : '0')
      } catch (e) {
        /* préférence non gardée */
      }
    },
    sourceLabel(value) {
      return this.$t('visibilizer.source.' + value.source, { field: value.field })
    },
    haystack(row) {
      if (row.href) return [row.label, row.href].concat(row.from.map(f => f.title)).join(' ').toLowerCase()
      if (row.filename) return [row.filename, row.alt, row.parent.title].join(' ').toLowerCase()
      return [row.title, row.path, row.metaTitle.value, row.description.value].join(' ').toLowerCase()
    },
    select(tab, level = 'all') {
      this.current = tab
      this.level = level
      this.open = {}
      const url = new URL(window.location.href)
      url.searchParams.set('tab', tab)
      window.history.replaceState(window.history.state, '', url)
    },
    toggle(key) {
      this.open[key] = !this.open[key]
    },
    // Compteurs des textes alternatifs : « 1 image décrite » / « 3 images décrites »
    countText(key, count) {
      return this.$t(key + (count === 1 && key.startsWith('visibilizer.count.alts.') ? '.one' : ''), { count })
    },
    setMode(mode) {
      this.modes[this.current] = mode
      this.limit = LIMIT
      try {
        window.localStorage.setItem('visibilizer.' + this.current, mode)
      } catch (e) {
        /* préférence non gardée */
      }
    },
    pagesOf(row) {
      return row.href ? row.from : [row.parent]
    },
    // Compteurs d'une ligne de l'arbre : la page et toutes ses sous-pages, chaque élément compté une fois
    summary(n, depth, open) {
      const seen = new Set()
      const items = []
      const collect = node => {
        for (const i of node.items) {
          const key = i.href || i.id
          if (seen.has(key)) continue
          seen.add(key)
          items.push(i)
        }
        node.children.forEach(collect)
      }
      collect(n)
      const pages = (function size(node) {
        return node.children.reduce((sum, c) => sum + 1 + size(c), 0)
      })(n)
      const row = { node: n, depth, open, pages, total: items.length }
      if (this.current === 'links') {
        const levels = items.map(linkLevel)
        row.level = levels.includes('error') ? 'error' : levels.includes('warn') ? 'warn' : levels.includes('pending') ? 'pending' : 'ok'
        row.legend = ['ok', 'warn', 'error', 'pending']
          .map(l => ({ level: l, count: count(levels, l) }))
          .filter(l => l.count)
          .map(l => ({ ...l, text: this.$t('visibilizer.count.links.' + (l.level === 'pending' ? (this.checking ? 'pending' : 'unchecked') : l.level), { count: l.count }) }))
        return row
      }
      row.level = worst(items.map(this.levelOf))
      row.legendLevel = worst(items.map(i => this.issuesLevel(i.issues.filter(x => x.key.startsWith('alt_')))))
      row.legend = ['ok', 'warn', 'error']
        .map(l => ({ level: l, count: items.filter(i => altLevel(i) === l).length }))
        .filter(l => l.count)
        .map(l => ({ ...l, text: this.countText('visibilizer.count.alts.' + l.level, l.count) }))
      row.heavy = items.filter(i => i.issues.some(x => x.key === 'image_heavy')).length
      row.thumbs = items.filter(i => i.thumb).slice(0, 4)
      return row
    },
    // Clic sur une ligne : un parent se replie / se déplie, une page ouvre son tiroir
    clickNode(row) {
      if (row.node.children.length) this.expanded[row.node.id] = !row.open
      else this.openNode(row.node)
    },
    openNode(n) {
      if (this.current === 'links') this.openLinks(n)
      else this.openImages(n)
    },
    openLinks(n) {
      this.$panel.drawer.open({
        component: 'k-visibilizer-links-drawer',
        props: {
          icon: 'url',
          title: n.title,
          page: { id: n.id, title: n.title, path: n.path, panel: n.panel },
          links: () => this.linkRows.filter(l => l.from.some(f => f.id === n.id)),
          detail: this.linkDetail,
        },
        on: {
          submit: () => this.$panel.drawer.close(),
        },
      })
    },
    openImages(group) {
      this.$panel.drawer.open({
        component: 'k-visibilizer-alts-drawer',
        props: {
          icon: 'image',
          title: group.title,
          page: { id: group.id, title: group.title, path: group.path, panel: group.panel },
          images: group.items,
          only: this.level !== 'all',
          onSaved: rows => rows.forEach(row => this.saved[row.id] = row),
        },
        on: {
          submit: () => this.$panel.drawer.close(),
        },
      })
    },
    issues(row) {
      if (row.checks) return [].concat(row.checks.title.issues, row.checks.description.issues, row.checks.image.issues)
      return row.issues || []
    },
    issue(i) {
      return this.$t('visibilizer.issue.' + i.key, i.data || {})
    },
    linkDetail(row) {
      const result = row.result
      if (!result) {
        if (this.failed[row.href]) return this.$t('visibilizer.link.failed')
        return this.$t(this.checking ? 'visibilizer.checking' : 'visibilizer.pending')
      }
      return result.key ? this.$t('visibilizer.link.' + result.key, result) : this.$t('visibilizer.link.ok')
    },
    async check(hrefs, force = false) {
      this.checking = { done: 0, total: hrefs.length }
      this.failed = {}
      let error = null
      for (let i = 0; i < hrefs.length; i += BATCH) {
        const batch = hrefs.slice(i, i + BATCH)
        try {
          const res = await this.$api.post('rllngr/visibilizer-audit/links', { hrefs: batch, force })
          for (const href of Object.keys(res || {})) this.results[href] = res[href]
        } catch (e) {
          // Le lot reste sans résultat, signalé sur ses lignes ; une seule notification pour toute la passe
          for (const href of batch) this.failed[href] = true
          error = e
        }
        this.checking.done = Math.min(hrefs.length, i + BATCH)
      }
      this.checking = null
      // Réponse qui n'est pas du JSON (PHP planté, délai dépassé) : Kirby la nomme « redirect »
      if (error) this.$panel.notification.error(error.message === 'redirect' ? this.$t('visibilizer.link.crashed') : error)
    },
    fill() {
      this.$panel.dialog.open({
        component: 'k-text-dialog',
        props: {
          text: this.$t('visibilizer.fill.confirm', { count: this.fillable }),
          submitButton: { text: this.$t('visibilizer.fill.submit'), icon: 'check', theme: 'positive' },
        },
        on: {
          submit: async () => {
            this.$panel.dialog.close()
            const res = await this.$api.post('rllngr/visibilizer-audit/alts')
            this.$panel.notification.success(this.$t('visibilizer.fill.done', { count: res.done }))
            await this.$panel.view.reload()
          },
        },
      })
    },
    async saveSettings() {
      this.saving = true
      try {
        await this.$api.post('rllngr/visibilizer-settings', { values: this.form })
        this.$panel.notification.success(this.$t('visibilizer.settings.saved'))
        // Les valeurs du site changent la cascade : on recalcule pages et images
        await this.$panel.view.reload()
        this.form = { ...this.settings.values }
      } catch (e) {
        this.$panel.notification.error(e)
      } finally {
        this.saving = false
      }
    },
    uploadFiles() {
      this.$panel.upload.pick({
        url: this.$panel.urls.api + '/site/files',
        accept: 'image/*',
        multiple: true,
        on: { done: () => this.$panel.view.reload() },
      })
    },
    resetSettings() {
      this.form = { ...this.settings.values }
    },
    async recheck() {
      // Les liens internes sont recalculés côté serveur au rechargement de la vue
      await this.$panel.view.reload()
      this.results = {}
      await this.check(this.links.filter(l => !l.internal).map(l => l.href), true)
    },
  },
  render: (() => {
function render(_ctx, _cache) {
  const _component_k_visibilizer_preview = _resolveComponent("k-visibilizer-preview")
  const _component_k_fieldset = _resolveComponent("k-fieldset")
  const _component_k_icon = _resolveComponent("k-icon")
  const _component_k_link = _resolveComponent("k-link")
  const _component_k_panel_inside = _resolveComponent("k-panel-inside")

  return (_openBlock(), _createBlock(_component_k_panel_inside, { class: "k-visibilizer-view" }, {
    default: _withCtx(() => [
      _createElementVNode("div", { class: "k-vis" }, [
        _createElementVNode("header", { class: "k-vis-ink k-vis-header" }, [
          _createElementVNode("h1", null, _toDisplayString(_ctx.$t('visibilizer.seo')), 1 /* TEXT */),
          _createElementVNode("nav", { class: "k-vis-tabs" }, [
            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.tabs, (t) => {
              return (_openBlock(), _createElementBlock("button", {
                key: t.key,
                type: "button",
                "aria-current": t.key === _ctx.current ? 'true' : null,
                onClick: $event => (_ctx.select(t.key))
              }, [
                _createTextVNode(_toDisplayString(_ctx.$t('visibilizer.tab.' + t.key)) + " ", 1 /* TEXT */),
                (t.count !== null)
                  ? (_openBlock(), _createElementBlock("span", {
                      key: 0,
                      class: "k-vis-tab-count"
                    }, _toDisplayString(t.count), 1 /* TEXT */))
                  : _createCommentVNode("v-if", true)
              ], 8 /* PROPS */, ["aria-current", "onClick"]))
            }), 128 /* KEYED_FRAGMENT */))
          ])
        ]),
        (_ctx.current !== 'settings')
          ? (_openBlock(), _createElementBlock("div", {
              key: 0,
              class: "k-vis-cards"
            }, [
              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.cards, (c) => {
                return (_openBlock(), _createElementBlock("button", {
                  key: c.key,
                  type: "button",
                  class: "k-vis-card",
                  "data-color": c.color,
                  onClick: $event => (_ctx.select(c.tab, c.counts.error ? 'error' : 'all'))
                }, [
                  _createElementVNode("span", {
                    class: "k-vis-card-dot",
                    "data-size": c.text.length > 3 ? 's' : 'l'
                  }, [
                    _createElementVNode("span", { class: "k-vis-card-value" }, _toDisplayString(c.text), 1 /* TEXT */),
                    _createElementVNode("span", { class: "k-vis-card-unit" }, _toDisplayString(c.unit), 1 /* TEXT */)
                  ], 8 /* PROPS */, ["data-size"]),
                  _createElementVNode("span", { class: "k-vis-card-label" }, _toDisplayString(_ctx.$t('visibilizer.card.' + c.key)), 1 /* TEXT */),
                  _createElementVNode("span", {
                    class: "k-vis-card-bar",
                    "aria-hidden": "true"
                  }, [
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(c.segments, (s) => {
                      return (_openBlock(), _createElementBlock("span", {
                        key: s.level,
                        "data-level": s.level,
                        style: _normalizeStyle({ width: s.width + '%' })
                      }, null, 12 /* STYLE, PROPS */, ["data-level"]))
                    }), 128 /* KEYED_FRAGMENT */))
                  ]),
                  _createElementVNode("span", { class: "k-vis-card-legend" }, [
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(c.legend, (l) => {
                      return (_openBlock(), _createElementBlock("span", {
                        key: l.level,
                        "data-level": l.level
                      }, _toDisplayString(l.text), 9 /* TEXT, PROPS */, ["data-level"]))
                    }), 128 /* KEYED_FRAGMENT */)),
                    (!c.total)
                      ? (_openBlock(), _createElementBlock("span", { key: 0 }, _toDisplayString(_ctx.$t('visibilizer.empty')), 1 /* TEXT */))
                      : _createCommentVNode("v-if", true)
                  ])
                ], 8 /* PROPS */, ["data-color", "onClick"]))
              }), 128 /* KEYED_FRAGMENT */))
            ]))
          : _createCommentVNode("v-if", true),
        (_ctx.current !== 'settings')
          ? (_openBlock(), _createElementBlock("div", {
              key: 1,
              class: "k-vis-mode"
            }, [
              _createElementVNode("button", {
                type: "button",
                class: "k-vis-switch",
                role: "switch",
                "aria-checked": _ctx.fallbacks ? 'true' : 'false',
                onClick: _cache[0] || (_cache[0] = (...args) => (_ctx.toggleFallbacks && _ctx.toggleFallbacks(...args)))
              }, [
                _createElementVNode("span", { class: "k-vis-switch-track" }, [
                  _createElementVNode("span", { class: "k-vis-switch-thumb" })
                ]),
                _createTextVNode(" " + _toDisplayString(_ctx.$t('visibilizer.fallbacks')), 1 /* TEXT */)
              ], 8 /* PROPS */, ["aria-checked"]),
              _createElementVNode("span", { class: "k-vis-muted" }, _toDisplayString(_ctx.$t(_ctx.fallbacks ? 'visibilizer.fallbacks.on' : 'visibilizer.fallbacks.off')), 1 /* TEXT */)
            ]))
          : _createCommentVNode("v-if", true),
        (_ctx.current === 'settings')
          ? (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [
              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.settingsGroups, (group, i) => {
                return (_openBlock(), _createElementBlock("section", {
                  key: group.key,
                  class: "k-vis-block k-vis-settings"
                }, [
                  (i === 0)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "k-vis-settings-split"
                      }, [
                        _createVNode(_component_k_visibilizer_preview, {
                          class: "k-vis-settings-preview",
                          label: _ctx.$t('visibilizer.settings.preview'),
                          "live-values": _ctx.form,
                          "live-context": _ctx.previewContext,
                          "initial-tab": "social"
                        }, null, 8 /* PROPS */, ["label", "live-values", "live-context"]),
                        _createVNode(_component_k_fieldset, {
                          fields: group.fields,
                          value: _ctx.form,
                          novalidate: true,
                          onInput: _cache[1] || (_cache[1] = $event => (_ctx.form = $event))
                        }, null, 8 /* PROPS */, ["fields", "value"])
                      ]))
                    : (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                        _createVNode(_component_k_fieldset, {
                          fields: group.fields,
                          value: _ctx.form,
                          novalidate: true,
                          onInput: _cache[2] || (_cache[2] = $event => (_ctx.form = $event))
                        }, null, 8 /* PROPS */, ["fields", "value"]),
                        (group.key === 'icon_headline')
                          ? (_openBlock(), _createElementBlock("div", {
                              key: 0,
                              class: "k-vis-icon-state"
                            }, [
                              (_ctx.iconPreviews.length)
                                ? (_openBlock(), _createElementBlock("div", {
                                    key: 0,
                                    class: "k-vis-icon-previews"
                                  }, [
                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.iconPreviews, (p) => {
                                      return (_openBlock(), _createElementBlock("figure", {
                                        key: p.key,
                                        "data-kind": p.key
                                      }, [
                                        _createElementVNode("span", { class: "k-vis-icon-frame" }, [
                                          _createElementVNode("img", {
                                            src: p.src,
                                            alt: ""
                                          }, null, 8 /* PROPS */, ["src"])
                                        ]),
                                        _createElementVNode("figcaption", null, [
                                          _createTextVNode(_toDisplayString(p.label) + " ", 1 /* TEXT */),
                                          _createElementVNode("span", { class: "k-vis-muted" }, _toDisplayString(p.size), 1 /* TEXT */)
                                        ])
                                      ], 8 /* PROPS */, ["data-kind"]))
                                    }), 128 /* KEYED_FRAGMENT */))
                                  ]))
                                : _createCommentVNode("v-if", true),
                              _createElementVNode("ul", { class: "k-vis-icon-checks" }, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.settings.icons.checks, (c) => {
                                  return (_openBlock(), _createElementBlock("li", {
                                    key: c.key + (c.data ? c.data.file || '' : '')
                                  }, [
                                    _createElementVNode("span", {
                                      class: "k-vis-dot",
                                      "data-level": c.level
                                    }, null, 8 /* PROPS */, ["data-level"]),
                                    _createTextVNode(" " + _toDisplayString(_ctx.$t('visibilizer.icon.' + c.key, c.data || {})), 1 /* TEXT */)
                                  ]))
                                }), 128 /* KEYED_FRAGMENT */))
                              ])
                            ]))
                          : _createCommentVNode("v-if", true)
                      ], 64 /* STABLE_FRAGMENT */))
                ]))
              }), 128 /* KEYED_FRAGMENT */)),
              _createElementVNode("div", { class: "k-vis-block k-vis-settings-bar" }, [
                (!_ctx.settings.editable)
                  ? (_openBlock(), _createElementBlock("span", {
                      key: 0,
                      class: "k-vis-muted"
                    }, _toDisplayString(_ctx.$t('visibilizer.settings.readonly')), 1 /* TEXT */))
                  : (_ctx.settingsChanged)
                    ? (_openBlock(), _createElementBlock("span", {
                        key: 1,
                        class: "k-vis-muted"
                      }, _toDisplayString(_ctx.$t('visibilizer.settings.unsaved')), 1 /* TEXT */))
                    : (_openBlock(), _createElementBlock("span", {
                        key: 2,
                        class: "k-vis-muted"
                      }, _toDisplayString(_ctx.$t('visibilizer.settings.stored')), 1 /* TEXT */)),
                _createElementVNode("span", { class: "k-vis-tools" }, [
                  (_ctx.settingsChanged)
                    ? (_openBlock(), _createElementBlock("button", {
                        key: 0,
                        type: "button",
                        class: "k-vis-button",
                        onClick: _cache[3] || (_cache[3] = (...args) => (_ctx.resetSettings && _ctx.resetSettings(...args)))
                      }, _toDisplayString(_ctx.$t('visibilizer.settings.reset')), 1 /* TEXT */))
                    : _createCommentVNode("v-if", true),
                  _createElementVNode("button", {
                    type: "button",
                    class: "k-vis-button k-vis-button-primary",
                    disabled: !_ctx.settingsChanged || _ctx.saving || !_ctx.settings.editable,
                    onClick: _cache[4] || (_cache[4] = (...args) => (_ctx.saveSettings && _ctx.saveSettings(...args)))
                  }, _toDisplayString(_ctx.$t(_ctx.saving ? 'visibilizer.settings.saving' : 'visibilizer.settings.save')), 9 /* TEXT, PROPS */, ["disabled"])
                ])
              ]),
              _createElementVNode("section", { class: "k-vis-block" }, [
                _createElementVNode("div", { class: "k-vis-files-head" }, [
                  _createElementVNode("h2", { class: "k-vis-caption" }, _toDisplayString(_ctx.$t('visibilizer.files')), 1 /* TEXT */),
                  (_ctx.settings.editable)
                    ? (_openBlock(), _createElementBlock("button", {
                        key: 0,
                        type: "button",
                        class: "k-vis-button",
                        onClick: _cache[5] || (_cache[5] = (...args) => (_ctx.uploadFiles && _ctx.uploadFiles(...args)))
                      }, [
                        _createVNode(_component_k_icon, { type: "upload" }),
                        _createElementVNode("span", null, _toDisplayString(_ctx.$t('visibilizer.files.upload')), 1 /* TEXT */)
                      ]))
                    : _createCommentVNode("v-if", true)
                ]),
                (!_ctx.settings.files.length)
                  ? (_openBlock(), _createElementBlock("p", {
                      key: 0,
                      class: "k-vis-message"
                    }, _toDisplayString(_ctx.$t('visibilizer.empty')), 1 /* TEXT */))
                  : (_openBlock(), _createElementBlock("ul", {
                      key: 1,
                      class: "k-vis-files"
                    }, [
                      (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.settings.files, (file) => {
                        return (_openBlock(), _createElementBlock("li", {
                          key: file.id
                        }, [
                          _createVNode(_component_k_link, {
                            to: file.panel,
                            class: "k-vis-files-thumb"
                          }, {
                            default: _withCtx(() => [
                              (file.thumb)
                                ? (_openBlock(), _createElementBlock("img", {
                                    key: 0,
                                    src: file.thumb,
                                    alt: "",
                                    loading: "lazy"
                                  }, null, 8 /* PROPS */, ["src"]))
                                : _createCommentVNode("v-if", true)
                            ]),
                            _: 2 /* DYNAMIC */
                          }, 1032 /* PROPS, DYNAMIC_SLOTS */, ["to"]),
                          _createElementVNode("span", { class: "k-vis-files-info" }, [
                            _createVNode(_component_k_link, {
                              to: file.panel,
                              class: "k-vis-link"
                            }, {
                              default: _withCtx(() => [
                                _createTextVNode(_toDisplayString(file.filename), 1 /* TEXT */)
                              ]),
                              _: 2 /* DYNAMIC */
                            }, 1032 /* PROPS, DYNAMIC_SLOTS */, ["to"]),
                            _createElementVNode("span", { class: "k-vis-path" }, [
                              _createTextVNode(_toDisplayString(file.niceSize), 1 /* TEXT */),
                              (file.size)
                                ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
                                    _createTextVNode(" · " + _toDisplayString(file.size), 1 /* TEXT */)
                                  ], 64 /* STABLE_FRAGMENT */))
                                : _createCommentVNode("v-if", true)
                            ]),
                            _createElementVNode("span", { class: "k-vis-files-used" }, [
                              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.fileUsage(file), (label) => {
                                return (_openBlock(), _createElementBlock("span", {
                                  key: label,
                                  class: "k-vis-badge"
                                }, _toDisplayString(label), 1 /* TEXT */))
                              }), 128 /* KEYED_FRAGMENT */)),
                              (!file.used.length)
                                ? (_openBlock(), _createElementBlock("span", {
                                    key: 0,
                                    class: "k-vis-badge k-vis-badge-warn"
                                  }, _toDisplayString(_ctx.$t('visibilizer.files.unused')), 1 /* TEXT */))
                                : _createCommentVNode("v-if", true)
                            ])
                          ])
                        ]))
                      }), 128 /* KEYED_FRAGMENT */))
                    ]))
              ]),
              _createElementVNode("section", { class: "k-vis-block" }, [
                _createElementVNode("h2", { class: "k-vis-caption" }, _toDisplayString(_ctx.$t('visibilizer.config')), 1 /* TEXT */),
                _createElementVNode("dl", { class: "k-vis-config" }, [
                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.configRows, (row) => {
                    return (_openBlock(), _createElementBlock(_Fragment, {
                      key: row.key
                    }, [
                      _createElementVNode("dt", null, _toDisplayString(row.key), 1 /* TEXT */),
                      _createElementVNode("dd", null, _toDisplayString(row.value), 1 /* TEXT */)
                    ], 64 /* STABLE_FRAGMENT */))
                  }), 128 /* KEYED_FRAGMENT */))
                ])
              ])
            ], 64 /* STABLE_FRAGMENT */))
          : (_openBlock(), _createElementBlock("section", {
              key: 3,
              class: "k-vis-block"
            }, [
              _createElementVNode("div", { class: "k-vis-toolbar" }, [
                _createElementVNode("nav", { class: "k-vis-filters" }, [
                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.filters, (f) => {
                    return (_openBlock(), _createElementBlock("button", {
                      key: f.key,
                      type: "button",
                      "data-level": f.key,
                      "aria-current": f.key === _ctx.level ? 'true' : null,
                      disabled: !f.count && f.key !== 'all',
                      onClick: $event => (_ctx.level = f.key)
                    }, [
                      (f.key !== 'all')
                        ? (_openBlock(), _createElementBlock("span", {
                            key: 0,
                            class: "k-vis-dot",
                            "data-level": f.key
                          }, null, 8 /* PROPS */, ["data-level"]))
                        : _createCommentVNode("v-if", true),
                      _createTextVNode(" " + _toDisplayString(_ctx.$t(f.key === 'all' ? 'visibilizer.filter.all' : 'visibilizer.level.' + f.key)) + " ", 1 /* TEXT */),
                      _createElementVNode("span", { class: "k-vis-muted" }, _toDisplayString(f.count), 1 /* TEXT */)
                    ], 8 /* PROPS */, ["data-level", "aria-current", "disabled", "onClick"]))
                  }), 128 /* KEYED_FRAGMENT */))
                ]),
                _createElementVNode("div", { class: "k-vis-tools" }, [
                  (_ctx.modes[_ctx.current])
                    ? (_openBlock(), _createElementBlock("nav", {
                        key: 0,
                        class: "k-vis-filters k-vis-modes"
                      }, [
                        (_openBlock(), _createElementBlock(_Fragment, null, _renderList(['pages', 'list'], (m) => {
                          return _createElementVNode("button", {
                            key: m,
                            type: "button",
                            "aria-current": m === _ctx.modes[_ctx.current] ? 'true' : null,
                            onClick: $event => (_ctx.setMode(m))
                          }, [
                            _createVNode(_component_k_icon, {
                              type: m === 'pages' ? 'folder' : 'list-bullet'
                            }, null, 8 /* PROPS */, ["type"]),
                            _createTextVNode(" " + _toDisplayString(_ctx.$t('visibilizer.images.' + m)), 1 /* TEXT */)
                          ], 8 /* PROPS */, ["aria-current", "onClick"])
                        }), 64 /* STABLE_FRAGMENT */))
                      ]))
                    : _createCommentVNode("v-if", true),
                  (_ctx.current === 'images' && _ctx.fillable)
                    ? (_openBlock(), _createElementBlock("button", {
                        key: 1,
                        type: "button",
                        class: "k-vis-button",
                        onClick: _cache[6] || (_cache[6] = (...args) => (_ctx.fill && _ctx.fill(...args)))
                      }, [
                        _createVNode(_component_k_icon, { type: "wand" }),
                        _createElementVNode("span", null, _toDisplayString(_ctx.$t('visibilizer.fill')) + " (" + _toDisplayString(_ctx.fillable) + ")", 1 /* TEXT */)
                      ]))
                    : _createCommentVNode("v-if", true),
                  (_ctx.current === 'links' && _ctx.links.length)
                    ? (_openBlock(), _createElementBlock("button", {
                        key: 2,
                        type: "button",
                        class: "k-vis-button",
                        disabled: !!_ctx.checking,
                        onClick: _cache[7] || (_cache[7] = (...args) => (_ctx.recheck && _ctx.recheck(...args)))
                      }, [
                        _createVNode(_component_k_icon, { type: "refresh" }),
                        (_ctx.checking)
                          ? (_openBlock(), _createElementBlock("span", { key: 0 }, _toDisplayString(_ctx.$t('visibilizer.checking', _ctx.checking)), 1 /* TEXT */))
                          : (_openBlock(), _createElementBlock("span", { key: 1 }, _toDisplayString(_ctx.$t('visibilizer.recheck')), 1 /* TEXT */))
                      ], 8 /* PROPS */, ["disabled"]))
                    : _createCommentVNode("v-if", true),
                  _createElementVNode("label", { class: "k-vis-search" }, [
                    _createVNode(_component_k_icon, { type: "search" }),
                    _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((_ctx.query) = $event)),
                      type: "search",
                      placeholder: _ctx.$t('visibilizer.search')
                    }, null, 8 /* PROPS */, ["placeholder"]), [
                      [_vModelText, _ctx.query]
                    ])
                  ])
                ])
              ]),
              (!_ctx.source(_ctx.current).length)
                ? (_openBlock(), _createElementBlock("p", {
                    key: 0,
                    class: "k-vis-message"
                  }, _toDisplayString(_ctx.$t('visibilizer.empty')), 1 /* TEXT */))
                : (!_ctx.rows.length)
                  ? (_openBlock(), _createElementBlock("p", {
                      key: 1,
                      class: "k-vis-message"
                    }, _toDisplayString(_ctx.$t('visibilizer.empty.filter')), 1 /* TEXT */))
                  : (_ctx.current === 'pages')
                    ? (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [
                        _createCommentVNode(" Pages "),
                        _createElementVNode("div", {
                          class: "k-vis-table",
                          "data-tab": "pages"
                        }, [
                          _createElementVNode("div", { class: "k-vis-row k-vis-head" }, [
                            _createElementVNode("span"),
                            _createElementVNode("span", null, _toDisplayString(_ctx.$t('visibilizer.col.page')), 1 /* TEXT */),
                            _createElementVNode("span", null, _toDisplayString(_ctx.$t('visibilizer.col.title')), 1 /* TEXT */),
                            _createElementVNode("span", null, _toDisplayString(_ctx.$t('visibilizer.col.description')), 1 /* TEXT */),
                            _createElementVNode("span", null, _toDisplayString(_ctx.$t('visibilizer.col.image')), 1 /* TEXT */),
                            _createElementVNode("span", null, _toDisplayString(_ctx.$t('visibilizer.col.index')), 1 /* TEXT */),
                            _createElementVNode("span")
                          ]),
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.visibleRows, (row) => {
                            return (_openBlock(), _createElementBlock(_Fragment, {
                              key: row.id
                            }, [
                              _createElementVNode("div", {
                                class: _normalizeClass(["k-vis-row", { open: _ctx.open[row.id] }]),
                                onClick: $event => (_ctx.toggle(row.id))
                              }, [
                                _createElementVNode("span", {
                                  class: "k-vis-dot",
                                  "data-level": _ctx.pageLevel(row),
                                  title: _ctx.$t('visibilizer.level.' + _ctx.pageLevel(row))
                                }, null, 8 /* PROPS */, ["data-level", "title"]),
                                _createElementVNode("span", { class: "k-vis-cell-page" }, [
                                  _createVNode(_component_k_link, {
                                    to: row.panel,
                                    class: "k-vis-link",
                                    onClick: _cache[9] || (_cache[9] = _withModifiers(() => {}, ["stop"]))
                                  }, {
                                    default: _withCtx(() => [
                                      _createTextVNode(_toDisplayString(row.title), 1 /* TEXT */)
                                    ]),
                                    _: 2 /* DYNAMIC */
                                  }, 1032 /* PROPS, DYNAMIC_SLOTS */, ["to"]),
                                  _createElementVNode("span", {
                                    class: "k-vis-path",
                                    title: row.path
                                  }, _toDisplayString(row.path), 9 /* TEXT, PROPS */, ["title"])
                                ]),
                                _createElementVNode("span", {
                                  class: "k-vis-cell-text",
                                  "data-level": _ctx.checkLevel(row.checks.title)
                                }, [
                                  (row.metaTitle.source !== 'custom')
                                    ? (_openBlock(), _createElementBlock("span", {
                                        key: 0,
                                        class: "k-vis-badge"
                                      }, _toDisplayString(_ctx.sourceLabel(row.metaTitle)), 1 /* TEXT */))
                                    : _createCommentVNode("v-if", true),
                                  _createElementVNode("span", {
                                    class: _normalizeClass({ 'k-vis-muted': row.metaTitle.source !== 'custom' })
                                  }, _toDisplayString(row.metaTitle.value), 3 /* TEXT, CLASS */)
                                ], 8 /* PROPS */, ["data-level"]),
                                _createElementVNode("span", {
                                  class: "k-vis-cell-text k-vis-clamp",
                                  "data-level": _ctx.checkLevel(row.checks.description)
                                }, [
                                  (row.description.source !== 'custom' && row.description.source !== 'none')
                                    ? (_openBlock(), _createElementBlock("span", {
                                        key: 0,
                                        class: "k-vis-badge"
                                      }, _toDisplayString(_ctx.sourceLabel(row.description)), 1 /* TEXT */))
                                    : _createCommentVNode("v-if", true),
                                  (row.description.value)
                                    ? (_openBlock(), _createElementBlock("span", {
                                        key: 1,
                                        class: _normalizeClass({ 'k-vis-muted': row.description.source !== 'custom' })
                                      }, _toDisplayString(row.description.value), 3 /* TEXT, CLASS */))
                                    : (_openBlock(), _createElementBlock("span", {
                                        key: 2,
                                        class: "k-vis-muted"
                                      }, _toDisplayString(_ctx.$t('visibilizer.none')), 1 /* TEXT */))
                                ], 8 /* PROPS */, ["data-level"]),
                                _createElementVNode("span", {
                                  class: "k-vis-cell-thumb",
                                  "data-level": _ctx.checkLevel(row.checks.image)
                                }, [
                                  (row.image && row.image.thumb)
                                    ? (_openBlock(), _createElementBlock("img", {
                                        key: 0,
                                        src: row.image.thumb,
                                        alt: "",
                                        loading: "lazy"
                                      }, null, 8 /* PROPS */, ["src"]))
                                    : _createCommentVNode("v-if", true),
                                  (row.image && row.image.source !== 'custom')
                                    ? (_openBlock(), _createElementBlock("span", {
                                        key: 1,
                                        class: "k-vis-badge k-vis-thumb-badge",
                                        title: _ctx.sourceLabel(row.image)
                                      }, _toDisplayString(row.image.source === 'field' ? row.image.field : _ctx.sourceLabel(row.image)), 9 /* TEXT, PROPS */, ["title"]))
                                    : _createCommentVNode("v-if", true)
                                ], 8 /* PROPS */, ["data-level"]),
                                _createElementVNode("span", { class: "k-vis-cell-index" }, [
                                  _createElementVNode("span", {
                                    class: "k-vis-dot",
                                    "data-level": row.indexable ? 'ok' : 'off',
                                    title: row.indexable ? _ctx.$t('visibilizer.indexable') : _ctx.$t('visibilizer.noindex', { robots: row.robots })
                                  }, null, 8 /* PROPS */, ["data-level", "title"])
                                ]),
                                _createElementVNode("span", {
                                  class: "k-vis-actions",
                                  onClick: _cache[10] || (_cache[10] = _withModifiers(() => {}, ["stop"]))
                                }, [
                                  _createVNode(_component_k_link, {
                                    to: row.panel,
                                    title: _ctx.$t('visibilizer.open.panel')
                                  }, {
                                    default: _withCtx(() => [
                                      _createVNode(_component_k_icon, { type: "edit" })
                                    ]),
                                    _: 1 /* STABLE */
                                  }, 8 /* PROPS */, ["to", "title"]),
                                  _createElementVNode("a", {
                                    href: row.url,
                                    target: "_blank",
                                    rel: "noopener",
                                    title: _ctx.$t('visibilizer.open.site')
                                  }, [
                                    _createVNode(_component_k_icon, { type: "open" })
                                  ], 8 /* PROPS */, ["href", "title"])
                                ])
                              ], 10 /* CLASS, PROPS */, ["onClick"]),
                              (_ctx.open[row.id])
                                ? (_openBlock(), _createElementBlock("ul", {
                                    key: 0,
                                    class: "k-vis-issues"
                                  }, [
                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.issues(row), (i, n) => {
                                      return (_openBlock(), _createElementBlock("li", {
                                        key: n,
                                        class: _normalizeClass({ 'k-vis-muted': !_ctx.counts(i) })
                                      }, _toDisplayString(_ctx.issue(i)), 3 /* TEXT, CLASS */))
                                    }), 128 /* KEYED_FRAGMENT */)),
                                    (!_ctx.issues(row).length)
                                      ? (_openBlock(), _createElementBlock("li", {
                                          key: 0,
                                          "data-level": "ok"
                                        }, _toDisplayString(_ctx.$t('visibilizer.level.ok')), 1 /* TEXT */))
                                      : _createCommentVNode("v-if", true)
                                  ]))
                                : _createCommentVNode("v-if", true)
                            ], 64 /* STABLE_FRAGMENT */))
                          }), 128 /* KEYED_FRAGMENT */))
                        ])
                      ], 2112 /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */))
                    : (_ctx.byPage)
                      ? (_openBlock(), _createElementBlock(_Fragment, { key: 3 }, [
                          _createCommentVNode(" Par page (images, liens) : un parent se déplie, une page ouvre son tiroir "),
                          _createElementVNode("div", {
                            class: "k-vis-table",
                            "data-tab": "by-page",
                            "data-kind": _ctx.current
                          }, [
                            _createElementVNode("div", { class: "k-vis-row k-vis-head" }, [
                              _createElementVNode("span"),
                              (_ctx.current === 'images')
                                ? (_openBlock(), _createElementBlock("span", { key: 0 }))
                                : _createCommentVNode("v-if", true),
                              _createElementVNode("span", null, _toDisplayString(_ctx.$t('visibilizer.col.page')), 1 /* TEXT */),
                              _createElementVNode("span", null, _toDisplayString(_ctx.$t(_ctx.current === 'images' ? 'visibilizer.col.alt' : 'visibilizer.col.status')), 1 /* TEXT */),
                              _createElementVNode("span", null, _toDisplayString(_ctx.$t('visibilizer.tab.' + _ctx.current)), 1 /* TEXT */),
                              _createElementVNode("span")
                            ]),
                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.pageRows, (row) => {
                              return (_openBlock(), _createElementBlock("div", {
                                key: row.node.id,
                                class: "k-vis-row",
                                "data-depth": row.depth,
                                onClick: $event => (_ctx.clickNode(row))
                              }, [
                                _createElementVNode("span", {
                                  class: "k-vis-dot",
                                  "data-level": row.level,
                                  title: _ctx.$t('visibilizer.level.' + (row.level === 'pending' ? 'ok' : row.level))
                                }, null, 8 /* PROPS */, ["data-level", "title"]),
                                (_ctx.current === 'images')
                                  ? (_openBlock(), _createElementBlock("span", {
                                      key: 0,
                                      class: "k-vis-stack"
                                    }, [
                                      (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(row.thumbs, (i) => {
                                        return (_openBlock(), _createElementBlock("img", {
                                          key: i.id,
                                          src: i.thumb,
                                          alt: "",
                                          loading: "lazy"
                                        }, null, 8 /* PROPS */, ["src"]))
                                      }), 128 /* KEYED_FRAGMENT */))
                                    ]))
                                  : _createCommentVNode("v-if", true),
                                _createElementVNode("span", {
                                  class: "k-vis-cell-page k-vis-cell-tree",
                                  style: _normalizeStyle({ paddingLeft: row.depth * 1.25 + 'rem' })
                                }, [
                                  _createElementVNode("span", { class: "k-vis-link" }, [
                                    (row.node.children.length)
                                      ? (_openBlock(), _createBlock(_component_k_icon, {
                                          key: 0,
                                          type: row.open ? 'angle-down' : 'angle-right',
                                          class: "k-vis-chevron"
                                        }, null, 8 /* PROPS */, ["type"]))
                                      : _createCommentVNode("v-if", true),
                                    _createTextVNode(" " + _toDisplayString(row.node.title), 1 /* TEXT */)
                                  ]),
                                  _createElementVNode("span", {
                                    class: "k-vis-path",
                                    title: row.node.path
                                  }, [
                                    _createTextVNode(_toDisplayString(row.node.path), 1 /* TEXT */),
                                    (row.pages)
                                      ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
                                          _createTextVNode(" · " + _toDisplayString(_ctx.$t('visibilizer.subpages', { count: row.pages })), 1 /* TEXT */)
                                        ], 64 /* STABLE_FRAGMENT */))
                                      : _createCommentVNode("v-if", true)
                                  ], 8 /* PROPS */, ["title"])
                                ], 4 /* STYLE */),
                                _createElementVNode("span", {
                                  class: "k-vis-cell-text k-vis-legend",
                                  "data-level": row.legendLevel || row.level
                                }, [
                                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(row.legend, (l) => {
                                    return (_openBlock(), _createElementBlock("span", {
                                      key: l.level,
                                      "data-level": l.level
                                    }, _toDisplayString(l.text), 9 /* TEXT, PROPS */, ["data-level"]))
                                  }), 128 /* KEYED_FRAGMENT */))
                                ], 8 /* PROPS */, ["data-level"]),
                                _createElementVNode("span", { class: "k-vis-cell-meta" }, [
                                  _createElementVNode("span", null, _toDisplayString(row.total), 1 /* TEXT */),
                                  (row.heavy)
                                    ? (_openBlock(), _createElementBlock("span", {
                                        key: 0,
                                        class: "k-vis-flag"
                                      }, _toDisplayString(_ctx.$t('visibilizer.images.heavy', { count: row.heavy })), 1 /* TEXT */))
                                    : _createCommentVNode("v-if", true)
                                ]),
                                _createElementVNode("span", {
                                  class: "k-vis-actions",
                                  onClick: _cache[11] || (_cache[11] = _withModifiers(() => {}, ["stop"]))
                                }, [
                                  (row.node.items.length)
                                    ? (_openBlock(), _createElementBlock("button", {
                                        key: 0,
                                        type: "button",
                                        title: _ctx.$t(_ctx.current === 'images' ? 'visibilizer.images.open' : 'visibilizer.links.open'),
                                        onClick: $event => (_ctx.openNode(row.node))
                                      }, [
                                        _createVNode(_component_k_icon, {
                                          type: _ctx.current === 'images' ? 'image' : 'url'
                                        }, null, 8 /* PROPS */, ["type"])
                                      ], 8 /* PROPS */, ["title", "onClick"]))
                                    : _createCommentVNode("v-if", true),
                                  (row.node.panel)
                                    ? (_openBlock(), _createBlock(_component_k_link, {
                                        key: 1,
                                        to: row.node.panel,
                                        title: _ctx.$t('visibilizer.open.panel')
                                      }, {
                                        default: _withCtx(() => [
                                          _createVNode(_component_k_icon, { type: "edit" })
                                        ]),
                                        _: 1 /* STABLE */
                                      }, 8 /* PROPS */, ["to", "title"]))
                                    : _createCommentVNode("v-if", true)
                                ])
                              ], 8 /* PROPS */, ["data-depth", "onClick"]))
                            }), 128 /* KEYED_FRAGMENT */))
                          ], 8 /* PROPS */, ["data-kind"])
                        ], 2112 /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */))
                      : (_ctx.current === 'images')
                        ? (_openBlock(), _createElementBlock(_Fragment, { key: 4 }, [
                            _createCommentVNode(" Images "),
                            _createElementVNode("div", {
                              class: "k-vis-table",
                              "data-tab": "images"
                            }, [
                              _createElementVNode("div", { class: "k-vis-row k-vis-head" }, [
                                _createElementVNode("span"),
                                _createElementVNode("span"),
                                _createElementVNode("span", null, _toDisplayString(_ctx.$t('visibilizer.col.file')), 1 /* TEXT */),
                                _createElementVNode("span", null, _toDisplayString(_ctx.$t('visibilizer.col.alt')), 1 /* TEXT */),
                                _createElementVNode("span", null, _toDisplayString(_ctx.$t('visibilizer.col.weight')), 1 /* TEXT */),
                                _createElementVNode("span")
                              ]),
                              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.visibleRows, (row) => {
                                return (_openBlock(), _createElementBlock("div", {
                                  key: row.id,
                                  class: "k-vis-row"
                                }, [
                                  _createElementVNode("span", {
                                    class: "k-vis-dot",
                                    "data-level": _ctx.levelOf(row),
                                    title: row.issues.map(_ctx.issue).join(' · ') || _ctx.$t('visibilizer.level.ok')
                                  }, null, 8 /* PROPS */, ["data-level", "title"]),
                                  _createElementVNode("span", { class: "k-vis-cell-thumb" }, [
                                    (row.thumb)
                                      ? (_openBlock(), _createElementBlock("img", {
                                          key: 0,
                                          src: row.thumb,
                                          alt: "",
                                          loading: "lazy"
                                        }, null, 8 /* PROPS */, ["src"]))
                                      : _createCommentVNode("v-if", true)
                                  ]),
                                  _createElementVNode("span", { class: "k-vis-cell-page" }, [
                                    _createVNode(_component_k_link, {
                                      to: row.panel,
                                      class: "k-vis-link"
                                    }, {
                                      default: _withCtx(() => [
                                        _createTextVNode(_toDisplayString(row.filename), 1 /* TEXT */)
                                      ]),
                                      _: 2 /* DYNAMIC */
                                    }, 1032 /* PROPS, DYNAMIC_SLOTS */, ["to"]),
                                    _createVNode(_component_k_link, {
                                      to: row.parent.panel,
                                      class: "k-vis-path"
                                    }, {
                                      default: _withCtx(() => [
                                        _createTextVNode(_toDisplayString(row.parent.title), 1 /* TEXT */)
                                      ]),
                                      _: 2 /* DYNAMIC */
                                    }, 1032 /* PROPS, DYNAMIC_SLOTS */, ["to"])
                                  ]),
                                  _createElementVNode("span", {
                                    class: "k-vis-cell-text",
                                    "data-level": _ctx.issuesLevel(row.issues.filter(i => i.key.startsWith('alt_')))
                                  }, [
                                    (row.alt)
                                      ? (_openBlock(), _createElementBlock("span", { key: 0 }, _toDisplayString(row.alt), 1 /* TEXT */))
                                      : (row.generated)
                                        ? (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                                            _createElementVNode("span", { class: "k-vis-badge" }, _toDisplayString(_ctx.$t('visibilizer.source.auto')), 1 /* TEXT */),
                                            _createElementVNode("span", { class: "k-vis-muted" }, _toDisplayString(row.generated), 1 /* TEXT */)
                                          ], 64 /* STABLE_FRAGMENT */))
                                        : (_openBlock(), _createElementBlock("span", {
                                            key: 2,
                                            class: "k-vis-flag"
                                          }, _toDisplayString(_ctx.$t('visibilizer.issue.alt_missing')), 1 /* TEXT */))
                                  ], 8 /* PROPS */, ["data-level"]),
                                  _createElementVNode("span", { class: "k-vis-cell-meta" }, [
                                    _createElementVNode("span", {
                                      class: _normalizeClass({ 'k-vis-flag': row.issues.some(i => i.key === 'image_heavy') })
                                    }, _toDisplayString(row.niceSize), 3 /* TEXT, CLASS */),
                                    _createElementVNode("span", { class: "k-vis-muted" }, _toDisplayString(row.width) + " × " + _toDisplayString(row.height), 1 /* TEXT */)
                                  ]),
                                  _createElementVNode("span", { class: "k-vis-actions" }, [
                                    _createVNode(_component_k_link, {
                                      to: row.panel,
                                      title: _ctx.$t('visibilizer.open.panel')
                                    }, {
                                      default: _withCtx(() => [
                                        _createVNode(_component_k_icon, { type: "edit" })
                                      ]),
                                      _: 1 /* STABLE */
                                    }, 8 /* PROPS */, ["to", "title"]),
                                    _createElementVNode("a", {
                                      href: row.url,
                                      target: "_blank",
                                      rel: "noopener",
                                      title: _ctx.$t('visibilizer.open.site')
                                    }, [
                                      _createVNode(_component_k_icon, { type: "open" })
                                    ], 8 /* PROPS */, ["href", "title"])
                                  ])
                                ]))
                              }), 128 /* KEYED_FRAGMENT */))
                            ])
                          ], 2112 /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */))
                        : (_openBlock(), _createElementBlock(_Fragment, { key: 5 }, [
                            _createCommentVNode(" Liens "),
                            _createElementVNode("div", {
                              class: "k-vis-table",
                              "data-tab": "links"
                            }, [
                              _createElementVNode("div", { class: "k-vis-row k-vis-head" }, [
                                _createElementVNode("span", null, _toDisplayString(_ctx.$t('visibilizer.col.status')), 1 /* TEXT */),
                                _createElementVNode("span", null, _toDisplayString(_ctx.$t('visibilizer.col.link')), 1 /* TEXT */),
                                _createElementVNode("span", null, _toDisplayString(_ctx.$t('visibilizer.col.details')), 1 /* TEXT */),
                                _createElementVNode("span", null, _toDisplayString(_ctx.$t('visibilizer.col.from')), 1 /* TEXT */),
                                _createElementVNode("span")
                              ]),
                              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.visibleRows, (row) => {
                                return (_openBlock(), _createElementBlock(_Fragment, {
                                  key: row.href
                                }, [
                                  _createElementVNode("div", {
                                    class: _normalizeClass(["k-vis-row", { open: _ctx.open[row.href] }]),
                                    onClick: $event => (row.from.length > 1 && _ctx.toggle(row.href))
                                  }, [
                                    _createElementVNode("span", { class: "k-vis-cell-status" }, [
                                      _createElementVNode("span", {
                                        class: "k-vis-dot",
                                        "data-level": row.result ? row.result.level : 'pending'
                                      }, null, 8 /* PROPS */, ["data-level"]),
                                      _createElementVNode("span", { class: "k-vis-code" }, _toDisplayString(row.result && row.result.code === 0 ? _ctx.$t('visibilizer.link.code_none') : row.result && row.result.code ? row.result.code : '—'), 1 /* TEXT */)
                                    ]),
                                    _createElementVNode("span", { class: "k-vis-cell-page" }, [
                                      _createElementVNode("span", {
                                        class: "k-vis-href",
                                        title: row.href
                                      }, _toDisplayString(row.label), 9 /* TEXT, PROPS */, ["title"]),
                                      _createElementVNode("span", { class: "k-vis-path" }, _toDisplayString(_ctx.$t(row.internal ? 'visibilizer.internal' : 'visibilizer.external')), 1 /* TEXT */)
                                    ]),
                                    _createElementVNode("span", {
                                      class: _normalizeClass(["k-vis-cell-text", { 'k-vis-muted': !row.result }])
                                    }, _toDisplayString(_ctx.linkDetail(row)), 3 /* TEXT, CLASS */),
                                    _createElementVNode("span", { class: "k-vis-cell-from" }, [
                                      _createVNode(_component_k_link, {
                                        to: row.from[0].panel,
                                        class: "k-vis-link",
                                        onClick: _cache[12] || (_cache[12] = _withModifiers(() => {}, ["stop"]))
                                      }, {
                                        default: _withCtx(() => [
                                          _createTextVNode(_toDisplayString(row.from[0].title), 1 /* TEXT */)
                                        ]),
                                        _: 2 /* DYNAMIC */
                                      }, 1032 /* PROPS, DYNAMIC_SLOTS */, ["to"]),
                                      (row.from.length > 1)
                                        ? (_openBlock(), _createElementBlock("span", {
                                            key: 0,
                                            class: "k-vis-muted",
                                            title: row.from.slice(1).map(f => f.title).join(', ')
                                          }, _toDisplayString(_ctx.$t('visibilizer.more', { count: row.from.length - 1 })), 9 /* TEXT, PROPS */, ["title"]))
                                        : _createCommentVNode("v-if", true)
                                    ]),
                                    _createElementVNode("span", {
                                      class: "k-vis-actions",
                                      onClick: _cache[13] || (_cache[13] = _withModifiers(() => {}, ["stop"]))
                                    }, [
                                      _createElementVNode("a", {
                                        href: row.result && row.result.internal ? row.label : row.href,
                                        target: "_blank",
                                        rel: "noopener",
                                        title: _ctx.$t('visibilizer.open.site')
                                      }, [
                                        _createVNode(_component_k_icon, { type: "open" })
                                      ], 8 /* PROPS */, ["href", "title"])
                                    ])
                                  ], 10 /* CLASS, PROPS */, ["onClick"]),
                                  (_ctx.open[row.href])
                                    ? (_openBlock(), _createElementBlock("ul", {
                                        key: 0,
                                        class: "k-vis-issues k-vis-from"
                                      }, [
                                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(row.from, (f) => {
                                          return (_openBlock(), _createElementBlock("li", {
                                            key: f.panel
                                          }, [
                                            _createVNode(_component_k_link, {
                                              to: f.panel,
                                              class: "k-vis-link"
                                            }, {
                                              default: _withCtx(() => [
                                                _createTextVNode(_toDisplayString(f.title), 1 /* TEXT */)
                                              ]),
                                              _: 2 /* DYNAMIC */
                                            }, 1032 /* PROPS, DYNAMIC_SLOTS */, ["to"])
                                          ]))
                                        }), 128 /* KEYED_FRAGMENT */))
                                      ]))
                                    : _createCommentVNode("v-if", true)
                                ], 64 /* STABLE_FRAGMENT */))
                              }), 128 /* KEYED_FRAGMENT */))
                            ])
                          ], 2112 /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */)),
              (_ctx.rows.length > _ctx.limit && !_ctx.byPage)
                ? (_openBlock(), _createElementBlock("button", {
                    key: 6,
                    type: "button",
                    class: "k-vis-button k-vis-more",
                    onClick: _cache[14] || (_cache[14] = $event => (_ctx.limit += _ctx.step))
                  }, _toDisplayString(_ctx.$t('visibilizer.showMore', { count: Math.min(_ctx.step, _ctx.rows.length - _ctx.limit), total: _ctx.rows.length - _ctx.limit })), 1 /* TEXT */))
                : _createCommentVNode("v-if", true)
            ])),
        _createElementVNode("p", { class: "k-vis-footnote" }, _toDisplayString(_ctx.$t('visibilizer.footnote')), 1 /* TEXT */),
        _createElementVNode("footer", { class: "k-vis-ink k-vis-footer" }, [
          _createElementVNode("span", null, "visibilizer"),
          _createElementVNode("a", {
            href: "https://rollinger.design",
            target: "_blank",
            rel: "noopener"
          }, "rollinger.design")
        ])
      ])
    ]),
    _: 1 /* STABLE */
  }))
}
return render
})(),
}

panel.plugin('rllngr/kirby-visibilizer', {
  fields: {
    'seo-preview': SeoPreview,
  },
  components: {
    'k-visibilizer-preview': SeoPreview,
    'k-visibilizer-seo-view': SeoView,
    'k-visibilizer-alts-drawer': AltsDrawer,
    'k-visibilizer-links-drawer': LinksDrawer,
  },
})
