# QuarkXPress Feasibility Spike

## Goal

Evaluate whether QuarkXPress desktop can replace Adobe InDesign for this repo's structured-data-first production workflow.

This is a constrained feasibility spike, not a migration commitment.

## Stable Interface to Preserve

The spike must preserve these repo-level concepts:

- assignment schema `2.0`
- named template slots
- template manifests
- backend-specific ingest/export runner pattern

The spike should adapt Quark to the existing contract. It should not redesign the repo around Quark-specific data structures.

## Minimum Backend Adapter Spec

The candidate backend must demonstrate all of the following:

1. Open a visual print template.
2. Resolve named or otherwise stable template-addressable slots.
3. Place text into those slots from assignment JSON.
4. Place local and remote images from assignment JSON.
5. Apply styles or equivalent template-driven formatting.
6. Export a deterministic, print-ready PDF.

## Test Artifact

Use one representative artifact that exercises the current production model:

- at least one multipage newspaper-like template or card-sheet template
- text slots
- image slots
- style application
- PDF export

Prefer a template that already exists in the current InDesign flow so the comparison stays honest.

## Acceptance Criteria

QuarkXPress passes the spike only if it can show:

- scriptable or API-driven slot resolution
- low-manual-intervention placement of text and images
- repeatable export from a commandable workflow
- support for production print concerns such as color-managed export and PDF/X-class output
- a reasonable migration path from current `.indt`-style template thinking
- total operator time that is materially better than simply staying on InDesign

## Failure Criteria

Stop the replacement effort if any of these are true:

- the normal path depends on operator-led data merge and cleanup
- slot addressing is unreliable or too tool-specific to stabilize
- export cannot be automated consistently
- production output quality falls below the current InDesign baseline
- setup or licensing cost outweighs the workflow gain

## Evaluation Log Template

Record the spike in this format:

| Area | Result | Notes |
| :--- | :--- | :--- |
| Template addressing | pass/fail | How were slots identified? |
| Text placement | pass/fail | Any manual intervention? |
| Image placement | pass/fail | Local/remote behavior |
| Style application | pass/fail | Template-driven or scripted? |
| PDF export | pass/fail | Output settings and repeatability |
| Print controls | pass/fail | Color, bleed, PDF/X, overprint |
| Operator time | pass/fail | Compare against current InDesign path |
| Migration effort | pass/fail | Template rewrite burden |
| Cost fit | pass/fail | Worth replacing an already-paid InDesign seat? |

## Decision Branches

- If QuarkXPress desktop passes cleanly, proceed to a deeper backend adapter design.
- If QuarkXPress desktop is technically viable but operationally heavy, evaluate whether QuarkXPress Server is justified.
- If QuarkXPress desktop fails the spike, remain on InDesign and treat Quark as rejected for this repo's needs.

## Explicit Non-Goals

- Do not evaluate Affinity Publisher in this spike.
- Do not migrate to Antenna House or Prince in this phase.
- Do not change the assignment schema as part of the spike.
