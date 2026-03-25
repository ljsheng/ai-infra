/**
 * Swift Concurrency Guard（基于正则的静态检测）
 *
 * 检测常见 Swift 并发反模式，无需 SwiftSyntax 依赖。
 * 支持 per-file disable：// concurrency-guard: disable CC-CONC-001,CC-CONC-003
 * 支持 inline allow：  Task.detached { ... } // concurrency-guard: allow detached (reason)
 *
 * 阻断规则（block）：
 *   CC-CONC-001  Task.detached — 脱离结构化并发
 *
 * 报告规则（report）：
 *   CC-CONC-W01  nonisolated(unsafe) — 绕过隔离检查
 *   CC-CONC-W02  @unchecked Sendable — 绕过 Sendable 检查
 */
import { existsSync, readFileSync } from "fs";
import { matchExt } from "./_utils.mjs";

const BLOCK_RULES = [
  {
    id: "CC-CONC-001",
    pattern: /Task\s*\.\s*detached/,
    message: "Task.detached 脱离结构化并发，请改用 Task {} 并绑定到生命周期对象。",
  },
];

const REPORT_RULES = [
  {
    id: "CC-CONC-W01",
    pattern: /nonisolated\s*\(\s*unsafe\s*\)/,
    message: "nonisolated(unsafe) 绕过隔离检查，确认是否有更安全的替代方案。",
  },
  {
    id: "CC-CONC-W02",
    pattern: /@unchecked\s+Sendable/,
    message: "@unchecked Sendable 绕过线程安全检查，确认类型是否真正线程安全。",
  },
];

function matches(filePath) {
  return matchExt(filePath, [".swift"]);
}

/** 解析 disable 注释，返回被禁用的规则 ID 集合 */
function collectDisables(lines) {
  const disabled = new Set();
  for (const line of lines) {
    const m = line.match(/\/\/\s*concurrency-guard:\s*disable\s+([\w\-,\s]+)/);
    if (m) {
      for (const id of m[1].split(",")) disabled.add(id.trim());
    }
  }
  return disabled;
}

/** 检查某行是否有 inline allow 注释 */
function hasAllowComment(line) {
  return /\/\/\s*concurrency-guard:\s*allow\b/.test(line);
}

/** 行是否是纯注释 */
function isComment(trimmed) {
  return trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*");
}

function scanRules(lines, rules, disabled) {
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || isComment(trimmed)) continue;
    if (hasAllowComment(line)) continue;

    for (const rule of rules) {
      if (disabled.has(rule.id)) continue;
      if (rule.pattern.test(line)) {
        hits.push({ line: i + 1, id: rule.id, message: rule.message });
      }
    }
  }
  return hits;
}

async function check(filePath) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const disabled = collectDisables(lines);

  const blockers = scanRules(lines, BLOCK_RULES, disabled);
  const warnings = scanRules(lines, REPORT_RULES, disabled);

  if (blockers.length > 0) {
    const msg = blockers
      .map((h) => `L${h.line}: [${h.id}] ${h.message}`)
      .join("\n");
    return { decision: "block", lang: "Swift Concurrency Guard", message: msg };
  }

  if (warnings.length > 0) {
    const msg = warnings
      .map((h) => `L${h.line}: [${h.id}] ${h.message}`)
      .join("\n");
    return { decision: "report", lang: "Swift Concurrency Guard", message: msg };
  }

  return null;
}

export async function run(payload) {
  const filePath = payload?.tool_input?.file_path;
  if (!filePath || !existsSync(filePath)) return null;
  if (!matches(filePath)) return null;
  const result = await check(filePath);
  if (!result) return null;
  return {
    decision: result.decision,
    reason: `[${result.lang}]\n${result.message.trim()}\n\n请修复后再继续。`,
  };
}
