import { execFileSync } from "child_process";
import { hasCommand, cmd, matchExt } from "./utils.mjs";

export function matches(filePath) {
  return matchExt(filePath, [".zsh"]);
}

export async function check(filePath) {
  if (!hasCommand("zsh")) return null;
  try {
    execFileSync(cmd("zsh"), ["-n", filePath], { stdio: "pipe", timeout: 15000 });
    return null;
  } catch (err) {
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    return output.trim() ? { lang: "Zsh Syntax", message: output } : null;
  }
}
