# dsh-announcement

[English](#english) | [中文](#中文)

---

<a id="english"></a>

## English

A single-purpose update announcement popup for the DeepSeek Harness (DSH) web
UI. After each system update, the first page load shows the announcement once.
Nothing else.

### Features

- Auto re-arm: the plugin records the DSH core version at boot; a version
  change (i.e. an update) clears the read record, so every browser pops the
  announcement again on its first page load.
- One popup per announcement: acknowledging (我知道了) stores a global read
  record server-side; reloads stay quiet until the announcement changes.
- Plugins-panel page (**更新公告**): edit the announcement (title + body),
  clear the popup record to show it again, or remove it (two-step confirm).

> The read record is global (single-tenant): the first browser to acknowledge
> closes the popup for everyone. UI-level only — nothing else is gated.

Full history: [CHANGELOG.md](CHANGELOG.md).

### Install

Requires DSH >= 0.1.5-rc.1 (tested on 0.2.0-rc.2):

```bash
dsh plugin --profile web add link:/path/to/this/repo
docker restart dsh-harness
```

Remove:

```bash
dsh plugin --profile web remove dsh-announcement
docker restart dsh-harness
```

The announcement and its read record persist in `<home>/.dsh/announcement.json`
(inside the dsh-data volume) and survive restarts and reinstalls.

### Compatibility

- No dsh peerDependencies declared — the 0.2.0 plugin version gate does not
  apply. The client requires only the host seed modules (`react`,
  `react-dom/client`); no build step.
- The settings page uses the `plugins.bundle.config` seat (keyed by package
  name, 0.1.6-alpha.2+); older hosts simply never show it.

### License

MIT

---

<a id="中文"></a>

## 中文

一个只做更新公告弹窗的 DSH 插件：每次系统更新完成后的首次打开网页弹窗展示
公告，读过即静默。不掺别的功能。

### 功能说明

- 更新自动重弹：插件启动时记录 DSH 核心版本，版本变化（即完成更新）时自动
  清除已读记录，所有浏览器的首次打开都会再弹一次，无需任何手动操作。
- 每份公告只弹一次：点「我知道了」即在服务端记录已读（全局记录），刷新不再
  弹，直到公告内容变更。
- 插件面板页（**更新公告**）：编辑公告（标题 + 正文）、清除弹窗记录重新弹窗、
  两步确认移除公告。

> 已读记录为全局（单租户）：第一个点「我知道了」的浏览器代表所有人关闭弹窗。
> 仅界面层，不拦截任何其他功能。

完整历史见 [CHANGELOG.md](CHANGELOG.md)。

### 安装

要求 DSH >= 0.1.5-rc.1（在 0.2.0-rc.2 上开发测试）：

```bash
dsh plugin --profile web add link:/path/to/this/repo
docker restart dsh-harness
```

移除：

```bash
dsh plugin --profile web remove dsh-announcement
docker restart dsh-harness
```

公告与已读记录保存在 `<home>/.dsh/announcement.json`（dsh-data 卷内），重启
或重装不丢失。

### 兼容性

- 不声明 dsh 包 peerDependencies —— 0.2.0 起的插件版本门禁不适用。客户端只
  require 原生种子模块（`react`、`react-dom/client`），无构建步骤。
- 设置页使用 `plugins.bundle.config` 座席（按包名注册，0.1.6-alpha.2+）；
  更老的核心只是不显示该页。

### 许可证

MIT
