/**
 * dsh-announcement host half: the system update announcement popup.
 *
 * Five same-origin routes under /api/announcement/* persist the announcement
 * and its popup record in <home>/.dsh/announcement.json — inside the dsh-data
 * volume, so the file rides volume backups. Storage format:
 *   {
 *     version: 1,
 *     announcement: { id, title, content, updatedAt } | null,
 *     ack: { id, ts } | null,          // the 弹窗记录 (read receipt)
 *     lastCoreVersion: string | null
 *   }
 *
 * The popup shows once per announcement id. Two things re-arm it:
 *  - a NEW announcement (the /save route mints a fresh id); and
 *  - a core version change detected at boot (lastCoreVersion differs): the
 *    ack is cleared so every browser pops again on its first page load —
 *    the "每次更新完首次打开网页会弹窗" behavior. The very first detection
 *    only records the baseline (no popup on a fresh install).
 * The settings card (browser half) can also clear the record by hand.
 *
 * The ack is GLOBAL (server-side): the first browser to acknowledge closes
 * the popup for everyone — announcements are operator-authored and the
 * deployment has a single tenant. DSH_ANNOUNCEMENT_PATH overrides the storage
 * path and DSH_ANNOUNCEMENT_CORE_PKG prepends a package.json probe path
 * (both smoke-test hooks only).
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'dsh-announcement'
// NOTE: no static `inject` export on purpose (see dsh-workspace-lock): a
// static inject list makes cordis hand apply() a FILTERED context and the
// dynamic ctx.inject below would wait forever.

const STORE_PATH = process.env.DSH_ANNOUNCEMENT_PATH || join(homedir(), '.dsh', 'announcement.json')
const BODY_LIMIT = 8192
const TITLE_MAX = 128
const CONTENT_MAX = 6000
const DEFAULT_TITLE = '系统公告'

// Best-effort core version detection: read the host package.json. The first
// candidate is the deployed layout (/usr/local/lib/node_modules/@deepseek-ai/dsh);
// the second covers a plain `dsh` global install. Null disables auto re-arm
// (the manual settings controls keep working).
const CORE_PKG_CANDIDATES = [
  process.env.DSH_ANNOUNCEMENT_CORE_PKG,
  '/usr/local/lib/node_modules/@deepseek-ai/dsh/package.json',
  '/usr/local/lib/node_modules/dsh/package.json',
].filter(Boolean)

function detectCoreVersion() {
  for (const path of CORE_PKG_CANDIDATES) {
    try {
      const pkg = JSON.parse(readFileSync(path, 'utf8'))
      if (pkg && typeof pkg.version === 'string' && pkg.version !== '') return pkg.version
    } catch {
      // Next candidate; absence is expected outside the deployed layout.
    }
  }
  return null
}

function emptyDoc() {
  return { announcement: null, ack: null, lastCoreVersion: null }
}

function readDoc() {
  try {
    if (!existsSync(STORE_PATH)) return emptyDoc()
    const parsed = JSON.parse(readFileSync(STORE_PATH, 'utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyDoc()
    const doc = emptyDoc()
    const a = parsed.announcement
    if (a !== null && typeof a === 'object' && typeof a.id === 'string') {
      doc.announcement = {
        id: a.id,
        title: typeof a.title === 'string' ? a.title : DEFAULT_TITLE,
        content: typeof a.content === 'string' ? a.content : '',
        updatedAt: typeof a.updatedAt === 'string' ? a.updatedAt : '',
      }
    }
    const k = parsed.ack
    if (k !== null && typeof k === 'object' && typeof k.id === 'string') {
      doc.ack = { id: k.id, ts: typeof k.ts === 'string' ? k.ts : '' }
    }
    if (typeof parsed.lastCoreVersion === 'string') doc.lastCoreVersion = parsed.lastCoreVersion
    return doc
  } catch {
    return emptyDoc()
  }
}

function writeDoc(doc) {
  const tmp = `${STORE_PATH}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify({ version: 1, announcement: doc.announcement, ack: doc.ack, lastCoreVersion: doc.lastCoreVersion }, null, 2))
  renameSync(tmp, STORE_PATH)
}

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

/**
 * Same-origin fence (same contract as dsh-workspace-lock): Sec-Fetch-Site
 * same-origin passes, cross-site is rejected, an Origin header is compared
 * hostname-only against Host (reverse proxies strip the port), and a bare
 * request (neither header) is admitted — the embedded Chromium sends neither.
 */
