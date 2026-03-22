import { execFileSync } from "child_process";
import { hasCommand, cmd, matchExt } from "./utils.mjs";

export function matches(filePath) {
  return matchExt(filePath, [".sh", ".bash"]);
}

export async function check(filePath) {
  if (!hasCommand("bash")) return null;
  try {
    execFileSync(cmd("bash"), ["-n", filePath], { stdio: "pipe", timeout: 15000 });
    return null;
  } catch (err) {
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    return output.trim() ? { lang: "Bash Syntax", message: output } : null;
  }
}
