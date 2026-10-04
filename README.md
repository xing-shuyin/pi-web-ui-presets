# pi-web-ui presets

Community-shared **settings presets** for [pi-web-ui](https://github.com/xing-shuyin/pi-web-ui).

- 中文说明见 [README.zh-CN.md](README.zh-CN.md)
- Catalog: [`index.json`](index.json) — what the app's **Settings → Presets → Browse shared** list reads.
- Preset files: [`presets/`](presets/)

## Use a shared preset

**Easiest:** open pi-web-ui → **Settings → Presets → Browse shared**, search, click **Import**.

**By URL:** copy the raw URL of any preset file and paste it into **Presets → Import → From URL**:

```
https://raw.githubusercontent.com/xing-shuyin/pi-web-ui-presets/main/presets/<file>.json
```

Importing a preset whose name already exists overwrites that preset (nothing else is touched).

## Share a preset

**From the app (recommended):** **Settings → Presets** → the **Share** button on a preset row. pi-web-ui
creates a GitHub issue in this repository for you (via the `gh` CLI, or a prefilled browser tab if `gh`
is not installed). A bot validates it, commits it to `presets/`, updates `index.json`, comments and closes
the issue.

**Manually:** open a new issue with the title `[preset] <name>` and paste the exported JSON inside a
` ```json ` code block, or send a pull request that adds `presets/<file>.json` **and** an `index.json`
entry (run `node scripts/validate-repo.mjs` first).

**Offline:** export a preset to a `.json` file and send it to whoever you like — the app imports files,
pasted text and URLs.

## File format

```jsonc
{
  "format": "pi-web-ui-preset",
  "version": 1,
  "name": "My preset",            // required, ≤ 60 chars, import target name
  "description": "What it is for", // optional, ≤ 500 chars
  "author": "github-login",        // optional
  "tags": ["coding", "minimal"],   // optional, ≤ 8 tags
  "createdAt": "2026-01-01T00:00:00.000Z",
  "appVersion": "1.2.3",           // optional
  "settings": { /* pi-web-ui SettingsPreset fields */ }
}
```

`settings` mirrors pi-web-ui's own preset record (`server/client-state.ts` → `SettingsPreset`): prompt
mode / custom system prompt / prompt template / per-token overrides / disabled skills, extensions, agent
tools and plugin tools / terminal tool flags / review prompt and review skills / retry count / compaction
soft cap. Unknown fields are ignored by the importer, so older clients stay compatible.
JSON Schemas: [`schema/preset.schema.json`](schema/preset.schema.json), [`schema/index.schema.json`](schema/index.schema.json).

`index.json` entries:

```jsonc
{
  "id": "my-preset-1a2b3c4",       // <slug>-<sha1(settings)[0..7]>
  "name": "My preset",
  "description": "...",
  "author": "github-login",
  "tags": ["coding"],
  "file": "presets/my-preset-1a2b3c4.json",
  "issue": 12,                      // originating issue, if any
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "summary": { "promptMode": "append", "skills": 2, "agentTools": 0, "hasTemplate": true, "hasReviewPrompt": false }
}
```

## Privacy

A preset contains settings, not secrets — API keys, provider logins and project paths are never part of a
preset. Still, **read a shared preset before importing it**: it can carry a custom system prompt or
template. Review it in the import dialog first; nothing is applied until you press **Apply**.

## Automation

| Workflow | Trigger | What it does |
| --- | --- | --- |
| [`ingest-preset.yml`](.github/workflows/ingest-preset.yml) | issue opened/edited with title `[preset] …` | validates the JSON, writes `presets/<id>.json`, updates `index.json`, commits, comments, closes |
| [`validate-presets.yml`](.github/workflows/validate-presets.yml) | push / PR touching `presets/**`, `index.json` | `node scripts/validate-repo.mjs` — index ↔ files must agree |

## License

Content in this repository (presets, docs, scripts) is released under [CC0-1.0](LICENSE) — share freely.
