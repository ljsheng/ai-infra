/**
 * git-stale-lock-guard — 检测并清理 stale 的 .git/index.lock
 *
 * 场景：多个 Claude Code 进程/subagent 并行操作同一仓库，
 *       某进程被杀（Ctrl+C / 超时 / 崩溃）后留下 index.lock。
 *       后续所有 git 写操作都会失败。
 *
 * 触发：PreToolUse Bash，仅在检测到 git 写命令时检查。
 * 策略：
 *   - lock 不存在 → 跳过
 *   - lock 存在 + 持有进程已死 → 自动清理 + report
 *   - lock 存在 + 超过 5 分钟 → 自动清理 + report（进程可能已不在）
 *   - lock 存在 + 持有进程存活 + 未超时 → block（不破坏正在进行的操作）
 */

import { existsSync, statSync, readFileSync, unlinkSync } from "fs";
import { execFileSync } from "child_process";
import { join, resolve } from "path";

// git 写操作关键词（这些命令才需要 index lock）
const GIT_WRITE_RE = /\bgit\s+(add|commit|merge|rebase|cherry-pick|checkout|switch|restore|reset|stash|am|pull|rm|mv)\b/;

// 超时阈值：5 分钟
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * 查找 .git 目录（支持 worktree：.git 可能是文件而非目录）
 */
function findGitDir(cwd) {
  try {
    return execFileSync("git", ["rev-parse", "--git-dir"], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3_000,
    }).trim();
  } catch {
    return null;
  }
}

/**
 * 检查 PID 是否存活
 */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0); // signal 0 = 存活检测，不发送信号
    return true;
  } catch {
    return false;
  }
}

/**
 * 尝试从 lock 文件获取持有进程 PID
 * git 的 lockfile.c 会在某些场景写入 PID，但不是所有版本都这样做。
 * 回退：检查当前是否有 git 进程在运行。
 */
function getHolderPid(lockPath, cwd) {
  // 方法 1：尝试从文件首部读取 PID（部分 git 版本写入）
  try {
    const head = readFileSync(lockPath, "utf-8").slice(0, 64);
    const match = head.match(/^(\d+)\s/);
    if (match) return parseInt(match[1], 10);
  } catch { /* 文件可能是二进制 */ }

  // 方法 2：查找在该仓库目录下运行的 git 进程
  try {
    const pgrep = execFileSync("pgrep", ["-f", `git.*${cwd}`], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3_000,
    }).trim();
    const pids = pgrep.split("\n").map(Number).filter(Boolean);
    if (pids.length > 0) return pids[0];
  } catch { /* pgrep 无结果或不可用 */ }

  return null;
}

export async function run(payload) {
  const command = payload?.tool_input?.command || "";

  // 仅对 git 写命令做检查
  if (!GIT_WRITE_RE.test(command)) return null;

  // 定位 .git 目录（findGitDir 可能返回相对路径 ".git"，必须 resolve 到绝对路径）
  const cwd = payload?.cwd || process.cwd();
  const gitDirRaw = findGitDir(cwd);
  if (!gitDirRaw) return null;
  const gitDir = resolve(cwd, gitDirRaw);

  const lockPath = join(gitDir, "index.lock");
  if (!existsSync(lockPath)) return null;

  // lock 存在 → 分析是否 stale
  let lockAgeMs;
  try {
    const st = statSync(lockPath);
    lockAgeMs = Date.now() - st.mtimeMs;
  } catch {
    return null; // 读取失败（可能刚被清理）
  }

  const holderPid = getHolderPid(lockPath, cwd);
  const holderAlive = holderPid ? isProcessAlive(holderPid) : false;
  const isStale = lockAgeMs > STALE_THRESHOLD_MS || (holderPid && !holderAlive);

  if (isStale) {
    // 自动清理 stale lock
    try {
      unlinkSync(lockPath);
    } catch (err) {
      return {
        decision: "block",
        reason: `[Git Lock] .git/index.lock 已过期但无法清理: ${err.message}\n请手动执行: rm ${lockPath}`,
      };
    }

    const ageMin = Math.round(lockAgeMs / 60_000);
    const pidInfo = holderPid ? `（原持有进程 PID ${holderPid} 已退出）` : "";
    return {
      decision: "report",
      reason: `[Git Lock] 已自动清理 stale 的 .git/index.lock（存在 ${ageMin} 分钟）${pidInfo}\n可能原因：之前的 git 操作被中断（Ctrl+C / 超时 / 进程崩溃）`,
    };
  }

  // lock 存在 + 持有进程存活 → 阻断，避免破坏并行操作
  const pidInfo = holderPid ? `（持有进程 PID: ${holderPid}）` : "";
  return {
    decision: "block",
    reason: `[Git Lock] .git/index.lock 已被占用${pidInfo}\n另一个 git 操作正在进行中，请等待其完成或确认后手动清理:\n  rm ${lockPath}`,
  };
}
