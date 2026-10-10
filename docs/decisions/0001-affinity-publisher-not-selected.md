# Decision 0001: Affinity Publisher Is Not the Current Replacement Target

Date: 2026-03-18

## Status

Accepted

## Decision

Do not use Affinity Publisher as the next backend evaluation target for this repo.

The repo will continue using Adobe InDesign as the production backend while evaluating QuarkXPress desktop as the next serious replacement candidate.

## Why

This repo is optimizing for:

- structured data to named-slot template ingest
- repeatable export from the terminal
- minimal manual layout work after data preparation
- production-oriented print output

Affinity Publisher is credible for manual production work, but it is not currently a good fit for this repo's automation model.

## Basis

- Affinity Publisher offers useful manual-production features such as data merge, preflight, and PDF/X export.
- However, its current scripting story is insufficient for the workflow this repo wants.
- Operator-led data merge is not enough; the requirement is a scriptable ingest path into visual templates with deterministic export.

## What This Means

- Affinity Publisher is considered automation-insufficient for now.
- The repo should not be reworked around Affinity-specific data merge assumptions.
- The stable interface remains assignment schema `2.0`, template manifests, and named-slot concepts.
- Future backend work should preserve that interface and plug in backend-specific runners beneath it.

## Revisit Conditions

Revisit this decision only if one of these becomes true:

- Affinity ships usable desktop scripting or API support.
- Affinity ships a reliable headless or externally automatable export path.
- A hands-on spike shows Affinity can achieve the repo's workflow goals with materially less operator time than InDesign.
