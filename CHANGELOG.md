# Changelog

## v0.2.0 (2026-10-02)

- **Semantics change: read records are now PER BROWSER.** v0.1.0 stored one
  global read receipt server-side, so the first browser to acknowledge closed
  the popup for everyone — "first visit pops" only held for the very first
  browser. Now each browser keeps its own record in localStorage
  (`dsh-announcement.read` = `{id, epoch}`): every browser's first visit pops
  once; reloads stay quiet for that browser only.
- Re-arm model: the server stores an `ackEpoch` counter. `/clear-ack` (the
  settings-panel button) and a core version change at boot bump the epoch —
  every browser (including already-acknowledged ones) pops again on its next
  load or tab focus. A saved announcement still re-arms by minting a fresh id.
- The server-side `ack` row is informational only now (most recent read
  anywhere, shown in the settings card); acknowledging no longer suppresses
  other browsers.
- The client re-fetches state on tab focus (throttled to one round-trip per
  5s), so an announcement saved or re-armed while a page sat open pops without
  a manual reload.
- Verified on core 0.2.0-rc.2: node smokes (38 + 20 checks) and browser E2E
  24/24 (fresh-browser first visit pops → ack → quiet → second simulated
  browser pops → clear record re-arms the acked browser in-page → epoch
  reload pops → save pops → no page errors).

## v0.1.0 (2026-10-01)

- First release. Server half: five same-origin routes under `/api/announcement/*`
  (`state` GET; `ack` / `clear-ack` / `save` / `remove` POST, JSON-only, 8 KiB
  cap, atomic tmp+rename writes) storing the announcement, the global read
  record and the last seen core version in `<home>/.dsh/announcement.json`.
- Auto re-arm on updates: at boot the host half probes the DSH core version
  (host package.json); a version change clears the read record so every browser
  pops again on its first page load. The first detection only records the
  baseline — no popup on a fresh install.
- Client half: body-portal modal (z-index 10000, megaphone outline SVG, zh/en,
  system-following theme) requiring only `react` + `react-dom/client`; the
  plugins-panel config page (`plugins.bundle.config`, keyed by package name)
  offers 清除弹窗记录 / 保存并重新弹窗 / two-step 移除公告.
- Verified on core 0.2.0-rc.2: node smokes (37 + 17 checks) and browser E2E
  20/20 (empty-state quiet → save → popup in-page → ack persists across reload
  → clear record re-arms → reload pops again → no page errors).
