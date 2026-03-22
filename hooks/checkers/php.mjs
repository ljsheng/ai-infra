import { execFileSync } from "child_process";
import { hasCommand, cmd, matchExt } from "./utils.mjs";

export function matches(filePath) {
  return matchExt(filePath, [".php"]);
}

export async function check(filePath) {
  if (!hasCommand("php")) return null;
  try {
    execFileSync(cmd("php"), ["-l", filePath], { stdio: "pipe", timeout: 15000 });
    return null;
  } catch (err) {
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    return output.trim() ? { lang: "PHP Syntax", message: output } : null;
  }
}
