/**
 * ShellCheck 静态分析（增强 syntax-bash 的 bash -n）
 *
 * - 检测未引用变量、无用 cat、不安全 glob 等常见 shell 反模式
 * - 仅报告 warning 及以上（跳过 info/style）
 * - 项目可通过 .shellcheckrc 自定义规则
 * - shellcheck 未安装时静默跳过
 */
import { existsSync } from "fs";
import { execFileSync } from "child_process";
import { hasCommand, cmd, matchExt } from "./_utils.mjs";

function matches(filePath) {
  return matchExt(filePath, [".sh", ".bash"]);
}

async function check(filePath) {
  if (!hasCommand("shellcheck")) return null;
  try {
    execFileSync(cmd("shellcheck"), [
      "--severity=warning",
      "--format=gcc",
      filePath,
    ], { stdio: "pipe", timeout: 15000 });
    return null;
  } catch (err) {
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    return output.trim() ? { lang: "ShellCheck", message: output } : null;
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
