import { execFileSync } from "child_process";
import { hasCommand, matchExt } from "./utils.mjs";

export function matches(filePath) {
  return matchExt(filePath, [".xml", ".xsl", ".xsd"]);
}

export async function check(filePath) {
  if (process.platform === "win32") return null;
  if (!hasCommand("xmllint")) return null;
  try {
    execFileSync("xmllint", ["--noout", filePath], { stdio: "pipe", timeout: 15000 });
    return null;
  } catch (err) {
    const output = (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    return output.trim() ? { lang: "XML Syntax", message: output } : null;
  }
}
