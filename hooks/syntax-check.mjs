/**
 * 语法检查 hook 入口（PostToolUse）
 *
 * 扫描 checkers/ 下所有 .mjs 模块，每个模块导出：
 *   matches(filePath) → boolean  是否对该文件生效
 *   check(filePath)   → null | { lang, message }  检查结果
 *
 * 一个文件可命中多个 checker（如 composer.json 同时走 JSON 校验 + composer validate）。
 */
import { existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ── 读取 hook payload ──
const payload = JSON.parse(await new Promise((resolve) => {
  let data = "";
  process.stdin.on("data", (chunk) => (data += chunk));
  process.stdin.on("end", () => resolve(data));
}));

const filePath = payload?.tool_input?.file_path;
if (!filePath || !existsSync(filePath)) process.exit(0);

// ── 扫描 checkers 目录，收集所有命中结果 ──
const checkersDir = join(dirname(fileURLToPath(import.meta.url)), "checkers");
const files = readdirSync(checkersDir).filter((f) => f.endsWith(".mjs") && f !== "utils.mjs");
const errors = [];

for (const file of files) {
  const mod = await import(join(checkersDir, file));
  if (!mod.matches?.(filePath)) continue;
  const result = await mod.check(filePath);
  if (result) errors.push(result);
}

if (errors.length > 0) {
  const reason = errors
    .map((e) => `[${e.lang}] ${e.message.trim()}`)
    .join("\n\n---\n\n");
  console.log(JSON.stringify({
    decision: "block",
    reason: `${filePath} 存在以下问题:\n\n${reason}\n\n请修复后再继续。`,
  }));
}
