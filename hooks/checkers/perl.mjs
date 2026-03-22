import { execFileSync } from "child_process";
import { hasCommand, cmd, matchExt } from "./utils.mjs";

export function matches(filePath) {
  return matchExt(filePath, [".pl", ".pm"]);
}

export async function check(filePath) {
  if (!hasCommand("perl")) return null;
  try {
    execFileSync(cmd("perl"), ["-c", filePath], { stdio: "pipe", timeout: 15000 });
    return null;
  } catch (err) {
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    return output.trim() ? { lang: "Perl Syntax", message: output } : null;
  }
}
