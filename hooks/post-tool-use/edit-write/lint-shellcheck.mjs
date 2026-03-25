/**
 * ShellCheck + 防御性编程检查（增强 syntax-bash 的 bash -n）
 *
 * - ShellCheck: 未引用变量、无用 cat、不安全 glob 等反模式
 * - 防御性检查: set -euo pipefail 或等效组合必须存在
 * - 仅报告 warning 及以上（跳过 info/style）
 * - 项目可通过 .shellcheckrc 自定义规则
 * - shellcheck 未安装时静默跳过（防御性检查仍执行）
 *
 * 已替代原 bash-defensive-patterns skill，自动化零干预。
 */
import { existsSync, readFileSync } from "fs";
import { execFileSync } from "child_process";
import { hasCommand, cmd, matchExt } from "./_utils.mjs";

function matches(filePath) {
  return matchExt(filePath, [".sh", ".bash"]);
}

/**
 * 检查脚本是否包含 set -euo pipefail 或等效的独立 set 指令。
 * 跳过注释行；只检查前 30 行（shebang + 初始化区域）。
 */
function checkDefensiveSet(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const head = content.split("\n").slice(0, 30);

  // 移除注释行，保留有效代码
  const code = head
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter(Boolean)
    .join("\n");

  // 方式 1: 一行式 set -euo pipefail（或含 E: set -Eeuo pipefail）
  if (/\bset\s+-[Eeuo]*e[Eeuo]*u[Eeuo]*o\s+pipefail\b/.test(code)) return null;
  if (/\bset\s+-[Eeuo]*u[Eeuo]*e[Eeuo]*o\s+pipefail\b/.test(code)) return null;

  // 方式 2: 分别设置
  const hasE = /\bset\s+.*-[^ ]*e/.test(code);
  const hasU = /\bset\s+.*-[^ ]*u/.test(code);
  const hasPipefail = /\bset\s+-o\s+pipefail\b/.test(code);

  if (hasE && hasU && hasPipefail) return null;

  const missing = [];
  if (!hasE) missing.push("-e (出错即退出)");
  if (!hasU) missing.push("-u (未定义变量报错)");
  if (!hasPipefail) missing.push("-o pipefail (管道错误传播)");

  return {
    lang: "Defensive Bash",
    message:
      `脚本缺少防御性设置，请在 shebang 之后添加：set -euo pipefail\n` +
      `缺失项: ${missing.join(", ")}`,
  };
}

async function checkShellCheck(filePath) {
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

  // 先跑 ShellCheck（发现问题立即 block）
  const scResult = await checkShellCheck(filePath);
  if (scResult) {
    return {
      decision: "block",
      reason: `[${scResult.lang}] ${scResult.message.trim()}\n\n请修复后再继续。`,
    };
  }

  // 再检查防御性 set 指令
  const defResult = checkDefensiveSet(filePath);
  if (defResult) {
    return {
      decision: "block",
      reason: `[${defResult.lang}] ${defResult.message.trim()}\n\n请修复后再继续。`,
    };
  }

  return null;
}
