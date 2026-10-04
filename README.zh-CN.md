# pi-web-ui 共享预设仓库

[pi-web-ui](https://github.com/xing-shuyin/pi-web-ui) 的**设置预设**共享仓库，所有人可以在这里发布和取用配置。

- English: [README.md](README.md)
- 目录清单：[`index.json`](index.json)（客户端「设置 → 预设 → 浏览分享」读的就是它）
- 预设文件：[`presets/`](presets/)

## 用别人的预设

**最省事**：pi-web-ui → **设置 → 预设 → 浏览分享**，搜索后点「导入」。

**用网址导入**：复制任意预设文件的 raw 地址，粘到 **设置 → 预设 → 导入 → 从网址导入**：

```
https://raw.githubusercontent.com/xing-shuyin/pi-web-ui-presets/main/presets/<文件名>.json
```

导入时如果本地已有同名预设，会**覆盖**它，其他设置不受影响。

## 分享自己的预设

**在客户端里（推荐）**：「设置 → 预设」里点某个预设的 **分享** 按钮。pi-web-ui 会替你在本仓库开一条
GitHub Issue（有 `gh` 命令或 GitHub 令牌就直接提交；两者都没有则打开**已预填内容**的页面，点一下 Submit 即可），
机器人校验通过后自动写进 `presets/`、更新 `index.json`、评论并关闭 Issue。

**手工提交**：新建标题为 `[preset] <名称>` 的 Issue，把导出的 JSON 放进 ` ```json ` 代码块；或者直接提
PR，添加 `presets/<文件>.json` **和** `index.json` 里的对应条目（提交前先跑 `node scripts/validate-repo.mjs`）。

**离线**：把预设导出成 `.json` 文件随便发；客户端支持**文件、粘贴文本、网址**三种导入方式。

## 文件格式

```jsonc
{
  "format": "pi-web-ui-preset",
  "version": 1,
  "name": "我的预设",              // 必填，≤ 60 字，导入后的预设名
  "description": "适合什么场景",     // 选填，≤ 500 字
  "author": "github 用户名",        // 选填
  "tags": ["编程", "极简"],         // 选填，≤ 8 个
  "createdAt": "2026-01-01T00:00:00.000Z",
  "appVersion": "1.2.3",           // 选填
  "settings": { /* pi-web-ui 的 SettingsPreset 字段 */ }
}
```

`settings` 与 pi-web-ui 自己的预设记录一一对应（见 `server/client-state.ts` 的 `SettingsPreset`）：
提示词模式 / 自定义系统提示词 / 提示词模板 / 逐 token 覆盖 / 禁用的技能、扩展、Agent 工具、插件工具 /
终端工具开关 / 审查提示词与审查技能 / 重试次数 / 压缩软上限。导入端会**忽略不认识的字段**，所以旧版客户端
不会因为新字段炸掉。JSON Schema 见 [`schema/preset.schema.json`](schema/preset.schema.json)、
[`schema/index.schema.json`](schema/index.schema.json)。

`index.json` 条目：

```jsonc
{
  "id": "my-preset-1a2b3c4",       // <slug>-<sha1(settings) 前 7 位>
  "name": "我的预设",
  "description": "…",
  "author": "github 用户名",
  "tags": ["编程"],
  "file": "presets/my-preset-1a2b3c4.json",
  "issue": 12,                      // 来源 Issue（手工 PR 时无此项）
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "summary": { "promptMode": "append", "skills": 2, "agentTools": 0, "hasTemplate": true, "hasReviewPrompt": false }
}
```

## 隐私

预设里只有设置，没有密钥——API key、provider 登录信息、项目路径都不属于预设。但**导入前请先看一眼**：
预设可以携带自定义系统提示词或模板。导入对话框会先把内容展示出来，你不点「应用」就不会生效。

## 自动化

| 工作流 | 触发 | 作用 |
| --- | --- | --- |
| [`ingest-preset.yml`](.github/workflows/ingest-preset.yml) | 标题以 `[preset] …` 开头的 Issue 打开/编辑 | 校验 JSON → 写 `presets/<id>.json` → 更新 `index.json` → 提交 → 评论 → 关闭 |
| [`validate-presets.yml`](.github/workflows/validate-presets.yml) | 推送/PR 改到 `presets/**`、`index.json` | 跑 `node scripts/validate-repo.mjs`，保证清单与文件自洽 |

## 许可

仓库内容（预设、文档、脚本）以 [CC0-1.0](LICENSE) 发布 —— 随便用。
