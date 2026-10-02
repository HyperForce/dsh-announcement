# Changelog

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
