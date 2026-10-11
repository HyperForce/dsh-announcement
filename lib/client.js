/**
 * dsh-announcement browser half: the update announcement popup + the
 * settings card. Hand-written ModuleLoader module (no build step).
 *
 * On apply the client fetches /api/announcement/state once (and re-fetches on
 * tab focus plus a 60s visible-only poll); when an announcement exists and
 * THIS browser has not
 * acknowledged it, a themed modal pops over the whole page (body-mounted
 * createRoot portal, independent of the host React tree). The read record is
 * PER BROWSER — localStorage `dsh-announcement.read` {id, epoch}: 我知道了
 * stores it locally (and reports it to the server, informational only), so
 * every browser's first visit pops once; reloads stay quiet until the
 * announcement changes, the server's re-arm epoch is bumped (清除弹窗记录 or
 * a core version change), or storage is unavailable.
 *
 * The settings card registers into the `plugins.bundle.config` slot keyed by
 * PACKAGE name (the Plugins panel's per-bundle config page, the seat that
 * works on 0.1.7+ where settingsScope/settings.register are gone; pattern
 * mirrors dsh-better-workspace 0.23 / dsh-workspace-lock 0.4.0). The card can
 * clear the popup record (re-arms the popup) and edit/remove the announcement
 * (a save mints a fresh id, which re-arms by itself).
 *
 * Requires ONLY `react` + `react-dom/client` — both shell-guaranteed module
 * table seeds on every core this plugin supports. Scheduling is
 * setTimeout(0) only (requestAnimationFrame never fires in the embedded
 * renderer). Mount problems are logged, never thrown — an external plugin
 * must not take the GUI down.
 */
