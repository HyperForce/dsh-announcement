# dsh-announcement

[English](#english) | [中文](#中文)

---

<a id="english"></a>

## English

A single-purpose update announcement popup for the DeepSeek Harness (DSH) web
UI. After each system update, the first page load shows the announcement once.
Nothing else.

### Features

- First visit pops: after each update (or record clear) the first visit from
  EVERY browser shows the announcement once — read records are kept per
  browser, so one person acknowledging never silences the others.
- Auto re-arm: the plugin records the DSH core version at boot; a version
  change (i.e. an update) bumps the re-arm epoch, so all browsers pop again on
  their first page load. Saving a new announcement re-arms the same way.
- Plugins-panel page (**更新公告**): edit the announcement (title + body),
  clear the popup record (re-arms every browser), or remove it (two-step
  confirm). The card shows this browser's read state and the global
  last-read time.

> The read record lives in each browser's localStorage; the server only keeps
> the announcement, an informational last-read stamp, and the re-arm epoch.
> UI-level only — nothing else is gated.

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

The announcement persists in `<home>/.dsh/announcement.json` (inside the
dsh-data volume) and survives restarts and reinstalls; each browser's read
record lives in its own localStorage.

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

- 首次访问弹窗：每次更新（或清除记录）后，**每个浏览器**的首次访问都会弹一次
  公告——已读按浏览器分别记录，一个人点了「我知道了」不会让其他设备静默。
- 更新自动重弹：插件启动时记录 DSH 核心版本，版本变化（即完成更新）时自动
  递增重弹纪元，所有浏览器首次打开都会再弹，无需任何手动操作；保存新公告
  同样自动重弹。
- 插件面板页（**更新公告**）：编辑公告（标题 + 正文）、清除弹窗记录（所有
  浏览器重新弹窗）、两步确认移除公告。卡片同时显示本浏览器已读状态与全局
  最近已读时间。

> 已读记录保存在各浏览器 localStorage；服务器只存公告、信息性的最近已读
> 时间戳和重弹纪元。仅界面层，不拦截任何其他功能。

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

公告保存在 `<home>/.dsh/announcement.json`（dsh-data 卷内），重启或重装不丢
失；各浏览器的已读记录存在各自浏览器的 localStorage 里。

### 兼容性

- 不声明 dsh 包 peerDependencies —— 0.2.0 起的插件版本门禁不适用。客户端只
  require 原生种子模块（`react`、`react-dom/client`），无构建步骤。
- 设置页使用 `plugins.bundle.config` 座席（按包名注册，0.1.6-alpha.2+）；
  更老的核心只是不显示该页。

### 许可证

MIT
