#!/usr/bin/env python3
"""Claude Code hook: block clearly destructive worktree commands."""

from __future__ import annotations

import json
import re
import sys


BLOCK_RULES = (
    (
        re.compile(r"(^|[\s;&|])git\s+reset\s+--hard(\s|$)", re.IGNORECASE),
        "禁止执行 `git reset --hard`，这会直接覆盖工作区状态。",
    ),
    (
        re.compile(r"(^|[\s;&|])git\s+checkout\s+--(\s|$)", re.IGNORECASE),
        "禁止执行 `git checkout -- ...`，请改用非破坏性方式处理文件。",
    ),
    (
        re.compile(r"(^|[\s;&|])git\s+restore\s+--source=HEAD(\s|$)", re.IGNORECASE),
        "禁止执行 `git restore --source=HEAD ...`，这会回退当前修改。",
    ),
    (
        re.compile(r"(^|[\s;&|])rm\s+-[^\n]*r[^\n]*f(\s|$)", re.IGNORECASE),
        "禁止执行带 `-rf` 的 `rm` 命令；如确有必要，必须先得到用户明确授权。",
    ),
)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    if payload.get("tool_name") != "Bash":
        return 0

    command = str(payload.get("tool_input", {}).get("command", ""))
    if not command:
        return 0

    for pattern, reason in BLOCK_RULES:
        if pattern.search(command):
            json.dump(
                {
                    "decision": "block",
                    "reason": reason,
                },
                sys.stdout,
                ensure_ascii=False,
                indent=2,
            )
            sys.stdout.write("\n")
            return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
