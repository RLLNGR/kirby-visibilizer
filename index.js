// GÉNÉRÉ par scripts/build-panel.mjs depuis src/panel.js — ne pas modifier ici, puis : npm run build
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

// Section « Aperçu SEO » des pages (aperçu Google / réseaux sociaux + contrôles), valeurs lues en direct.
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
      tab: this.initialTab,
      ctx: this.liveContext || {
        siteTitle: '',
        pageTitle: '',
        pageUrl:   '',
        siteUrl:   '',
        separator: ' — ',
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
        // Kirby 5
        if (this.$panel?.content?.version) {
          return this.$panel.content.version('changes') || {};
        }
        // Kirby 4
        const id    = this.$store.state.content?.current;
        const model = this.$store.state.content?.models?.[id];
        return { ...model?.originals, ...model?.changes };
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
      const s = this.ctx.siteTitle;
      if (this.ctx.isHome) return t || s;
      if (!t || t === s) return s;
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
      for (const name of this.ctx.fallbacks?.image || []) {
        const url = this.fileUrl(this.values[name]);
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
        items.push({ status: fallback, msg: t('title.' + this.titleSource, { field: (this.ctx.fallbacks?.title || []).join(', ') }) });
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
          items.push({ status: fallback, msg: t('desc.' + this.descSource, { field: (this.ctx.fallbacks?.description || []).join(', ') }) });
        }
      }

      // OG image
      if (!this.hasOgImage && this.fallbackImageUrl) {
        items.push({ status: fallback, msg: t('image.field', { field: (this.ctx.fallbacks?.image || []).join(', ') }) });
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
    // Champ fichiers : Kirby 5 donne [{ image: { url } }, …] dans les valeurs en direct
    fileUrl(value) {
      const first = Array.isArray(value) ? value[0] : null;
      if (!first || typeof first !== 'object') return null;
      return first.image?.url || first.url || null;
    },

    // Texte brut (le champ peut contenir du HTML), coupé comme Str::excerpt côté PHP
    fallbackText(type) {
      const max = type === 'title' ? 60 : (this.ctx.fallbacks?.length || 160);
      for (const name of this.ctx.fallbacks?.[type] || []) {
        const raw = this.values[name];
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
        const parent = this.parent || this.$panel?.view?.props?.api || this.$store?.state?.content?.current || '';
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

  ...(() => {
var render = function render(){var _vm=this,_c=_vm._self._c;return _c('k-section',{attrs:{"label":_vm.resolvedLabel}},[_c('div',{staticClass:"vis-preview"},[_c('div',{staticClass:"vis-score",class:'vis-score--' + _vm.scoreClass},[_c('span',{staticClass:"vis-score-number"},[_vm._v(_vm._s(_vm.score)),_c('small',[_vm._v("%")])]),_c('span',{staticClass:"vis-score-label"},[_vm._v(_vm._s(_vm.scoreLabel))])]),_c('div',{staticClass:"vis-tabs"},_vm._l(([['google','Google'],['social',_vm.$t('visibilizer.preview.tab.social')],['twitter','Twitter / X']]),function(t){return _c('button',{key:t[0],class:['vis-tab', _vm.tab === t[0] && 'vis-tab--active'],on:{"click":function($event){_vm.tab = t[0]}}},[_vm._v(_vm._s(t[1]))])}),0),(_vm.tab === 'google')?_c('div',{staticClass:"vis-google"},[_c('div',{staticClass:"vis-google-header"},[_c('div',{staticClass:"vis-google-favicon",class:{ 'vis-has-icon': _vm.faviconUrl }},[(_vm.faviconUrl)?_c('img',{attrs:{"src":_vm.faviconUrl,"alt":""}}):[_vm._v("G")]],2),_c('div',[_c('div',{staticClass:"vis-google-site"},[_vm._v(_vm._s(_vm.ctx.siteTitle))]),_c('div',{staticClass:"vis-google-url"},[_vm._v(_vm._s(_vm.displayDomain)+_vm._s(_vm.displayPath))])])]),_c('div',{staticClass:"vis-google-title",class:_vm.titleLength > 60 ? 'vis-truncated' : ''},[_vm._v(" "+_vm._s(_vm.fullTitle || _vm.$t('visibilizer.preview.placeholder.title'))+" ")]),_c('div',{staticClass:"vis-google-desc"},[_vm._v(" "+_vm._s(_vm.seoDescription || _vm.$t('visibilizer.preview.placeholder.description'))+" ")]),_c('div',{staticClass:"vis-char-row"},[_c('span',{staticClass:"vis-char-label"},[_vm._v(_vm._s(_vm.$t('visibilizer.preview.chars.title')))]),_c('div',{staticClass:"vis-char-bar"},[_c('div',{staticClass:"vis-char-fill",style:(_vm.titleBar)})]),_c('span',{staticClass:"vis-char-count",class:_vm.titleLength > 60 ? 'vis-over' : ''},[_vm._v(_vm._s(_vm.titleLength)+"/60")])]),_c('div',{staticClass:"vis-char-row"},[_c('span',{staticClass:"vis-char-label"},[_vm._v(_vm._s(_vm.$t('visibilizer.preview.chars.description')))]),_c('div',{staticClass:"vis-char-bar"},[_c('div',{staticClass:"vis-char-fill",style:(_vm.descBar)})]),_c('span',{staticClass:"vis-char-count",class:_vm.descLength > 160 ? 'vis-over' : ''},[_vm._v(_vm._s(_vm.descLength)+"/160")])])]):_vm._e(),(_vm.tab === 'social')?_c('div',{staticClass:"vis-og"},[_c('div',{staticClass:"vis-og-image",class:!_vm.ogImageUrl ? 'vis-og-image--empty' : ''},[(_vm.ogImageUrl)?_c('img',{attrs:{"src":_vm.ogImageUrl,"alt":""}}):_c('span',{staticClass:"vis-og-placeholder"},[_vm._v(_vm._s(_vm.$t('visibilizer.preview.placeholder.ogimage')))])]),_c('div',{staticClass:"vis-og-body"},[_c('div',{staticClass:"vis-og-domain"},[(_vm.faviconUrl)?_c('img',{staticClass:"vis-domain-icon",attrs:{"src":_vm.faviconUrl,"alt":""}}):_vm._e(),_vm._v(" "+_vm._s(_vm.displayDomain.split('/')[0].toUpperCase())+" ")]),_c('div',{staticClass:"vis-og-title"},[_vm._v(_vm._s(_vm.ogTitle || _vm.$t('visibilizer.preview.placeholder.title')))]),_c('div',{staticClass:"vis-og-desc"},[_vm._v(_vm._s(_vm.ogDescription || _vm.$t('visibilizer.preview.placeholder.description')))])])]):_vm._e(),(_vm.tab === 'twitter')?_c('div',{staticClass:"vis-twitter"},[_c('div',{staticClass:"vis-twitter-image",class:!_vm.twitterImageUrl ? 'vis-twitter-image--empty' : ''},[(_vm.twitterImageUrl)?_c('img',{attrs:{"src":_vm.twitterImageUrl,"alt":""}}):_c('span',{staticClass:"vis-og-placeholder"},[_vm._v(_vm._s(_vm.$t('visibilizer.preview.placeholder.image')))])]),_c('div',{staticClass:"vis-twitter-body"},[_c('div',{staticClass:"vis-twitter-title"},[_vm._v(_vm._s(_vm.ogTitle || _vm.$t('visibilizer.preview.placeholder.title')))]),_c('div',{staticClass:"vis-twitter-desc"},[_vm._v(_vm._s(_vm.ogDescription || _vm.$t('visibilizer.preview.placeholder.description')))]),_c('div',{staticClass:"vis-twitter-domain",class:{ 'vis-has-icon': _vm.faviconUrl }},[(_vm.faviconUrl)?_c('img',{staticClass:"vis-domain-icon",attrs:{"src":_vm.faviconUrl,"alt":""}}):_vm._e(),_vm._v(" "+_vm._s(_vm.displayDomain.split('/')[0])+" ")])])]):_vm._e(),_c('ul',{staticClass:"vis-checks"},_vm._l((_vm.checks),function(c,i){return _c('li',{key:i,class:['vis-check', 'vis-check--' + c.status]},[_c('span',{staticClass:"vis-check-icon"},[(c.status === 'ok')?_c('span',[_vm._v("✓")]):(c.status === 'warn')?_c('span',[_vm._v("⚠")]):(c.status === 'info')?_c('span',[_vm._v("i")]):_c('span',[_vm._v("✗")])]),_vm._v(" "+_vm._s(c.msg)+" ")])}),0)])])
}
var staticRenderFns = []
return { render, staticRenderFns }
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
    }
  },
  computed: {
    linkRows() {
      return this.links.map(l => ({ ...l, result: this.results[l.href] || l.result }))
    },
    // Niveau de chaque élément, par carte (null = lien externe pas encore vérifié)
    levels() {
      return {
        titles: this.pages.map(p => this.checkLevel(p.checks.title)),
        descriptions: this.pages.map(p => this.checkLevel(p.checks.description)),
        alts: this.images.map(i => this.issuesLevel(i.issues.filter(x => x.key.startsWith('alt_')))),
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
          .map(l => ({ level: l, text: this.$t('visibilizer.count.' + (l === 'pending' ? 'links.' + (this.checking ? 'pending' : 'unchecked') : prefix + l), { count: counts[l] }) }))
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
      return this.images.filter(i => !i.alt && i.generated).length
    },
    pendingLinks() {
      return this.linkRows.filter(l => !l.internal && !l.result).map(l => l.href)
    },
  },
  mounted() {
    // Vérifie les liens externes jamais vérifiés (ou sortis du cache)
    if (this.pendingLinks.length) this.check(this.pendingLinks)
  },
  methods: {
    source(tab) {
      return tab === 'pages' ? this.pages : tab === 'images' ? this.images : this.linkRows
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
      this.$set(this.open, key, !this.open[key])
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
          for (const href of Object.keys(res || {})) this.$set(this.results, href, res[href])
        } catch (e) {
          // Le lot reste sans résultat, signalé sur ses lignes ; une seule notification pour toute la passe
          for (const href of batch) this.$set(this.failed, href, true)
          error = e
        }
        this.checking.done = Math.min(hrefs.length, i + BATCH)
      }
      this.checking = null
      if (error) this.$panel.notification.error(error)
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
  ...(() => {
var render = function render(){var _vm=this,_c=_vm._self._c;return _c('k-panel-inside',{staticClass:"k-visibilizer-view"},[_c('div',{staticClass:"k-vis"},[_c('header',{staticClass:"k-vis-ink k-vis-header"},[_c('h1',[_vm._v(_vm._s(_vm.$t('visibilizer.seo')))]),_c('nav',{staticClass:"k-vis-tabs"},_vm._l((_vm.tabs),function(t){return _c('button',{key:t.key,attrs:{"type":"button","aria-current":t.key === _vm.current ? 'true' : null},on:{"click":function($event){return _vm.select(t.key)}}},[_vm._v(" "+_vm._s(_vm.$t('visibilizer.tab.' + t.key))+" "),(t.count !== null)?_c('span',{staticClass:"k-vis-tab-count"},[_vm._v(_vm._s(t.count))]):_vm._e()])}),0)]),(_vm.current !== 'settings')?_c('div',{staticClass:"k-vis-cards"},_vm._l((_vm.cards),function(c){return _c('button',{key:c.key,staticClass:"k-vis-card",attrs:{"type":"button","data-color":c.color},on:{"click":function($event){return _vm.select(c.tab, c.counts.error ? 'error' : 'all')}}},[_c('span',{staticClass:"k-vis-card-dot",attrs:{"data-size":c.text.length > 3 ? 's' : 'l'}},[_c('span',{staticClass:"k-vis-card-value"},[_vm._v(_vm._s(c.text))]),_c('span',{staticClass:"k-vis-card-unit"},[_vm._v(_vm._s(c.unit))])]),_c('span',{staticClass:"k-vis-card-label"},[_vm._v(_vm._s(_vm.$t('visibilizer.card.' + c.key)))]),_c('span',{staticClass:"k-vis-card-bar",attrs:{"aria-hidden":"true"}},_vm._l((c.segments),function(s){return _c('span',{key:s.level,style:({ width: s.width + '%' }),attrs:{"data-level":s.level}})}),0),_c('span',{staticClass:"k-vis-card-legend"},[_vm._l((c.legend),function(l){return _c('span',{key:l.level,attrs:{"data-level":l.level}},[_vm._v(_vm._s(l.text))])}),(!c.total)?_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.empty')))]):_vm._e()],2)])}),0):_vm._e(),(_vm.current !== 'settings')?_c('div',{staticClass:"k-vis-mode"},[_c('button',{staticClass:"k-vis-switch",attrs:{"type":"button","role":"switch","aria-checked":_vm.fallbacks ? 'true' : 'false'},on:{"click":_vm.toggleFallbacks}},[_c('span',{staticClass:"k-vis-switch-track"},[_c('span',{staticClass:"k-vis-switch-thumb"})]),_vm._v(" "+_vm._s(_vm.$t('visibilizer.fallbacks'))+" ")]),_c('span',{staticClass:"k-vis-muted"},[_vm._v(_vm._s(_vm.$t(_vm.fallbacks ? 'visibilizer.fallbacks.on' : 'visibilizer.fallbacks.off')))])]):_vm._e(),(_vm.current === 'settings')?[_vm._l((_vm.settingsGroups),function(group,i){return [_c('section',{key:group.key,staticClass:"k-vis-block k-vis-settings"},[(i === 0)?_c('div',{staticClass:"k-vis-settings-split"},[_c('k-visibilizer-preview',{staticClass:"k-vis-settings-preview",attrs:{"label":_vm.$t('visibilizer.settings.preview'),"live-values":_vm.form,"live-context":_vm.previewContext,"initial-tab":"social"}}),_c('k-fieldset',{attrs:{"fields":group.fields,"value":_vm.form,"novalidate":true},on:{"input":function($event){_vm.form = $event}}})],1):[_c('k-fieldset',{attrs:{"fields":group.fields,"value":_vm.form,"novalidate":true},on:{"input":function($event){_vm.form = $event}}}),(group.key === 'icon_headline')?_c('div',{staticClass:"k-vis-icon-state"},[(_vm.iconPreviews.length)?_c('div',{staticClass:"k-vis-icon-previews"},_vm._l((_vm.iconPreviews),function(p){return _c('figure',{key:p.key,attrs:{"data-kind":p.key}},[_c('span',{staticClass:"k-vis-icon-frame"},[_c('img',{attrs:{"src":p.src,"alt":""}})]),_c('figcaption',[_vm._v(_vm._s(p.label)+" "),_c('span',{staticClass:"k-vis-muted"},[_vm._v(_vm._s(p.size))])])])}),0):_vm._e(),_c('ul',{staticClass:"k-vis-icon-checks"},_vm._l((_vm.settings.icons.checks),function(c){return _c('li',{key:c.key + (c.data ? c.data.file || '' : '')},[_c('span',{staticClass:"k-vis-dot",attrs:{"data-level":c.level}}),_vm._v(" "+_vm._s(_vm.$t('visibilizer.icon.' + c.key, c.data || {}))+" ")])}),0)]):_vm._e()]],2)]}),_c('div',{staticClass:"k-vis-block k-vis-settings-bar"},[(!_vm.settings.editable)?_c('span',{staticClass:"k-vis-muted"},[_vm._v(_vm._s(_vm.$t('visibilizer.settings.readonly')))]):(_vm.settingsChanged)?_c('span',{staticClass:"k-vis-muted"},[_vm._v(_vm._s(_vm.$t('visibilizer.settings.unsaved')))]):_c('span',{staticClass:"k-vis-muted"},[_vm._v(_vm._s(_vm.$t('visibilizer.settings.stored')))]),_c('span',{staticClass:"k-vis-tools"},[(_vm.settingsChanged)?_c('button',{staticClass:"k-vis-button",attrs:{"type":"button"},on:{"click":_vm.resetSettings}},[_vm._v(_vm._s(_vm.$t('visibilizer.settings.reset')))]):_vm._e(),_c('button',{staticClass:"k-vis-button k-vis-button-primary",attrs:{"type":"button","disabled":!_vm.settingsChanged || _vm.saving || !_vm.settings.editable},on:{"click":_vm.saveSettings}},[_vm._v(" "+_vm._s(_vm.$t(_vm.saving ? 'visibilizer.settings.saving' : 'visibilizer.settings.save'))+" ")])])]),_c('section',{staticClass:"k-vis-block"},[_c('div',{staticClass:"k-vis-files-head"},[_c('h2',{staticClass:"k-vis-caption"},[_vm._v(_vm._s(_vm.$t('visibilizer.files')))]),(_vm.settings.editable)?_c('button',{staticClass:"k-vis-button",attrs:{"type":"button"},on:{"click":_vm.uploadFiles}},[_c('k-icon',{attrs:{"type":"upload"}}),_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.files.upload')))])],1):_vm._e()]),(!_vm.settings.files.length)?_c('p',{staticClass:"k-vis-message"},[_vm._v(_vm._s(_vm.$t('visibilizer.empty')))]):_c('ul',{staticClass:"k-vis-files"},_vm._l((_vm.settings.files),function(file){return _c('li',{key:file.id},[_c('k-link',{staticClass:"k-vis-files-thumb",attrs:{"to":file.panel}},[(file.thumb)?_c('img',{attrs:{"src":file.thumb,"alt":"","loading":"lazy"}}):_vm._e()]),_c('span',{staticClass:"k-vis-files-info"},[_c('k-link',{staticClass:"k-vis-link",attrs:{"to":file.panel}},[_vm._v(_vm._s(file.filename))]),_c('span',{staticClass:"k-vis-path"},[_vm._v(_vm._s(file.niceSize)),(file.size)?[_vm._v(" · "+_vm._s(file.size))]:_vm._e()],2),_c('span',{staticClass:"k-vis-files-used"},[_vm._l((_vm.fileUsage(file)),function(label){return _c('span',{key:label,staticClass:"k-vis-badge"},[_vm._v(_vm._s(label))])}),(!file.used.length)?_c('span',{staticClass:"k-vis-badge k-vis-badge-warn"},[_vm._v(_vm._s(_vm.$t('visibilizer.files.unused')))]):_vm._e()],2)],1)],1)}),0)]),_c('section',{staticClass:"k-vis-block"},[_c('h2',{staticClass:"k-vis-caption"},[_vm._v(_vm._s(_vm.$t('visibilizer.config')))]),_c('dl',{staticClass:"k-vis-config"},[_vm._l((_vm.configRows),function(row){return [_c('dt',{key:row.key + ':k'},[_vm._v(_vm._s(row.key))]),_c('dd',{key:row.key + ':v'},[_vm._v(_vm._s(row.value))])]})],2)])]:_c('section',{staticClass:"k-vis-block"},[_c('div',{staticClass:"k-vis-toolbar"},[_c('nav',{staticClass:"k-vis-filters"},_vm._l((_vm.filters),function(f){return _c('button',{key:f.key,attrs:{"type":"button","data-level":f.key,"aria-current":f.key === _vm.level ? 'true' : null,"disabled":!f.count && f.key !== 'all'},on:{"click":function($event){_vm.level = f.key}}},[(f.key !== 'all')?_c('span',{staticClass:"k-vis-dot",attrs:{"data-level":f.key}}):_vm._e(),_vm._v(" "+_vm._s(_vm.$t(f.key === 'all' ? 'visibilizer.filter.all' : 'visibilizer.level.' + f.key))+" "),_c('span',{staticClass:"k-vis-muted"},[_vm._v(_vm._s(f.count))])])}),0),_c('div',{staticClass:"k-vis-tools"},[(_vm.current === 'images' && _vm.fillable)?_c('button',{staticClass:"k-vis-button",attrs:{"type":"button"},on:{"click":_vm.fill}},[_c('k-icon',{attrs:{"type":"wand"}}),_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.fill'))+" ("+_vm._s(_vm.fillable)+")")])],1):_vm._e(),(_vm.current === 'links' && _vm.links.length)?_c('button',{staticClass:"k-vis-button",attrs:{"type":"button","disabled":!!_vm.checking},on:{"click":_vm.recheck}},[_c('k-icon',{attrs:{"type":"refresh"}}),(_vm.checking)?_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.checking', _vm.checking)))]):_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.recheck')))])],1):_vm._e(),_c('label',{staticClass:"k-vis-search"},[_c('k-icon',{attrs:{"type":"search"}}),_c('input',{directives:[{name:"model",rawName:"v-model",value:(_vm.query),expression:"query"}],attrs:{"type":"search","placeholder":_vm.$t('visibilizer.search')},domProps:{"value":(_vm.query)},on:{"input":function($event){if($event.target.composing)return;_vm.query=$event.target.value}}})],1)])]),(!_vm.source(_vm.current).length)?_c('p',{staticClass:"k-vis-message"},[_vm._v(_vm._s(_vm.$t('visibilizer.empty')))]):(!_vm.rows.length)?_c('p',{staticClass:"k-vis-message"},[_vm._v(_vm._s(_vm.$t('visibilizer.empty.filter')))]):(_vm.current === 'pages')?_c('div',{staticClass:"k-vis-table",attrs:{"data-tab":"pages"}},[_c('div',{staticClass:"k-vis-row k-vis-head"},[_c('span'),_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.col.page')))]),_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.col.title')))]),_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.col.description')))]),_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.col.image')))]),_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.col.index')))]),_c('span')]),_vm._l((_vm.rows),function(row){return [_c('div',{key:row.id,staticClass:"k-vis-row",class:{ open: _vm.open[row.id] },on:{"click":function($event){return _vm.toggle(row.id)}}},[_c('span',{staticClass:"k-vis-dot",attrs:{"data-level":_vm.pageLevel(row),"title":_vm.$t('visibilizer.level.' + _vm.pageLevel(row))}}),_c('span',{staticClass:"k-vis-cell-page"},[_c('k-link',{staticClass:"k-vis-link",attrs:{"to":row.panel},nativeOn:{"click":function($event){$event.stopPropagation();}}},[_vm._v(_vm._s(row.title))]),_c('span',{staticClass:"k-vis-path",attrs:{"title":row.path}},[_vm._v(_vm._s(row.path))])],1),_c('span',{staticClass:"k-vis-cell-text",attrs:{"data-level":_vm.checkLevel(row.checks.title)}},[(row.metaTitle.source !== 'custom')?_c('span',{staticClass:"k-vis-badge"},[_vm._v(_vm._s(_vm.sourceLabel(row.metaTitle)))]):_vm._e(),_c('span',{class:{ 'k-vis-muted': row.metaTitle.source !== 'custom' }},[_vm._v(_vm._s(row.metaTitle.value))])]),_c('span',{staticClass:"k-vis-cell-text k-vis-clamp",attrs:{"data-level":_vm.checkLevel(row.checks.description)}},[(row.description.source !== 'custom' && row.description.source !== 'none')?_c('span',{staticClass:"k-vis-badge"},[_vm._v(_vm._s(_vm.sourceLabel(row.description)))]):_vm._e(),(row.description.value)?_c('span',{class:{ 'k-vis-muted': row.description.source !== 'custom' }},[_vm._v(_vm._s(row.description.value))]):_c('span',{staticClass:"k-vis-muted"},[_vm._v(_vm._s(_vm.$t('visibilizer.none')))])]),_c('span',{staticClass:"k-vis-cell-thumb",attrs:{"data-level":_vm.checkLevel(row.checks.image)}},[(row.image && row.image.thumb)?_c('img',{attrs:{"src":row.image.thumb,"alt":"","loading":"lazy"}}):_vm._e(),(row.image && row.image.source !== 'custom')?_c('span',{staticClass:"k-vis-badge k-vis-thumb-badge",attrs:{"title":_vm.sourceLabel(row.image)}},[_vm._v(_vm._s(row.image.source === 'field' ? row.image.field : _vm.sourceLabel(row.image)))]):_vm._e()]),_c('span',{staticClass:"k-vis-cell-index"},[_c('span',{staticClass:"k-vis-dot",attrs:{"data-level":row.indexable ? 'ok' : 'off',"title":row.indexable ? _vm.$t('visibilizer.indexable') : _vm.$t('visibilizer.noindex', { robots: row.robots })}})]),_c('span',{staticClass:"k-vis-actions",on:{"click":function($event){$event.stopPropagation();}}},[_c('k-link',{attrs:{"to":row.panel,"title":_vm.$t('visibilizer.open.panel')}},[_c('k-icon',{attrs:{"type":"edit"}})],1),_c('a',{attrs:{"href":row.url,"target":"_blank","rel":"noopener","title":_vm.$t('visibilizer.open.site')}},[_c('k-icon',{attrs:{"type":"open"}})],1)],1)]),(_vm.open[row.id])?_c('ul',{key:row.id + ':issues',staticClass:"k-vis-issues"},[_vm._l((_vm.issues(row)),function(i,n){return _c('li',{key:n,class:{ 'k-vis-muted': !_vm.counts(i) }},[_vm._v(_vm._s(_vm.issue(i)))])}),(!_vm.issues(row).length)?_c('li',{attrs:{"data-level":"ok"}},[_vm._v(_vm._s(_vm.$t('visibilizer.level.ok')))]):_vm._e()],2):_vm._e()]})],2):(_vm.current === 'images')?_c('div',{staticClass:"k-vis-table",attrs:{"data-tab":"images"}},[_c('div',{staticClass:"k-vis-row k-vis-head"},[_c('span'),_c('span'),_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.col.file')))]),_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.col.alt')))]),_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.col.weight')))]),_c('span')]),_vm._l((_vm.rows),function(row){return _c('div',{key:row.id,staticClass:"k-vis-row"},[_c('span',{staticClass:"k-vis-dot",attrs:{"data-level":_vm.levelOf(row),"title":row.issues.map(_vm.issue).join(' · ') || _vm.$t('visibilizer.level.ok')}}),_c('span',{staticClass:"k-vis-cell-thumb"},[(row.thumb)?_c('img',{attrs:{"src":row.thumb,"alt":"","loading":"lazy"}}):_vm._e()]),_c('span',{staticClass:"k-vis-cell-page"},[_c('k-link',{staticClass:"k-vis-link",attrs:{"to":row.panel}},[_vm._v(_vm._s(row.filename))]),_c('k-link',{staticClass:"k-vis-path",attrs:{"to":row.parent.panel}},[_vm._v(_vm._s(row.parent.title))])],1),_c('span',{staticClass:"k-vis-cell-text",attrs:{"data-level":_vm.issuesLevel(row.issues.filter(i => i.key.startsWith('alt_')))}},[(row.alt)?_c('span',[_vm._v(_vm._s(row.alt))]):(row.generated)?[_c('span',{staticClass:"k-vis-badge"},[_vm._v(_vm._s(_vm.$t('visibilizer.source.auto')))]),_c('span',{staticClass:"k-vis-muted"},[_vm._v(_vm._s(row.generated))])]:_c('span',{staticClass:"k-vis-flag"},[_vm._v(_vm._s(_vm.$t('visibilizer.issue.alt_missing')))])],2),_c('span',{staticClass:"k-vis-cell-meta"},[_c('span',{class:{ 'k-vis-flag': row.issues.some(i => i.key === 'image_heavy') }},[_vm._v(_vm._s(row.niceSize))]),_c('span',{staticClass:"k-vis-muted"},[_vm._v(_vm._s(row.width)+" × "+_vm._s(row.height))])]),_c('span',{staticClass:"k-vis-actions"},[_c('k-link',{attrs:{"to":row.panel,"title":_vm.$t('visibilizer.open.panel')}},[_c('k-icon',{attrs:{"type":"edit"}})],1),_c('a',{attrs:{"href":row.url,"target":"_blank","rel":"noopener","title":_vm.$t('visibilizer.open.site')}},[_c('k-icon',{attrs:{"type":"open"}})],1)],1)])})],2):_c('div',{staticClass:"k-vis-table",attrs:{"data-tab":"links"}},[_c('div',{staticClass:"k-vis-row k-vis-head"},[_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.col.status')))]),_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.col.link')))]),_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.col.details')))]),_c('span',[_vm._v(_vm._s(_vm.$t('visibilizer.col.from')))]),_c('span')]),_vm._l((_vm.rows),function(row){return [_c('div',{key:row.href,staticClass:"k-vis-row",class:{ open: _vm.open[row.href] },on:{"click":function($event){row.from.length > 1 && _vm.toggle(row.href)}}},[_c('span',{staticClass:"k-vis-cell-status"},[_c('span',{staticClass:"k-vis-dot",attrs:{"data-level":row.result ? row.result.level : 'pending'}}),_c('span',{staticClass:"k-vis-code"},[_vm._v(_vm._s(row.result && row.result.code === 0 ? _vm.$t('visibilizer.link.code_none') : row.result && row.result.code ? row.result.code : '—'))])]),_c('span',{staticClass:"k-vis-cell-page"},[_c('span',{staticClass:"k-vis-href",attrs:{"title":row.href}},[_vm._v(_vm._s(row.label))]),_c('span',{staticClass:"k-vis-path"},[_vm._v(_vm._s(_vm.$t(row.internal ? 'visibilizer.internal' : 'visibilizer.external')))])]),_c('span',{staticClass:"k-vis-cell-text",class:{ 'k-vis-muted': !row.result }},[_vm._v(_vm._s(_vm.linkDetail(row)))]),_c('span',{staticClass:"k-vis-cell-from"},[_c('k-link',{staticClass:"k-vis-link",attrs:{"to":row.from[0].panel},nativeOn:{"click":function($event){$event.stopPropagation();}}},[_vm._v(_vm._s(row.from[0].title))]),(row.from.length > 1)?_c('span',{staticClass:"k-vis-muted",attrs:{"title":row.from.slice(1).map(f => f.title).join(', ')}},[_vm._v(_vm._s(_vm.$t('visibilizer.more', { count: row.from.length - 1 })))]):_vm._e()],1),_c('span',{staticClass:"k-vis-actions",on:{"click":function($event){$event.stopPropagation();}}},[_c('a',{attrs:{"href":row.result && row.result.internal ? row.label : row.href,"target":"_blank","rel":"noopener","title":_vm.$t('visibilizer.open.site')}},[_c('k-icon',{attrs:{"type":"open"}})],1)])]),(_vm.open[row.href])?_c('ul',{key:row.href + ':from',staticClass:"k-vis-issues k-vis-from"},_vm._l((row.from),function(f){return _c('li',{key:f.panel},[_c('k-link',{staticClass:"k-vis-link",attrs:{"to":f.panel}},[_vm._v(_vm._s(f.title))])],1)}),0):_vm._e()]})],2)]),_c('p',{staticClass:"k-vis-footnote"},[_vm._v(_vm._s(_vm.$t('visibilizer.footnote')))]),_c('footer',{staticClass:"k-vis-ink k-vis-footer"},[_c('span',[_vm._v("visibilizer")]),_c('a',{attrs:{"href":"https://rollinger.design","target":"_blank","rel":"noopener"}},[_vm._v("rollinger.design")])])],2)])
}
var staticRenderFns = []
return { render, staticRenderFns }
})(),
}

panel.plugin('rllngr/kirby-visibilizer', {
  sections: {
    'seo-preview': SeoPreview,
  },
  components: {
    'k-visibilizer-preview': SeoPreview,
    'k-visibilizer-seo-view': SeoView,
  },
})
