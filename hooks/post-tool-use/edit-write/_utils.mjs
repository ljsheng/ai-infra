import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { extname, basename, dirname, join, resolve } from "path";

const isWin = process.platform === "win32";

export function cmd(name) {
  return isWin ? `${name}.exe` : name;
}

export function hasCommand(name) {
  try {
    execFileSync(cmd(name), ["--version"], { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/** 按扩展名匹配 */
export function matchExt(filePath, exts) {
  return exts.includes(extname(filePath).toLowerCase());
}

/** 按文件名匹配（如 "Dockerfile", "composer.json"） */
export function matchName(filePath, names) {
  return names.includes(basename(filePath));
}

/** 路径中是否包含指定目录段（如 "Entity"） */
export function pathContains(filePath, segment) {
  const normalized = filePath.replaceAll("\\", "/");
  return normalized.includes(`/${segment}/`);
}

/** 从文件所在目录向上查找配置文件，返回所在目录或 null */
export function findUp(startPath, fileNames) {
  let dir = dirname(resolve(startPath));
  while (true) {
    for (const name of fileNames) {
      if (existsSync(join(dir, name))) return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
