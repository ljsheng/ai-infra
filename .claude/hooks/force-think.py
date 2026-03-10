#!/usr/bin/env python3
"""Claude Code hook: append a lightweight thinking reminder to user prompts."""

from __future__ import annotations

import json
import sys


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        json.dump(
            {
                "decision": "block",
                "reason": f"Hook 输入不是合法 JSON: {exc}",
            },
            sys.stdout,
            ensure_ascii=False,
            indent=2,
        )
        sys.stdout.write("\n")
        return 1

    prompt = str(payload.get("prompt", ""))
    if "think" in prompt.lower():
        return 0

    json.dump(
        {
            "reason": "已追加 think 提示，要求先思考再执行。",
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": "\n（请先充分思考，再开始执行，并明确说明你的首个验证动作。）",
            },
        },
        sys.stdout,
        ensure_ascii=False,
        indent=2,
    )
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
