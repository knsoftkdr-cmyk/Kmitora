# KMITORA hardening baseline - 2026-09-20

This baseline consolidates the prior source-scope, staging-count, storage-quota, universal-business-logic, and multi-format-discovery changes.

## Permanent regression prevention
- File discovery is recursive, not top-folder-only.
- Discovery no longer requires CSV. Supported file types are CSV, TSV, TXT, XML, JSON, JSONL, XLSX, XLSM.
- Physical partition files such as `*_part1.csv`, `*_part2.xml`, `*_part3.txt` are merged into one logical source entity.
- Source lineage (`source_files`) is preserved.
- Frontend normalizes all file-source aliases to API contract `type=file` and trims `filePath` before test/create.
- Regression tests verify nested multi-format discovery and explicitly verify that zero CSV files is valid.
- Source remains read-only; target mutation remains DEV-governed; production cutover remains disabled.
