# KMITORA Permanent Discovery Hardening

Integrated into the normal KMITORA main code path.

Guards:
- recursive multi-format discovery for CSV/TSV/TXT/XML/JSON/JSONL/XLSX/XLSM
- connected file sources re-resolve their configured root on every discovery run
- no CSV-only prerequisite
- physical partitions consolidate into logical entities
- authoritative full row counts are independent of preview row limits
- a failed rerun does not erase the last successful discovery in the UI
- source lineage is preserved
- regression test explicitly validates zero-CSV sources

Expected ADDRESS_1000 logical totals:
- customer_master: 1000
- address_history: 2850
- total rows: 3850
