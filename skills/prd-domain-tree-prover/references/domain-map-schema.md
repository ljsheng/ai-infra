# Domain Map Schema

Use this canonical JSON shape for deterministic validation.

```json
{
  "R": ["r1", "r2"],
  "S": ["s1", "s2"],
  "E": ["e1", "e2"],
  "P": ["p1", "p2"],
  "capability_closure": {
    "required": ["identity", "catalog", "cart", "checkout_order", "payment", "entitlement_delivery"],
    "forbidden": ["logistics"],
    "evidence": {
      "identity": ["R:r_user_login", "S:s_user_state", "E:e_user_registered"],
      "catalog": ["R:r_browse", "S:s_product", "E:e_product_published"]
    },
    "forbidden_evidence": {
      "logistics": []
    }
  },
  "domains": [
    {
      "id": "d1",
      "name": "domain name",
      "responsibility": "single sentence",
      "members": {
        "R": ["r1"],
        "S": ["s1"],
        "E": ["e1"],
        "P": ["p1"]
      },
      "writers": {
        "s1": "d1"
      },
      "producers": {
        "e1": "d1"
      }
    }
  ],
  "merge_blockers": [
    {
      "a": "d1",
      "b": "d2",
      "violates": ["H2", "H4"],
      "reason": "why merging these two violates hard constraints"
    }
  ],
  "shared_write_models": []
}
```

## Validation Semantics

- C0 capability-closure:
  - every capability in `required` has at least one valid typed evidence ref (`R:id|S:id|E:id|P:id`)
  - forbidden capabilities have no evidence
  - forbidden capabilities must not appear in domain names or domain responsibilities
- C1 completeness:
  - every item in R/S/E/P appears in exactly one domain members bucket
- C2 orthogonality:
  - for each s in S, exactly one writer
  - for each e in E, exactly one producer
  - `shared_write_models` must stay empty
- C3 minimality:
  - no empty domain
  - every domain pair must have at least one `merge_blockers` entry with `H1..H5`

## Hard Constraints

- H1 invariant conflict
- H2 lifecycle conflict
- H3 compliance/audit conflict
- H4 fault-isolation conflict
- H5 permission-boundary conflict
