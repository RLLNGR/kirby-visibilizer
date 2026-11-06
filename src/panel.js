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
    // Champ fichiers : Kirby 5 donne [{ image: { url } }, …] dans les valeurs en direct
    fileUrl(value) {
      const first = Array.isArray(value) ? value[0] : null;
      if (!first || typeof first !== 'object') return null;
      return first.image?.url || first.url || null;
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
            <div class="vis-google-favicon" :class="{ 'vis-has-icon': faviconUrl }">
              <img v-if="faviconUrl" :src="faviconUrl" alt="" />
              <template v-else>G</template>
            </div>
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
            <div class="vis-og-domain">
              <img v-if="faviconUrl" class="vis-domain-icon" :src="faviconUrl" alt="" />
              {{ displayDomain.split('/')[0].toUpperCase() }}
            </div>
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
            <div class="vis-twitter-domain" :class="{ 'vis-has-icon': faviconUrl }">
              <img v-if="faviconUrl" class="vis-domain-icon" :src="faviconUrl" alt="" />
              {{ displayDomain.split('/')[0] }}
            </div>
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
        this.$set(this.items, n, row)
        this.$set(this.drafts, row.id, row.alt)
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
      this.$set(this.saving, item.id, true)
      try {
        const row = await this.$api.post('rllngr/visibilizer-audit/alt', { id: item.id, alt: value })
        this.replace([row])
        this.$set(this.done, item.id, true)
      } catch (e) {
        this.$panel.notification.error(e)
      } finally {
        this.$set(this.saving, item.id, false)
      }
    },
    useGenerated(item) {
      this.$set(this.drafts, item.id, item.generated)
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
  beforeDestroy() {
    this.flush()
  },
  template: `
    <k-drawer v-bind="$props" class="k-vis-alts-drawer" @cancel="$emit('cancel')" @submit="$emit('submit')">
      <template #options>
        <k-button
          v-if="fillable"
          class="k-drawer-option"
          icon="wand"
          :text="$t('visibilizer.fill') + ' (' + fillable + ')'"
          :disabled="filling"
          @click="fill"
        />
        <k-button
          class="k-drawer-option"
          icon="filter"
          :theme="pinned ? 'notice' : null"
          :text="$t('visibilizer.alts.only')"
          :disabled="!pinned && !missing"
          @click="toggleOnly"
        />
        <k-button class="k-drawer-option" icon="edit" :link="page.panel" :title="$t('visibilizer.open.panel')" />
      </template>

      <p class="k-vis-alts-summary">
        {{ $t('visibilizer.alts.summary', { count: items.length, missing }) }}
        <span class="k-vis-alts-path">{{ page.path }}</span>
      </p>
      <p v-if="!shown.length" class="k-vis-alts-empty">{{ $t('visibilizer.empty.filter') }}</p>
      <ul class="k-vis-alts">
        <li v-for="item in shown" :key="item.id" :data-level="level(item)">
          <a :href="item.url" target="_blank" rel="noopener" class="k-vis-alts-thumb" :title="$t('visibilizer.open.site')">
            <img v-if="item.thumb" :src="item.thumb" alt="" loading="lazy" />
          </a>
          <div class="k-vis-alts-body">
            <div class="k-vis-alts-head">
              <span class="k-vis-dot" :data-level="level(item)"></span>
              <k-link :to="item.panel" class="k-vis-alts-name">{{ item.filename }}</k-link>
              <span class="k-vis-alts-meta" :data-heavy="heavy(item) ? 'true' : null">{{ item.niceSize }} · {{ item.width }} × {{ item.height }}</span>
            </div>
            <textarea
              rows="2"
              :value="drafts[item.id]"
              :placeholder="item.generated || $t('visibilizer.alts.placeholder')"
              @input="$set(drafts, item.id, $event.target.value); $set(done, item.id, false)"
              @blur="save(item)"
              @keydown.enter.exact.prevent="next"
            ></textarea>
            <div class="k-vis-alts-foot">
              <button v-if="!drafts[item.id] && item.generated" type="button" class="k-vis-alts-use" @click="useGenerated(item)">
                {{ $t('visibilizer.alts.use') }}
              </button>
              <span v-if="saving[item.id]">{{ $t('visibilizer.settings.saving') }}</span>
              <span v-else-if="done[item.id]" data-level="ok">{{ $t('visibilizer.alts.saved') }}</span>
            </div>
          </div>
        </li>
      </ul>
    </k-drawer>
  `,
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
  template: `
    <k-drawer v-bind="$props" class="k-vis-alts-drawer" @cancel="$emit('cancel')" @submit="$emit('submit')">
      <template #options>
        <k-button class="k-drawer-option" icon="edit" :link="page.panel" :title="$t('visibilizer.open.panel')" />
      </template>

      <p class="k-vis-alts-summary">
        {{ $t('visibilizer.links.summary', { count: rows.length, broken }) }}
        <span class="k-vis-alts-path">{{ page.path }}</span>
      </p>
      <ul class="k-vis-alts k-vis-links">
        <li v-for="row in rows" :key="row.href" :data-level="level(row)">
          <div class="k-vis-alts-body">
            <div class="k-vis-alts-head">
              <span class="k-vis-dot" :data-level="level(row)"></span>
              <a :href="row.result && row.result.internal ? row.label : row.href" target="_blank" rel="noopener" class="k-vis-alts-name" :title="row.href">{{ row.label }}</a>
              <span class="k-vis-alts-meta">{{ row.result && row.result.code ? row.result.code : '—' }}</span>
            </div>
            <div class="k-vis-alts-foot">
              <span>{{ $t(row.internal ? 'visibilizer.internal' : 'visibilizer.external') }} · {{ detail(row) }}</span>
              <span v-if="row.from.length > 1">{{ $t('visibilizer.links.elsewhere', { count: row.from.length - 1 }) }}</span>
            </div>
          </div>
        </li>
      </ul>
    </k-drawer>
  `,
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
      this.$set(this.open, key, !this.open[key])
    },
    // Compteurs des textes alternatifs : « 1 image décrite » / « 3 images décrites »
    countText(key, count) {
      return this.$t(key + (count === 1 && key.startsWith('visibilizer.count.alts.') ? '.one' : ''), { count })
    },
    setMode(mode) {
      this.$set(this.modes, this.current, mode)
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
      if (row.node.children.length) this.$set(this.expanded, row.node.id, !row.open)
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
          onSaved: rows => rows.forEach(row => this.$set(this.saved, row.id, row)),
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
          for (const href of Object.keys(res || {})) this.$set(this.results, href, res[href])
        } catch (e) {
          // Le lot reste sans résultat, signalé sur ses lignes ; une seule notification pour toute la passe
          for (const href of batch) this.$set(this.failed, href, true)
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
              <span v-if="t.count !== null" class="k-vis-tab-count">{{ t.count }}</span>
            </button>
          </nav>
        </header>

        <div v-if="current !== 'settings'" class="k-vis-cards">
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

        <div v-if="current !== 'settings'" class="k-vis-mode">
          <button type="button" class="k-vis-switch" role="switch" :aria-checked="fallbacks ? 'true' : 'false'" @click="toggleFallbacks">
            <span class="k-vis-switch-track"><span class="k-vis-switch-thumb"></span></span>
            {{ $t('visibilizer.fallbacks') }}
          </button>
          <span class="k-vis-muted">{{ $t(fallbacks ? 'visibilizer.fallbacks.on' : 'visibilizer.fallbacks.off') }}</span>
        </div>

        <template v-if="current === 'settings'">
          <template v-for="(group, i) in settingsGroups">
            <section :key="group.key" class="k-vis-block k-vis-settings">
              <div v-if="i === 0" class="k-vis-settings-split">
                <k-visibilizer-preview
                  class="k-vis-settings-preview"
                  :label="$t('visibilizer.settings.preview')"
                  :live-values="form"
                  :live-context="previewContext"
                  initial-tab="social"
                />
                <k-fieldset :fields="group.fields" :value="form" :novalidate="true" @input="form = $event" />
              </div>
              <template v-else>
                <k-fieldset :fields="group.fields" :value="form" :novalidate="true" @input="form = $event" />
                <div v-if="group.key === 'icon_headline'" class="k-vis-icon-state">
                  <div v-if="iconPreviews.length" class="k-vis-icon-previews">
                    <figure v-for="p in iconPreviews" :key="p.key" :data-kind="p.key">
                      <span class="k-vis-icon-frame"><img :src="p.src" alt="" /></span>
                      <figcaption>{{ p.label }} <span class="k-vis-muted">{{ p.size }}</span></figcaption>
                    </figure>
                  </div>
                  <ul class="k-vis-icon-checks">
                    <li v-for="c in settings.icons.checks" :key="c.key + (c.data ? c.data.file || '' : '')">
                      <span class="k-vis-dot" :data-level="c.level"></span>
                      {{ $t('visibilizer.icon.' + c.key, c.data || {}) }}
                    </li>
                  </ul>
                </div>
              </template>
            </section>
          </template>
          <div class="k-vis-block k-vis-settings-bar">
              <span v-if="!settings.editable" class="k-vis-muted">{{ $t('visibilizer.settings.readonly') }}</span>
              <span v-else-if="settingsChanged" class="k-vis-muted">{{ $t('visibilizer.settings.unsaved') }}</span>
              <span v-else class="k-vis-muted">{{ $t('visibilizer.settings.stored') }}</span>
              <span class="k-vis-tools">
                <button v-if="settingsChanged" type="button" class="k-vis-button" @click="resetSettings">{{ $t('visibilizer.settings.reset') }}</button>
                <button type="button" class="k-vis-button k-vis-button-primary" :disabled="!settingsChanged || saving || !settings.editable" @click="saveSettings">
                  {{ $t(saving ? 'visibilizer.settings.saving' : 'visibilizer.settings.save') }}
                </button>
              </span>
            </div>

          <section class="k-vis-block">
            <div class="k-vis-files-head">
              <h2 class="k-vis-caption">{{ $t('visibilizer.files') }}</h2>
              <button v-if="settings.editable" type="button" class="k-vis-button" @click="uploadFiles">
                <k-icon type="upload" />
                <span>{{ $t('visibilizer.files.upload') }}</span>
              </button>
            </div>
            <p v-if="!settings.files.length" class="k-vis-message">{{ $t('visibilizer.empty') }}</p>
            <ul v-else class="k-vis-files">
              <li v-for="file in settings.files" :key="file.id">
                <k-link :to="file.panel" class="k-vis-files-thumb">
                  <img v-if="file.thumb" :src="file.thumb" alt="" loading="lazy" />
                </k-link>
                <span class="k-vis-files-info">
                  <k-link :to="file.panel" class="k-vis-link">{{ file.filename }}</k-link>
                  <span class="k-vis-path">{{ file.niceSize }}<template v-if="file.size"> · {{ file.size }}</template></span>
                  <span class="k-vis-files-used">
                    <span v-for="label in fileUsage(file)" :key="label" class="k-vis-badge">{{ label }}</span>
                    <span v-if="!file.used.length" class="k-vis-badge k-vis-badge-warn">{{ $t('visibilizer.files.unused') }}</span>
                  </span>
                </span>
              </li>
            </ul>
          </section>

          <section class="k-vis-block">
            <h2 class="k-vis-caption">{{ $t('visibilizer.config') }}</h2>
            <dl class="k-vis-config">
              <template v-for="row in configRows">
                <dt :key="row.key + ':k'">{{ row.key }}</dt>
                <dd :key="row.key + ':v'">{{ row.value }}</dd>
              </template>
            </dl>
          </section>
        </template>

        <section v-else class="k-vis-block">
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
              <nav v-if="modes[current]" class="k-vis-filters k-vis-modes">
                <button
                  v-for="m in ['pages', 'list']"
                  :key="m"
                  type="button"
                  :aria-current="m === modes[current] ? 'true' : null"
                  @click="setMode(m)"
                >
                  <k-icon :type="m === 'pages' ? 'folder' : 'list-bullet'" />
                  {{ $t('visibilizer.images.' + m) }}
                </button>
              </nav>
              <button v-if="current === 'images' && fillable" type="button" class="k-vis-button" @click="fill">
                <k-icon type="wand" />
                <span>{{ $t('visibilizer.fill') }} ({{ fillable }})</span>
              </button>
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
            <template v-for="row in visibleRows">
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
                <span class="k-vis-cell-thumb" :data-level="checkLevel(row.checks.image)">
                  <img v-if="row.image && row.image.thumb" :src="row.image.thumb" alt="" loading="lazy" />
                  <span v-if="row.image && row.image.source !== 'custom'" class="k-vis-badge k-vis-thumb-badge" :title="sourceLabel(row.image)">{{ row.image.source === 'field' ? row.image.field : sourceLabel(row.image) }}</span>
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

          <!-- Par page (images, liens) : un parent se déplie, une page ouvre son tiroir -->
          <div v-else-if="byPage" class="k-vis-table" data-tab="by-page" :data-kind="current">
            <div class="k-vis-row k-vis-head">
              <span></span>
              <span v-if="current === 'images'"></span>
              <span>{{ $t('visibilizer.col.page') }}</span>
              <span>{{ $t(current === 'images' ? 'visibilizer.col.alt' : 'visibilizer.col.status') }}</span>
              <span>{{ $t('visibilizer.tab.' + current) }}</span>
              <span></span>
            </div>
            <div v-for="row in pageRows" :key="row.node.id" class="k-vis-row" :data-depth="row.depth" @click="clickNode(row)">
              <span class="k-vis-dot" :data-level="row.level" :title="$t('visibilizer.level.' + (row.level === 'pending' ? 'ok' : row.level))"></span>
              <span v-if="current === 'images'" class="k-vis-stack">
                <img v-for="i in row.thumbs" :key="i.id" :src="i.thumb" alt="" loading="lazy" />
              </span>
              <span class="k-vis-cell-page k-vis-cell-tree" :style="{ paddingLeft: row.depth * 1.25 + 'rem' }">
                <span class="k-vis-link">
                  <k-icon v-if="row.node.children.length" :type="row.open ? 'angle-down' : 'angle-right'" class="k-vis-chevron" />
                  {{ row.node.title }}
                </span>
                <span class="k-vis-path" :title="row.node.path">
                  {{ row.node.path }}<template v-if="row.pages"> · {{ $t('visibilizer.subpages', { count: row.pages }) }}</template>
                </span>
              </span>
              <span class="k-vis-cell-text k-vis-legend" :data-level="row.legendLevel || row.level">
                <span v-for="l in row.legend" :key="l.level" :data-level="l.level">{{ l.text }}</span>
              </span>
              <span class="k-vis-cell-meta">
                <span>{{ row.total }}</span>
                <span v-if="row.heavy" class="k-vis-flag">{{ $t('visibilizer.images.heavy', { count: row.heavy }) }}</span>
              </span>
              <span class="k-vis-actions" @click.stop>
                <button
                  v-if="row.node.items.length"
                  type="button"
                  :title="$t(current === 'images' ? 'visibilizer.images.open' : 'visibilizer.links.open')"
                  @click="openNode(row.node)"
                >
                  <k-icon :type="current === 'images' ? 'image' : 'url'" />
                </button>
                <k-link v-if="row.node.panel" :to="row.node.panel" :title="$t('visibilizer.open.panel')"><k-icon type="edit" /></k-link>
              </span>
            </div>
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
            <div v-for="row in visibleRows" :key="row.id" class="k-vis-row">
              <span class="k-vis-dot" :data-level="levelOf(row)" :title="row.issues.map(issue).join(' · ') || $t('visibilizer.level.ok')"></span>
              <span class="k-vis-cell-thumb"><img v-if="row.thumb" :src="row.thumb" alt="" loading="lazy" /></span>
              <span class="k-vis-cell-page">
                <k-link :to="row.panel" class="k-vis-link">{{ row.filename }}</k-link>
                <k-link :to="row.parent.panel" class="k-vis-path">{{ row.parent.title }}</k-link>
              </span>
              <span class="k-vis-cell-text" :data-level="issuesLevel(row.issues.filter(i => i.key.startsWith('alt_')))">
                <span v-if="row.alt">{{ row.alt }}</span>
                <template v-else-if="row.generated">
                  <span class="k-vis-badge">{{ $t('visibilizer.source.auto') }}</span>
                  <span class="k-vis-muted">{{ row.generated }}</span>
                </template>
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
            <template v-for="row in visibleRows">
              <div :key="row.href" class="k-vis-row" :class="{ open: open[row.href] }" @click="row.from.length > 1 && toggle(row.href)">
                <span class="k-vis-cell-status">
                  <span class="k-vis-dot" :data-level="row.result ? row.result.level : 'pending'"></span>
                  <span class="k-vis-code">{{ row.result && row.result.code === 0 ? $t('visibilizer.link.code_none') : row.result && row.result.code ? row.result.code : '—' }}</span>
                </span>
                <span class="k-vis-cell-page">
                  <span class="k-vis-href" :title="row.href">{{ row.label }}</span>
                  <span class="k-vis-path">{{ $t(row.internal ? 'visibilizer.internal' : 'visibilizer.external') }}</span>
                </span>
                <span class="k-vis-cell-text" :class="{ 'k-vis-muted': !row.result }">{{ linkDetail(row) }}</span>
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
          <button
            v-if="rows.length > limit && !byPage"
            type="button"
            class="k-vis-button k-vis-more"
            @click="limit += step"
          >
            {{ $t('visibilizer.showMore', { count: Math.min(step, rows.length - limit), total: rows.length - limit }) }}
          </button>
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
    'k-visibilizer-preview': SeoPreview,
    'k-visibilizer-seo-view': SeoView,
    'k-visibilizer-alts-drawer': AltsDrawer,
    'k-visibilizer-links-drawer': LinksDrawer,
  },
})
