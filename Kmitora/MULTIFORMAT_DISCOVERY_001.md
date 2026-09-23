# KMITORA MULTI-FORMAT-DISCOVERY-001

Fixes Unified Discovery when a File System source root contains nested CSV, TXT, XML, XLSX/XLSM partitions.

## Changes
- Replaces top-level-only `glob("*.csv")` discovery with recursive supported-file discovery.
- Supports CSV, TSV, TXT, XML, XLSX and XLSM in the authoritative Main API file-source discovery path.
- Consolidates physical partitions named `*_part1`, `*_part2`, `*_part3`, etc. into one logical entity.
- Preserves physical source file lineage in `source_files`.
- Fails closed if no supported files are found.

## Verified against address test pack
- `customer_master`: 1,000 rows from CSV + XML + TXT.
- `address_history`: 2,850 rows from CSV + XML + TXT.
- Total physical source rows understood: 3,850.
