# Binary Graph Format For Large Repositories

Labels: `performance`, `graph-format`, `large-repos`, `priority:P1`, `status:ready`

## Problem

Large JSON graphs are easy to inspect but heavy to parse and transfer. Stress examples already reach multi-megabyte payloads.

## Goal

Design and implement an optional compact graph format for large repositories.

## Scope

- Keep JSON as the portable baseline.
- Add a binary or chunked format for large generated graphs.
- Separate string table, nodes, links, members, and metadata.
- Support streaming or progressive loading.
- Measure parse time, transfer size, and memory usage.

## Acceptance Criteria

- JSON graphs still load.
- Large binary/chunked graph loads faster than equivalent JSON in benchmark.
- Format is documented.
- CLI can emit both JSON and compact format.
