import { execFileSync } from "child_process";
import { hasCommand, cmd, matchExt } from "./utils.mjs";

export function matches(filePath) {
  return matchExt(filePath, [".py"]);
}

export async function check(filePath) {
  const py = hasCommand("python3") ? "python3" : hasCommand("python") ? "python" : null;
  if (!py) return null;
  try {
    execFileSync(cmd(py), ["-m", "py_compile", filePath], { stdio: "pipe", timeout: 15000 });
    return null;
  } catch (err) {
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    return output.trim() ? { lang: "Python Syntax", message: output } : null;
  }
}
