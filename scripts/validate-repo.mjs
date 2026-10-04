#!/usr/bin/env node
/**
 * 仓库自检（PR / push 时跑）：index.json 与 presets/*.json 必须自洽。
 * 手工提 PR 时先本地跑 `node scripts/validate-repo.mjs`。
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readIndex, slugify, validateDoc } from "./ingest-preset.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

const index = readIndex();
if (!Array.isArray(index.presets)) problems.push("index.json: presets 必须是数组");
const seen = new Set();
for (const entry of index.presets) {
	const label = entry?.id ?? JSON.stringify(entry)?.slice(0, 40) ?? "?";
	if (!entry || typeof entry !== "object") {
		problems.push("index.json: 条目必须是对象");
		continue;
	}
	if (!entry.id || !entry.name || !entry.file) problems.push(`index.json: ${label} 缺 id/name/file`);
	if (seen.has(entry.id)) problems.push(`index.json: id 重复 ${entry.id}`);
	seen.add(entry.id);
	if (typeof entry.file !== "string" || !entry.file.startsWith("presets/")) {
		problems.push(`index.json: ${label} 的 file 必须位于 presets/`);
		continue;
	}
	const path = join(ROOT, entry.file);
	if (!existsSync(path)) {
		problems.push(`index.json: ${label} 指向的文件不存在 ${entry.file}`);
		continue;
	}
	try {
		const doc = validateDoc(JSON.parse(readFileSync(path, "utf8")));
		if (doc.name !== entry.name) problems.push(`${entry.file}: name 与 index 不一致（${doc.name} ≠ ${entry.name}）`);
		if (!entry.file.includes(slugify(doc.name))) {
			problems.push(`${entry.file}: 文件名应以 ${slugify(doc.name)}- 开头`);
		}
	} catch (err) {
		problems.push(`${entry.file}: ${err instanceof Error ? err.message : String(err)}`);
	}
}

if (problems.length) {
	for (const p of problems) process.stderr.write(`::error::${p}\n`);
	process.exit(1);
}
process.stdout.write(`ok ${index.presets.length} preset(s)\n`);
