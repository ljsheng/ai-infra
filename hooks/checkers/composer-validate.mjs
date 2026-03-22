import { execFileSync } from "child_process";
import { hasCommand, cmd, matchName } from "./utils.mjs";
import { dirname } from "path";

export function matches(filePath) {
  return matchName(filePath, ["composer.json"]);
}

export async function check(filePath) {
  if (!hasCommand("composer")) return null;
  const cwd = dirname(filePath);
  try {
    execFileSync(cmd("composer"), ["validate", "--no-check-publish", "--no-check-lock", "--strict"], {
      stdio: "pipe",
      timeout: 30000,
      cwd,
    });
    return null;
  } catch (err) {
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    // 过滤掉纯 warning（如 lock 文件过期），只关注 error
    if (output.includes("is valid") && !output.includes("error")) return null;
    return output.trim() ? { lang: "Composer Validate", message: output } : null;
  }
}
