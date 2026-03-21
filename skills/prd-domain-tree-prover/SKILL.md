---
name: prd-domain-tree-prover
description: Recursive domain decomposition and formal verification for product requirements (PRD). Use when Codex needs to turn a PRD into a minimal domain tree, enforce C1/C2/C3 constraints, prove owner/writer/producer uniqueness, and produce code-ready leaf domain specs.
---

# PRD Domain Tree Prover

Use this skill to recursively decompose a PRD into minimal leaf domains that are ready for code generation. Apply formal constraints C1 (Completeness), C2 (Orthogonality), and C3 (Minimality) at each split level.

Tree depth is not fixed. Always start from the root node and recurse until all resulting nodes satisfy the leaf criteria. Different PRD inputs can produce different decomposition depths.

## Inputs

- PRD text.
- Optional output constraint (for example: strict table format only).
- Optional existing candidate map to refine.

## Workflow

0. Run capability-closure gate for the current node.
   - Determine scenario profile (for example: digital ecommerce).
   - Build required capabilities and forbidden capabilities for the node scope.
   - Map each required capability to evidence references in `R/S/E/P`.
   - If any required capability has no valid evidence, return `NOT_PROVABLE` with missing facts.
1. Normalize the PRD into atomic facts and extract `R`, `S`, `E`, `P`, then `U = R union S union E union P`.
2. Build a candidate split for the current node and assign:
   - `owner(u)` for every `u in U`
   - `writers(s)` for each state `s`
   - `producers(e)` for each event `e`
3. Repair until all pass:
   - C1: full coverage over `U`
   - C2: unique writer for state, unique producer for event, contract-only cross-domain interaction
4. Run minimality checks:
   - deletion test for each domain
   - merge test for each pair
   - enforce hard constraints `H1..H5`
5. For each resulting domain, decide leaf or split:
   - If leaf criteria pass, emit a code-ready leaf spec.
   - If not, recurse with this domain as the new parent node.
6. Stop when all leaves satisfy the leaf criteria and no further safe split exists.

## Leaf Criteria

Treat a domain as leaf only if all are true:

- Exactly one write owner per state.
- Exactly one producer per event.
- Invariants are closed in-domain.
- Lifecycle strategy is internally consistent (timeouts/compensation).
- Independent least-privilege boundary can be defined.
- External API/Event contract is complete enough for implementation.
- Further split would force cross-domain transaction coupling or break invariants.

## Output Strategy

- If user forces a strict format, comply exactly with that format.
- If no strict format is given, output in two sections:
  1. Full domain tree summary across all recursion levels (root to leaves).
  2. Leaf implementation specs for code generation.
- The two sections above are an output presentation format, not a constraint on tree depth.
- If proof cannot be completed with available information, return `NOT_PROVABLE` and list missing facts.

## Use Bundled Resources

- Prompt templates and recursion loop:
  - `references/prompt-templates.md`
- Formal data contracts and validation rules:
  - `references/domain-map-schema.md`
- Prompt bundle generator:
  - `scripts/build_prompt_bundle.py`
- Candidate map validator for C1/C2/C3 checks:
  - `scripts/validate_domain_map.py`

## Execution Notes

- Keep formal derivation internal unless the user explicitly asks to see proofs.
- Never invent logistics subdomains when PRD declares digital-only delivery.
- Prefer event contracts between domains; avoid shared writable internal models.
- Treat C1 as valid only after capability-closure is satisfied for the current node.
- If PRD is too terse to prove capability-closure, return `NOT_PROVABLE` instead of silently dropping core capabilities.
