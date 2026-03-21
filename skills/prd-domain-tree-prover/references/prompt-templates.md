# Prompt Templates

Use these templates as a 3-agent loop: `Decomposer -> Prover -> Leaf Builder`.

## 1) Recursive Decomposer Prompt

```text
You are Domain Tree Decomposer.

Input:
- PRD: {{PRD_TEXT}}
- Current node: {{NODE_SCOPE}}
- Constraints: C1/C2/C3, H1..H5
- Leaf criteria: L1..L7

Task:
0. Build capability-closure checklist for current node:
   - required_capabilities
   - forbidden_capabilities
   - evidence mapping to typed refs (R:id / S:id / E:id / P:id)
   If any required capability lacks evidence, return NOT_PROVABLE with missing facts.
1. Extract R/S/E/P for current node, define U = R U S U E U P.
2. Propose candidate child domains D = {d1..dn}.
3. Assign owner(u), writers(s), producers(e).
4. Self-repair until C1/C2 pass.
5. Mark each child as leaf or needs_split.

Output only JSON:
{
  "domain_id": "{{NODE_SCOPE}}",
  "capability_closure": {
    "required": [],
    "forbidden": [],
    "evidence": {},
    "forbidden_evidence": {}
  },
  "children": [
    {
      "id": "d1",
      "name": "...",
      "responsibility": "...",
      "R": [],
      "S": [],
      "E": [],
      "P": [],
      "writers": {},
      "producers": {},
      "contracts": {"apis": [], "events_out": [], "events_in": []},
      "needs_split": true,
      "stop_reason": ""
    }
  ]
}
```

## 2) Formal Prover Prompt

```text
You are Domain Map Formal Prover.

Input:
- candidate_json
- constraints C1/C2/C3
- hard constraints H1..H5

Task:
0. Verify C0 capability-closure:
   - every required capability has >=1 valid evidence typed ref
   - forbidden capabilities have no evidence
   - if C0 fails, verdict is NOT_PROVABLE
1. Verify C1: completeness + unique owner.
2. Verify C2: unique writer per state, unique producer per event.
3. Verify C3:
   - deletion test for each domain
   - merge test for each pair
   - ensure every merge is blocked by >=1 hard constraint from H1..H5
4. If failed, output minimal repair actions.

Output only JSON:
{
  "result": "PASS|FAIL|NOT_PROVABLE",
  "violations": [],
  "repairs": [],
  "missing_facts": []
}
```

## 3) Leaf Spec Builder Prompt

```text
You are Leaf Domain Spec Builder.

Input:
- leaf domain JSON

Task:
- Build implementation-ready spec for code generation.

Output only JSON:
{
  "leaf_id": "...",
  "bounded_context": "...",
  "entities": [],
  "state_machine": {"states": [], "transitions": []},
  "commands": [],
  "events": [],
  "apis": [
    {"method": "", "path": "", "req_schema": {}, "resp_schema": {}}
  ],
  "storage": {"tables": [], "indexes": []},
  "tests": {"unit": [], "contract": [], "e2e": []}
}
```

## 4) Orchestration Loop

```text
queue <- [root(PRD)]
tree <- {}

while queue not empty:
  node <- pop(queue)
  candidate <- run(Decomposer, node)
  if candidate indicates NOT_PROVABLE:
    return NOT_PROVABLE with missing facts for node

  verdict <- run(Prover, candidate)
  if verdict == NOT_PROVABLE:
    return verdict

  while verdict == FAIL:
    candidate <- apply_repairs(candidate, verdict.repairs)
    verdict <- run(Prover, candidate)

  save(tree, candidate)
  for child in candidate.children:
    if child.needs_split:
      queue.push(child)
    else:
      leaf_spec <- run(Leaf Spec Builder, child)
      save_leaf_spec(tree, leaf_spec)

return tree
```

## 5) Leaf Criteria (L1..L7)

- L1 one writer per state
- L2 one producer per event
- L3 invariant closure within domain
- L4 lifecycle consistency within domain
- L5 independent least-privilege boundary
- L6 complete external contracts
- L7 further split would introduce cross-domain transaction coupling or break invariants
