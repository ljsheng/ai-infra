#!/usr/bin/env python3
"""
Validate a domain map JSON against C0/C1/C2/C3 checks used in this skill.
"""

from __future__ import annotations

import argparse
import itertools
import json
from pathlib import Path

HARD_CONSTRAINTS = {"H1", "H2", "H3", "H4", "H5"}
TYPED_KEYS = ("R", "S", "E", "P")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate domain map JSON (C0/C1/C2/C3).")
    parser.add_argument("input", help="Path to candidate JSON file")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON output")
    return parser.parse_args()


def typed_items(data: dict, key: str) -> set[tuple[str, str]]:
    return {(key, item) for item in data.get(key, [])}


def domain_members(domain: dict, key: str) -> set[tuple[str, str]]:
    members = domain.get("members", {}).get(key, [])
    return {(key, item) for item in members}


def parse_typed_ref(ref: str) -> tuple[str, str] | None:
    if ":" not in ref:
        return None
    key, value = ref.split(":", 1)
    key = key.strip()
    value = value.strip()
    if key not in TYPED_KEYS or not value:
        return None
    return key, value


def validate_capability_closure(data: dict, domains: list[dict]) -> list[str]:
    errors: list[str] = []
    closure = data.get("capability_closure")
    if not closure:
        return errors

    required = closure.get("required", [])
    forbidden = closure.get("forbidden", [])
    evidence = closure.get("evidence", {})
    forbidden_evidence = closure.get("forbidden_evidence", {})

    if not isinstance(required, list) or any(not isinstance(x, str) or not x for x in required):
        errors.append("C0 capability_closure.required must be a list of non-empty strings.")
        required = []

    if not isinstance(forbidden, list) or any(not isinstance(x, str) or not x for x in forbidden):
        errors.append("C0 capability_closure.forbidden must be a list of non-empty strings.")
        forbidden = []

    if not isinstance(evidence, dict):
        errors.append("C0 capability_closure.evidence must be an object.")
        evidence = {}

    if not isinstance(forbidden_evidence, dict):
        errors.append("C0 capability_closure.forbidden_evidence must be an object.")
        forbidden_evidence = {}

    valid_refs = set()
    for key in TYPED_KEYS:
        valid_refs |= typed_items(data, key)

    for capability in required:
        refs = evidence.get(capability, [])
        if not isinstance(refs, list):
            errors.append(f"C0 required capability {capability} evidence must be a list.")
            continue
        if not refs:
            errors.append(f"C0 required capability {capability} has no evidence refs.")
            continue
        for ref in refs:
            if not isinstance(ref, str):
                errors.append(f"C0 required capability {capability} has non-string ref {ref!r}.")
                continue
            parsed = parse_typed_ref(ref)
            if not parsed:
                errors.append(
                    f"C0 invalid typed ref {ref!r} for capability {capability}; expected R:id|S:id|E:id|P:id."
                )
                continue
            if parsed not in valid_refs:
                errors.append(
                    f"C0 typed ref {ref!r} for capability {capability} does not exist in top-level {parsed[0]} list."
                )

    for capability in forbidden:
        refs = forbidden_evidence.get(capability, [])
        if refs:
            errors.append(f"C0 forbidden capability {capability} has evidence refs: {refs}.")

        token = capability.lower()
        for domain in domains:
            haystacks = [domain.get("name", ""), domain.get("responsibility", "")]
            if any(token in str(part).lower() for part in haystacks):
                errors.append(
                    f"C0 forbidden capability {capability} appears in domain name/responsibility for {domain.get('id')}."
                )
                break

    return errors


