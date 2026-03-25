/**
 * Ruff Python 代码检查（替代 python-code-style + python-anti-patterns skill）
 *
 * - 向上查找 pyproject.toml / ruff.toml / .ruff.toml 确定项目根目录
 * - 无配置时仍可运行（ruff 有合理默认值）
 * - ruff 未安装时静默跳过
 * - 仅在发现 error 级别违反时 block
 */
import { existsSync } from "fs";
import { execFileSync } from "child_process";
import { hasCommand, cmd, matchExt, findUp } from "./_utils.mjs";

const CONFIG_NAMES = [
  "ruff.toml",
  ".ruff.toml",
  "pyproject.toml",
];
const EXTS = [".py", ".pyi"];

function matches(filePath) {
  return matchExt(filePath, EXTS);
}

async function check(filePath) {
  if (!hasCommand("ruff")) return null;

  const projectDir = findUp(filePath, CONFIG_NAMES);
  const args = [
    "check",
    "--output-format=concise",
    "--no-fix",
    filePath,
  ];

  try {
    execFileSync(cmd("ruff"), args, {
      stdio: "pipe",
      timeout: 15000,
      cwd: projectDir || undefined,
    });
    return null;
  } catch (err) {
    // exit 2 = 配置/内部错误，不阻断用户
    if (err.status === 2) return null;
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    return output.trim() ? { lang: "Ruff", message: output } : null;
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
