import { execFileSync } from "child_process";
import { cmd, matchExt } from "./utils.mjs";

export function matches(filePath) {
  return matchExt(filePath, [".js", ".mjs", ".cjs"]);
}

export async function check(filePath) {
  try {
    execFileSync(cmd("node"), ["--check", filePath], { stdio: "pipe", timeout: 15000 });
    return null;
  } catch (err) {
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    return output.trim() ? { lang: "JavaScript Syntax", message: output } : null;
  }
}
