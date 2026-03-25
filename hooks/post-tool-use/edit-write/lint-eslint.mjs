/**
 * ESLint v9 代码检查
 *
 * - 向上查找 eslint.config.{js,mjs,cjs,ts} 确定项目根目录
 * - 无配置或 eslint 未安装时静默跳过
 * - ESLint 仅在发现 error 级别规则违反时 exit 1（warning 不阻断）
 */
import { existsSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
import { matchExt, findUp } from "./_utils.mjs";

const CONFIG_NAMES = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
];
const EXTS = [".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".mts", ".cts"];

function matches(filePath) {
  return matchExt(filePath, EXTS);
}

async function check(filePath) {
  const projectDir = findUp(filePath, CONFIG_NAMES);
  if (!projectDir) return null;

  const eslint = join(projectDir, "node_modules", ".bin", "eslint");
  if (!existsSync(eslint)) return null;

  try {
    execFileSync(eslint, ["--no-warn-ignored", filePath], {
      stdio: "pipe",
      timeout: 30000,
      cwd: projectDir,
    });
    return null;
  } catch (err) {
    // exit 2 = 配置错误，不应阻断用户
    if (err.status === 2) return null;
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    return output.trim() ? { lang: "ESLint", message: output } : null;
  }
}

export async function run(payload) {
  const filePath = payload?.tool_input?.file_path;
  if (!filePath || !existsSync(filePath)) return null;
  if (!matches(filePath)) return null;
  const result = await check(filePath);
  if (!result) return null;
  return {
    decision: "block",
    reason: `[${result.lang}] ${result.message.trim()}\n\n请修复后再继续。`,
  };
}
