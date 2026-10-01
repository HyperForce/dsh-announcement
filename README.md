# dsh-announcement 更新公告插件

Pops up a system announcement once on the first page load after each update. Only does announcement popups — minimal, clean, maximally native-compatible.

在每次系统更新后的首次打开网页时弹窗展示公告;只做公告弹窗功能——简洁、最大程度兼容原生。

## Why / 特点

- **Auto re-arm on updates**: the plugin records the DSH core version at boot; when it changes (i.e. after an image/package update), the popup record is cleared automatically, so every browser shows the announcement again on its first page load. No manual step needed after an update.
- **One popup per announcement**: acknowledging (我知道了) stores a global read record server-side; the popup stays quiet on reloads until the announcement changes or the record is cleared.
- **Settings panel controls**: the per-bundle config page in the Plugins panel (更新公告) shows the popup record state, can **clear the record** (re-arms the popup as if never shown), and edits/removes the announcement (saving mints a fresh id, which re-arms the popup by itself).
- **简洁 / native-compatible**: hand-written client, requires only `react` + `react-dom/client` (shell-guaranteed module table seeds); body-mounted portal modal; system-following theme (`prefers-color-scheme`); no emoji, no native prompt/confirm dialogs.

## How it works / 功能说明

- Storage: `~/.dsh/announcement.json` (inside the dsh-data volume, rides volume backups):

  ```json
  {
    "version": 1,
    "announcement": { "id": "1770000000000", "title": "…", "content": "…", "updatedAt": "…" },
    "ack": { "id": "…", "ts": "…" },
    "lastCoreVersion": "0.2.0-rc.2"
  }
  ```

- Server half (`lib/index.js`): five same-origin routes under `/api/announcement/*` —
  `state` (GET), `ack`, `clear-ack`, `save`, `remove` (POST, JSON, 8 KiB cap, atomic tmp+rename writes).
  At boot it probes the core version; on a change it clears `ack` (re-arms the popup).
- Client half (`lib/client.js`): fetches the state once per page load; renders the modal when an
  announcement exists and `ack.id !== announcement.id`. The ack is **global** (single-tenant):
  the first browser to acknowledge closes the popup for everyone.
- The read record is UI-level only — nothing else is gated.

## Install / 安装

```bash
dsh plugin --profile web add link:/root/.dsh/dev/dsh-announcement   # dev copy in the volume
# or: dsh plugin --profile web add dsh-announcement                  # from npm
docker restart dsh-harness
```

Then open **设置 → 插件 → 更新公告**(或插件面板里的 查看 dsh-announcement)to edit the announcement,
clear the popup record, or remove it. Smokes: `node smoke/smoke_host.mjs && node smoke/smoke_client.js`.

## Compatibility / 兼容性

- Tested on DSH core `0.2.0-rc.2` (declaration `dsh >= 0.1.5-rc.1`).
- Client requires only `react` + `react-dom/client`; the settings card uses the
  `plugins.bundle.config` seat (0.1.6-alpha.2+; older cores simply never show it).

## License

MIT