window.__ModuleLoader__.load({
  id: 'dsh-announcement',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const react = require('react')
    const { createRoot } = require('react-dom/client')
    // Children are passed varargs-style (createElement signature), NOT as
    // jsx-runtime props.children — do not swap this for react/jsx-runtime.
    const h = react.createElement

    const STATE_API = '/api/announcement/state'

    // ---------------------------------------------------------------- texts

    const TEXT = {
      zh: {
        'ack': '我知道了',
        'published': '发布于',
        'card.title': '更新公告',
        'card.desc': '系统更新或公告变更后，每个浏览器的首次访问会自动弹窗；已打开的页面最长约 1 分钟内自动弹出，无需刷新。',
        'card.record': '弹窗记录',
        'card.recordLocal': '本浏览器',
        'card.recordGlobal': '最近已读（全局）',
        'record.read': '已读',
        'record.unread': '未读（下次加载将弹窗）',
        'record.globalNone': '无记录',
        'record.noneAnnouncement': '未设置公告',
        'card.clearHint': '清除后所有浏览器都会重新弹窗',
        'card.editor': '公告内容',
        'card.titleField': '标题',
        'card.contentField': '内容',
        'card.titlePlaceholder': '公告标题（默认：系统公告）',
        'card.contentPlaceholder': '公告正文（纯文本，换行会按原样显示）',
        'card.save': '保存并重新弹窗',
        'card.clear': '清除弹窗记录',
        'card.remove': '移除公告',
        'card.removeConfirm': '确认移除？',
        'card.saved': '公告已保存，已触发重新弹窗',
        'card.cleared': '弹窗记录已清除，已触发重新弹窗',
        'card.removed': '公告已移除，不再弹窗',
        'card.busy': '处理中…',
        'card.saveRequired': '请填写公告内容',
        'card.version': '核心版本',
        'card.versionHint': '检测到核心版本变化时自动重新弹窗（更新后自动弹窗）',
        'card.error': '操作失败',
        'card.loadFailed': '公告状态加载失败',
      },
      en: {
        'ack': 'Got it',
        'published': 'Published',
        'card.title': 'Update announcement',
        'card.desc': 'After each system update or announcement change, the first visit from EVERY browser pops the announcement; open pages re-check every minute — no reload needed.',
        'card.record': 'Popup record',
        'card.recordLocal': 'This browser',
        'card.recordGlobal': 'Last read (global)',
        'record.read': 'Read',
        'record.unread': 'Unread (the popup shows on the next page load)',
        'record.globalNone': 'None',
        'record.noneAnnouncement': 'No announcement configured',
        'card.clearHint': 'Clearing re-arms every browser',
        'card.editor': 'Announcement',
        'card.titleField': 'Title',
        'card.contentField': 'Body',
        'card.titlePlaceholder': 'Announcement title (default: 系统公告)',
        'card.contentPlaceholder': 'Announcement body (plain text; line breaks are kept)',
        'card.save': 'Save and re-arm popup',
        'card.clear': 'Clear popup record',
        'card.remove': 'Remove announcement',
        'card.removeConfirm': 'Remove for sure?',
        'card.saved': 'Announcement saved; the popup is re-armed',
        'card.cleared': 'Popup record cleared; the popup is re-armed',
        'card.removed': 'Announcement removed; no more popups',
        'card.busy': 'Working…',
        'card.saveRequired': 'Enter the announcement body',
        'card.version': 'Core version',
        'card.versionHint': 'A core version change re-arms the popup automatically (auto popup after updates)',
        'card.error': 'Operation failed',
        'card.loadFailed': 'Failed to load announcement state',
      },
    }
    const ZH = String((typeof navigator !== 'undefined' && navigator.language) || 'en').toLowerCase().startsWith('zh')
    const T = (k) => (TEXT[ZH ? 'zh' : 'en'][k] ?? k)

    /**
     * Megaphone icon in the official Outline16 style (16×16, stroke-based,
     * currentColor). The primitives package has no announcement glyph, so
     * this is hand-drawn to match IconEditOutline16 weight.
     */
    const MEGAPHONE_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6.6h1.6L11 3.6a.6.6 0 0 1 .9.5v7.8a.6.6 0 0 1-.9.5L4.6 9.4H3a.9.9 0 0 1-.9-.9v-1a.9.9 0 0 1 .9-.9Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M6.1 9.7l.9 2.35a.75.75 0 0 1-1.4.53L4.85 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.3 6.1a2.5 2.5 0 0 1 0 3.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>'

    // ---------------------------------------------------------------- styles

    // Theme tokens follow the SYSTEM (same signal the DSH app itself uses):
    // light values by default, dark values under prefers-color-scheme: dark.
    const CSS = `
      :where(.announcement-card),.announcement-modalBack{
        --announcement-card:#ffffff;--announcement-border:#e3e6ea;--announcement-text:#1f2328;--announcement-muted:#7a828c;--announcement-faint:#9aa2ab;
        --announcement-input-bg:#ffffff;--announcement-input-border:#d4d9df;
        --announcement-btn-bg:#ffffff;--announcement-btn-border:rgba(28,60,110,.25);--announcement-btn-hover:rgba(28,60,110,.06);
        --announcement-danger:#b3261e;--announcement-danger-border:rgba(180,40,40,.4);
        --announcement-backdrop:rgba(15,20,30,.45);--announcement-shadow:0 10px 36px rgba(20,30,50,.16);
        --announcement-accent:#2456c4;
        color-scheme:light;
      }
      @media (prefers-color-scheme: dark){
        :where(.announcement-card),.announcement-modalBack{
          --announcement-card:#22262d;--announcement-border:#343a44;--announcement-text:#e6e8eb;--announcement-muted:#9aa2ab;--announcement-faint:#7a828c;
          --announcement-input-bg:#1a1d22;--announcement-input-border:#3c424c;
          --announcement-btn-bg:#22262d;--announcement-btn-border:#3c424c;--announcement-btn-hover:rgba(255,255,255,.07);
          --announcement-danger:#f28b82;--announcement-danger-border:rgba(242,139,130,.45);
          --announcement-backdrop:rgba(0,0,0,.55);--announcement-shadow:0 10px 36px rgba(0,0,0,.5);
          --announcement-accent:#5b8def;
          color-scheme:dark;
        }
      }
      .announcement-modalBack{position:fixed;inset:0;background:var(--announcement-backdrop);display:flex;align-items:center;
        justify-content:center;z-index:10000;padding:24px;
        font:14px/1.6 -apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif}
      .announcement-modal{background:var(--announcement-card);border:1px solid var(--announcement-border);border-radius:14px;
        box-shadow:var(--announcement-shadow);padding:22px 24px;width:560px;max-width:100%;max-height:80vh;color:var(--announcement-text);
        display:flex;flex-direction:column}
      .announcement-modalHead{display:flex;align-items:center;gap:10px;min-width:0}
      .announcement-modalIcon{display:inline-flex;flex:none;color:var(--announcement-accent)}
      .announcement-modalIcon svg{width:22px;height:22px;display:block}
      .announcement-modalTitle{font-size:16px;font-weight:600;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .announcement-modalMeta{color:var(--announcement-faint);font-size:11.5px;margin:10px 0 0}
      .announcement-content{margin:10px 0 0;white-space:pre-wrap;word-break:break-word;overflow:auto;
        font-size:13.5px;line-height:1.75;min-height:0}
      .announcement-modalActions{display:flex;justify-content:flex-end;margin-top:18px}
      .announcement-btn{border:1px solid var(--announcement-btn-border);background:var(--announcement-btn-bg);color:var(--announcement-text);
        border-radius:8px;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer}
      .announcement-btn:hover{background:var(--announcement-btn-hover)}
      .announcement-btn:disabled{opacity:.55;cursor:default}
      .announcement-btnPrimary{background:var(--announcement-accent);border-color:var(--announcement-accent);color:#fff}
      .announcement-btnPrimary:hover{filter:brightness(.94);background:var(--announcement-accent)}
      .announcement-btnDanger{background:var(--announcement-btn-bg);border-color:var(--announcement-danger-border);color:var(--announcement-danger)}
      .announcement-btnDanger:hover{background:var(--announcement-btn-hover)}
      /* Settings card (Plugins panel → 更新公告). The plugin owns its chrome
         and renders with its own tokens, which follow the system theme. */
      .announcement-card{color:var(--announcement-text);
        font:14px/1.6 -apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;
        max-width:640px;padding:4px 2px}
      .announcement-cardTitle{font-size:15px;font-weight:600;margin:0 0 4px}
      .announcement-cardDesc{color:var(--announcement-muted);font-size:12.5px;margin:0 0 14px}
      .announcement-section{border:1px solid var(--announcement-border);border-radius:10px;padding:12px 14px;margin:0 0 12px}
      .announcement-sectionTitle{font-size:13px;font-weight:600;margin:0 0 8px}
      .announcement-statusRow{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
      .announcement-statusLabel{color:var(--announcement-muted);font-size:12.5px;flex:none}
      .announcement-statusValue{font-size:12.5px}
      .announcement-statusActions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
      .announcement-metaLine{color:var(--announcement-faint);font-size:11.5px;margin:8px 0 0}
      .announcement-field{display:flex;flex-direction:column;gap:4px;margin:0 0 10px}
      .announcement-fieldLabel{color:var(--announcement-muted);font-size:12px}
      .announcement-input,.announcement-textarea{width:100%;box-sizing:border-box;border:1px solid var(--announcement-input-border);
        border-radius:8px;padding:7px 10px;font:inherit;font-size:13px;background:var(--announcement-input-bg);color:var(--announcement-text)}
      .announcement-textarea{min-height:110px;resize:vertical;line-height:1.6}
      .announcement-input:focus,.announcement-textarea:focus{outline:2px solid rgba(36,86,196,.35);border-color:var(--announcement-accent)}
      .announcement-msg{font-size:12.5px;margin:10px 0 0;color:var(--announcement-muted)}
      .announcement-msgErr{color:var(--announcement-danger)}
      .announcement-versionHint{color:var(--announcement-faint);font-size:11.5px;margin:12px 0 0}
    `

    function ensureStyles() {
      if (document.getElementById('announcement-style') !== null) return
      const style = document.createElement('style')
      style.id = 'announcement-style'
      style.textContent = CSS
      // FIRST child of <head>: host stylesheets come after ours, so host
      // rules win the cascade if selectors ever overlap.
      const first = document.head.firstChild
      if (first) document.head.insertBefore(style, first)
      else document.head.appendChild(style)
    }

    // ----------------------------------------------------------------- store

    function createStore(initial) {
      const listeners = new Set()
      let state = initial
      const emit = () => {
        for (const listener of listeners) {
          try { listener() } catch { /* listener bugs must not break the rest */ }
        }
      }
      return {
        get: () => state,
        set(patch) { state = { ...state, ...patch }; emit() },
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
      }
    }

    function useStoreSnapshot(store) {
      const [snapshot, setSnapshot] = react.useState(store.get())
      react.useEffect(() => store.subscribe(() => setSnapshot(store.get())), [store])
      return snapshot
    }

    // ------------------------------------------------------------ server API

    async function fetchState() {
      const response = await fetch(STATE_API, { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = await response.json()
      if (!body || body.ok !== true) throw new Error('bad-response')
      return {
        announcement: body.announcement && typeof body.announcement === 'object' ? body.announcement : null,
        ack: body.ack && typeof body.ack === 'object' ? body.ack : null,
        lastCoreVersion: typeof body.lastCoreVersion === 'string' ? body.lastCoreVersion : null,
        ackEpoch: typeof body.ackEpoch === 'number' && Number.isFinite(body.ackEpoch) && body.ackEpoch >= 0 ? body.ackEpoch : 0,
      }
    }

    async function postAnnouncement(endpoint, body) {
      const response = await fetch('/api/announcement/' + endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      let data = {}
      try { data = await response.json() } catch { /* non-json error body */ }
      if (!response.ok || data.ok !== true) {
        const error = new Error(data.error || `HTTP ${response.status}`)
        error.code = data.error
        throw error
      }
      return data
    }

    // ------------------------------------------------- per-browser read record

    // localStorage key: {"id": <announcementId>, "epoch": <ackEpoch at read
    // time>}. The popup shows while the stored record lags the server state
    // (different announcement id, or the server's re-arm epoch moved past
    // the recorded one). try/catch throughout: privacy modes and disabled
    // storage must not break the plugin — worst case the popup shows on
    // every load of that browser.
    const READ_KEY = 'dsh-announcement.read'

    function readLocal() {
      try {
        const raw = window.localStorage.getItem(READ_KEY)
        if (raw === null) return null
        const parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
        if (typeof parsed.id !== 'string' || typeof parsed.epoch !== 'number' || !Number.isFinite(parsed.epoch)) return null
        return { id: parsed.id, epoch: parsed.epoch }
      } catch {
        return null
      }
    }

    function writeLocal(id, epoch) {
      try {
        window.localStorage.setItem(READ_KEY, JSON.stringify({ id, epoch }))
      } catch {
        // Storage unavailable: the popup will simply re-show on next load.
      }
    }

    /** True when THIS browser has acknowledged the current announcement/epoch. */
    function readByBrowser(data) {
      if (!data || data.announcement === null) return false
      const stored = readLocal()
      if (stored === null) return false
      return stored.id === data.announcement.id && stored.epoch >= data.ackEpoch
    }

    function formatWhen(iso) {
      if (typeof iso !== 'string' || iso === '') return ''
      try {
        const ms = Date.parse(iso)
        if (Number.isNaN(ms)) return iso
        return new Date(ms).toLocaleString()
      } catch {
        return iso
      }
    }

    // -------------------------------------------------------------- components

    function AnnouncementModal(props) {
      const { announcement, onConfirm } = props
      const [busy, setBusy] = react.useState(false)
      const confirm = async () => {
        if (busy) return
        setBusy(true)
        try { await onConfirm() } finally { setBusy(false) }
      }
      return h('div', { className: 'announcement-modalBack', role: 'dialog', 'aria-modal': 'true', 'aria-label': announcement.title },
        h('div', { className: 'announcement-modal' },
          h('div', { className: 'announcement-modalHead' },
            h('span', { className: 'announcement-modalIcon', dangerouslySetInnerHTML: { __html: MEGAPHONE_SVG } }),
            h('h2', { className: 'announcement-modalTitle' }, announcement.title),
          ),
          h('p', { className: 'announcement-modalMeta' },
            `${T('published')} ${formatWhen(announcement.updatedAt)}`),
          h('div', { className: 'announcement-content' }, announcement.content),
          h('div', { className: 'announcement-modalActions' },
            h('button', {
              type: 'button',
              className: 'announcement-btn announcement-btnPrimary',
              onClick: confirm,
              disabled: busy,
            }, busy ? T('card.busy') : T('ack')),
          ),
        ),
      )
    }

    /** Top of the body portal: null unless an unacknowledged announcement exists. */
    function AnnouncementApp(props) {
      const { data, onAck } = props
      if (!data || data.announcement === null || readByBrowser(data)) return null
      return h(AnnouncementModal, { announcement: data.announcement, onConfirm: onAck })
    }

    function SettingsCard(props) {
      const { data, actions } = props
      // draft === null means untouched: the fields mirror the stored
      // announcement (and follow server updates) until the user types.
      const [draft, setDraft] = react.useState(null)
      const [busy, setBusy] = react.useState(false)
      const [msg, setMsg] = react.useState(null) // { text, error }
      const [confirmRemove, setConfirmRemove] = react.useState(false)
      const stored = data && data.announcement !== null ? data.announcement : null
      const title = draft !== null ? draft.title : (stored ? stored.title : '')
      const content = draft !== null ? draft.content : (stored ? stored.content : '')
      const localRead = stored === null
        ? T('record.noneAnnouncement')
        : (readByBrowser(data) ? T('record.read') : T('record.unread'))
      const globalRead = data && data.ack !== null && data.ack.ts ? `${formatWhen(data.ack.ts)}` : T('record.globalNone')
      react.useEffect(() => {
        if (!confirmRemove) return undefined
        const timer = setTimeout(() => setConfirmRemove(false), 4000)
        return () => clearTimeout(timer)
      }, [confirmRemove])
      const run = async (action, doneText) => {
        if (busy) return
        setBusy(true)
        setMsg(null)
        try {
          await action()
          setMsg({ text: doneText })
        } catch (error) {
          setMsg({ text: `${T('card.error')}: ${String(error && error.message || error)}`, error: true })
        } finally {
          setBusy(false)
          setConfirmRemove(false)
        }
      }
      const save = () => {
        if (content.trim() === '') { setMsg({ text: T('card.saveRequired'), error: true }); return }
        void run(() => actions.save({ title, content }), T('card.saved'))
      }
      const clearRecord = () => void run(() => actions.clearAck(), T('card.cleared'))
      const remove = () => void run(() => actions.remove(), T('card.removed'))
      return h('div', { className: 'announcement-card' },
        h('h3', { className: 'announcement-cardTitle' }, T('card.title')),
        h('p', { className: 'announcement-cardDesc' }, T('card.desc')),
        h('div', { className: 'announcement-section' },
          h('div', { className: 'announcement-sectionTitle' }, T('card.record')),
          h('div', { className: 'announcement-statusRow' },
            h('span', { className: 'announcement-statusLabel' }, T('card.recordLocal')),
            h('span', { className: 'announcement-statusValue' }, localRead),
          ),
          h('div', { className: 'announcement-statusRow' },
            h('span', { className: 'announcement-statusLabel' }, T('card.recordGlobal')),
            h('span', { className: 'announcement-statusValue' }, globalRead),
          ),
          h('div', { className: 'announcement-statusActions' },
            h('button', {
              type: 'button',
              className: 'announcement-btn announcement-btnPrimary',
              onClick: clearRecord,
              disabled: busy || stored === null,
            }, T('card.clear')),
            stored !== null ? h('button', {
              type: 'button',
              className: 'announcement-btn announcement-btnDanger',
              onClick: confirmRemove ? remove : () => setConfirmRemove(true),
              disabled: busy,
            }, confirmRemove ? T('card.removeConfirm') : T('card.remove')) : null,
          ),
          stored !== null ? h('p', { className: 'announcement-metaLine' }, T('card.clearHint')) : null,
          stored !== null ? h('p', { className: 'announcement-metaLine' },
            `${T('published')} ${formatWhen(stored.updatedAt)} · #${stored.id}`) : null,
        ),
        h('div', { className: 'announcement-section' },
          h('div', { className: 'announcement-sectionTitle' }, T('card.editor')),
          h('div', { className: 'announcement-field' },
            h('span', { className: 'announcement-fieldLabel' }, T('card.titleField')),
            h('input', {
              type: 'text', className: 'announcement-input', value: title, disabled: busy,
              placeholder: T('card.titlePlaceholder'),
              onChange: (e) => setDraft({ title: e.target.value, content }),
              onKeyDown: (e) => { if (e.key === 'Enter') save() },
            }),
          ),
          h('div', { className: 'announcement-field' },
            h('span', { className: 'announcement-fieldLabel' }, T('card.contentField')),
            h('textarea', {
              className: 'announcement-textarea', value: content, disabled: busy,
              placeholder: T('card.contentPlaceholder'),
              onChange: (e) => setDraft({ title, content: e.target.value }),
            }),
          ),
          h('div', { className: 'announcement-statusActions' },
            h('button', {
              type: 'button',
              className: 'announcement-btn announcement-btnPrimary',
              onClick: save,
              disabled: busy || content.trim() === '',
            }, busy ? T('card.busy') : T('card.save')),
          ),
        ),
        msg ? h('p', { className: 'announcement-msg' + (msg.error ? ' announcement-msgErr' : '') }, msg.text) : null,
        h('p', { className: 'announcement-versionHint' },
          `${T('card.version')}: ${data && data.lastCoreVersion ? data.lastCoreVersion : '—'} · ${T('card.versionHint')}`),
      )
    }

    // ----------------------------------------------------------------- apply

    function apply(ctx) {
      // A duplicated client injection must not mount a second UI.
      if (window.__announcementApplied === true) return
      window.__announcementApplied = true

      try {
        ensureStyles()
        const store = createStore({ data: null, loadError: '' })
        const unsubscribers = []

        const modalHost = document.createElement('div')
        modalHost.setAttribute('data-announcement-root', '')
        let modalRoot = null
        const renderModal = () => {
          try {
            if (modalRoot === null) {
              document.body.appendChild(modalHost)
              modalRoot = createRoot(modalHost)
            }
            modalRoot.render(h(AnnouncementApp, { data: store.get().data, onAck: actions.ack }))
          } catch (error) {
            console.error('[announcement] modal render failed:', error)
          }
        }

        const refresh = async () => {
          try {
            const data = await fetchState()
            store.set({ data, loadError: '' })
          } catch (error) {
            console.error('[announcement] state fetch failed:', error)
            store.set({ loadError: String(error && error.message || error) })
          }
          renderModal()
        }

        const actions = {
          ack: async () => {
            // Per-browser read: record locally FIRST (the popup must hide even
            // if the informational server POST fails), then report it.
            const raw = store.get()
            if (raw.data !== null && raw.data.announcement !== null) {
              writeLocal(raw.data.announcement.id, raw.data.ackEpoch)
            }
            try { await postAnnouncement('ack', {}) } catch (error) {
              console.error('[announcement] ack report failed:', error)
            }
            await refresh()
          },
          clearAck: async () => {
            await postAnnouncement('clear-ack', {})
            await refresh()
          },
          save: async ({ title, content }) => {
            const result = await postAnnouncement('save', { title, content })
            await refresh()
            return result
          },
          remove: async () => {
            await postAnnouncement('remove', {})
            await refresh()
          },
        }

        // Settings surface: the per-bundle config page in the Plugins panel
        // (keyed by PACKAGE name, rendered with view:'page' by
        // dsh-client-ui-plugin-manager — the seat that works on 0.1.7+).
        try {
          const slots = ctx.get('slots')
          if (slots && typeof slots.inject === 'function' && typeof slots.register === 'function') {
            const card = () => {
              const raw = useStoreSnapshot(store)
              return h(SettingsCard, { data: raw.data, actions })
            }
            const disposePage = slots.inject('plugins.bundle.config', () => slots.register({
              name: 'plugins.bundle.config',
              key: 'dsh-announcement',
            }, card))
            if (typeof disposePage === 'function') unsubscribers.push(disposePage)
          } else {
            console.error('[announcement] slots service unavailable; settings card will not be registered')
          }
        } catch (error) {
          console.error('[announcement] settings card registration failed:', error)
        }

        // Re-evaluate on tab focus AND on a slow visible-only poll: an
        // announcement saved or re-armed while this page sat open pops on the
        // next visibility gain, or within POLL_MS on a forever-foreground
        // page — no reload needed. rAF is unusable here, but plain timers +
        // fetch are fine. The poll is one small GET per minute at most.
        const POLL_MS = 60000
        let lastFocusFetch = 0
        const onVisibility = () => {
          if (document.visibilityState !== 'visible') return
          const now = Date.now()
          if (now - lastFocusFetch < 5000) return
          lastFocusFetch = now
          void refresh()
        }
        const pollTimer = setInterval(() => {
          if (document.visibilityState !== 'visible') return
          void refresh()
        }, POLL_MS)
        document.addEventListener('visibilitychange', onVisibility)

        window.__announcementDebug = () => {
          const raw = store.get()
          const hasAnnouncement = raw.data !== null && raw.data.announcement !== null
          return {
            has: hasAnnouncement,
            id: raw.data && raw.data.announcement ? raw.data.announcement.id : null,
            ackEpoch: raw.data ? raw.data.ackEpoch : null,
            clientRead: readLocal(),
            acked: readByBrowser(raw.data),
            visible: hasAnnouncement && !readByBrowser(raw.data),
            lastCoreVersion: raw.data ? raw.data.lastCoreVersion : null,
            loadError: raw.loadError,
            modalInDom: document.querySelector('.announcement-modalBack') !== null,
            cardInDom: document.querySelector('.announcement-card') !== null,
          }
        }

        ctx.effect(() => {
          return () => {
            try { delete window.__announcementDebug } catch { /* older engines */ }
            clearInterval(pollTimer)
            document.removeEventListener('visibilitychange', onVisibility)
            for (const unsubscribe of unsubscribers) {
              try { unsubscribe() } catch { /* already torn down */ }
            }
            if (modalRoot !== null) {
              try { modalRoot.unmount() } catch { /* host going away anyway */ }
              modalRoot = null
            }
            modalHost.remove()
            window.__announcementApplied = false
          }
        }, 'announcement: ui')

        void refresh()
      } catch (error) {
        window.__announcementApplied = false
        console.error('[announcement] apply failed:', error)
      }
    }

    exports.apply = apply
    exports.inject = ['slots']
    return module.exports
  },
})
