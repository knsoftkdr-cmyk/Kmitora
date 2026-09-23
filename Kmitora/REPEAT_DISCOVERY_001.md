# KMITORA REPEAT-DISCOVERY-001

Fixes repeated Unified Discovery for connected file sources.

- Connected file sources are re-read from their configured root on every run.
- Recursive multi-format reader is used for CSV/TXT/XML/JSON/XLSX partitions.
- Preview row limits no longer become source population counts.
- Partitioned files are normalized into logical source entities in the UI.
- Failed reruns preserve the last successful discovery result instead of blanking the page.
- Validated against the 1000-customer address pack: customer_master=1000, address_history=2850, total=3850.
