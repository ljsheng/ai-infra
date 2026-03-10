#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${ROOT_DIR}/skills"

assert_symlink_target() {
  local target="$1"

  if [[ ! -L "$target" ]]; then
    echo "缺少软链: $target" >&2
    exit 1
  fi

  local resolved
  resolved="$(readlink "$target")"
  if [[ "$resolved" != "$SOURCE_DIR" ]]; then
    echo "软链目标不正确: $target -> $resolved" >&2
    exit 1
  fi
}

assert_not_exists() {
  local target="$1"
  if [[ -e "$target" || -L "$target" ]]; then
    echo "不应存在目标: $target" >&2
    exit 1
  fi
}

run_default_mode_test() {
  local temp_home
  temp_home="$(mktemp -d)"
  (
    export HOME="$temp_home"
    bash "$ROOT_DIR/scripts/link-skills.sh" >/dev/null

    assert_symlink_target "$HOME/.claude/skills"
    assert_symlink_target "$HOME/.codex/skills"
    assert_symlink_target "$HOME/.gemini/skills"
  )
  rm -rf "$temp_home"
}

run_gemini_only_test() {
  local temp_home
  temp_home="$(mktemp -d)"
  (
    export HOME="$temp_home"
    bash "$ROOT_DIR/scripts/link-skills.sh" gemini >/dev/null

    assert_not_exists "$HOME/.claude/skills"
    assert_not_exists "$HOME/.codex/skills"
    assert_symlink_target "$HOME/.gemini/skills"
  )
  rm -rf "$temp_home"
}

run_default_mode_test
run_gemini_only_test

echo "link:skills smoke test passed"
