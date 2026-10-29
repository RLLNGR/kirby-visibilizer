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
  },

  // -----------------------------------------------------------------------
  // Local state
  // -----------------------------------------------------------------------

  data() {
    return {
      tab: 'google',
      ctx: {
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
      },
    };
  },

  // -----------------------------------------------------------------------
  // Computed
  // -----------------------------------------------------------------------

  computed: {

    // Live field values (includes unsaved edits)
    values() {
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
    ogImageUrl() {
      return this.fileUrl(this.values.og_image) || this.ctx.siteOgImageUrl || this.ctx.autoImageUrl || null;
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
      if (!this.hasOgImage && this.ctx.siteOgImage) {
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

  template: `
    <k-section :label="resolvedLabel">
      <div class="vis-preview">

        <!-- Score badge -->
        <div class="vis-score" :class="'vis-score--' + scoreClass">
          <span class="vis-score-number">{{ score }}<small>%</small></span>
          <span class="vis-score-label">{{ scoreLabel }}</span>
        </div>

        <!-- Tabs -->
        <div class="vis-tabs">
          <button
            v-for="t in [['google','Google'],['social',$t('visibilizer.preview.tab.social')],['twitter','Twitter / X']]"
            :key="t[0]"
            :class="['vis-tab', tab === t[0] && 'vis-tab--active']"
            @click="tab = t[0]"
          >{{ t[1] }}</button>
        </div>

        <!-- Google SERP preview -->
        <div v-if="tab === 'google'" class="vis-google">
          <div class="vis-google-header">
            <div class="vis-google-favicon">G</div>
            <div>
              <div class="vis-google-site">{{ ctx.siteTitle }}</div>
              <div class="vis-google-url">{{ displayDomain }}{{ displayPath }}</div>
            </div>
          </div>
          <div class="vis-google-title" :class="titleLength > 60 ? 'vis-truncated' : ''">
            {{ fullTitle || $t('visibilizer.preview.placeholder.title') }}
          </div>
          <div class="vis-google-desc">
            {{ seoDescription || $t('visibilizer.preview.placeholder.description') }}
          </div>
          <div class="vis-char-row">
            <span class="vis-char-label">{{ $t('visibilizer.preview.chars.title') }}</span>
            <div class="vis-char-bar"><div class="vis-char-fill" :style="titleBar"></div></div>
            <span class="vis-char-count" :class="titleLength > 60 ? 'vis-over' : ''">{{ titleLength }}/60</span>
          </div>
          <div class="vis-char-row">
            <span class="vis-char-label">{{ $t('visibilizer.preview.chars.description') }}</span>
            <div class="vis-char-bar"><div class="vis-char-fill" :style="descBar"></div></div>
            <span class="vis-char-count" :class="descLength > 160 ? 'vis-over' : ''">{{ descLength }}/160</span>
          </div>
        </div>

        <!-- OG / Social card -->
        <div v-if="tab === 'social'" class="vis-og">
          <div class="vis-og-image" :class="!ogImageUrl ? 'vis-og-image--empty' : ''">
            <img v-if="ogImageUrl" :src="ogImageUrl" alt="" />
            <span v-else class="vis-og-placeholder">{{ $t('visibilizer.preview.placeholder.ogimage') }}</span>
          </div>
          <div class="vis-og-body">
            <div class="vis-og-domain">{{ displayDomain.split('/')[0].toUpperCase() }}</div>
            <div class="vis-og-title">{{ ogTitle || $t('visibilizer.preview.placeholder.title') }}</div>
            <div class="vis-og-desc">{{ ogDescription || $t('visibilizer.preview.placeholder.description') }}</div>
          </div>
        </div>

        <!-- Twitter / X card -->
        <div v-if="tab === 'twitter'" class="vis-twitter">
          <div class="vis-twitter-image" :class="!twitterImageUrl ? 'vis-twitter-image--empty' : ''">
            <img v-if="twitterImageUrl" :src="twitterImageUrl" alt="" />
            <span v-else class="vis-og-placeholder">{{ $t('visibilizer.preview.placeholder.image') }}</span>
          </div>
          <div class="vis-twitter-body">
            <div class="vis-twitter-title">{{ ogTitle || $t('visibilizer.preview.placeholder.title') }}</div>
            <div class="vis-twitter-desc">{{ ogDescription || $t('visibilizer.preview.placeholder.description') }}</div>
            <div class="vis-twitter-domain">{{ displayDomain.split('/')[0] }}</div>
          </div>
        </div>

        <!-- Checks -->
        <ul class="vis-checks">
          <li
            v-for="(c, i) in checks"
            :key="i"
            :class="['vis-check', 'vis-check--' + c.status]"
          >
            <span class="vis-check-icon">
              <span v-if="c.status === 'ok'">✓</span>
              <span v-else-if="c.status === 'warn'">⚠</span>
              <span v-else-if="c.status === 'info'">i</span>
              <span v-else>✗</span>
            </span>
            {{ c.msg }}
          </li>
        </ul>

      </div>
    </k-section>
  `,
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
  { key: 'titles', color: 'blue', tab: 'pages' },
  { key: 'descriptions', color: 'green', tab: 'pages' },
  { key: 'alts', color: 'magenta', tab: 'images' },
  { key: 'links', color: 'orange', tab: 'links' },
]

const count = (items, level) => items.filter(l => l === level).length
const SeoView = {
  props: {
    tab: String,
    pages: Array,
    images: Array,
    links: Array,
  },
  data() {
    return {
      current: this.tab || 'pages',
      level: 'all',
      query: '',
      open: {},
      results: {},
      checking: null,
      fallbacks: readPref(),
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
        alts: this.images.map(i => (i.altOk ? 'ok' : 'error')),
        links: this.linkRows.map(l => (l.result ? l.result.level : null)),
      }
    },
    cards() {
      return CARDS.map(card => {
        const levels = this.levels[card.key]
        const counts = { ok: count(levels, 'ok'), warn: count(levels, 'warn'), error: count(levels, 'error'), pending: count(levels, null) }
        const done = counts.ok + counts.warn + counts.error
        const score = done ? Math.round(((counts.ok + counts.warn * 0.5) / done) * 100) : null
        // Légende : les textes alternatifs n'ont pas de niveau « acceptable »
        const prefix = card.key === 'links' ? 'links.' : card.key === 'alts' ? 'alts.' : ''
        const legend = ['ok', 'warn', 'error', 'pending']
          .filter(l => counts[l] && (l !== 'warn' || card.key !== 'alts'))
          .map(l => ({ level: l, text: this.$t('visibilizer.count.' + (l === 'pending' ? 'links.' : prefix) + l, { count: counts[l] }) }))
        return {
          ...card,
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
      return row.level
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
    linkDetail(result) {
      if (!result) return this.$t('visibilizer.pending')
      return result.key ? this.$t('visibilizer.link.' + result.key, result) : this.$t('visibilizer.link.ok')
    },
    async check(hrefs, force = false) {
      this.checking = { done: 0, total: hrefs.length }
      for (let i = 0; i < hrefs.length; i += BATCH) {
        const batch = hrefs.slice(i, i + BATCH)
        try {
          const res = await this.$api.post('rllngr/visibilizer-audit/links', { hrefs: batch, force })
          for (const href of Object.keys(res || {})) this.$set(this.results, href, res[href])
        } catch (e) {
          /* on garde l'état précédent */
        }
        this.checking.done = Math.min(hrefs.length, i + BATCH)
      }
      this.checking = null
    },
    async recheck() {
      // Les liens internes sont recalculés côté serveur au rechargement de la vue
      await this.$panel.view.reload()
      this.results = {}
      await this.check(this.links.filter(l => !l.internal).map(l => l.href), true)
    },
  },
  template: `
    <k-panel-inside class="k-visibilizer-view">
      <div class="k-vis">
        <header class="k-vis-ink k-vis-header">
          <h1>{{ $t('visibilizer.seo') }}</h1>
          <nav class="k-vis-tabs">
            <button
              v-for="t in tabs"
              :key="t.key"
              type="button"
              :aria-current="t.key === current ? 'true' : null"
              @click="select(t.key)"
            >
              {{ $t('visibilizer.tab.' + t.key) }}
              <span class="k-vis-tab-count">{{ t.count }}</span>
            </button>
          </nav>
        </header>

        <div class="k-vis-cards">
          <button
            v-for="c in cards"
            :key="c.key"
            type="button"
            class="k-vis-card"
            :data-color="c.color"
            @click="select(c.tab, c.counts.error ? 'error' : 'all')"
          >
            <span class="k-vis-card-dot" :data-size="c.text.length > 3 ? 's' : 'l'">
              <span class="k-vis-card-value">{{ c.text }}</span>
              <span class="k-vis-card-unit">{{ c.unit }}</span>
            </span>
            <span class="k-vis-card-label">{{ $t('visibilizer.card.' + c.key) }}</span>
            <span class="k-vis-card-bar" aria-hidden="true">
              <span v-for="s in c.segments" :key="s.level" :data-level="s.level" :style="{ width: s.width + '%' }"></span>
            </span>
            <span class="k-vis-card-legend">
              <span v-for="l in c.legend" :key="l.level" :data-level="l.level">{{ l.text }}</span>
              <span v-if="!c.total">{{ $t('visibilizer.empty') }}</span>
            </span>
          </button>
        </div>

        <div class="k-vis-mode">
          <button type="button" class="k-vis-switch" role="switch" :aria-checked="fallbacks ? 'true' : 'false'" @click="toggleFallbacks">
            <span class="k-vis-switch-track"><span class="k-vis-switch-thumb"></span></span>
            {{ $t('visibilizer.fallbacks') }}
          </button>
          <span class="k-vis-muted">{{ $t(fallbacks ? 'visibilizer.fallbacks.on' : 'visibilizer.fallbacks.off') }}</span>
        </div>

        <section class="k-vis-block">
          <div class="k-vis-toolbar">
            <nav class="k-vis-filters">
              <button
                v-for="f in filters"
                :key="f.key"
                type="button"
                :data-level="f.key"
                :aria-current="f.key === level ? 'true' : null"
                :disabled="!f.count && f.key !== 'all'"
                @click="level = f.key"
              >
                <span v-if="f.key !== 'all'" class="k-vis-dot" :data-level="f.key"></span>
                {{ $t(f.key === 'all' ? 'visibilizer.filter.all' : 'visibilizer.level.' + f.key) }}
                <span class="k-vis-muted">{{ f.count }}</span>
              </button>
            </nav>
            <div class="k-vis-tools">
              <button v-if="current === 'links' && links.length" type="button" class="k-vis-button" :disabled="!!checking" @click="recheck">
                <k-icon type="refresh" />
                <span v-if="checking">{{ $t('visibilizer.checking', checking) }}</span>
                <span v-else>{{ $t('visibilizer.recheck') }}</span>
              </button>
              <label class="k-vis-search">
                <k-icon type="search" />
                <input v-model="query" type="search" :placeholder="$t('visibilizer.search')" />
              </label>
            </div>
          </div>

          <p v-if="!source(current).length" class="k-vis-message">{{ $t('visibilizer.empty') }}</p>
          <p v-else-if="!rows.length" class="k-vis-message">{{ $t('visibilizer.empty.filter') }}</p>

          <!-- Pages -->
          <div v-else-if="current === 'pages'" class="k-vis-table" data-tab="pages">
            <div class="k-vis-row k-vis-head">
              <span></span>
              <span>{{ $t('visibilizer.col.page') }}</span>
              <span>{{ $t('visibilizer.col.title') }}</span>
              <span>{{ $t('visibilizer.col.description') }}</span>
              <span>{{ $t('visibilizer.col.image') }}</span>
              <span>{{ $t('visibilizer.col.index') }}</span>
              <span></span>
            </div>
            <template v-for="row in rows">
              <div :key="row.id" class="k-vis-row" :class="{ open: open[row.id] }" @click="toggle(row.id)">
                <span class="k-vis-dot" :data-level="pageLevel(row)" :title="$t('visibilizer.level.' + pageLevel(row))"></span>
                <span class="k-vis-cell-page">
                  <k-link :to="row.panel" class="k-vis-link" @click.native.stop>{{ row.title }}</k-link>
                  <span class="k-vis-path" :title="row.path">{{ row.path }}</span>
                </span>
                <span class="k-vis-cell-text" :data-level="checkLevel(row.checks.title)">
                  <span v-if="row.metaTitle.source !== 'custom'" class="k-vis-badge">{{ sourceLabel(row.metaTitle) }}</span>
                  <span :class="{ 'k-vis-muted': row.metaTitle.source !== 'custom' }">{{ row.metaTitle.value }}</span>
                </span>
                <span class="k-vis-cell-text k-vis-clamp" :data-level="checkLevel(row.checks.description)">
                  <span v-if="row.description.source !== 'custom' && row.description.source !== 'none'" class="k-vis-badge">{{ sourceLabel(row.description) }}</span>
                  <span v-if="row.description.value" :class="{ 'k-vis-muted': row.description.source !== 'custom' }">{{ row.description.value }}</span>
                  <span v-else class="k-vis-muted">{{ $t('visibilizer.none') }}</span>
                </span>
                <span class="k-vis-cell-thumb">
                  <img v-if="row.image && row.image.thumb" :src="row.image.thumb" alt="" loading="lazy" />
                  <span v-else class="k-vis-thumb-empty"></span>
                </span>
                <span class="k-vis-cell-index">
                  <span class="k-vis-dot" :data-level="row.indexable ? 'ok' : 'off'" :title="row.indexable ? $t('visibilizer.indexable') : $t('visibilizer.noindex', { robots: row.robots })"></span>
                </span>
                <span class="k-vis-actions" @click.stop>
                  <k-link :to="row.panel" :title="$t('visibilizer.open.panel')"><k-icon type="edit" /></k-link>
                  <a :href="row.url" target="_blank" rel="noopener" :title="$t('visibilizer.open.site')"><k-icon type="open" /></a>
                </span>
              </div>
              <ul v-if="open[row.id]" :key="row.id + ':issues'" class="k-vis-issues">
                <li v-for="(i, n) in issues(row)" :key="n" :class="{ 'k-vis-muted': !counts(i) }">{{ issue(i) }}</li>
                <li v-if="!issues(row).length" data-level="ok">{{ $t('visibilizer.level.ok') }}</li>
              </ul>
            </template>
          </div>

          <!-- Images -->
          <div v-else-if="current === 'images'" class="k-vis-table" data-tab="images">
            <div class="k-vis-row k-vis-head">
              <span></span>
              <span></span>
              <span>{{ $t('visibilizer.col.file') }}</span>
              <span>{{ $t('visibilizer.col.alt') }}</span>
              <span>{{ $t('visibilizer.col.weight') }}</span>
              <span></span>
            </div>
            <div v-for="row in rows" :key="row.id" class="k-vis-row">
              <span class="k-vis-dot" :data-level="row.level" :title="row.issues.map(issue).join(' · ') || $t('visibilizer.level.ok')"></span>
              <span class="k-vis-cell-thumb"><img v-if="row.thumb" :src="row.thumb" alt="" loading="lazy" /></span>
              <span class="k-vis-cell-page">
                <k-link :to="row.panel" class="k-vis-link">{{ row.filename }}</k-link>
                <k-link :to="row.parent.panel" class="k-vis-path">{{ row.parent.title }}</k-link>
              </span>
              <span class="k-vis-cell-text" :data-level="row.altOk ? 'ok' : 'error'">
                <span v-if="row.alt">{{ row.alt }}</span>
                <span v-else class="k-vis-flag">{{ $t('visibilizer.issue.alt_missing') }}</span>
              </span>
              <span class="k-vis-cell-meta">
                <span :class="{ 'k-vis-flag': row.issues.some(i => i.key === 'image_heavy') }">{{ row.niceSize }}</span>
                <span class="k-vis-muted">{{ row.width }} × {{ row.height }}</span>
              </span>
              <span class="k-vis-actions">
                <k-link :to="row.panel" :title="$t('visibilizer.open.panel')"><k-icon type="edit" /></k-link>
                <a :href="row.url" target="_blank" rel="noopener" :title="$t('visibilizer.open.site')"><k-icon type="open" /></a>
              </span>
            </div>
          </div>

          <!-- Liens -->
          <div v-else class="k-vis-table" data-tab="links">
            <div class="k-vis-row k-vis-head">
              <span>{{ $t('visibilizer.col.status') }}</span>
              <span>{{ $t('visibilizer.col.link') }}</span>
              <span>{{ $t('visibilizer.col.details') }}</span>
              <span>{{ $t('visibilizer.col.from') }}</span>
              <span></span>
            </div>
            <template v-for="row in rows">
              <div :key="row.href" class="k-vis-row" :class="{ open: open[row.href] }" @click="row.from.length > 1 && toggle(row.href)">
                <span class="k-vis-cell-status">
                  <span class="k-vis-dot" :data-level="row.result ? row.result.level : 'pending'"></span>
                  <span class="k-vis-code">{{ row.result && row.result.code ? row.result.code : '—' }}</span>
                </span>
                <span class="k-vis-cell-page">
                  <span class="k-vis-href" :title="row.href">{{ row.label }}</span>
                  <span class="k-vis-path">{{ $t(row.internal ? 'visibilizer.internal' : 'visibilizer.external') }}</span>
                </span>
                <span class="k-vis-cell-text" :class="{ 'k-vis-muted': !row.result }">{{ linkDetail(row.result) }}</span>
                <span class="k-vis-cell-from">
                  <k-link :to="row.from[0].panel" class="k-vis-link" @click.native.stop>{{ row.from[0].title }}</k-link>
                  <span v-if="row.from.length > 1" class="k-vis-muted" :title="row.from.slice(1).map(f => f.title).join(', ')">{{ $t('visibilizer.more', { count: row.from.length - 1 }) }}</span>
                </span>
                <span class="k-vis-actions" @click.stop>
                  <a :href="row.result && row.result.internal ? row.label : row.href" target="_blank" rel="noopener" :title="$t('visibilizer.open.site')"><k-icon type="open" /></a>
                </span>
              </div>
              <ul v-if="open[row.href]" :key="row.href + ':from'" class="k-vis-issues k-vis-from">
                <li v-for="f in row.from" :key="f.panel"><k-link :to="f.panel" class="k-vis-link">{{ f.title }}</k-link></li>
              </ul>
            </template>
          </div>
        </section>

        <p class="k-vis-footnote">{{ $t('visibilizer.footnote') }}</p>

        <footer class="k-vis-ink k-vis-footer">
          <span>visibilizer</span>
          <a href="https://rollinger.design" target="_blank" rel="noopener">rollinger.design</a>
        </footer>
      </div>
    </k-panel-inside>
  `,
}

panel.plugin('rllngr/kirby-visibilizer', {
  sections: {
    'seo-preview': SeoPreview,
  },
  components: {
    'k-visibilizer-seo-view': SeoView,
  },
})
