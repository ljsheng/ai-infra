import { readFileSync } from "fs";
import { matchExt } from "./utils.mjs";

export function matches(filePath) {
  return matchExt(filePath, [".json"]);
}

export async function check(filePath) {
  try {
    JSON.parse(readFileSync(filePath, "utf-8"));
    return null;
  } catch (err) {
    return { lang: "JSON Syntax", message: err.message };
  }
}
