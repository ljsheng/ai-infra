#!/usr/bin/env python3
"""
Build a prompt bundle for recursive domain decomposition from PRD text.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


DECOMPOSER_TEMPLATE = """You are Domain Tree Decomposer.

Input:
- PRD: {prd}
- Current node: {node_scope}
- Constraints: C1/C2/C3, H1..H5
- Leaf criteria: L1..L7

Task:
0. Build capability-closure checklist for current node:
   - required_capabilities
   - forbidden_capabilities
   - evidence mapping to typed refs (R:id / S:id / E:id / P:id)
   If any required capability lacks evidence, return NOT_PROVABLE with missing facts.
1. Extract R/S/E/P for current node, define U = R U S U E U P.
2. Propose candidate child domains D = {{d1..dn}}.
3. Assign owner(u), writers(s), producers(e).
4. Self-repair until C1/C2 pass.
5. Mark each child as leaf or needs_split.

Output only JSON with capability_closure, children, mappings, contracts, and needs_split flags.
"""

PROVER_TEMPLATE = """You are Domain Map Formal Prover.

Input:
- candidate_json
- constraints C1/C2/C3
- hard constraints H1..H5

Task:
0. Verify C0 capability-closure:
   - every required capability has >=1 valid typed ref
   - forbidden capabilities have no evidence
   - if C0 fails, verdict is NOT_PROVABLE
1. Verify C1: completeness + unique owner.
2. Verify C2: unique writer per state, unique producer per event.
3. Verify C3 using delete and merge tests.
4. If failed, output minimal repair actions.

Output only JSON:
{{"result":"PASS|FAIL|NOT_PROVABLE","violations":[],"repairs":[],"missing_facts":[]}}
"""

LEAF_TEMPLATE = """You are Leaf Domain Spec Builder.

Input:
- leaf domain JSON

Task:
- Build implementation-ready spec for code generation.

Output only JSON with:
- entities
- state_machine
- commands/events
- APIs (schemas)
- storage/indexes
- unit/contract/e2e test matrix
"""

WORKFLOW_STEPS = [
    "Initialize queue with root(PRD).",
    "Run Decomposer on current node and build capability-closure checklist.",
    "If capability-closure is not provable, return NOT_PROVABLE with missing facts.",
    "Run Prover; if FAIL, apply repairs and rerun.",
    "If child.needs_split=true, enqueue child.",
    "If child is leaf, run Leaf Spec Builder.",
    "Finish when queue is empty and all leaves have specs.",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build prompt bundle for PRD domain proving workflow.")
    parser.add_argument("--prd", help="PRD text inline")
    parser.add_argument("--prd-file", help="Path to file containing PRD text")
    parser.add_argument("--node-scope", default="root", help="Current node scope label")
    parser.add_argument(
        "--output",
        default="-",
        help="Output path for JSON bundle (default: stdout)",
    )
    return parser.parse_args()


def read_prd(args: argparse.Namespace) -> str:
    if bool(args.prd) == bool(args.prd_file):
        raise ValueError("Provide exactly one of --prd or --prd-file.")
    if args.prd:
        return args.prd.strip()
    return Path(args.prd_file).read_text(encoding="utf-8").strip()


def main() -> int:
    args = parse_args()
    prd = read_prd(args)
    bundle = {
        "node_scope": args.node_scope,
        "prompts": {
            "decomposer": DECOMPOSER_TEMPLATE.format(prd=prd, node_scope=args.node_scope),
            "prover": PROVER_TEMPLATE,
            "leaf_builder": LEAF_TEMPLATE,
        },
        "workflow": WORKFLOW_STEPS,
    }

    output = json.dumps(bundle, ensure_ascii=False, indent=2)
    if args.output == "-":
        print(output)
        return 0

    Path(args.output).write_text(output, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