def validate(data: dict) -> tuple[bool, list[str]]:
    errors: list[str] = []
    domains = data.get("domains", [])
    if not domains:
        return False, ["No domains found."]

    domain_ids = [d.get("id") for d in domains]
    if any(not d for d in domain_ids):
        errors.append("Each domain must have a non-empty id.")
    if len(set(domain_ids)) != len(domain_ids):
        errors.append("Domain ids must be unique.")

    # C0: capability-closure checks (optional block).
    errors.extend(validate_capability_closure(data, domains))

    # C1: completeness + unique owner for all u in U.
    expected_u = set()
    for key in TYPED_KEYS:
        expected_u |= typed_items(data, key)

    owner_count: dict[tuple[str, str], int] = {}
    for key in TYPED_KEYS:
        for domain in domains:
            for item in domain_members(domain, key):
                owner_count[item] = owner_count.get(item, 0) + 1

    for item in expected_u:
        count = owner_count.get(item, 0)
        if count != 1:
            errors.append(f"C1 owner uniqueness failed for {item[0]}:{item[1]} (count={count}).")

    extra_items = [item for item in owner_count if item not in expected_u]
    for item in extra_items:
        errors.append(f"C1 membership contains unknown element {item[0]}:{item[1]}.")

    # C2: one writer per state and one producer per event.
    state_writers: dict[str, list[str]] = {s: [] for s in data.get("S", [])}
    event_producers: dict[str, list[str]] = {e: [] for e in data.get("E", [])}

    for domain in domains:
        did = domain.get("id", "")
        for state, writer in domain.get("writers", {}).items():
            if writer != did:
                errors.append(f"C2 writers map mismatch: state {state} maps to {writer}, expected {did}.")
            if state in state_writers:
                state_writers[state].append(did)
            else:
                errors.append(f"C2 writers references unknown state {state}.")

        for event, producer in domain.get("producers", {}).items():
            if producer != did:
                errors.append(f"C2 producers map mismatch: event {event} maps to {producer}, expected {did}.")
            if event in event_producers:
                event_producers[event].append(did)
            else:
                errors.append(f"C2 producers references unknown event {event}.")

    for state, writers in state_writers.items():
        if len(writers) != 1:
            errors.append(f"C2 requires exactly one writer for state {state}; found {len(writers)}.")
    for event, producers in event_producers.items():
        if len(producers) != 1:
            errors.append(f"C2 requires exactly one producer for event {event}; found {len(producers)}.")

    if data.get("shared_write_models"):
        errors.append("C2 shared internal write models are not allowed.")

    # C3 deletion test: no empty domain.
    for domain in domains:
        size = sum(len(domain.get("members", {}).get(k, [])) for k in TYPED_KEYS)
        if size == 0:
            errors.append(f"C3 deletion test failed: removable empty domain {domain.get('id')}.")

    # C3 merge test: every pair must have a hard-constraint blocker.
    blockers = data.get("merge_blockers", [])
    blocker_index: dict[tuple[str, str], set[str]] = {}
    for blocker in blockers:
        a = blocker.get("a")
        b = blocker.get("b")
        violates = set(blocker.get("violates", []))
        key = tuple(sorted((a, b)))
        if not a or not b:
            errors.append("merge_blockers entries require both a and b.")
            continue
        unknown = violates - HARD_CONSTRAINTS
        if unknown:
            errors.append(
                f"merge_blockers for {a},{b} contains unknown constraints: {sorted(unknown)}."
            )
        if not (violates & HARD_CONSTRAINTS):
            errors.append(f"merge_blockers for {a},{b} must include at least one of H1..H5.")
        blocker_index[key] = blocker_index.get(key, set()) | (violates & HARD_CONSTRAINTS)

    for a, b in itertools.combinations(domain_ids, 2):
        key = tuple(sorted((a, b)))
        if key not in blocker_index:
            errors.append(f"C3 merge test failed: domains {a} and {b} have no hard blocker.")

    return len(errors) == 0, errors


def main() -> int:
    args = parse_args()
    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    ok, errors = validate(data)

    if args.json:
        print(json.dumps({"result": "PASS" if ok else "FAIL", "errors": errors}, ensure_ascii=False, indent=2))
    else:
        print("PASS" if ok else "FAIL")
        for err in errors:
            print(f"- {err}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
