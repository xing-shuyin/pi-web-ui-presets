#!/usr/bin/env node
/**
 * 把一条「分享预设」Issue 的内容收进 presets/ 并更新 index.json。
 *
 * 由 .github/workflows/ingest-preset.yml 在 Issue 打开/编辑时调用，环境变量：
 *   ISSUE_NUMBER / ISSUE_TITLE / ISSUE_BODY / ISSUE_USER
 * 输出（GITHUB_OUTPUT）：
 *   id / name / changed=1|0 / file
 *
 * 只依赖 node 内置模块；任何校验失败都以非零退出码结束，工作流会照原样评论
 * 失败原因并给 Issue 打上 needs-fix 标签。
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRESET_DIR = join(ROOT, "presets");
const INDEX_FILE = join(ROOT, "index.json");

const MAX_SETTINGS_BYTES = 256 * 1024;
const FORMAT = "pi-web-ui-preset";
const VERSION = 1;

/** 与 pi-web-ui 的 preset-share 保持一致的 slug 规则。 */
export function slugify(name) {
	const ascii = String(name ?? "")
		.normalize("NFKD")
		// eslint-disable-next-line no-control-regex
		.replace(/[^\x00-\x7F]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);
	return ascii || "preset";
}

export function presetId(name, body) {
	const hash = createHash("sha1").update(String(body)).digest("hex").slice(0, 7);
	return `${slugify(name)}-${hash}`;
}

/** 从 Issue 正文里取出第一个 ```json 代码块（没有围栏时退回整段正文）。 */
export function extractJsonBlock(body) {
	const text = String(body ?? "");
	const fence = /```(?:json|JSON)?\s*\n([\s\S]*?)```/.exec(text);
	const raw = (fence ? fence[1] : text).trim();
	if (!raw) throw new Error("Issue 正文里没有找到 JSON（请把导出文件内容放进 ```json 代码块）");
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		throw new Error(`JSON 解析失败：${err instanceof Error ? err.message : String(err)}`);
	}
	return { parsed, raw };
}

/** 校验并规范化分享文档；返回 { doc } 或抛错（错误信息直接回给用户）。 */
export function validateDoc(parsed) {
	if (Array.isArray(parsed)) {
		throw new Error("一次只能提交一个预设（数组中请只保留一个对象）");
	}
	if (!parsed || typeof parsed !== "object") throw new Error("JSON 顶层必须是一个对象");
	const doc = parsed;
	if (doc.format !== FORMAT) throw new Error(`format 必须是 "${FORMAT}"（当前为 ${JSON.stringify(doc.format)}）`);
	if (doc.version !== VERSION) throw new Error(`version 必须是 ${VERSION}（当前为 ${JSON.stringify(doc.version)}）`);
	const name = typeof doc.name === "string" ? doc.name.trim() : "";
	if (!name) throw new Error("name 不能为空");
	if (name.length > 60) throw new Error("name 最长 60 个字符");
	const settings = doc.settings;
	if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
		throw new Error("settings 必须是一个对象");
	}
	const size = Buffer.byteLength(JSON.stringify(settings), "utf8");
	if (size > MAX_SETTINGS_BYTES) throw new Error(`settings 过大（${size} 字节 > ${MAX_SETTINGS_BYTES}）`);
	const tags = Array.isArray(doc.tags)
		? doc.tags
				.filter((t) => typeof t === "string" && t.trim())
				.map((t) => t.trim().slice(0, 24))
				.slice(0, 8)
		: [];
	return {
		format: FORMAT,
		version: VERSION,
		name,
		description: typeof doc.description === "string" ? doc.description.trim().slice(0, 500) : "",
		author: typeof doc.author === "string" ? doc.author.trim().slice(0, 80) : "",
		tags,
		createdAt: typeof doc.createdAt === "string" ? doc.createdAt : new Date().toISOString(),
		appVersion: typeof doc.appVersion === "string" ? doc.appVersion : "",
		settings,
	};
}

