import { execFileSync } from "child_process";
import { hasCommand, cmd, matchExt } from "./utils.mjs";

export function matches(filePath) {
  return matchExt(filePath, [".yaml", ".yml"]);
}

export async function check(filePath) {
  const py = hasCommand("python3") ? "python3" : hasCommand("python") ? "python" : null;
  if (!py) return null;
  try {
    execFileSync(cmd(py), [
      "-c",
      `import sys
try:
 import yaml
except ImportError:
 sys.exit(0)
yaml.safe_load(open(sys.argv[1],"r",encoding="utf-8"))`,
      filePath,
    ], { stdio: "pipe", timeout: 10000 });
    return null;
  } catch (err) {
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    return output.trim() ? { lang: "YAML Syntax", message: output } : null;
  }
}
