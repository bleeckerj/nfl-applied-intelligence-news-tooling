# Integration Plan: Drafting → Issue Assembly → Print Layout

## Goal
Create a flexible, repeatable workflow that:
- lets us choose from multiple templates/modules per issue,
- declares required content slots up front,
- supports mixed sources (generated drafts, curated drafts, hand-written),
- compiles into print-ready JSON for `nfl-news-tooling`.

## Core Idea
Introduce a middle artifact: **Issue Assembly JSON**.  
It enumerates which page templates/modules are used in a specific issue and defines
all **slots** that must be filled (including bespoke content like puzzles/cartoons/ads).

The assembly drives a **content needs report**, which then drives drafting and curation.

## Artifacts and Ownership
- Drafting engine (source of drafts): `nfl-remember-the-future`
- Layout compiler (source of templates/CSS): `nfl-news-tooling`
- Bridge artifact: `issue-assembly.json` (lives in `nfl-news-tooling/content/`)
- Final layout input: `content/issue.json` (lives in `nfl-news-tooling/content/`)

## Inventory Model
Maintain a library of **templates** and **modules**, grouped by content type:
- `newspaper_1`, `newspaper_2`
- `magazine_1`, `magazine_2`
- `catalog_1`, `catalog_2`

Each template/module defines:
- `id` (stable identifier)
- `slots[]` (each slot has type, size, copy budget, and optional constraints)

Example module types:
- `lead`, `briefs`, `opinion`, `review`, `ad`, `classifieds`, `cartoon`, `puzzle`

## Issue Assembly JSON (proposed shape)
```
{
  "issue_id": "2025-10-15",
  "templates": [
    { "template_id": "frontpage_v1", "page_id": "p1" },
    { "template_id": "inside_v1", "page_id": "p2" },
    { "template_id": "inside_v1", "page_id": "p3" },
    { "template_id": "backpage_v1", "page_id": "p4" }
  ],
  "slots": [
    {
      "slot_id": "p1.lead",
      "type": "lead",
      "module_id": "lead_story",
      "copy_budget": { "headline_chars": 70, "dek_words": 24, "body_words": 650 }
    },
    {
      "slot_id": "p1.ad_1",
      "type": "ad",
      "module_id": "ad_halfpage",
      "copy_budget": { "headline_chars": 40, "body_words": 120 }
    },
    {
      "slot_id": "p4.puzzle",
      "type": "puzzle",
      "module_id": "puzzle_small",
      "copy_budget": { "body_words": 80 }
    }
  ]
}
```

## Content Needs Report (derived)
Given `issue-assembly.json`, produce a report like:
- slot_id, type, size, copy budget
- required assets (image size, illustration, ad artwork)
- eligible sources (generated drafts, curated, hand-written)

This report is the checklist for drafting and curation.

## Draft Sourcing Modes
Each slot can be filled by one of:
- `generated` (from `nfl-remember-the-future` drafts)
- `curated` (selected from draft pool)
- `manual` (hand-written or external copy)

### Draft mapping
Maintain a simple mapping file (or embed in `issue-assembly.json`):
```
{
  "slot_id": "p1.lead",
  "source": "generated",
  "draft_id": "07",
  "draft_path": "../nfl-remember-the-future/projects/issue-2025/drafts/07_city-imagination.md"
}
```

## Pipeline (Recommended Hybrid)
1) **Select templates/modules** for the issue → write `issue-assembly.json`
2) **Generate content needs report** from assembly
3) **Draft + curate** using `nfl-remember-the-future`
4) **Map drafts to slots** (assignment file or inline)
5) **Export to print JSON** (`content/issue.json`)
6) **Compile** via `npm run build`

## Open Decisions (Resolved)
- `issue-assembly.json` lives in a **shared** location.
- Slot assignments live in a **separate mapping file**.
- Copy budgets **warn by default** to allow flexibility.

## Next Steps
1) Define the template/module inventory for v1 (front, inside, back).
2) Formalize the `issue-assembly.json` schema.
3) Add a small script to generate the content needs report.
4) Add a mapper that compiles assignments into `content/issue.json`.

## Implementation Plan
1) **Define v1 template inventory**
   - List templates/modules and their slots, copy budgets, and asset requirements.
   - Store as a simple JSON (or YAML) in `templates/` for lookup by scripts.
2) **Add `issue-assembly.json` schema**
   - Specify templates, slots, and optional assignments.
   - Include validation rules for required fields and slot types.
3) **Build `content-needs` generator**
   - Read `issue-assembly.json` + inventory definitions.
   - Emit a report (JSON + readable Markdown).
4) **Add slot assignment mapping**
   - Accept a mapping file or inline `assignments[]` in `issue-assembly.json`.
   - Validate draft paths + required fields per slot type.
5) **Add export step to print JSON**
   - Compile `content/issue.json` from assignments.
   - Enforce copy budgets (warn by default, optional fail).
6) **Wire scripts to npm**
   - `npm run needs` → content needs report
   - `npm run export` → assemble `content/issue.json`

## Test Plan
- **Schema validation**
  - Invalid `issue-assembly.json` fails with clear errors.
  - Unknown `template_id` or `module_id` is rejected.
- **Inventory mapping**
  - Slot definitions resolve correctly from template/module inventory.
  - Missing slot definitions produce actionable errors.
- **Content needs report**
  - Report lists every slot with type, copy budget, and asset needs.
  - Report output is deterministic for a given assembly.
- **Assignment validation**
  - Missing required fields for a slot (e.g., `headline`) is flagged.
  - Wrong source type or missing draft file fails fast.
- **Export to print JSON**
  - Generated `content/issue.json` matches expected shape for templates.
  - Copy budget warnings are emitted when limits are exceeded.
- **Smoke build**
  - `npm run build` succeeds using exported `content/issue.json`.
