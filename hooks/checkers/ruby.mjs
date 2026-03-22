import { execFileSync } from "child_process";
import { hasCommand, cmd, matchExt } from "./utils.mjs";

export function matches(filePath) {
  return matchExt(filePath, [".rb"]);
}

export async function check(filePath) {
  if (!hasCommand("ruby")) return null;
  try {
    execFileSync(cmd("ruby"), ["-c", filePath], { stdio: "pipe", timeout: 15000 });
    return null;
  } catch (err) {
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    return output.trim() ? { lang: "Ruby Syntax", message: output } : null;
  }
}