/** 列表展示用的摘要。 */
export function summarize(settings) {
	const arr = (v) => (Array.isArray(v) ? v.length : 0);
	return {
		promptMode: typeof settings.promptMode === "string" ? settings.promptMode : "append",
		skills: arr(settings.disabledSkills) + arr(settings.reviewDisabledSkills),
		agentTools: arr(settings.disabledAgentTools) + arr(settings.disabledPluginTools),
		hasTemplate: typeof settings.promptTemplate === "string" && settings.promptTemplate.trim().length > 0,
		hasReviewPrompt: typeof settings.reviewPrompt === "string" && settings.reviewPrompt.trim().length > 0,
	};
}

function readIndex() {
	if (!existsSync(INDEX_FILE)) return { version: 1, updatedAt: new Date().toISOString(), presets: [] };
	const parsed = JSON.parse(readFileSync(INDEX_FILE, "utf8"));
	if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.presets)) {
		return { version: 1, updatedAt: new Date().toISOString(), presets: [] };
	}
	return { version: 1, updatedAt: parsed.updatedAt ?? "", presets: parsed.presets };
}

/** 收纳一个预设文档：写 presets/<id>.json，返回 { entry, changed, file, removedFile }。 */
export function ingest(doc, { issue, author, now = new Date().toISOString() } = {}) {
	const canonical = JSON.stringify(doc, null, "\t") + "\n";
	const id = presetId(doc.name, canonical);
	const file = `presets/${id}.json`;
	mkdirSync(PRESET_DIR, { recursive: true });
	const target = join(ROOT, file);

	const index = readIndex();
	const stale = index.presets.filter(
		(p) => p.id === id || (typeof p.name === "string" && p.name === doc.name),
	);
	const entry = {
		id,
		name: doc.name,
		description: doc.description ?? "",
		author: doc.author || author || "",
		tags: doc.tags ?? [],
		file,
		issue: issue ?? null,
		updatedAt: now,
		summary: summarize(doc.settings),
	};

	const payload = { ...doc, id, author: entry.author, updatedAt: now, issue: entry.issue };
	const text = JSON.stringify(payload, null, "\t") + "\n";
	const changed = !existsSync(target) || readFileSync(target, "utf8") !== text;
	writeFileSync(target, text, "utf8");

	index.presets = [entry, ...index.presets.filter((p) => p.id !== id && p.name !== doc.name)];
	index.updatedAt = now;
	writeFileSync(INDEX_FILE, JSON.stringify(index, null, "\t") + "\n", "utf8");

	// 同名旧条目：删掉旧文件，避免仓库里留双份。
	const removedFile = stale.find((p) => p.file && p.file !== file)?.file ?? "";
	if (removedFile && !stale.some((p) => p.file === removedFile && p.id === id)) {
		try {
			rmSync(join(ROOT, removedFile), { force: true });
			process.stdout.write(`removed ${removedFile}\n`);
		} catch {
			/* 忽略：文件删不掉也不影响 index 的正确性 */
		}
	}
	return { entry, changed, file, removedFile };
}

function main() {
	const body = process.env.ISSUE_BODY ?? "";
	const { parsed } = extractJsonBlock(body);
	const doc = validateDoc(parsed);
	const { entry, changed, file } = ingest(doc, {
		issue: Number(process.env.ISSUE_NUMBER) || null,
		author: (process.env.ISSUE_USER ?? "").trim(),
	});
	const out = process.env.GITHUB_OUTPUT;
	if (out) {
		writeFileSync(out, `id=${entry.id}\nname=${entry.name}\nfile=${file}\nchanged=${changed ? 1 : 0}\n`, {
			flag: "a",
		});
	}
	process.stdout.write(`ok ${file} (changed=${changed})\n`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
	try {
		main();
	} catch (err) {
		process.stderr.write(`::error::${err instanceof Error ? err.message : String(err)}\n`);
		if (process.env.GITHUB_OUTPUT) {
			writeFileSync(process.env.GITHUB_OUTPUT, `error=${(err instanceof Error ? err.message : String(err)).replace(/\n/g, " ")}\n`, {
				flag: "a",
			});
		}
		process.exit(1);
	}
}

export { readIndex };
