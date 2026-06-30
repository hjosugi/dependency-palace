# Startup And Example Payload Performance

Labels: `performance`, `viewer`, `examples`, `priority:P0`, `status:ready`

## Problem

The viewer must feel light even though it can explore thousands of symbols. Large examples and generated graphs should not make the first screen sluggish.

Recent work replaced the heavy startup demo with a tiny starter graph and trimmed large example member payloads, but more remains.

## Goal

Make startup and example switching consistently fast on ordinary laptops.

## Scope

- Keep the starter graph tiny.
- Load heavy examples only on explicit click.
- Add payload size reporting for each example.
- Add gzip/brotli size notes for production hosting.
- Avoid parsing large JSON on the main thread where possible.
- Add a loading state for large example fetch and normalization.
- Consider splitting graph payload into summary + detail chunks.

## Acceptance Criteria

- Initial app startup does not generate a multi-thousand node graph.
- Example index stays below 20 KB uncompressed.
- Stress example can load without locking the UI for more than one noticeable pause.
- Performance notes are documented in `docs/examples.md`.
- Visual verification still loads tiny and stress examples.

## Notes

The long-term fix likely overlaps with worker-owned graph parsing and binary graph format issues.