function sameOrigin(req) {
  const site = req.headers['sec-fetch-site']
  if (site === 'same-origin') return true
  if (site === 'cross-site') return false
  const origin = req.headers.origin
  if (origin === undefined) return site === undefined
  const host = req.headers.host
  if (typeof origin !== 'string' || origin === '' || typeof host !== 'string' || host === '') return false
  try {
    return new URL(origin).hostname === new URL(`http://${host}`).hostname
  } catch {
    return false
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > BODY_LIMIT) {
        reject(new Error('body-too-large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function readJsonBody(req) {
  const raw = await readBody(req)
  if (raw === '') return {}
  return JSON.parse(raw)
}

/** Validate {title, content}; undefined when malformed. */
function parseAnnouncement(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return undefined
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (content.length < 1 || content.length > CONTENT_MAX) return undefined
  const rawTitle = typeof body.title === 'string' ? body.title.trim() : ''
  const title = rawTitle === '' ? DEFAULT_TITLE : rawTitle.slice(0, TITLE_MAX)
  return { title, content }
}

export function apply(ctx) {
  const log = ctx && ctx.logger && typeof ctx.logger.info === 'function'
    ? (msg) => ctx.logger.info(msg)
    : (msg) => console.log(msg)

  // Re-arm on core version change (see module docblock). Runs once per boot,
  // before the routes; a fresh file just records the baseline version.
  try {
    const doc = readDoc()
    const version = detectCoreVersion()
    if (version !== null && doc.lastCoreVersion !== version) {
      const previous = doc.lastCoreVersion
      if (previous !== null && doc.announcement !== null) doc.ack = null
      doc.lastCoreVersion = version
      writeDoc(doc)
      if (previous !== null) log(`[dsh-announcement] core version ${previous} -> ${version}; popup re-armed`)
      else log(`[dsh-announcement] recorded baseline core version ${version}`)
    }
  } catch (error) {
    log(`[dsh-announcement] version re-arm check failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!ctx || typeof ctx.inject !== 'function') return

  ctx.inject(['webServer'], (wctx) => {
    const webServer = wctx && wctx.webServer
    if (!webServer || typeof webServer.register !== 'function') {
      log('[dsh-announcement] webServer unavailable; announcement routes disabled')
      return undefined
    }
    const guard = (req, res) => {
      if (sameOrigin(req)) return true
      json(res, 403, { ok: false, error: 'forbidden' })
      return false
    }
    const requirePost = (req, res) => {
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, error: 'method-not-allowed' })
        return false
      }
      if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
        json(res, 415, { ok: false, error: 'json-required' })
        return false
      }
      return true
    }
    const routes = [
      {
        kind: 'exact',
        path: '/api/announcement/state',
        handler: (req, res) => {
          if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method-not-allowed' })
          if (!guard(req, res)) return
          const doc = readDoc()
          json(res, 200, { ok: true, announcement: doc.announcement, ack: doc.ack, lastCoreVersion: doc.lastCoreVersion })
        },
      },
      {
        kind: 'exact',
        path: '/api/announcement/ack',
        handler: async (req, res) => {
          try {
            if (!requirePost(req, res) || !guard(req, res)) return
            await readJsonBody(req).catch(() => ({}))
            const doc = readDoc()
            if (doc.announcement !== null) {
              doc.ack = { id: doc.announcement.id, ts: new Date().toISOString() }
              writeDoc(doc)
            }
            json(res, 200, { ok: true })
          } catch (error) {
            json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      },
      {
        kind: 'exact',
        path: '/api/announcement/clear-ack',
        handler: async (req, res) => {
          try {
            if (!requirePost(req, res) || !guard(req, res)) return
            await readJsonBody(req).catch(() => ({}))
            const doc = readDoc()
            doc.ack = null
            writeDoc(doc)
            log('[dsh-announcement] popup record cleared')
            json(res, 200, { ok: true })
          } catch (error) {
            json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      },
      {
        kind: 'exact',
        path: '/api/announcement/save',
        handler: async (req, res) => {
          try {
            if (!requirePost(req, res) || !guard(req, res)) return
            const parsed = parseAnnouncement(await readJsonBody(req))
            if (parsed === undefined) return json(res, 400, { ok: false, error: 'invalid-request' })
            const doc = readDoc()
            // A new id re-arms the popup by itself (ack.id no longer matches).
            doc.announcement = { id: String(Date.now()), title: parsed.title, content: parsed.content, updatedAt: new Date().toISOString() }
            writeDoc(doc)
            log(`[dsh-announcement] announcement saved (id ${doc.announcement.id})`)
            json(res, 200, { ok: true, announcement: doc.announcement })
          } catch (error) {
            json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      },
      {
        kind: 'exact',
        path: '/api/announcement/remove',
        handler: async (req, res) => {
          try {
            if (!requirePost(req, res) || !guard(req, res)) return
            await readJsonBody(req).catch(() => ({}))
            const doc = readDoc()
            doc.announcement = null
            doc.ack = null
            writeDoc(doc)
            log('[dsh-announcement] announcement removed')
            json(res, 200, { ok: true })
          } catch (error) {
            json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      },
    ]
    const disposers = []
    for (const route of routes) disposers.push(webServer.register(route))
    log('[dsh-announcement] routes registered (/api/announcement/*)')
    return () => {
      for (const dispose of disposers) {
        try {
          dispose()
        } catch {
          // Server already tearing down.
        }
      }
    }
  })
}
