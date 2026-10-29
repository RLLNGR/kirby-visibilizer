panel.plugin('rllngr/kirby-visibilizer', {
  sections: {
    'seo-preview': {

      // -----------------------------------------------------------------------
      // Props (from blueprint YAML)
      // -----------------------------------------------------------------------

      props: {
        label: { type: String, default: 'SEO Preview' },
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
          },
        };
      },

      // -----------------------------------------------------------------------
      // Computed
      // -----------------------------------------------------------------------

      computed: {

        // Live field values from the Kirby panel content store (includes unsaved edits)
        values() {
          try {
            const id    = this.$store.state.content?.current;
            const model = this.$store.state.content?.models?.[id];
            return { ...model?.originals, ...model?.changes };
          } catch {
            return {};
          }
        },

        seoTitle() {
          return this.values.seo_title || this.ctx.pageTitle || '';
        },

        fullTitle() {
          const t = this.seoTitle;
          const s = this.ctx.siteTitle;
          if (!t || t === s) return s;
          return `${t}${this.ctx.separator}${s}`;
        },

        seoDescription() {
          return this.values.seo_description || '';
        },

        ogTitle() {
          return this.values.og_title || this.seoTitle;
        },

        ogDescription() {
          return this.values.og_description || this.seoDescription;
        },

        hasOgImage() {
          const v = this.values.og_image;
          return !!(v && v.trim() && v.trim() !== '-');
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
          return (this.ctx.pageUrl || this.ctx.siteUrl || '')
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '');
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

        // --- Checks ---

        checks() {
          const items = [];

          // Title
          if (!this.values.seo_title) {
            items.push({ status: 'warn', msg: 'SEO title not set — page title used as fallback' });
          } else if (this.titleLength > 60) {
            items.push({ status: 'error', msg: `Title too long — ${this.titleLength} / 60 chars` });
          } else {
            items.push({ status: 'ok', msg: `Title — ${this.titleLength} / 60 chars` });
          }

          // Description
          if (!this.seoDescription) {
            items.push({ status: 'error', msg: 'Meta description missing' });
          } else if (this.descLength > 160) {
            items.push({ status: 'warn', msg: `Description too long — ${this.descLength} / 160 chars` });
          } else if (this.descLength < 80) {
            items.push({ status: 'warn', msg: `Description short — ${this.descLength} / 160 chars` });
          } else {
            items.push({ status: 'ok', msg: `Description — ${this.descLength} / 160 chars` });
          }

          // OG image
          if (!this.hasOgImage) {
            items.push({ status: 'warn', msg: 'OG image not set — social shares will have no image' });
          } else {
            items.push({ status: 'ok', msg: 'OG image set' });
          }

          // Robots
          if (!this.isIndexed) {
            items.push({ status: 'warn', msg: `Robots: ${this.robots}` });
          } else {
            items.push({ status: 'ok', msg: `Robots: ${this.robots}` });
          }

          return items;
        },

        score() {
          const ok = this.checks.filter(c => c.status === 'ok').length;
          return Math.round((ok / this.checks.length) * 100);
        },

        scoreLabel() {
          if (this.score >= 75) return 'Good';
          if (this.score >= 50) return 'Average';
          return 'Needs work';
        },

        scoreClass() {
          if (this.score >= 75) return 'ok';
          if (this.score >= 50) return 'warn';
          return 'error';
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
        async loadContext() {
          try {
            const id   = this.$store.state.content?.current;
            if (!id) return;
            const slug = id.replace(/\//g, '+');
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
        <k-section :label="label">
          <div class="vis-preview">

            <!-- Score badge -->
            <div class="vis-score" :class="'vis-score--' + scoreClass">
              <span class="vis-score-number">{{ score }}<small>%</small></span>
              <span class="vis-score-label">{{ scoreLabel }}</span>
            </div>

            <!-- Tabs -->
            <div class="vis-tabs">
              <button
                v-for="t in [['google','Google'],['social','Social'],['twitter','Twitter / X']]"
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
                {{ fullTitle || 'Page title' }}
              </div>
              <div class="vis-google-desc">
                {{ seoDescription || 'No meta description set.' }}
              </div>
              <div class="vis-char-row">
                <span class="vis-char-label">Title</span>
                <div class="vis-char-bar"><div class="vis-char-fill" :style="titleBar"></div></div>
                <span class="vis-char-count" :class="titleLength > 60 ? 'vis-over' : ''">{{ titleLength }}/60</span>
              </div>
              <div class="vis-char-row">
                <span class="vis-char-label">Desc.</span>
                <div class="vis-char-bar"><div class="vis-char-fill" :style="descBar"></div></div>
                <span class="vis-char-count" :class="descLength > 160 ? 'vis-over' : ''">{{ descLength }}/160</span>
              </div>
            </div>

            <!-- OG / Social card -->
            <div v-if="tab === 'social'" class="vis-og">
              <div class="vis-og-image" :class="!hasOgImage ? 'vis-og-image--empty' : ''">
                <span v-if="!hasOgImage" class="vis-og-placeholder">No OG image — 1200 × 630 px recommended</span>
              </div>
              <div class="vis-og-body">
                <div class="vis-og-domain">{{ displayDomain.split('/')[0].toUpperCase() }}</div>
                <div class="vis-og-title">{{ ogTitle || 'OG title' }}</div>
                <div class="vis-og-desc">{{ ogDescription || 'OG description' }}</div>
              </div>
            </div>

            <!-- Twitter / X card -->
            <div v-if="tab === 'twitter'" class="vis-twitter">
              <div class="vis-twitter-image" :class="!hasOgImage ? 'vis-twitter-image--empty' : ''">
                <span v-if="!hasOgImage" class="vis-og-placeholder">No image set</span>
              </div>
              <div class="vis-twitter-body">
                <div class="vis-twitter-title">{{ ogTitle || 'Twitter title' }}</div>
                <div class="vis-twitter-desc">{{ ogDescription || 'Twitter description' }}</div>
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
                  <span v-else>✗</span>
                </span>
                {{ c.msg }}
              </li>
            </ul>

          </div>
        </k-section>
      `,
    },
  },
});
