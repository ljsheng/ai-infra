/**
 * PHPStan 静态类型分析（增强 syntax-php 的 php -l）
 *
 * - 向上查找 phpstan.neon / phpstan.neon.dist 确定项目根目录
 * - 无配置或 phpstan 未安装时静默跳过（避免 level 0 误报）
 * - 使用 --error-format=raw 获得简洁输出
 */
import { existsSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
import { matchExt, findUp } from "./_utils.mjs";

const CONFIG_NAMES = ["phpstan.neon", "phpstan.neon.dist"];

function matches(filePath) {
  return matchExt(filePath, [".php"]);
}

async function check(filePath) {
  const projectDir = findUp(filePath, CONFIG_NAMES);
  if (!projectDir) return null;

  const phpstan = join(projectDir, "vendor", "bin", "phpstan");
  if (!existsSync(phpstan)) return null;

  try {
    execFileSync(phpstan, [
      "analyse",
      "--no-progress",
      "--no-interaction",
      "--error-format=raw",
      filePath,
    ], {
      stdio: "pipe",
      timeout: 60000,
      cwd: projectDir,
    });
    return null;
  } catch (err) {
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    return output.trim() ? { lang: "PHPStan", message: output } : null;
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
